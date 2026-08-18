import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'

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
    const cleanIdentifier = `%${identifier.replace(/[\s-]/g, '')}%`
    console.log(`[Vehicle API] Querying for identifier: "${identifier}" (clean: "${cleanIdentifier}")`)
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // 1. ดึงข้อมูลรถหลัก
    const carReq = pool.request()
    carReq.input('cleanIdentifier', sql.NVarChar, cleanIdentifier)
    const carResult = await carReq.query(`
      SELECT TOP 1
        i.InventoryItemID, i.VinNo, i.MotorNo, i.RegisterNo, i.Model,
        i.Project, i.ProjectType, i.Company, i.Status AS StatusCode, i.StatusType,
        i.Exterior_Color, i.Interior_Color, i.IsActive, i.CurrentLocation,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName,
        mainCarInfo.MainVehicleRegisterNo,
        mainCarInfo.MainVehicleVin
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      OUTER APPLY (
        SELECT TOP 1 
          mc.RegisterNo AS MainVehicleRegisterNo,
          mc.VinNo AS MainVehicleVin
        FROM dbo.EV_ReplacementItem activeRep
        JOIN dbo.EV_MaintenanceItem am ON activeRep.MaintenanceItemID = am.MaintenanceItemID
        JOIN dbo.EV_InventoryItem mc ON am.InventoryItemID = mc.InventoryItemID
        WHERE activeRep.VinNo = i.VinNo 
          AND activeRep.IsActive = 1 
          AND activeRep.ReplacementReturnDate IS NULL
          AND am.IsActive = 1
      ) mainCarInfo
      WHERE (
        REPLACE(REPLACE(i.RegisterNo, ' ', ''), '-', '') LIKE @cleanIdentifier
        OR REPLACE(REPLACE(i.VinNo, ' ', ''), '-', '') LIKE @cleanIdentifier
      ) AND i.IsActive = 1
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
    const insuranceReq = pool.request()
    const problemTypesReq = pool.request()
    const notesReq = pool.request()
    notesReq.input('inventoryItemId', sql.Int, car.InventoryItemID)

    const repossessReq = pool.request()
    repossessReq.input('vinNo', sql.VarChar, car.VinNo)

    const replPoolReq = pool.request()
    replPoolReq.input('vinNo', sql.VarChar, car.VinNo)

    const inspectReq = pool.request()
    inspectReq.input('vinNo', sql.VarChar, car.VinNo)

    // Execute all sub-queries concurrently
    const [
      rentResult,
      maintResult,
      returnResult,
      carStatusesResult,
      insuranceResult,
      problemTypesResult,
      notesResult,
      repossessResult,
      replPoolResult,
      inspectResult
    ] = await Promise.all([
      rentReq.query(`
        SELECT
          v.RentItemID, v.ContractNo, v.ContractType,
          v.FirstName, v.LastName, v.PhoneNo,
          v.ExpectedReleaseDate, v.ReleaseDate,
          v.ContractCancellationDate,
          CAST(COALESCE(r.IsActive, 0) AS BIT) AS IsActive,
          v.RentType
        FROM dbo.View_AccumarateReleaseCar v
        LEFT JOIN dbo.EV_RentItem r ON v.RentItemID = r.RentItemID
        WHERE v.InventoryItemID = @inventoryItemId
        ORDER BY v.ExpectedReleaseDate DESC, v.ReleaseDate DESC
      `),
      maintReq.query(`
        SELECT
          m.MaintenanceItemID, m.ReportDate, m.IncidentDate,
          m.MaintenanceStartDate, m.MaintenanceFinishDate, m.MaintenanceReturnDate,
          m.IssueTitle, m.CarStatusCode, m.ServiceLocationCode, m.IsActive,
          m.InsuranceCode, m.DriverName, m.RegisterNo, m.VinNo, m.RootCauseFound, m.FixAction,
          m.ProblemTypeCode, m.FaultPartyCode, m.CarCaseCode, m.ClaimNumber, m.ContractNo,
          m.LastFollowUpDate, m.ParentMaintenanceItemID,
          m.CreateDate, m.UpdateDate, m.CreateUserID, m.UpdateUserID,
          ISNULL(NULLIF(uc.FirstName + ' ' + ISNULL(uc.LastName, ''), ''), uc.UserName) AS CreateUserName,
          ISNULL(NULLIF(uu.FirstName + ' ' + ISNULL(uu.LastName, ''), ''), uu.UserName) AS UpdateUserName,
          ISNULL(sub.StatusName, m.CarStatusCode) AS CarStatusName
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_User uc ON m.CreateUserID = uc.UserID
        LEFT JOIN dbo.EV_User uu ON m.UpdateUserID = uu.UserID
        LEFT JOIN dbo.EV_MsSubStatus sub ON m.CarStatusCode = sub.StatusCode
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
      `),
      insuranceReq.query(`
        SELECT StatusCode, StatusName 
        FROM dbo.EV_MsSubStatus
        WHERE Type = 'INSURANCE' AND IsActive = 1
        ORDER BY StatusCode
      `),
      problemTypesReq.query(`
        SELECT StatusCode, StatusName 
        FROM dbo.EV_MsSubStatus
        WHERE Type = 'MAINTENANCE_PROBLEM_TYPE' AND IsActive = 1
        ORDER BY StatusCode
      `),
      notesReq.query(`
        SELECT
          n.VehicleNoteID,
          n.InventoryItemID,
          n.NoteDetail,
          n.CreateDate,
          n.CreateUserID,
          n.IsActive,
          ISNULL(NULLIF(u.FirstName + ' ' + ISNULL(u.LastName, ''), ''), u.UserName) AS CreateUserName
        FROM dbo.EV_VehicleNote n
        LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
        WHERE n.InventoryItemID = @inventoryItemId AND n.IsActive = 1
        ORDER BY n.CreateDate DESC
      `),
      repossessReq.query(`
        SELECT 
          r.RepossessID, r.VinNo, r.ContractNo, r.RepossessDate,
          r.RepossessLocation, r.Remark, r.CreateDate,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', u.LastName))), ''), u.UserName) AS CreateUserName
        FROM dbo.EV_VehicleRepossess r
        LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
        WHERE r.VinNo = @vinNo AND r.IsActive = 1
        ORDER BY r.RepossessDate DESC
      `).catch(() => ({ recordset: [] })),
      replPoolReq.query(`
        SELECT 
          r.ReplacementItemID, r.MaintenanceItemID, r.VinNo,
          r.ReplacementStartDate, r.ReplacementReturnDate,
          r.Location, r.Remark, r.IsActive, r.CreateDate,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', u.LastName))), ''), u.UserName) AS CreateUserName,
          m.IssueTitle, m.CarStatusCode,
          mainCar.RegisterNo AS MainRegisterNo,
          mainCar.VinNo AS MainVinNo,
          mainCar.Model AS MainModel
        FROM dbo.EV_ReplacementItem r
        JOIN dbo.EV_MaintenanceItem m ON r.MaintenanceItemID = m.MaintenanceItemID
        LEFT JOIN dbo.EV_InventoryItem mainCar ON m.InventoryItemID = mainCar.InventoryItemID
        LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
        WHERE r.VinNo = @vinNo
        ORDER BY r.ReplacementStartDate DESC
      `).catch(() => ({ recordset: [] })),
      inspectReq.query(`
        SELECT 
          ir.InspectionID, ir.VinNo, ir.RegisterNo, ir.CustomerName, ir.InspectionDate, ir.Location,
          ir.Status, ir.ReturnReason, ir.AssessmentResult, ir.InspectorName, ir.Mileage, ir.CreateDate,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', u.LastName))), ''), u.UserName) AS CreateUserName
        FROM dbo.EV_InspectionReturn ir
        LEFT JOIN dbo.EV_User u ON ir.CreateUserID = u.UserID
        WHERE ir.VinNo = @vinNo
        ORDER BY ir.InspectionDate DESC
      `).catch(() => ({ recordset: [] }))
    ])

    // 4. ดึงรถทดแทน (ถ้ามี), การติดตามงานซ่อม, และไฟล์แนบ สำหรับแต่ละงานซ่อม
    const maintIds = maintResult.recordset.map((m: { MaintenanceItemID: number }) => m.MaintenanceItemID)
    let replacements: Record<number, unknown[]> = {}
    let followUps: Record<number, unknown[]> = {}
    let attachments: Record<number, unknown[]> = {}

    // Resolve names from lineRegistration in Postgres for any mock/custom UserIDs
    let regMap = new Map<number, string>()
    try {
      const registrations = await prisma.lineRegistration.findMany({
        select: { ev7UserId: true, displayName: true }
      })
      for (const reg of registrations) {
        if (reg.ev7UserId && reg.displayName) {
          regMap.set(Number(reg.ev7UserId), reg.displayName)
        }
      }
    } catch (pgErr) {
      console.warn('[Vehicle API] PostgreSQL unavailable for name resolution, skipping:', (pgErr as Error).message)
    }

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
            fa.S3Key,
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
        const originalName = (f.CreateUserName || '').trim();
        const lineDisplayName = f.CreateUserID ? regMap.get(Number(f.CreateUserID)) : null;

        if (originalName && lineDisplayName) {
          // If originalName contains email or is just a fallback, use lineDisplayName.
          // Otherwise, show both as: originalName (lineDisplayName)
          if (originalName.includes('@')) {
            f.CreateUserName = lineDisplayName;
          } else if (originalName !== lineDisplayName) {
            f.CreateUserName = `${originalName} (${lineDisplayName})`;
          } else {
            f.CreateUserName = originalName;
          }
        } else if (lineDisplayName) {
          f.CreateUserName = lineDisplayName;
        } else if (!originalName) {
          f.CreateUserName = '-';
        }
        if (!followUps[f.MaintenanceItemID]) {
          followUps[f.MaintenanceItemID] = []
        }
        followUps[f.MaintenanceItemID].push(f)
      }

      // Initialize S3 Client to generate signed URLs offline
      const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')
      const { env } = require('@/lib/env')

      const s3ClientForSign = new S3Client({
        endpoint: env.SPACES_ENDPOINT,
        region: env.SPACES_REGION,
        credentials: {
          accessKeyId: env.SPACES_KEY,
          secretAccessKey: env.SPACES_SECRET
        }
      })

      for (const a of attachmentResult.recordset) {
        let signedUrl = ''
        try {
          const command = new GetObjectCommand({
            Bucket: env.SPACES_BUCKET,
            Key: a.S3Key
          })
          signedUrl = await getSignedUrl(s3ClientForSign, command, { expiresIn: 86400 })
        } catch (s3Err) {
          console.error('[S3 Presign Error]', s3Err)
          signedUrl = `https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com/${a.S3Key}`
        }

        const attachmentObj = {
          FileAttachmentID: a.FileAttachmentID,
          MaintenanceItemID: a.MaintenanceItemID,
          FileName: a.FileName,
          FilePath: signedUrl,
          FileType: a.FileType,
          FileSize: a.FileSize
        }

        if (!attachments[a.MaintenanceItemID]) {
          attachments[a.attachments] = []
        }
        attachments[a.MaintenanceItemID] = attachments[a.MaintenanceItemID] || []
        attachments[a.MaintenanceItemID].push(attachmentObj)
      }

      for (const m of maintResult.recordset) {
        const cOriginalName = (m.CreateUserName || '').trim()
        const cLineDisplayName = m.CreateUserID ? regMap.get(Number(m.CreateUserID)) : null
        if (cOriginalName && cLineDisplayName) {
          if (cOriginalName.includes('@')) {
            m.CreateUserName = cLineDisplayName
          } else if (cOriginalName !== cLineDisplayName) {
            m.CreateUserName = `${cOriginalName} (${cLineDisplayName})`
          } else {
            m.CreateUserName = cOriginalName
          }
        } else if (cLineDisplayName) {
          m.CreateUserName = cLineDisplayName
        }

        const uOriginalName = (m.UpdateUserName || '').trim()
        const uLineDisplayName = m.UpdateUserID ? regMap.get(Number(m.UpdateUserID)) : null
        if (uOriginalName && uLineDisplayName) {
          if (uOriginalName.includes('@')) {
            m.UpdateUserName = uLineDisplayName
          } else if (uOriginalName !== uLineDisplayName) {
            m.UpdateUserName = `${uOriginalName} (${uLineDisplayName})`
          } else {
            m.UpdateUserName = uOriginalName
          }
        } else if (uLineDisplayName) {
          m.UpdateUserName = uLineDisplayName
        }
      }
    }

    // Process Vehicle Notes
    const vehicleNotes = (notesResult?.recordset || []).map((n: any) => {
      const originalName = (n.CreateUserName || '').trim();
      const lineDisplayName = n.CreateUserID ? regMap.get(Number(n.CreateUserID)) : null;

      let creatorName = '-';
      if (originalName && lineDisplayName) {
        if (originalName.includes('@')) {
          creatorName = lineDisplayName;
        } else if (originalName !== lineDisplayName) {
          creatorName = `${originalName} (${lineDisplayName})`;
        } else {
          creatorName = originalName;
        }
      } else if (lineDisplayName) {
        creatorName = lineDisplayName;
      } else if (originalName) {
        creatorName = originalName;
      }

      return {
        VehicleNoteID: n.VehicleNoteID,
        InventoryItemID: n.InventoryItemID,
        NoteDetail: n.NoteDetail,
        CreateDate: n.CreateDate,
        CreateUserID: n.CreateUserID,
        CreateUserName: creatorName,
        IsActive: n.IsActive
      }
    })

    // ─── Apply Data Masking ────────────────────────────────────
    const maskedCar = stripSensitiveFields(car)
 
    const activeRentRow = rentResult.recordset.find((r: any) => r.IsActive === true)
    const maskedRent = activeRentRow
      ? {
          ...stripSensitiveFields(activeRentRow),
          FirstName: activeRentRow.FirstName || '-',
          LastName: activeRentRow.LastName || '',
          PhoneNo: maskPhone(activeRentRow.PhoneNo),
          CustomerName: (activeRentRow.FirstName + (activeRentRow.LastName ? ' ' + activeRentRow.LastName : '')).trim() || 'ลูกค้าทั่วไป',
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
      CarStatusDescription: m.CarStatusName || m.CarStatusCode || '-',
      replacements: replacements[m.MaintenanceItemID as number] || [],
      followUps: followUps[m.MaintenanceItemID as number] || [],
      attachments: attachments[m.MaintenanceItemID as number] || [],
    }))

    const maskedReturns = returnResult.recordset.map((r: Record<string, unknown>) => ({
      ...stripSensitiveFields(r),
      CustomerName: maskFullName(r.CustomerName as string),
    }))

    // Fetch active replacement reservation for this car (by its VinNo)
    let replacementReserved = null
    try {
      const reservedRes = await pool.request()
        .input('targetVin', sql.VarChar, car.VinNo)
        .query(`
          SELECT TOP 1 
            ReplacementReservedID,
            VinNo AS ReservedReplacementVinNo,
            Type,
            TargetVinNo,
            ReleaseDate,
            Remark,
            IsActive
          FROM dbo.EV_ReplacementReserved
          WHERE TargetVinNo = @targetVin 
            AND IsActive = 1
            AND ClosedByMaintenanceItemID IS NULL
          ORDER BY CreateDate DESC
        `)
      if (reservedRes.recordset.length > 0) {
        replacementReserved = reservedRes.recordset[0]
      }
    } catch (reservedErr) {
      console.error('[Vehicle API] Error fetching replacement reservation:', reservedErr)
    }

    // ─── Unified Activity Timeline Builder ─────────────────────────────────────────
    const timeline: Array<{
      id: string
      date: string
      category: 'RENT' | 'RETURN' | 'REPOSSESS' | 'MAINTENANCE' | 'FOLLOW_UP' | 'REPLACEMENT' | 'NOTE'
      title: string
      subtitle?: string | null
      description?: string | null
      badge: string
      badgeColor: 'blue' | 'emerald' | 'rose' | 'amber' | 'purple' | 'indigo' | 'zinc'
      icon: string
      location?: string | null
      user?: string | null
      relatedRegisterNo?: string | null
      relatedVin?: string | null
      meta?: Record<string, unknown>
    }> = []

    // 1. Rent History Events
    rentResult.recordset.forEach((r: Record<string, unknown>, idx: number) => {
      const custName = maskFullName(`${r.FirstName || ''} ${r.LastName || ''}`.trim())
      const phone = maskPhone(r.PhoneNo as string)
      
      if (r.ReleaseDate) {
        timeline.push({
          id: `rent-rel-${r.RentItemID || idx}`,
          date: new Date(r.ReleaseDate as string).toISOString(),
          category: 'RENT',
          title: `🚗 ส่งมอบ/ปล่อยรถให้ลูกค้า`,
          subtitle: `สัญญาเลขที่ ${r.ContractNo || '-'}`,
          description: `ผู้เช่า: ${custName} (${phone}) | ประเภท: ${r.ContractType || r.RentType || '-'}`,
          badge: 'ปล่อยรถ',
          badgeColor: 'emerald',
          icon: '🚗',
          user: null,
          meta: { contractNo: r.ContractNo, rentItemId: r.RentItemID }
        })
      }

      if (r.ContractCancellationDate) {
        timeline.push({
          id: `rent-cancel-${r.RentItemID || idx}`,
          date: new Date(r.ContractCancellationDate as string).toISOString(),
          category: 'RENT',
          title: `📄 บอกเลิก/สิ้นสุดสัญญาเช่า`,
          subtitle: `สัญญาเลขที่ ${r.ContractNo || '-'}`,
          description: `ลูกค้ายกเลิก/สิ้นสุดสัญญา (${custName})`,
          badge: 'ยกเลิกสัญญา',
          badgeColor: 'rose',
          icon: '📄',
          user: null,
          meta: { contractNo: r.ContractNo, rentItemId: r.RentItemID }
        })
      }
    })

    // 2. Repossessions
    repossessResult.recordset.forEach((rep: Record<string, unknown>, idx: number) => {
      timeline.push({
        id: `repossess-${rep.RepossessID || idx}`,
        date: rep.RepossessDate ? new Date(rep.RepossessDate as string).toISOString() : new Date(rep.CreateDate as string).toISOString(),
        category: 'REPOSSESS',
        title: `🚨 ยึดคืนรถยนต์`,
        subtitle: rep.RepossessLocation ? `สถานที่ยึด: ${rep.RepossessLocation}` : 'บันทึกยึดคืนรถ',
        description: rep.Remark ? String(rep.Remark) : (rep.ContractNo ? `สัญญา: ${rep.ContractNo}` : 'ดำเนินการยึดคืนรถยนต์เข้าสู่ระบบ'),
        badge: 'ยึดรถ',
        badgeColor: 'rose',
        icon: '🚨',
        location: (rep.RepossessLocation as string) || null,
        user: (rep.CreateUserName as string) || null,
        meta: { contractNo: rep.ContractNo, repossessId: rep.RepossessID }
      })
    })

    // 3. Replacements as Pool (This car was given to another main vehicle)
    replPoolResult.recordset.forEach((poolItem: Record<string, unknown>, idx: number) => {
      if (poolItem.ReplacementStartDate) {
        timeline.push({
          id: `repl-pool-${poolItem.ReplacementItemID || idx}`,
          date: new Date(poolItem.ReplacementStartDate as string).toISOString(),
          category: 'REPLACEMENT',
          title: `🚗🔄 นำไปเป็นรถทดแทนให้คันอื่น`,
          subtitle: `จ่ายให้รถคันหลัก: ${poolItem.MainRegisterNo || poolItem.MainVinNo || '-'} (${poolItem.MainModel || '-'})`,
          description: poolItem.IssueTitle ? `ใบแจ้งซ่อม #${poolItem.MaintenanceItemID}: ${poolItem.IssueTitle}` : `ใบแจ้งซ่อม #${poolItem.MaintenanceItemID}`,
          badge: poolItem.ReplacementReturnDate ? 'เคยเป็นรถทดแทน' : 'เป็นรถทดแทนใช้งานอยู่',
          badgeColor: poolItem.ReplacementReturnDate ? 'purple' : 'amber',
          icon: '🚗🔄',
          location: (poolItem.Location as string) || null,
          user: (poolItem.CreateUserName as string) || null,
          relatedRegisterNo: (poolItem.MainRegisterNo as string) || null,
          relatedVin: (poolItem.MainVinNo as string) || null,
          meta: { replacementItemId: poolItem.ReplacementItemID, maintenanceItemId: poolItem.MaintenanceItemID }
        })
      }

      if (poolItem.ReplacementReturnDate) {
        timeline.push({
          id: `repl-pool-ret-${poolItem.ReplacementItemID || idx}`,
          date: new Date(poolItem.ReplacementReturnDate as string).toISOString(),
          category: 'REPLACEMENT',
          title: `🔄 สิ้นสุดการเป็นรถทดแทน (ส่งคืนคลัง)`,
          subtitle: `ส่งคืนจากเคสของรถคันหลัก ${poolItem.MainRegisterNo || poolItem.MainVinNo || '-'}`,
          description: `ลูกค้านำรถทดแทนกลับมาส่งคืนเรียบร้อย`,
          badge: 'คืนรถทดแทน',
          badgeColor: 'emerald',
          icon: '🔄',
          user: (poolItem.CreateUserName as string) || null
        })
      }
    })

    // 4. Returns & Inspections
    returnResult.recordset.forEach((ret: Record<string, unknown>, idx: number) => {
      if (ret.ReturnDate) {
        timeline.push({
          id: `return-${ret.ReturnItemID || idx}`,
          date: new Date(ret.ReturnDate as string).toISOString(),
          category: 'RETURN',
          title: `🔄 ตรวจรับคืนรถยนต์`,
          subtitle: ret.ParkLocation ? `สถานที่จอดรับคืน: ${ret.ParkLocation}` : 'รับคืนรถยนต์',
          description: `สัญญา: ${ret.ContractNo || '-'} | ลูกค้า: ${maskFullName(ret.CustomerName as string)}`,
          badge: 'รับคืนรถ',
          badgeColor: 'indigo',
          icon: '🔄',
          location: (ret.ParkLocation as string) || null,
          meta: { returnItemId: ret.ReturnItemID, contractNo: ret.ContractNo }
        })
      }
    })

    inspectResult.recordset.forEach((ins: Record<string, unknown>, idx: number) => {
      if (ins.InspectionDate) {
        timeline.push({
          id: `inspect-${ins.InspectionID || idx}`,
          date: new Date(ins.InspectionDate as string).toISOString(),
          category: 'RETURN',
          title: `📋 ใบตรวจสภาพรับคืนรถ (Inspection #${ins.InspectionID})`,
          subtitle: ins.Location ? `สถานที่ตรวจ: ${ins.Location}` : 'ตรวจสภาพรับคืนรถ',
          description: `ผลประเมิน: ${ins.AssessmentResult || ins.Status || '-'} | ผู้ตรวจ: ${ins.InspectorName || ins.CreateUserName || '-'} ${ins.Mileage ? `| เลขไมล์: ${ins.Mileage} กม.` : ''}`,
          badge: 'ตรวจสภาพ',
          badgeColor: 'indigo',
          icon: '📋',
          location: (ins.Location as string) || null,
          user: (ins.InspectorName as string) || (ins.CreateUserName as string) || null,
          meta: { inspectionId: ins.InspectionID }
        })
      }
    })

    // 5. Maintenance Tickets
    maintenance.forEach((m: Record<string, unknown>, idx: number) => {
      const maintId = m.MaintenanceItemID || idx
      
      if (m.ReportDate) {
        timeline.push({
          id: `maint-rep-${maintId}`,
          date: new Date(m.ReportDate as string).toISOString(),
          category: 'MAINTENANCE',
          title: `🔧 เปิดใบแจ้งซ่อม #${maintId}`,
          subtitle: (m.IssueTitle as string) || 'แจ้งซ่อมบำรุง',
          description: `สถานะ: ${m.CarStatusDescription} | อู่/ศูนย์: ${m.ServiceLocation} | ปัญหา: ${m.ProblemTypeDescription || '-'}`,
          badge: (m.CarStatusDescription as string) || 'แจ้งซ่อม',
          badgeColor: 'amber',
          icon: '🔧',
          location: (m.ServiceLocation as string) || null,
          user: (m.CreateUserName as string) || null,
          meta: { maintenanceItemId: maintId }
        })
      }

      if (m.MaintenanceStartDate) {
        timeline.push({
          id: `maint-start-${maintId}`,
          date: new Date(m.MaintenanceStartDate as string).toISOString(),
          category: 'MAINTENANCE',
          title: `🛠️ เริ่มดำเนินการซ่อม (ใบงาน #${maintId})`,
          subtitle: `อู่/ศูนย์: ${m.ServiceLocation}`,
          description: `ช่างเริ่มดำเนินการซ่อมตามอาการ: ${m.IssueTitle || '-'}`,
          badge: 'เริ่มซ่อม',
          badgeColor: 'blue',
          icon: '🛠️',
          location: (m.ServiceLocation as string) || null
        })
      }

      if (m.MaintenanceFinishDate) {
        timeline.push({
          id: `maint-fin-${maintId}`,
          date: new Date(m.MaintenanceFinishDate as string).toISOString(),
          category: 'MAINTENANCE',
          title: `✅ ซ่อมเสร็จสิ้น (ใบงาน #${maintId})`,
          subtitle: `อู่/ศูนย์: ${m.ServiceLocation}`,
          description: `งานซ่อมเสร็จสมบูรณ์ พร้อมส่งมอบหรือตรวจรับ`,
          badge: 'ซ่อมเสร็จ',
          badgeColor: 'emerald',
          icon: '✅',
          location: (m.ServiceLocation as string) || null
        })
      }

      // Follow up logs
      const fList = (m.followUps as Record<string, unknown>[]) || []
      fList.forEach((f, fIdx) => {
        const fDate = f.FollowUpDate || f.CreateDate
        if (fDate) {
          timeline.push({
            id: `follow-${f.MaintenanceFollowUpID || `${maintId}-${fIdx}`}`,
            date: new Date(fDate as string).toISOString(),
            category: 'FOLLOW_UP',
            title: `📝 ติดตามงานซ่อม (ใบงาน #${maintId})`,
            subtitle: `ติดตามโดย: ${f.CreateUserName || '-'}`,
            description: String(f.FollowUpDetail || '-'),
            badge: 'ติดตามงาน',
            badgeColor: 'blue',
            icon: '📝',
            user: (f.CreateUserName as string) || null
          })
        }
      })
    })

    // 6. Vehicle Notes
    notesResult.recordset.forEach((n: Record<string, unknown>, idx: number) => {
      const detail = String(n.NoteDetail || '')
      const isLocNote = detail.includes('ย้ายสถานที่') || detail.includes('📍')
      timeline.push({
        id: `note-${n.VehicleNoteID || idx}`,
        date: new Date(n.CreateDate as string).toISOString(),
        category: 'NOTE',
        title: isLocNote ? `📍 บันทึกการย้ายสถานที่ / สถานะ` : `📌 บันทึกหมายเหตุประจำรถ`,
        subtitle: `บันทึกโดย: ${n.CreateUserName || '-'}`,
        description: detail,
        badge: isLocNote ? 'ย้ายสถานที่' : 'โน้ตรถ',
        badgeColor: isLocNote ? 'indigo' : 'zinc',
        icon: isLocNote ? '📍' : '📌',
        user: (n.CreateUserName as string) || null,
        meta: { vehicleNoteId: n.VehicleNoteID }
      })
    })

    // Sort timeline newest to oldest
    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      car: maskedCar,
      currentRent: maskedRent,
      rentHistory,
      maintenance,
      returns: maskedReturns,
      carStatuses: carStatusesResult.recordset,
      insuranceOptions: insuranceResult.recordset,
      problemTypes: problemTypesResult.recordset,
      vehicleNotes,
      replacementReserved,
      timeline
    })
  } catch (error) {
    console.error('[Vehicle API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
