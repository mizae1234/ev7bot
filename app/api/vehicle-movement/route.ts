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

export interface VehicleMovementItem {
  movementId: string
  movementType: string
  movementTypeName: string
  inventoryItemId: number | null
  vinNo: string
  registerNo: string | null
  model: string | null
  project: string | null
  currentLocation: string | null
  currentLocationName: string | null
  originLocation: string | null
  destinationLocation: string | null
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
    const movementType = searchParams.get('movementType')?.trim() || ''
    const startDate = searchParams.get('startDate')?.trim() || ''
    const endDate = searchParams.get('endDate')?.trim() || ''
    const location = searchParams.get('location')?.trim() || ''

    const pool = await getMSSQLReadOnlyPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // Unified Movement CTE with safe TRY_CAST for date conversions
    const baseCte = `
      WITH AllMovements AS (
        -- 1. Direct Location Change Notes (from EV_VehicleNote)
        SELECT
          CONCAT('NOTE-', n.VehicleNoteID) AS movementId,
          'LOCATION_CHANGE' AS movementType,
          N'ย้ายสถานที่ / อัปเดตสถานะ' AS movementTypeName,
          n.InventoryItemID AS inventoryItemId,
          i.VinNo AS vinNo,
          i.RegisterNo AS registerNo,
          i.Model AS model,
          i.Project AS project,
          i.CurrentLocation AS currentLocation,
          NULL AS originLocation,
          NULL AS destinationLocation,
          n.NoteDetail AS movementDetail,
          TRY_CAST(n.CreateDate AS DATETIME) AS movementDate,
          TRY_CAST(n.CreateDate AS DATETIME) AS createDate,
          n.CreateUserID AS createUserId,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS createUserName,
          n.IsActive AS isActive
        FROM dbo.EV_VehicleNote n
        INNER JOIN dbo.EV_InventoryItem i ON n.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_User u ON n.CreateUserID = u.UserID
        WHERE (
          n.NoteDetail LIKE N'%ย้ายสถานที่%' 
          OR n.NoteDetail LIKE N'%📍%' 
          OR n.NoteDetail LIKE N'%เปลี่ยนสถานที่%'
          OR n.NoteDetail LIKE N'%ยึดคืนรถยนต์%'
        ) AND n.IsActive = 1

        UNION ALL

        -- 2. Repossessions (from EV_VehicleRepossess)
        SELECT
          CONCAT('REPOSSESS-', r.RepossessID) AS movementId,
          'REPOSSESS' AS movementType,
          N'ยึดคืนรถยนต์' AS movementTypeName,
          r.InventoryItemID AS inventoryItemId,
          r.VinNo AS vinNo,
          i.RegisterNo AS registerNo,
          i.Model AS model,
          i.Project AS project,
          i.CurrentLocation AS currentLocation,
          r.RepossessLocation AS originLocation,
          NULL AS destinationLocation,
          ISNULL(r.Remark, N'ดำเนินการยึดคืนรถยนต์เข้าสู่ระบบ') AS movementDetail,
          TRY_CAST(ISNULL(r.RepossessDate, r.CreateDate) AS DATETIME) AS movementDate,
          TRY_CAST(r.CreateDate AS DATETIME) AS createDate,
          r.CreateUserID AS createUserId,
          ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', ISNULL(u.LastName, '')))), ''), u.UserName) AS createUserName,
          r.IsActive AS isActive
        FROM dbo.EV_VehicleRepossess r
        LEFT JOIN dbo.EV_InventoryItem i ON (r.InventoryItemID = i.InventoryItemID OR r.VinNo = i.VinNo)
        LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
        WHERE r.IsActive = 1

        UNION ALL

        -- 3. Returns (from EV_ReturnItem)
        SELECT
          CONCAT('RETURN-', ret.ReturnItemID) AS movementId,
          'RETURN' AS movementType,
          N'ตรวจรับคืนรถยนต์' AS movementTypeName,
          i.InventoryItemID AS inventoryItemId,
          ret.VinNo AS vinNo,
          i.RegisterNo AS registerNo,
          i.Model AS model,
          i.Project AS project,
          i.CurrentLocation AS currentLocation,
          NULL AS originLocation,
          ret.ParkLocation AS destinationLocation,
          CONCAT(N'รับคืนรถยนต์ ลูกค้า: ', ISNULL(ret.CustomerName, '-'), CASE WHEN ret.Mileage IS NOT NULL THEN CONCAT(N' | เลขไมล์: ', ret.Mileage, N' กม.') ELSE N'' END) AS movementDetail,
          TRY_CAST(ISNULL(ret.ReturnDate, ret.ReceiveDate) AS DATETIME) AS movementDate,
          TRY_CAST(ISNULL(ret.ReturnDate, ret.ReceiveDate) AS DATETIME) AS createDate,
          NULL AS createUserId,
          N'เจ้าหน้าที่รับคืนรถ' AS createUserName,
          1 AS isActive
        FROM dbo.EV_ReturnItem ret
        LEFT JOIN dbo.EV_InventoryItem i ON ret.VinNo = i.VinNo
        WHERE ret.ParkLocation IS NOT NULL OR ret.ReturnDate IS NOT NULL
      ),
      MovementView AS (
        SELECT
          m.*,
          ISNULL(loc.StatusName, m.currentLocation) AS currentLocationName
        FROM AllMovements m
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
        originLocation LIKE @search OR
        destinationLocation LIKE @search OR
        currentLocationName LIKE @search OR
        createUserName LIKE @search
      )`)
    }

    if (movementType && movementType !== 'ALL') {
      dataReq.input('movementType', sql.VarChar, movementType)
      countReq.input('movementType', sql.VarChar, movementType)
      whereConditions.push('movementType = @movementType')
    }

    if (location) {
      dataReq.input('locFilter', sql.NVarChar, `%${location}%`)
      countReq.input('locFilter', sql.NVarChar, `%${location}%`)
      whereConditions.push(`(
        currentLocationName LIKE @locFilter OR
        originLocation LIKE @locFilter OR
        destinationLocation LIKE @locFilter OR
        movementDetail LIKE @locFilter
      )`)
    }

    if (startDate) {
      dataReq.input('startDate', sql.Date, startDate)
      countReq.input('startDate', sql.Date, startDate)
      whereConditions.push('TRY_CAST(movementDate AS DATE) >= @startDate')
    }

    if (endDate) {
      dataReq.input('endDate', sql.Date, endDate)
      countReq.input('endDate', sql.Date, endDate)
      whereConditions.push('TRY_CAST(movementDate AS DATE) <= @endDate')
    }

    const whereSql = whereConditions.join(' AND ')

    // Execute Count Query
    const totalCountQuery = `
      ${baseCte}
      SELECT COUNT(*) AS total FROM MovementView WHERE ${whereSql}
    `
    const countRes = await countReq.query(totalCountQuery)
    const total = countRes.recordset[0]?.total || 0

    // Execute Paginated Data Query
    const offset = (page - 1) * limit
    dataReq.input('offset', sql.Int, offset)
    dataReq.input('limit', sql.Int, limit)

    const dataQuery = `
      ${baseCte}
      SELECT *
      FROM MovementView
      WHERE ${whereSql}
      ORDER BY movementDate DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `
    const dataRes = await dataReq.query(dataQuery)

    // Execute KPI Stats
    const statsReq = pool.request()
    const statsQuery = `
      ${baseCte}
      SELECT
        COUNT(*) AS totalCount,
        SUM(CASE WHEN MONTH(movementDate) = MONTH(GETDATE()) AND YEAR(movementDate) = YEAR(GETDATE()) THEN 1 ELSE 0 END) AS thisMonthCount,
        SUM(CASE WHEN TRY_CAST(movementDate AS DATE) = TRY_CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS todayCount,
        COUNT(DISTINCT vinNo) AS uniqueVehicles
      FROM MovementView
      WHERE movementDate IS NOT NULL
    `
    const statsRes = await statsReq.query(statsQuery)
    const statRow = statsRes.recordset[0] || {}

    // Map records with masked user names
    const records: VehicleMovementItem[] = (dataRes.recordset || []).map((row: Record<string, unknown>) => ({
      movementId: String(row.movementId || ''),
      movementType: String(row.movementType || 'LOCATION_CHANGE'),
      movementTypeName: String(row.movementTypeName || 'ย้ายสถานที่'),
      inventoryItemId: row.inventoryItemId ? Number(row.inventoryItemId) : null,
      vinNo: String(row.vinNo || ''),
      registerNo: (row.registerNo as string) || null,
      model: (row.model as string) || null,
      project: (row.project as string) || null,
      currentLocation: (row.currentLocation as string) || null,
      currentLocationName: (row.currentLocationName as string) || null,
      originLocation: (row.originLocation as string) || null,
      destinationLocation: (row.destinationLocation as string) || null,
      movementDetail: (row.movementDetail as string) || null,
      movementDate: row.movementDate ? new Date(row.movementDate as string).toISOString() : new Date().toISOString(),
      createDate: row.createDate ? new Date(row.createDate as string).toISOString() : new Date().toISOString(),
      createUserId: row.createUserId ? Number(row.createUserId) : null,
      createUserName: maskStaffName(row.createUserName as string),
    }))

    const stats: MovementStats = {
      totalCount: Number(statRow.totalCount || 0),
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
    console.error('[Vehicle Movement API] Error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการเคลื่อนย้ายรถ', details: String(error) },
      { status: 500 }
    )
  }
}
