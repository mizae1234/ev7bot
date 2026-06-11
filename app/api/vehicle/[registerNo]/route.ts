import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

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

export async function GET(
  req: NextRequest,
  { params }: { params: { registerNo: string } }
) {
  try {
    const registerNo = decodeURIComponent(params.registerNo)
    console.log(`[Vehicle API] Querying for registerNo: "${registerNo}" (raw params: "${params.registerNo}")`)
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // 1. ดึงข้อมูลรถหลัก
    const carReq = pool.request()
    carReq.input('registerNo', sql.NVarChar, `%${registerNo}%`)
    const carResult = await carReq.query(`
      SELECT TOP 1
        InventoryItemID, VinNo, MotorNo, RegisterNo, Model,
        Project, ProjectType, Company, Status AS StatusCode, StatusType,
        Exterior_Color, Interior_Color, IsActive
      FROM dbo.EV_InventoryItem
      WHERE RegisterNo LIKE @registerNo AND IsActive = 1
    `)

    if (carResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรถทะเบียนนี้' }, { status: 404 })
    }

    const car = carResult.recordset[0]

    // 2. ดึงข้อมูลสัญญาเช่าปัจจุบัน
    const rentReq = pool.request()
    rentReq.input('inventoryItemId', sql.Int, car.InventoryItemID)
    const rentResult = await rentReq.query(`
      SELECT TOP 1
        RentItemID, ContractNo, ContractType,
        FirstName, LastName, PhoneNo,
        ExpectedReleaseDate, ReleaseDate,
        ContractCancellationDate, IsActive
      FROM dbo.EV_RentItem
      WHERE InventoryItemID = @inventoryItemId AND IsActive = 1
      ORDER BY ReleaseDate DESC
    `)

    // 3. ดึงประวัติซ่อมทั้งหมด (ล่าสุดก่อน)
    const maintReq = pool.request()
    maintReq.input('inventoryItemId', sql.Int, car.InventoryItemID)
    const maintResult = await maintReq.query(`
      SELECT
        MaintenanceItemID, ReportDate, IncidentDate,
        MaintenanceStartDate, MaintenanceFinishDate, MaintenanceReturnDate,
        CarStatusCode, IssueTitle, ProblemTypeCode AS ProblemTypeDescription,
        FaultPartyCode AS FaultParty, CarCaseCode AS CarCase, 
        ServiceLocationCode AS ServiceLocation, InsuranceCode AS Insurance,
        FollowUpDetail, IsActive
      FROM dbo.EV_MaintenanceItem
      WHERE InventoryItemID = @inventoryItemId
      ORDER BY ReportDate DESC
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

    const maskedRent = rentResult.recordset[0]
      ? {
          ...stripSensitiveFields(rentResult.recordset[0]),
          ...maskName(rentResult.recordset[0].FirstName, rentResult.recordset[0].LastName),
          PhoneNo: maskPhone(rentResult.recordset[0].PhoneNo),
        }
      : null

    const maintenance = maintResult.recordset.map((m: Record<string, unknown>) => ({
      ...stripSensitiveFields(m),
      replacements: replacements[m.MaintenanceItemID as number] || [],
    }))

    const maskedReturns = returnResult.recordset.map((r: Record<string, unknown>) => ({
      ...stripSensitiveFields(r),
      CustomerName: maskFullName(r.CustomerName as string),
    }))

    return NextResponse.json({
      car: maskedCar,
      currentRent: maskedRent,
      maintenance,
      returns: maskedReturns,
    })
  } catch (error) {
    console.error('[Vehicle API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
