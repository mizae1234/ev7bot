import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLReadOnlyPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export interface VehicleRepossessItem {
  repossessId: number
  inventoryItemId: number | null
  vinNo: string
  registerNo: string | null
  model: string | null
  project: string | null
  currentLocation: string | null
  currentLocationName: string | null
  carStatus: string | null
  carStatusName: string | null
  rentItemId: number | null
  contractNo: string | null
  customerName: string | null
  customerPhone: string | null
  repossessDate: string
  repossessLocation: string | null
  remark: string | null
  createDate: string
  createUserId: number | null
  createUserName: string | null
  updateDate: string | null
  updateUserName: string | null
}

export interface RepossessStats {
  totalCount: number
  thisMonthCount: number
  withContractCount: number
  topLocations: { name: string; count: number }[]
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

    // Build WHERE clause
    const whereConditions: string[] = ['r.IsActive = 1']
    const dataReq = pool.request()
    const countReq = pool.request()

    if (search) {
      const searchPattern = `%${search}%`
      dataReq.input('search', sql.NVarChar, searchPattern)
      countReq.input('search', sql.NVarChar, searchPattern)
      whereConditions.push(`(
        r.VinNo LIKE @search OR
        i.RegisterNo LIKE @search OR
        i.Model LIKE @search OR
        r.ContractNo LIKE @search OR
        r.RepossessLocation LIKE @search OR
        r.Remark LIKE @search OR
        u.FirstName LIKE @search OR
        u.LastName LIKE @search OR
        u.UserName LIKE @search
      )`)
    }

    if (startDate) {
      dataReq.input('startDate', sql.Date, startDate)
      countReq.input('startDate', sql.Date, startDate)
      whereConditions.push('CAST(r.RepossessDate AS DATE) >= @startDate')
    }

    if (endDate) {
      dataReq.input('endDate', sql.Date, endDate)
      countReq.input('endDate', sql.Date, endDate)
      whereConditions.push('CAST(r.RepossessDate AS DATE) <= @endDate')
    }

    if (location && location !== 'ALL') {
      dataReq.input('location', sql.NVarChar, location)
      countReq.input('location', sql.NVarChar, location)
      whereConditions.push('r.RepossessLocation = @location')
    }

    const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // 1. Count query
    const countSql = `
      SELECT COUNT(*) AS Total
      FROM dbo.EV_VehicleRepossess r
      LEFT JOIN dbo.EV_InventoryItem i ON r.VinNo = i.VinNo
      LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
      ${whereSql}
    `

    // 2. Data query
    const offset = (page - 1) * limit
    dataReq.input('offset', sql.Int, offset)
    dataReq.input('limit', sql.Int, limit)

    const dataSql = `
      SELECT
        r.RepossessID AS repossessId,
        COALESCE(r.InventoryItemID, i.InventoryItemID) AS inventoryItemId,
        r.VinNo AS vinNo,
        i.RegisterNo AS registerNo,
        i.Model AS model,
        i.Project AS project,
        i.CurrentLocation AS currentLocation,
        loc.StatusName AS currentLocationName,
        i.Status AS carStatus,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, i.StatusType, i.Status) AS carStatusName,
        r.RentItemID AS rentItemId,
        r.ContractNo AS contractNo,
        r.RepossessDate AS repossessDate,
        r.RepossessLocation AS repossessLocation,
        r.Remark AS remark,
        r.CreateDate AS createDate,
        r.CreateUserID AS createUserId,
        ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(u.FirstName, ' ', u.LastName))), ''), u.UserName) AS createUserName,
        r.UpdateDate AS updateDate,
        ISNULL(NULLIF(RTRIM(LTRIM(CONCAT(uu.FirstName, ' ', uu.LastName))), ''), uu.UserName) AS updateUserName
      FROM dbo.EV_VehicleRepossess r
      LEFT JOIN dbo.EV_InventoryItem i ON r.VinNo = i.VinNo
      LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
      LEFT JOIN dbo.EV_User uu ON r.UpdateUserID = uu.UserID
      LEFT JOIN dbo.EV_MsSubStatus loc ON i.CurrentLocation = loc.StatusCode AND loc.Type = 'LOCATION'
      LEFT JOIN dbo.EV_MsSubStatus sub_st ON i.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      ${whereSql}
      ORDER BY r.RepossessDate DESC, r.RepossessID DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `

    // 3. Stats & Filter options queries (Parallelized)
    const statsReq = pool.request().query(`
      SELECT
        COUNT(*) AS TotalCount,
        SUM(CASE WHEN MONTH(RepossessDate) = MONTH(GETDATE()) AND YEAR(RepossessDate) = YEAR(GETDATE()) THEN 1 ELSE 0 END) AS ThisMonthCount,
        SUM(CASE WHEN ContractNo IS NOT NULL AND RTRIM(LTRIM(ContractNo)) <> '' THEN 1 ELSE 0 END) AS WithContractCount
      FROM dbo.EV_VehicleRepossess
      WHERE IsActive = 1
    `)

    const topLocReq = pool.request().query(`
      SELECT TOP 5
        RepossessLocation AS name,
        COUNT(*) AS count
      FROM dbo.EV_VehicleRepossess
      WHERE IsActive = 1 AND RepossessLocation IS NOT NULL AND RTRIM(LTRIM(RepossessLocation)) <> ''
      GROUP BY RepossessLocation
      ORDER BY COUNT(*) DESC
    `)

    const distinctLocsReq = pool.request().query(`
      SELECT DISTINCT RepossessLocation AS location
      FROM dbo.EV_VehicleRepossess
      WHERE IsActive = 1 AND RepossessLocation IS NOT NULL AND RTRIM(LTRIM(RepossessLocation)) <> ''
      ORDER BY RepossessLocation
    `)

    const [countRes, dataRes, statsRes, topLocRes, distinctLocsRes] = await Promise.all([
      countReq.query(countSql),
      dataReq.query(dataSql),
      statsReq.catch(() => ({ recordset: [] })),
      topLocReq.catch(() => ({ recordset: [] })),
      distinctLocsReq.catch(() => ({ recordset: [] }))
    ])

    const total = countRes.recordset[0]?.Total || 0
    const totalPages = Math.ceil(total / limit) || 1

    // Resolve customer details from EV_RentItem if contractNo or rentItemId exists
    const records: VehicleRepossessItem[] = (dataRes.recordset || []).map((row: Record<string, unknown>) => ({
      repossessId: Number(row.repossessId),
      inventoryItemId: row.inventoryItemId ? Number(row.inventoryItemId) : null,
      vinNo: (row.vinNo as string) || '',
      registerNo: (row.registerNo as string) || null,
      model: (row.model as string) || null,
      project: (row.project as string) || null,
      currentLocation: (row.currentLocation as string) || null,
      currentLocationName: (row.currentLocationName as string) || (row.currentLocation as string) || null,
      carStatus: (row.carStatus as string) || null,
      carStatusName: (row.carStatusName as string) || (row.carStatus as string) || null,
      rentItemId: row.rentItemId ? Number(row.rentItemId) : null,
      contractNo: (row.contractNo as string) || null,
      customerName: null,
      customerPhone: null,
      repossessDate: row.repossessDate ? new Date(row.repossessDate as string).toISOString() : new Date().toISOString(),
      repossessLocation: (row.repossessLocation as string) || null,
      remark: (row.remark as string) || null,
      createDate: row.createDate ? new Date(row.createDate as string).toISOString() : new Date().toISOString(),
      createUserId: row.createUserId ? Number(row.createUserId) : null,
      createUserName: (row.createUserName as string) || null,
      updateDate: row.updateDate ? new Date(row.updateDate as string).toISOString() : null,
      updateUserName: (row.updateUserName as string) || null
    }))

    // Batch lookup customer names for any rentItemId / contractNo
    const contractNumbers = Array.from(new Set(records.map(r => r.contractNo).filter(Boolean))) as string[]
    if (contractNumbers.length > 0) {
      try {
        const rentReq = pool.request()
        const placeholders = contractNumbers.map((c, i) => `@c${i}`).join(',')
        contractNumbers.forEach((c, i) => rentReq.input(`c${i}`, sql.VarChar, c))

        const rentRes = await rentReq.query(`
          SELECT 
            ContractNo,
            RTRIM(LTRIM(CONCAT(FirstName, ' ', LastName))) AS CustomerName,
            PhoneNo
          FROM dbo.EV_RentItem
          WHERE ContractNo IN (${placeholders}) AND IsActive = 1
        `)

        const customerMap = new Map<string, { name: string; phone: string }>()
        rentRes.recordset.forEach((r: Record<string, unknown>) => {
          if (r.ContractNo) {
            customerMap.set(r.ContractNo as string, {
              name: (r.CustomerName as string) || '',
              phone: (r.PhoneNo as string) || ''
            })
          }
        })

        records.forEach((r) => {
          if (r.contractNo && customerMap.has(r.contractNo)) {
            const cust = customerMap.get(r.contractNo)!
            r.customerName = cust.name
            r.customerPhone = cust.phone
          }
        })
      } catch (err) {
        console.warn('[Repossess API] RentItem lookup failed:', err)
      }
    }

    const statsRow = statsRes.recordset[0] || {}
    const stats: RepossessStats = {
      totalCount: Number(statsRow.TotalCount || 0),
      thisMonthCount: Number(statsRow.ThisMonthCount || 0),
      withContractCount: Number(statsRow.WithContractCount || 0),
      topLocations: (topLocRes.recordset || []).map((t: Record<string, unknown>) => ({
        name: (t.name as string) || '',
        count: Number(t.count || 0)
      }))
    }

    const locations = (distinctLocsRes.recordset || []).map((l: Record<string, unknown>) => (l.location as string)).filter(Boolean)

    return NextResponse.json({
      records,
      total,
      page,
      totalPages,
      stats,
      locations
    })
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in GET /api/vehicle-repossess:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: errMessage },
      { status: 500 }
    )
  }
}
