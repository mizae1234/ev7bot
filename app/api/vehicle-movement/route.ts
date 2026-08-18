import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLReadOnlyPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

function maskStaffName(name?: string | null): string {
  if (!name) return '-'
  const trimmed = name.trim()
  if (!trimmed) return '-'
  if (trimmed.includes('@')) return trimmed.split('@')[0]
  const parts = trimmed.split(/\s+/)
  if (parts.length === 0) return '-'
  if (parts[0] === 'คุณ' && parts.length > 1) return `คุณ${parts[1]}`
  return parts[0]
}

export interface VehicleLocationMovementItem {
  movementId: string
  inventoryItemId: number | null
  vinNo: string
  registerNo: string | null
  model: string | null
  project: string | null
  currentLocation: string | null
  currentLocationName: string | null
  fromLocation: string | null
  toLocation: string | null
  movementDetail: string | null
  movementDate: string
  createDate: string
  createUserId: number | null
  createUserName: string | null
}

export interface MovementStats {
  totalCount: number
  thisMonthCount: number
  todayCount: number
  uniqueVehicles: number
}

function parseLocationNote(noteDetail: string | null, locMap: Map<string, string>): {
  fromLocation: string | null
  toLocation: string | null
  actor: string | null
} {
  if (!noteDetail) return { fromLocation: null, toLocation: null, actor: null }
  
  const arrowMatch = noteDetail.match(/(?:ย้ายสถานที่|เปลี่ยนสถานที่)[:\s]+([^→\->|]+)\s*(?:→|->)\s*([^|]+)(?:\s*\|\s*โดย:\s*(.*))?/i)
  if (arrowMatch) {
    const rawFrom = arrowMatch[1]?.trim() || null
    const rawTo = arrowMatch[2]?.trim() || null
    const rawActor = arrowMatch[3]?.trim() || null

    const fromLoc = rawFrom ? (locMap.get(rawFrom) || rawFrom) : null
    const toLoc = rawTo ? (locMap.get(rawTo) || rawTo) : null
    return { fromLocation: fromLoc, toLocation: toLoc, actor: rawActor }
  }

  return { fromLocation: null, toLocation: null, actor: null }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '50', 10))
    const search = searchParams.get('search')?.trim() || ''
    const startDate = searchParams.get('startDate')?.trim() || ''
    const endDate = searchParams.get('endDate')?.trim() || ''
    const location = searchParams.get('location')?.trim() || ''

    const pool = await getMSSQLReadOnlyPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // 1. Fetch location masters for code-to-name translation
    const locMasterReq = pool.request()
    const locMasterRes = await locMasterReq.query(`
      SELECT StatusCode, StatusName 
      FROM dbo.EV_MsSubStatus 
      WHERE Type = 'LOCATION'
    `).catch(() => ({ recordset: [] }))

    const locMap = new Map<string, string>()
    locMasterRes.recordset.forEach((row: { StatusCode: string; StatusName: string }) => {
      if (row.StatusCode && row.StatusName) {
        locMap.set(row.StatusCode.trim(), row.StatusName.trim())
      }
    })

    // 2. High performance optimized CTE
    const baseCte = `
      WITH LocationMovements AS (
        -- A. บันทึกจาก EV_VehicleLocationLog (ถ้ามี)
        SELECT
          CONCAT('LOC-', ISNULL(CAST(l.InventoryItemID AS VARCHAR(20)), '0'), '-', CONVERT(VARCHAR(30), l.CreateDate, 126)) AS movementId,
          l.InventoryItemID AS inventoryItemId,
          l.VinNo AS vinNo,
          i.RegisterNo AS registerNo,
          i.Model AS model,
          i.Project AS project,
          l.NewLocation AS currentLocation,
          l.OldLocation AS originLocation,
          l.NewLocation AS destinationLocation,
          CONCAT(N'📍 ย้ายสถานที่: ', ISNULL(l.OldLocation, '-'), N' → ', ISNULL(l.NewLocation, '-'), CASE WHEN l.ActionCode IS NOT NULL THEN CONCAT(N' (', l.ActionCode, N')') ELSE N'' END) AS movementDetail,
          l.CreateDate AS movementDate,
          l.CreateDate AS createDate,
          l.CreateUserID AS createUserId,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS createUserName
        FROM dbo.EV_VehicleLocationLog l
        LEFT JOIN dbo.EV_InventoryItem i ON l.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_User u ON l.CreateUserID = u.UserID

        UNION ALL

        -- B. บันทึกจาก EV_VehicleNote
        SELECT
          CONCAT('NOTE-', n.VehicleNoteID) AS movementId,
          n.InventoryItemID AS inventoryItemId,
          i.VinNo AS vinNo,
          i.RegisterNo AS registerNo,
          i.Model AS model,
          i.Project AS project,
          i.CurrentLocation AS currentLocation,
          NULL AS originLocation,
          NULL AS destinationLocation,
          n.NoteDetail AS movementDetail,
          n.CreateDate AS movementDate,
          n.CreateDate AS createDate,
          n.CreateUserID AS createUserId,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS createUserName
        FROM dbo.EV_VehicleNote n
        INNER JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
        WHERE (
          n.NoteDetail LIKE N'%ย้ายสถานที่%' 
          OR n.NoteDetail LIKE N'%เปลี่ยนสถานที่%'
        ) AND n.IsActive = 1
      ),
      MovementView AS (
        SELECT
          m.*,
          ISNULL(loc.StatusName, m.currentLocation) AS currentLocationName
        FROM LocationMovements m
        LEFT JOIN dbo.EV_MsSubStatus loc ON m.currentLocation = loc.StatusCode AND loc.Type = 'LOCATION'
      )
    `

    // Build WHERE conditions
    const whereConditions: string[] = ['movementDate IS NOT NULL']
    const dataReq = pool.request()
    const countReq = pool.request()

    if (search) {
      const searchPattern = `%${search}%`
      dataReq.input('search', sql.NVarChar, searchPattern)
      countReq.input('search', sql.NVarChar, searchPattern)
      whereConditions.push(`(
        vinNo LIKE @search OR
        registerNo LIKE @search OR
        model LIKE @search OR
        movementDetail LIKE @search OR
        currentLocationName LIKE @search OR
        createUserName LIKE @search
      )`)
    }

    if (location) {
      dataReq.input('locFilter', sql.NVarChar, `%${location}%`)
      countReq.input('locFilter', sql.NVarChar, `%${location}%`)
      whereConditions.push(`(
        currentLocationName LIKE @locFilter OR
        movementDetail LIKE @locFilter
      )`)
    }

    if (startDate) {
      dataReq.input('startDate', sql.Date, startDate)
      countReq.input('startDate', sql.Date, startDate)
      whereConditions.push('CAST(movementDate AS DATE) >= @startDate')
    }

    if (endDate) {
      dataReq.input('endDate', sql.Date, endDate)
      countReq.input('endDate', sql.Date, endDate)
      whereConditions.push('CAST(movementDate AS DATE) <= @endDate')
    }

    const whereSql = whereConditions.join(' AND ')

    // Execute Count and Data in Parallel
    const offset = (page - 1) * limit
    dataReq.input('offset', sql.Int, offset)
    dataReq.input('limit', sql.Int, limit)

    const [countRes, dataRes, statsRes] = await Promise.all([
      countReq.query(`
        ${baseCte}
        SELECT COUNT(*) AS total FROM MovementView WHERE ${whereSql}
      `),
      dataReq.query(`
        ${baseCte}
        SELECT *
        FROM MovementView
        WHERE ${whereSql}
        ORDER BY movementDate DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `),
      pool.request().query(`
        ${baseCte}
        SELECT
          COUNT(*) AS totalCount,
          SUM(CASE WHEN MONTH(movementDate) = MONTH(GETDATE()) AND YEAR(movementDate) = YEAR(GETDATE()) THEN 1 ELSE 0 END) AS thisMonthCount,
          SUM(CASE WHEN CAST(movementDate AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS todayCount,
          COUNT(DISTINCT vinNo) AS uniqueVehicles
        FROM MovementView
        WHERE movementDate IS NOT NULL
      `).catch(() => ({ recordset: [{ totalCount: 0, thisMonthCount: 0, todayCount: 0, uniqueVehicles: 0 }] }))
    ])

    const total = countRes.recordset[0]?.total || 0
    const statRow = statsRes.recordset[0] || {}

    // Map records with parsed From/To and masked user names
    const records: VehicleLocationMovementItem[] = (dataRes.recordset || []).map((row: Record<string, unknown>) => {
      const detail = (row.movementDetail as string) || ''
      const parsed = parseLocationNote(detail, locMap)

      const fromLoc = parsed.fromLocation || (row.originLocation as string) || null
      const toLoc = parsed.toLocation || (row.destinationLocation as string) || null
      const effectiveActor = parsed.actor || (row.createUserName as string) || '-'

      return {
        movementId: String(row.movementId || ''),
        inventoryItemId: row.inventoryItemId ? Number(row.inventoryItemId) : null,
        vinNo: String(row.vinNo || ''),
        registerNo: (row.registerNo as string) || null,
        model: (row.model as string) || null,
        project: (row.project as string) || null,
        currentLocation: (row.currentLocation as string) || null,
        currentLocationName: (row.currentLocationName as string) || null,
        fromLocation: fromLoc,
        toLocation: toLoc,
        movementDetail: detail,
        movementDate: row.movementDate ? new Date(row.movementDate as string).toISOString() : new Date().toISOString(),
        createDate: row.createDate ? new Date(row.createDate as string).toISOString() : new Date().toISOString(),
        createUserId: row.createUserId ? Number(row.createUserId) : null,
        createUserName: maskStaffName(effectiveActor),
      }
    })

    const stats: MovementStats = {
      totalCount: Number(statRow.totalCount || total),
      thisMonthCount: Number(statRow.thisMonthCount || 0),
      todayCount: Number(statRow.todayCount || 0),
      uniqueVehicles: Number(statRow.uniqueVehicles || 0),
    }

    return NextResponse.json({
      records,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('[Vehicle Location Movement API] Error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการย้ายสถานที่รถ', details: String(error) },
      { status: 500 }
    )
  }
}
