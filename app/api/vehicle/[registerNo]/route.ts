import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic';
// ─── Data Masking Helpers ──────────────────────────────────────────

/** ชื่อ → แสดงเต็ม, นามสกุล → *** */
function maskName(firstName?: string, lastName?: string): { FirstName: string; LastName: string } {
  return {
    FirstName: firstName || '-',
    LastName: lastName ? '***' : '-',
  }
}

/** ชื่อเต็ม "สมชาย ใจดี" → "สมชาย ***" */
function maskFullName(fullName?: string): string {
  if (!fullName) return '-'
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return parts[0]
  return `${parts[0]} ***`
}

/** เบอร์โทร → แสดงเฉพาะ 4 ตัวท้าย เช่น ***-1234 */
function maskPhone(phone?: string): string {
  if (!phone) return '-'
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 4) return phone
  return `***-${digits.slice(-4)}`
}

/** ลบ field ที่เป็นเลขบัตรประชาชน / ID card ออก */
function stripSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['IDCard', 'IdCard', 'idcard', 'ID_Card', 'CitizenID', 'citizenId', 'NationalID', 'nationalId', 'PersonalID', 'personalId']
  const cleaned = { ...obj }
  for (const key of sensitiveKeys) {
    delete cleaned[key]
  }
  // Also strip any field that looks like a 13-digit Thai ID
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === 'string' && /^\d{13}$/.test(value.replace(/\D/g, ''))) {
      delete cleaned[key]
    }
  }
  return cleaned
}

function maskDriverName(driverName?: string): string {
  if (!driverName) return '-'
  const trimmed = driverName.trim()
  if (trimmed === 'รถใหม่ยังไม่มีเจ้าของ' || trimmed === 'รถทดแทน') return trimmed
  
  const parts = trimmed.split(/\s+/)
  if (parts.length === 0) return '-'
  
  if (parts[0] === 'คุณ' && parts.length > 1) {
    const firstName = parts[1]
    const remaining = parts.slice(2)
    if (remaining.length === 0) {
      return `คุณ ${firstName}`
    }
    const maskedRemaining = remaining.map(part => {
      if (part === 'คืนรถ') return 'คืนรถ'
      return '***'
    }).join(' ')
    return `คุณ ${firstName} ${maskedRemaining}`
  } else {
    const firstName = parts[0]
    const remaining = parts.slice(1)
    if (remaining.length === 0) return firstName
    const maskedRemaining = remaining.map(part => {
      if (part === 'คืนรถ') return 'คืนรถ'
      return '***'
    }).join(' ')
    return `${firstName} ${maskedRemaining}`
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { registerNo: string } }
) {
  try {
    const identifier = decodeURIComponent(params.registerNo).trim()
    console.log(`[Vehicle API] Querying for identifier: "${identifier}"`)
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // 1. ดึงข้อมูลรถหลัก
    const carReq = pool.request()
    carReq.input('identifier', sql.NVarChar, `%${identifier}%`)
    const carResult = await carReq.query(`
      SELECT TOP 1
        InventoryItemID, VinNo, MotorNo, RegisterNo, Model,
        Project, ProjectType, Company, Status AS StatusCode, StatusType,
        Exterior_Color, Interior_Color, IsActive
      FROM dbo.EV_InventoryItem
      WHERE (RegisterNo LIKE @identifier OR VinNo LIKE @identifier) AND IsActive = 1
    `)

    if (carResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรถทะเบียนนี้' }, { status: 404 })
    }

    const car = carResult.recordset[0]

    // 2. ดึงประวัติสัญญาเช่าทั้งหมด
    const rentReq = pool.request()
    rentReq.input('inventoryItemId', sql.Int, car.InventoryItemID)
    const rentResult = await rentReq.query(`
      SELECT
        RentItemID, ContractNo, ContractType,
        FirstName, LastName, PhoneNo,
        ExpectedReleaseDate, ReleaseDate,
        ContractCancellationDate, IsActive
      FROM dbo.EV_RentItem
      WHERE InventoryItemID = @inventoryItemId
      ORDER BY ExpectedReleaseDate DESC, ReleaseDate DESC
    `)

    // 3. ดึงประวัติซ่อมทั้งหมด (ใช้ SP ที่ return description แทน code)
    const maintReq = pool.request()
    maintReq.input('inventoryItemId', sql.Int, car.InventoryItemID)
    const maintResult = await maintReq.query(`
      SELECT
        m.MaintenanceItemID, m.ReportDate, m.IncidentDate,
        m.MaintenanceStartDate, m.MaintenanceFinishDate, m.MaintenanceReturnDate,
        m.CarStatusCode, m.IssueTitle,
        m.ProblemTypeCode, m.FaultPartyCode, m.CarCaseCode,
        m.ServiceLocationCode, m.InsuranceCode,
        m.FollowUpDetail, m.IsActive,
        m.DriverName, m.RootCauseFound, m.FixAction,
        m.LastFollowUpDate, m.ParentMaintenanceItemID,
        m.CreateDate, m.UpdateDate, m.CreateUserID, m.UpdateUserID
      FROM dbo.EV_MaintenanceItem m
      WHERE m.InventoryItemID = @inventoryItemId
      ORDER BY m.ReportDate DESC
    `)

    // 4. ดึงรถทดแทน (ถ้ามี) สำหรับแต่ละงานซ่อม
    const maintIds = maintResult.recordset.map((m: { MaintenanceItemID: number }) => m.MaintenanceItemID)
    let replacements: Record<number, unknown[]> = {}

    if (maintIds.length > 0) {
      const replReq = pool.request()
      const idList = maintIds.map((_: number, i: number) => `@mid${i}`).join(',')
      maintIds.forEach((id: number, i: number) => {
        replReq.input(`mid${i}`, sql.Int, id)
      })
      const replResult = await replReq.query(`
        SELECT
          ReplacementItemID, MaintenanceItemID, VinNo,
          ReplacementStartDate, ReplacementReturnDate,
          Location, Remark, IsActive
        FROM dbo.EV_ReplacementItem
        WHERE MaintenanceItemID IN (${idList})
        ORDER BY ReplacementStartDate DESC
      `)

      for (const r of replResult.recordset) {
        if (!replacements[r.MaintenanceItemID]) {
          replacements[r.MaintenanceItemID] = []
        }
        replacements[r.MaintenanceItemID].push(r)
      }
    }

    // 5. ดึงประวัติรับคืน
    const returnReq = pool.request()
    returnReq.input('vinNo', sql.NVarChar, car.VinNo)
    const returnResult = await returnReq.query(`
      SELECT
        r.ReturnItemID, r.VinNo, r.CustomerName, r.Model, rent.ContractNo,
        r.ReceiveDate, r.ReturnDate, r.Mileage, r.ParkLocation
      FROM dbo.EV_ReturnItem r
      LEFT JOIN dbo.EV_RentItem rent ON r.RentItemID = rent.RentItemID
      WHERE r.VinNo = @vinNo
      ORDER BY r.ReturnDate DESC
    `)

    // ─── Apply Data Masking ────────────────────────────────────
    const maskedCar = stripSensitiveFields(car)
 
    const activeRentRow = rentResult.recordset.find((r: any) => r.IsActive === true)
    const maskedRent = activeRentRow
      ? {
          ...stripSensitiveFields(activeRentRow),
          ...maskName(activeRentRow.FirstName, activeRentRow.LastName),
          PhoneNo: maskPhone(activeRentRow.PhoneNo),
        }
      : null

    const rentHistory = rentResult.recordset.map((r: any) => ({
      ...stripSensitiveFields(r),
      ...maskName(r.FirstName, r.LastName),
      PhoneNo: maskPhone(r.PhoneNo),
    }))

    // ─── Code → Description mapping ─────────────────────────────
    const carStatusMap: Record<string, string> = {
      'COMPLETE': 'ซ่อมเสร็จ',
      'IN_MAINTENANCE': 'อยู่ระหว่างการซ่อม',
      'WAITING_FOR_MAINTENANCE': 'รอเข้าซ่อม',
      'STILL_WORK': 'ยังวิ่งอยู่',
    }
    const problemTypeMap: Record<string, string> = {
      'PRODUCT': 'ผลิตภัณฑ์',
      'ACCIDENT': 'อุบัติเหตุ',
      'USAGE': 'การใช้งาน',
      'WEAR': 'สึกหรอ',
    }
    const faultPartyMap: Record<string, string> = {
      'DRIVER': 'คนขับ',
      'COUNTERPART': 'คู่กรณี',
      'OTHER': 'อื่นๆ',
      'MANUFACTURER': 'ผู้ผลิต',
    }
    const carCaseMap: Record<string, string> = {
      'DAMAGE_LIGHT': 'เคสซ่อมเบา',
      'DAMAGE_HEAVY': 'เคสซ่อมหนัก',
    }
    const insuranceMap: Record<string, string> = {
      'ICARE_INSURANCE': 'ไอแคร์ประกันภัย',
      'NO_INSURANCE': 'ไม่มีประกัน',
    }

    const mapCode = (code: unknown, map: Record<string, string>): string => {
      const s = (code as string) || ''
      return map[s] || s.replace(/_/g, ' ') || '-'
    }

    const maintenance = maintResult.recordset.map((m: Record<string, unknown>) => ({
      ...stripSensitiveFields(m),
      DriverName: maskDriverName(m.DriverName as string),
      ProblemTypeDescription: mapCode(m.ProblemTypeCode, problemTypeMap),
      FaultParty: mapCode(m.FaultPartyCode, faultPartyMap),
      CarCase: mapCode(m.CarCaseCode, carCaseMap),
      ServiceLocation: ((m.ServiceLocationCode as string) || '-').replace(/_/g, ' '),
      Insurance: mapCode(m.InsuranceCode, insuranceMap),
      CarStatusDescription: carStatusMap[m.CarStatusCode as string] || (m.CarStatusCode as string) || '-',
      replacements: replacements[m.MaintenanceItemID as number] || [],
    }))

    const maskedReturns = returnResult.recordset.map((r: Record<string, unknown>) => ({
      ...stripSensitiveFields(r),
      CustomerName: maskFullName(r.CustomerName as string),
    }))

    return NextResponse.json({
      car: maskedCar,
      currentRent: maskedRent,
      rentHistory,
      maintenance,
      returns: maskedReturns,
    })
  } catch (error) {
    console.error('[Vehicle API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
