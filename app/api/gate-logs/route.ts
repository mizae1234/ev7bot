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
    const vehicleType = searchParams.get('vehicleType') || 'ALL' // 'ALL' | 'NEW_CAR' | 'PLATE'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const offset = (page - 1) * limit

    // Build WHERE clauses
    const conditions: string[] = []
    const request = pool.request()

    if (search) {
      const cleanSearch = search.replace(/[-\s]/g, '')
      conditions.push(`(
        g.VehicleRef LIKE @search 
        OR REPLACE(REPLACE(g.VehicleRef, '-', ''), ' ', '') LIKE @cleanSearch
        OR g.VinNo LIKE @search 
        OR g.CheckInByName LIKE @search 
        OR g.CheckOutByName LIKE @search 
        OR g.CheckInCategory LIKE @search 
        OR g.CheckOutCategory LIKE @search 
        OR g.CheckInMessage LIKE @search 
        OR g.CheckOutMessage LIKE @search
      )`)
      request.input('search', sql.NVarChar, `%${search}%`)
      request.input('cleanSearch', sql.NVarChar, `%${cleanSearch}%`)
    }

    if (status !== 'ALL') {
      conditions.push(`g.Status = @status`)
      request.input('status', sql.NVarChar, status)
    }

    if (vehicleType === 'NEW_CAR') {
      conditions.push(`(g.VehicleRef LIKE '%รถใหม่%' OR g.QuantityIn > 1 OR g.QuantityOut > 1)`)
    } else if (vehicleType === 'PLATE') {
      conditions.push(`(g.VehicleRef NOT LIKE '%รถใหม่%' AND g.QuantityIn <= 1)`)
    }

    if (startDate && endDate) {
      conditions.push(`(
        (g.CheckInTime >= @startDate AND g.CheckInTime <= @endDate)
        OR (g.CheckOutTime >= @startDate AND g.CheckOutTime <= @endDate)
        OR (g.CreateDate >= @startDate AND g.CreateDate <= @endDate)
        OR (g.UpdateDate >= @startDate AND g.UpdateDate <= @endDate)
      )`)
      request.input('startDate', sql.DateTime, new Date(`${startDate}T00:00:00`))
      request.input('endDate', sql.DateTime, new Date(`${endDate}T23:59:59`))
    } else if (startDate) {
      conditions.push(`(
        g.CheckInTime >= @startDate
        OR g.CheckOutTime >= @startDate
        OR g.CreateDate >= @startDate
        OR g.UpdateDate >= @startDate
      )`)
      request.input('startDate', sql.DateTime, new Date(`${startDate}T00:00:00`))
    } else if (endDate) {
      conditions.push(`(
        g.CheckInTime <= @endDate
        OR g.CheckOutTime <= @endDate
        OR g.CreateDate <= @endDate
        OR g.UpdateDate <= @endDate
      )`)
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
    if (search) {
      const cleanSearch = search.replace(/[-\s]/g, '')
      dataRequest.input('search', sql.NVarChar, `%${search}%`)
      dataRequest.input('cleanSearch', sql.NVarChar, `%${cleanSearch}%`)
    }
    if (status !== 'ALL') dataRequest.input('status', sql.NVarChar, status)
    if (startDate && endDate) {
      dataRequest.input('startDate', sql.DateTime, new Date(`${startDate}T00:00:00`))
      dataRequest.input('endDate', sql.DateTime, new Date(`${endDate}T23:59:59`))
    } else if (startDate) {
      dataRequest.input('startDate', sql.DateTime, new Date(`${startDate}T00:00:00`))
    } else if (endDate) {
      dataRequest.input('endDate', sql.DateTime, new Date(`${endDate}T23:59:59`))
    }
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
        g.QuantityIn,
        g.QuantityOut,
        g.Status,
        g.Note,
        g.CreateDate,
        g.UpdateDate
      FROM dbo.EV_GateLog g
      ${whereClause}
      ORDER BY COALESCE(g.CheckOutTime, g.CheckInTime, g.CreateDate) DESC, g.GateLogID DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `)

    // Get summary stats
    const statsRequest = pool.request()
    const statsRes = await statsRequest.query(`
      SELECT
        COUNT(CASE WHEN CAST(CreateDate AS DATE) = CAST(GETDATE() AS DATE) OR CAST(CheckOutTime AS DATE) = CAST(GETDATE() AS DATE) OR CAST(CheckInTime AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE NULL END) as totalRecordsToday,
        SUM(CASE WHEN CAST(CheckInTime AS DATE) = CAST(GETDATE() AS DATE) OR (CheckInTime IS NULL AND CAST(CreateDate AS DATE) = CAST(GETDATE() AS DATE)) THEN QuantityIn ELSE 0 END) as totalVehiclesInToday,
        SUM(CASE WHEN Status = 'IN' THEN (CASE WHEN QuantityIn > QuantityOut THEN (QuantityIn - QuantityOut) ELSE 1 END) ELSE 0 END) as inYardVehicles,
        SUM(CASE WHEN Status = 'IN' AND (VehicleRef LIKE '%รถใหม่%' OR QuantityIn > 1) THEN (CASE WHEN QuantityIn > QuantityOut THEN (QuantityIn - QuantityOut) ELSE 0 END) ELSE 0 END) as inYardNewCars,
        SUM(CASE WHEN Status = 'IN' AND (VehicleRef NOT LIKE '%รถใหม่%' AND QuantityIn <= 1) THEN 1 ELSE 0 END) as inYardPlateCars,
        SUM(CASE WHEN CAST(CheckOutTime AS DATE) = CAST(GETDATE() AS DATE) THEN (CASE WHEN Status = 'OUT' THEN QuantityIn WHEN Status = 'OUT_ONLY' THEN (CASE WHEN QuantityOut > 0 THEN QuantityOut ELSE 1 END) ELSE QuantityOut END) ELSE 0 END) as outTodayVehicles,
        SUM(CASE WHEN Status = 'OUT_ONLY' AND CAST(CheckOutTime AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as outOnlyRecords,
        SUM(CASE WHEN Status = 'CANCELLED' AND CAST(UpdateDate AS DATE) = CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) as cancelledRecords
      FROM dbo.EV_GateLog
    `)

    const stats = statsRes.recordset[0] || {}

    return NextResponse.json({
      logs: dataRes.recordset,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: {
        totalToday: stats.totalRecordsToday || 0,
        totalVehiclesInToday: stats.totalVehiclesInToday || 0,
        inYard: stats.inYardVehicles || 0,
        inYardNewCars: stats.inYardNewCars || 0,
        inYardPlateCars: stats.inYardPlateCars || 0,
        outPaired: stats.outTodayVehicles || 0,
        outOnly: stats.outOnlyRecords || 0,
        cancelled: stats.cancelledRecords || 0,
      }
    })
  } catch (error: any) {
    console.error('[Gate Logs API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function toMssqlDate(d: string | null | undefined): string | null {
  if (!d || !d.trim()) return null
  let result = d.trim().replace('T', ' ')
  if (result.split(':').length === 2) result += ':00'
  return result
}

function normalizeVehicleRef(ref: string | null | undefined): string | null {
  if (!ref || !ref.trim()) return null
  const trimmed = ref.trim()
  if (trimmed === 'รถใหม่' || trimmed.includes('รถใหม่')) {
    return 'รถใหม่'
  }
  // Standardize plate: "ทอ 1234", "ทอ-1234", "1กก 1234" -> "ทอ-1234", "1กก-1234"
  return trimmed.replace(/[\s\-_]+/g, '').replace(/([ก-ฮ]+)(\d)/g, '$1-$2')
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req)
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req)
}

async function handleUpdate(req: NextRequest) {
  try {
    const body = await req.json()
    const rawId = body.id || body.GateLogID
    const id = parseInt(String(rawId), 10)

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Missing or invalid GateLog ID' }, { status: 400 })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Quick action: cancel
    if (body.action === 'cancel') {
      const updateReq = pool.request()
      updateReq.input('id', sql.Int, id)
      await updateReq.query(`
        UPDATE dbo.EV_GateLog SET Status = 'CANCELLED', UpdateDate = GETDATE()
        WHERE GateLogID = @id
      `)
      return NextResponse.json({ success: true, status: 'CANCELLED' })
    }

    // Full update of fields
    const vehicleRef = normalizeVehicleRef(body.VehicleRef ?? body.vehicleRef)
    const vinNo = (body.VinNo ?? body.vinNo)?.trim() || null
    const checkInTime = toMssqlDate(body.CheckInTime ?? body.checkInTime)
    const checkInCategory = (body.CheckInCategory ?? body.checkInCategory)?.trim() || null
    const checkInByName = (body.CheckInByName ?? body.checkInByName)?.trim() || null
    const checkOutTime = toMssqlDate(body.CheckOutTime ?? body.checkOutTime)
    const checkOutCategory = (body.CheckOutCategory ?? body.checkOutCategory)?.trim() || null
    const checkOutByName = (body.CheckOutByName ?? body.checkOutByName)?.trim() || null
    const quantityIn = Math.max(1, parseInt(String(body.QuantityIn ?? body.quantityIn ?? 1), 10) || 1)
    const quantityOut = Math.max(0, parseInt(String(body.QuantityOut ?? body.quantityOut ?? 0), 10) || 0)
    const status = (body.Status ?? body.status)?.trim() || 'IN'
    const note = (body.Note ?? body.note)?.trim() || null

    const updateReq = pool.request()
    updateReq.input('id', sql.Int, id)
    updateReq.input('vehicleRef', sql.NVarChar, vehicleRef)
    updateReq.input('vinNo', sql.NVarChar, vinNo)
    updateReq.input('checkInTime', sql.DateTime, checkInTime ? new Date(checkInTime) : null)
    updateReq.input('checkInCategory', sql.NVarChar, checkInCategory)
    updateReq.input('checkInByName', sql.NVarChar, checkInByName)
    updateReq.input('checkOutTime', sql.DateTime, checkOutTime ? new Date(checkOutTime) : null)
    updateReq.input('checkOutCategory', sql.NVarChar, checkOutCategory)
    updateReq.input('checkOutByName', sql.NVarChar, checkOutByName)
    updateReq.input('quantityIn', sql.Int, quantityIn)
    updateReq.input('quantityOut', sql.Int, quantityOut)
    updateReq.input('status', sql.NVarChar, status)
    updateReq.input('note', sql.NVarChar, note)

    await updateReq.query(`
      UPDATE dbo.EV_GateLog
      SET
        VehicleRef = @vehicleRef,
        VinNo = @vinNo,
        CheckInTime = @checkInTime,
        CheckInCategory = @checkInCategory,
        CheckInByName = @checkInByName,
        CheckOutTime = @checkOutTime,
        CheckOutCategory = @checkOutCategory,
        CheckOutByName = @checkOutByName,
        QuantityIn = @quantityIn,
        QuantityOut = @quantityOut,
        Status = @status,
        Note = @note,
        UpdateDate = GETDATE()
      WHERE GateLogID = @id
    `)

    return NextResponse.json({
      success: true,
      message: 'บันทึกการแก้ไขข้อมูลสำเร็จ'
    })
  } catch (error: any) {
    console.error('[Gate Logs API Update Error]', error)
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id: number | null = null
    const paramId = req.nextUrl.searchParams.get('id')
    if (paramId) {
      id = parseInt(paramId, 10)
    } else {
      const body = await req.json().catch(() => ({}))
      if (body.id || body.GateLogID) {
        id = parseInt(String(body.id || body.GateLogID), 10)
      }
    }

    if (!id || isNaN(id)) {
      return NextResponse.json({ error: 'Missing or invalid GateLog ID' }, { status: 400 })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const delReq = pool.request()
    delReq.input('id', sql.Int, id)
    await delReq.query(`
      DELETE FROM dbo.EV_GateLog WHERE GateLogID = @id
    `)

    return NextResponse.json({
      success: true,
      message: 'ลบรายการสำเร็จ'
    })
  } catch (error: any) {
    console.error('[Gate Logs API DELETE Error]', error)
    return NextResponse.json({ error: 'Internal Server Error: ' + error.message }, { status: 500 })
  }
}
