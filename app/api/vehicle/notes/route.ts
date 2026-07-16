import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const search = searchParams.get('search') || ''

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
            IsActive: true
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

    // First, let's get the total count for pagination
    let countQuery = `
      SELECT COUNT(*) AS Total
      FROM dbo.EV_VehicleNote n
      JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
      WHERE n.IsActive = 1
    `
    let dataQuery = `
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
      WHERE n.IsActive = 1
    `

    const searchClause = ` AND (
      i.RegisterNo LIKE @search OR
      i.VinNo LIKE @search OR
      n.NoteDetail LIKE @search
    )`

    const countReq = pool.request()
    const dataReq = pool.request()

    if (search) {
      const cleanSearch = `%${search.trim()}%`
      countReq.input('search', sql.NVarChar, cleanSearch)
      dataReq.input('search', sql.NVarChar, cleanSearch)
      countQuery += searchClause
      dataQuery += searchClause
    }

    // Run Count Query
    const countResult = await countReq.query(countQuery)
    const total = countResult.recordset[0]?.Total || 0

    // Add Pagination and Order
    const offset = (page - 1) * limit
    dataReq.input('offset', sql.Int, offset)
    dataReq.input('limit', sql.Int, limit)

    dataQuery += `
      ORDER BY n.CreateDate DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `

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

    const vehicleNotes = (dataResult.recordset || []).map((n: any) => {
      const originalName = (n.CreateUserName || '').trim()
      const lineDisplayName = n.CreateUserID ? regMap.get(Number(n.CreateUserID)) : null

      let creatorName = '-'
      if (originalName && lineDisplayName) {
        if (originalName.includes('@')) {
          creatorName = lineDisplayName
        } else if (originalName !== lineDisplayName) {
          creatorName = `${originalName} (${lineDisplayName})`
        } else {
          creatorName = originalName
        }
      } else if (lineDisplayName) {
        creatorName = lineDisplayName
      } else if (originalName) {
        creatorName = originalName
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
        IsActive: n.IsActive
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
