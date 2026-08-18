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

    // 1. Query strictly from dbo.EV_VehicleLocationLog joined with dbo.EV_MsSubStatus for Thai names
    const baseCte = `
      WITH MovementView AS (
        SELECT
          CONCAT('LOC-', ISNULL(CAST(l.InventoryItemID AS VARCHAR(20)), '0'), '-', CONVERT(VARCHAR(30), l.CreateDate, 126)) AS movementId,
          l.InventoryItemID AS inventoryItemId,
          l.VinNo AS vinNo,
          i.RegisterNo AS registerNo,
          i.Model AS model,
          i.Project AS project,
          l.NewLocation AS currentLocation,
          ISNULL(locTo.StatusName, l.NewLocation) AS currentLocationName,
          ISNULL(locFrom.StatusName, l.OldLocation) AS fromLocation,
          ISNULL(locTo.StatusName, l.NewLocation) AS toLocation,
          CONCAT(
            N'📍 ย้ายสถานที่: ', 
            ISNULL(locFrom.StatusName, ISNULL(l.OldLocation, '-')), 
            N' → ', 
            ISNULL(locTo.StatusName, ISNULL(l.NewLocation, '-'))
          ) AS movementDetail,
          l.CreateDate AS movementDate,
          l.CreateDate AS createDate,
          l.CreateUserID AS createUserId,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS createUserName
        FROM dbo.EV_VehicleLocationLog l
        LEFT JOIN dbo.EV_InventoryItem i ON l.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_User u ON l.CreateUserID = u.UserID
        LEFT JOIN dbo.EV_MsSubStatus locFrom ON l.OldLocation = locFrom.StatusCode AND locFrom.Type = 'LOCATION'
        LEFT JOIN dbo.EV_MsSubStatus locTo ON l.NewLocation = locTo.StatusCode AND locTo.Type = 'LOCATION'
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
        fromLocation LIKE @search OR
        toLocation LIKE @search OR
        movementDetail LIKE @search OR
        createUserName LIKE @search
      )`)
    }

    if (location) {
      dataReq.input('locFilter', sql.NVarChar, `%${location}%`)
      countReq.input('locFilter', sql.NVarChar, `%${location}%`)
      whereConditions.push(`(
        fromLocation LIKE @locFilter OR
        toLocation LIKE @locFilter OR
        currentLocationName LIKE @locFilter
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

    // Execute Count, Data, and Stats in Parallel
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

    // Map records with masked staff names
    const records: VehicleLocationMovementItem[] = (dataRes.recordset || []).map((row: Record<string, unknown>) => {
      return {
        movementId: String(row.movementId || ''),
        inventoryItemId: row.inventoryItemId ? Number(row.inventoryItemId) : null,
        vinNo: String(row.vinNo || ''),
        registerNo: (row.registerNo as string) || null,
        model: (row.model as string) || null,
        project: (row.project as string) || null,
        currentLocation: (row.currentLocation as string) || null,
        currentLocationName: (row.currentLocationName as string) || null,
        fromLocation: (row.fromLocation as string) || null,
        toLocation: (row.toLocation as string) || null,
        movementDetail: (row.movementDetail as string) || '',
        movementDate: row.movementDate ? new Date(row.movementDate as string).toISOString() : new Date().toISOString(),
        createDate: row.createDate ? new Date(row.createDate as string).toISOString() : new Date().toISOString(),
        createUserId: row.createUserId ? Number(row.createUserId) : null,
        createUserName: maskStaffName(row.createUserName as string),
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
