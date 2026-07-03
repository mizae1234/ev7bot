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
        i.InventoryItemID, i.VinNo, i.MotorNo, i.RegisterNo, i.Model,
        i.Project, i.ProjectType, i.Company, i.Status AS StatusCode, i.StatusType,
        i.Exterior_Color, i.Interior_Color, i.IsActive,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      WHERE (i.RegisterNo LIKE @identifier OR i.VinNo LIKE @identifier) AND i.IsActive = 1
    `)

    if (carResult.recordset.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรถทะเบียนนี้' }, { status: 404 })
    }

    const car = carResult.recordset[0]

    // Prepare requests
    const rentReq = pool.request()
    rentReq.input('inventoryItemId', sql.Int, car.InventoryItemID)

    const maintReq = pool.request()
    maintReq.input('inventoryItemId', sql.Int, car.InventoryItemID)

    const returnReq = pool.request()
    returnReq.input('vinNo', sql.NVarChar, car.VinNo)

    const carStatusesReq = pool.request()

    // Execute rent history, maintenance records, return history, and car sub-statuses concurrently
    const [rentResult, maintResult, returnResult, carStatusesResult] = await Promise.all([
      rentReq.query(`
        SELECT
          RentItemID, ContractNo, ContractType,
          FirstName, LastName, PhoneNo,
          ExpectedReleaseDate, ReleaseDate,
          ContractCancellationDate, IsActive
        FROM dbo.EV_RentItem
        WHERE InventoryItemID = @inventoryItemId
        ORDER BY ExpectedReleaseDate DESC, ReleaseDate DESC
      `),
      maintReq.query(`
        SELECT
          m.MaintenanceItemID, m.ReportDate, m.IncidentDate,
          m.MaintenanceStartDate, m.MaintenanceFinishDate, m.MaintenanceReturnDate,
          m.CarStatusCode, m.IssueTitle,
          m.ProblemTypeCode, m.FaultPartyCode, m.CarCaseCode,
          m.ServiceLocationCode, m.InsuranceCode, m.ClaimNumber,
          m.FollowUpDetail, m.IsActive,
          m.DriverName, m.RegisterNo, m.VinNo, m.RootCauseFound, m.FixAction,
          m.LastFollowUpDate, m.ParentMaintenanceItemID,
          m.CreateDate, m.UpdateDate, m.CreateUserID, m.UpdateUserID
        FROM dbo.EV_MaintenanceItem m
        WHERE m.InventoryItemID = @inventoryItemId
        ORDER BY m.ReportDate DESC
      `),
      returnReq.query(`
        SELECT
          r.ReturnItemID, r.VinNo, r.CustomerName, r.Model, rent.ContractNo,
          r.ReceiveDate, r.ReturnDate, r.Mileage, r.ParkLocation
        FROM dbo.EV_ReturnItem r
        LEFT JOIN dbo.EV_RentItem rent ON r.RentItemID = rent.RentItemID
        WHERE r.VinNo = @vinNo
        ORDER BY r.ReturnDate DESC
      `),
      carStatusesReq.query(`
        SELECT StatusCode, StatusName 
        FROM dbo.EV_MsSubStatus
        WHERE Type = 'MAINTENANCE_CAR_STATUS' AND StatusCode != 'COMPLETE' AND IsActive = 1
      `)
    ])

    // 4. ดึงรถทดแทน (ถ้ามี), การติดตามงานซ่อม, และไฟล์แนบ สำหรับแต่ละงานซ่อม
    const maintIds = maintResult.recordset.map((m: { MaintenanceItemID: number }) => m.MaintenanceItemID)
    let replacements: Record<number, unknown[]> = {}
    let followUps: Record<number, unknown[]> = {}
    let attachments: Record<number, unknown[]> = {}

    if (maintIds.length > 0) {
      const replReq = pool.request()
      const followUpReq = pool.request()
      const attachmentReq = pool.request()
      const idList = maintIds.map((_: number, i: number) => `@mid${i}`).join(',')
      maintIds.forEach((id: number, i: number) => {
        replReq.input(`mid${i}`, sql.Int, id)
        followUpReq.input(`mid${i}`, sql.Int, id)
        attachmentReq.input(`mid${i}`, sql.Int, id)
      })
      const [replResult, followUpResult, attachmentResult] = await Promise.all([
        replReq.query(`
          SELECT
            ReplacementItemID, MaintenanceItemID, VinNo,
            ReplacementStartDate, ReplacementReturnDate,
            Location, Remark, IsActive
          FROM dbo.EV_ReplacementItem
          WHERE MaintenanceItemID IN (${idList})
          ORDER BY ReplacementStartDate DESC
        `),
        followUpReq.query(`
          SELECT
            f.MaintenanceFollowUpID, f.MaintenanceItemID, f.FollowUpDate,
            f.FollowUpDetail, f.IsActive, f.CreateDate, f.CreateUserID,
            f.UpdateDate, f.UpdateUserID,
            ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreateUserName
          FROM dbo.EV_MaintenanceFollowUp f
          LEFT JOIN dbo.EV_User u ON f.CreateUserID = u.UserID
          WHERE f.MaintenanceItemID IN (${idList}) AND f.IsActive = 1
          ORDER BY f.FollowUpDate DESC, f.CreateDate DESC
        `),
        attachmentReq.query(`
          SELECT
            fa.FileAttachmentID,
            link.MaintenanceItemID,
            fa.FileName,
            'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com/' + fa.S3Key AS FilePath,
            fa.ContentType AS FileType,
            fa.FileSize
          FROM dbo.EV_FileAttachmentMaintenanceItem link
          JOIN dbo.FileAttachment fa ON link.FileAttachmentID = fa.FileAttachmentID
          WHERE link.MaintenanceItemID IN (${idList}) AND link.IsActive = 1
        `)
      ])

      for (const r of replResult.recordset) {
        if (!replacements[r.MaintenanceItemID]) {
          replacements[r.MaintenanceItemID] = []
        }
        replacements[r.MaintenanceItemID].push(r)
      }

      for (const f of followUpResult.recordset) {
        if (!followUps[f.MaintenanceItemID]) {
          followUps[f.MaintenanceItemID] = []
        }
        followUps[f.MaintenanceItemID].push(f)
      }

      for (const a of attachmentResult.recordset) {
        if (!attachments[a.MaintenanceItemID]) {
          attachments[a.MaintenanceItemID] = []
        }
        attachments[a.MaintenanceItemID].push(a)
      }
    }

    // ─── Apply Data Masking ────────────────────────────────────
    const maskedCar = stripSensitiveFields(car)
 
    const activeRentRow = rentResult.recordset.find((r: any) => r.IsActive === true)
    const maskedRent = activeRentRow
      ? {
          ...stripSensitiveFields(activeRentRow),
          FirstName: activeRentRow.FirstName || '-',
          LastName: activeRentRow.LastName || '',
          PhoneNo: maskPhone(activeRentRow.PhoneNo),
        }
      : null

    const rentHistory = rentResult.recordset.map((r: any) => ({
      ...stripSensitiveFields(r),
      ...maskName(r.FirstName, r.LastName),
      PhoneNo: maskPhone(r.PhoneNo),
    }))

    // ─── Code → Description mapping (from master table) ─────────────────────────────
    const carStatusMap: Record<string, string> = {}
    carStatusesResult.recordset.forEach((s: { StatusCode: string; StatusName: string }) => {
      carStatusMap[s.StatusCode] = s.StatusName
    })
    // Fallback for COMPLETE (not in query due to filter)
    if (!carStatusMap['COMPLETE']) carStatusMap['COMPLETE'] = 'ซ่อมเสร็จ'
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
      'DAMAGE_TOTAL': 'ความเสียหายรุนแรง ไม่คุ้มค่าต่อการซ่อม',
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
      followUps: followUps[m.MaintenanceItemID as number] || [],
      attachments: attachments[m.MaintenanceItemID as number] || [],
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
      carStatuses: carStatusesResult.recordset
    })
  } catch (error) {
    console.error('[Vehicle API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
