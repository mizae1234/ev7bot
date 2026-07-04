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
        i.Exterior_Color, i.Interior_Color, i.IsActive,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
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

    // Execute rent history, maintenance records, return history, car sub-statuses, and insurance options concurrently
    const [rentResult, maintResult, returnResult, carStatusesResult, insuranceResult, problemTypesResult] = await Promise.all([
      rentReq.query(`
        SELECT
          RentItemID, ContractNo, ContractType,
          FirstName, LastName, PhoneNo,
          ExpectedReleaseDate, ReleaseDate,
          ContractCancellationDate, IsActive
        FROM (
          SELECT
            RentItemID, ContractNo, ContractType,
            FirstName, LastName, PhoneNo,
            ExpectedReleaseDate, ReleaseDate,
            ContractCancellationDate, IsActive,
            ROW_NUMBER() OVER(PARTITION BY RentItemID ORDER BY Source ASC) as rn
          FROM (
            SELECT
              RentItemID, ContractNo, ContractType,
              FirstName, LastName, PhoneNo,
              ExpectedReleaseDate, ReleaseDate,
              ContractCancellationDate, IsActive,
              1 AS Source
            FROM dbo.EV_RentItem
            WHERE InventoryItemID = @inventoryItemId
            UNION ALL
            SELECT
              RentItemID, ContractNo, ContractType,
              FirstName, LastName, PhoneNo,
              ExpectedReleaseDate, ReleaseDate,
              ReturnDate AS ContractCancellationDate,
              1 AS IsActive,
              2 AS Source
            FROM dbo.EV_RentItemLinemanHistory
            WHERE InventoryItemID = @inventoryItemId
          ) combined
        ) t
        WHERE rn = 1
        ORDER BY ExpectedReleaseDate DESC, ReleaseDate DESC
      `),
      maintReq.query(`
        SELECT
          m.MaintenanceItemID, m.ReportDate, m.IncidentDate,
          m.MaintenanceStartDate, m.MaintenanceFinishDate, m.MaintenanceReturnDate,
          m.IssueTitle, m.CarStatusCode, m.ServiceLocationCode,
          m.InsuranceCode, m.DriverName, m.RegisterNo, m.VinNo, m.RootCauseFound, m.FixAction,
          m.ProblemTypeCode, m.FaultPartyCode, m.CarCaseCode, m.ClaimNumber,
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
          attachments[a.MaintenanceItemID] = []
        }
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
      CarStatusDescription: m.CarStatusName || m.CarStatusCode || '-',
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
      carStatuses: carStatusesResult.recordset,
      insuranceOptions: insuranceResult.recordset,
      problemTypes: problemTypesResult.recordset
    })
  } catch (error) {
    console.error('[Vehicle API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
