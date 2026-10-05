import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

function maskStaffName(name?: string | null): string {
  if (!name) return '-'
  const trimmed = name.trim()
  if (!trimmed) return '-'
  if (trimmed.includes('@')) return trimmed.split('@')[0].trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 0) return '-'
  if (parts[0] === 'คุณ' && parts.length > 1) return `คุณ${parts[1]}`
  return parts[0]
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate')?.trim() || ''
    const endDate = searchParams.get('endDate')?.trim() || ''

    if (env.MOCK_MODE) {
      return NextResponse.json({
        success: true,
        vehicleNotes: [
          {
            VehicleNoteID: 1,
            InventoryItemID: 123,
            NoteDetail: 'MOCK NOTE: รถพร้อมใช้ ยางหน้าขวาอ่อนเช็คแล้วเรียบร้อย @คุณ เนย (Dev Mode)',
            CreateDate: new Date().toISOString(),
            CreateUserID: 1,
            CreateUserName: 'คุณ เนย (Dev Mode)',
            RegisterNo: 'กข-1234',
            VinNo: 'VIN1234567890',
            Model: 'BYD Atto 3',
            ProjectType: 'EV7',
            StatusName: 'พร้อมใช้',
            SubStatusName: null,
            CurrentLocation: 'ศูนย์บางนา',
            IsActive: true,
            attachments: []
          }
        ],
        pagination: {
          page,
          limit,
          total: 1,
          totalPages: 1
        }
      })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    const whereConditions: string[] = ['n.IsActive = 1']
    const countReq = pool.request()
    const dataReq = pool.request()

    if (search) {
      const cleanSearch = `%${search.trim()}%`
      countReq.input('search', sql.NVarChar, cleanSearch)
      dataReq.input('search', sql.NVarChar, cleanSearch)
      whereConditions.push(`(
        i.RegisterNo LIKE @search OR
        i.VinNo LIKE @search OR
        n.NoteDetail LIKE @search
      )`)
    }

    let start = startDate
    let end = endDate
    if (start && end && start > end) {
      const tmp = start
      start = end
      end = tmp
    }

    if (start) {
      countReq.input('startDate', sql.Date, start)
      dataReq.input('startDate', sql.Date, start)
      whereConditions.push('CAST(n.CreateDate AS DATE) >= @startDate')
    }

    if (end) {
      countReq.input('endDate', sql.Date, end)
      dataReq.input('endDate', sql.Date, end)
      whereConditions.push('CAST(n.CreateDate AS DATE) <= @endDate')
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`

    // First, let's get the total count for pagination
    const countQuery = `
      SELECT COUNT(*) AS Total
      FROM dbo.EV_VehicleNote n
      JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
      ${whereClause}
    `
    const dataQuery = `
      SELECT
        n.VehicleNoteID,
        n.InventoryItemID,
        n.NoteDetail,
        n.CreateDate,
        n.CreateUserID,
        n.IsActive,
        COALESCE(i.RegisterNo, '') AS RegisterNo,
        i.VinNo,
        i.Model,
        i.ProjectType,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName,
        loc.StatusName AS CurrentLocationName,
        i.CurrentLocation AS LocationCode,
        ISNULL(NULLIF(u.FirstName + ' ' + ISNULL(u.LastName, ''), ''), u.UserName) AS CreateUserName
      FROM dbo.EV_VehicleNote n
      JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus loc ON i.CurrentLocation = loc.StatusCode AND loc.Type = 'LOCATION'
      ${whereClause}
      ORDER BY n.CreateDate DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `

    // Run Count Query
    const countResult = await countReq.query(countQuery)
    const total = countResult.recordset[0]?.Total || 0

    // Add Pagination and Order
    const offset = (page - 1) * limit
    dataReq.input('offset', sql.Int, offset)
    dataReq.input('limit', sql.Int, limit)

    const dataResult = await dataReq.query(dataQuery)

    // Resolve creator names from PostgreSQL
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
      console.warn('[Vehicle Notes API] PostgreSQL unavailable for name resolution, skipping:', (pgErr as Error).message)
    }

    // Fetch attachments for these vehicle notes
    let attachmentMap = new Map<number, any[]>()
    if (dataResult.recordset && dataResult.recordset.length > 0) {
      try {
        const noteIds = dataResult.recordset.map((n: any) => n.VehicleNoteID)
        const chunkSize = 500
        for (let i = 0; i < noteIds.length; i += chunkSize) {
          const chunk = noteIds.slice(i, i + chunkSize)
          const attachmentsRes = await pool.request().query(`
            SELECT 
              FileAttachmentID,
              FileName,
              OriginalFileName,
              S3Key,
              FileSize,
              ContentType,
              ReferenceID
            FROM dbo.FileAttachment
            WHERE ReferenceType = 'VEHICLE_NOTES'
              AND ReferenceID IN (${chunk.join(',')})
          `)
          for (const att of attachmentsRes.recordset) {
            const refId = Number(att.ReferenceID)
            const list = attachmentMap.get(refId) || []
            list.push({
              FileAttachmentID: Number(att.FileAttachmentID),
              fileName: att.FileName,
              originalFileName: att.OriginalFileName,
              s3Key: att.S3Key,
              fileSize: Number(att.FileSize),
              contentType: att.ContentType,
              url: `https://${env.SPACES_BUCKET}.${env.SPACES_ENDPOINT.replace('https://', '')}/${att.S3Key}`
            })
            attachmentMap.set(refId, list)
          }
        }
      } catch (attErr) {
        console.error('[Fetch Notes Attachments Error]', attErr)
      }
    }

    const vehicleNotes = (dataResult.recordset || []).map((n: any) => {
      const originalName = (n.CreateUserName || '').trim()
      const lineDisplayName = n.CreateUserID ? regMap.get(Number(n.CreateUserID)) : null

      let creatorName = '-'
      if (originalName && lineDisplayName) {
        const maskedOriginal = maskStaffName(originalName)
        const maskedLine = maskStaffName(lineDisplayName)
        if (originalName.includes('@')) {
          creatorName = maskedLine
        } else if (maskedOriginal !== maskedLine && maskedLine !== '-') {
          creatorName = `${maskedOriginal} (${maskedLine})`
        } else {
          creatorName = maskedOriginal
        }
      } else if (lineDisplayName) {
        creatorName = maskStaffName(lineDisplayName)
      } else if (originalName) {
        creatorName = maskStaffName(originalName)
      }

      return {
        VehicleNoteID: n.VehicleNoteID,
        InventoryItemID: n.InventoryItemID,
        NoteDetail: n.NoteDetail,
        CreateDate: n.CreateDate,
        CreateUserID: n.CreateUserID,
        CreateUserName: creatorName,
        RegisterNo: n.RegisterNo || null,
        VinNo: n.VinNo,
        Model: n.Model || '-',
        ProjectType: n.ProjectType || '-',
        StatusName: n.StatusName || null,
        SubStatusName: n.SubStatusName || null,
        CurrentLocation: n.CurrentLocationName || n.LocationCode || null,
        IsActive: n.IsActive,
        attachments: attachmentMap.get(n.VehicleNoteID) || []
      }
    })

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      vehicleNotes,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    })
  } catch (err: any) {
    console.error('[Get Vehicle Notes Error]', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}` }, { status: 500 })
  }
}
