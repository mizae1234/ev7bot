import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, getMSSQLWritePool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'ALL'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const offset = (page - 1) * limit

    // Build WHERE clauses
    const conditions: string[] = []
    const request = pool.request()

    if (search) {
      conditions.push(`(g.VehicleRef LIKE @search OR g.VinNo LIKE @search OR g.CheckInByName LIKE @search OR g.CheckOutByName LIKE @search OR g.CheckInCategory LIKE @search OR g.CheckOutCategory LIKE @search)`)
      request.input('search', sql.NVarChar, `%${search}%`)
    }

    if (status !== 'ALL') {
      conditions.push(`g.Status = @status`)
      request.input('status', sql.NVarChar, status)
    }

    if (startDate) {
      conditions.push(`g.CreateDate >= @startDate`)
      request.input('startDate', sql.DateTime, new Date(`${startDate}T00:00:00`))
    }

    if (endDate) {
      conditions.push(`g.CreateDate <= @endDate`)
      request.input('endDate', sql.DateTime, new Date(`${endDate}T23:59:59`))
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countRes = await request.query(`
      SELECT COUNT(*) as total FROM dbo.EV_GateLog g ${whereClause}
    `)
    const total = countRes.recordset[0]?.total || 0

    // Get paginated data
    const dataRequest = pool.request()
    if (search) dataRequest.input('search', sql.NVarChar, `%${search}%`)
    if (status !== 'ALL') dataRequest.input('status', sql.NVarChar, status)
    if (startDate) dataRequest.input('startDate', sql.DateTime, new Date(`${startDate}T00:00:00`))
    if (endDate) dataRequest.input('endDate', sql.DateTime, new Date(`${endDate}T23:59:59`))
    dataRequest.input('offset', sql.Int, offset)
    dataRequest.input('limit', sql.Int, limit)

    const dataRes = await dataRequest.query(`
      SELECT 
        g.GateLogID,
        g.VehicleRef,
        g.VinNo,
        g.CheckInTime,
        g.CheckInCategory,
        g.CheckInMessage,
        g.CheckInByName,
        g.CheckOutTime,
        g.CheckOutCategory,
        g.CheckOutMessage,
        g.CheckOutByName,
        g.Status,
        g.Note,
        g.CreateDate,
        g.UpdateDate
      FROM dbo.EV_GateLog g
      ${whereClause}
      ORDER BY g.CreateDate DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `)

    // Get summary stats (today only)
    const statsRequest = pool.request()
    const statsRes = await statsRequest.query(`
      SELECT
        COUNT(*) as totalToday,
        SUM(CASE WHEN Status = 'IN' THEN 1 ELSE 0 END) as inYard,
        SUM(CASE WHEN Status = 'OUT' THEN 1 ELSE 0 END) as outPaired,
        SUM(CASE WHEN Status = 'OUT_ONLY' THEN 1 ELSE 0 END) as outOnly,
        SUM(CASE WHEN Status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
      FROM dbo.EV_GateLog
      WHERE CAST(CreateDate AS DATE) = CAST(GETDATE() AS DATE)
    `)

    const stats = statsRes.recordset[0] || {}

    return NextResponse.json({
      logs: dataRes.recordset,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalToday: stats.totalToday || 0,
        inYard: stats.inYard || 0,
        outPaired: stats.outPaired || 0,
        outOnly: stats.outOnly || 0,
        cancelled: stats.cancelled || 0,
      }
    })
  } catch (error: any) {
    console.error('[Gate Logs API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'Missing id or action' }, { status: 400 })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    if (action === 'cancel') {
      const updateReq = pool.request()
      updateReq.input('id', sql.Int, parseInt(id))
      await updateReq.query(`
        UPDATE dbo.EV_GateLog SET Status = 'CANCELLED', UpdateDate = GETDATE()
        WHERE GateLogID = @id
      `)
      return NextResponse.json({ success: true, status: 'CANCELLED' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('[Gate Logs API PATCH Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
