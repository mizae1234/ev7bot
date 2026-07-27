import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// API Route for managing Spare Parts Audit Sessions
// POST: Create a new audit session
// GET: Fetch list of sessions or details of a single session
// PUT: Update status of a session (e.g., COMPLETE, CANCELED)
export async function POST(request: NextRequest) {
  try {
    const { date, location, createdBy, notes } = await request.json()
    if (!date || !location) {
      return NextResponse.json({ error: 'Missing date or location' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const result = await pool.request()
      .input('date', sql.Date, date)
      .input('location', sql.NVarChar, location)
      .input('createdBy', sql.NVarChar, createdBy || 'System')
      .input('notes', sql.NVarChar, notes || '')
      .query(`
        INSERT INTO dbo.GI_SparePartAuditSession (AuditDate, Location, Status, CreatedBy, CreateDate, Notes, IsActive)
        VALUES (@date, @location, 'DRAFT', @createdBy, GETDATE(), @notes, 1);
        SELECT SCOPE_IDENTITY() AS AuditSessionID;
      `)

    const newSessionId = result.recordset[0]?.AuditSessionID

    return NextResponse.json({ success: true, auditSessionId: newSessionId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Create Session Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('id')

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    if (sessionId) {
      // 1. Fetch single session details
      const sessionResult = await pool.request()
        .input('sessionId', sql.Int, parseInt(sessionId))
        .query(`
          SELECT s.AuditSessionID, s.AuditDate, s.Location, s.Status, s.CreatedBy, s.CreateDate, s.UpdateDate, s.Notes,
                 sub.StatusName AS LocationName
          FROM dbo.GI_SparePartAuditSession s
          LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
          WHERE s.AuditSessionID = @sessionId AND s.IsActive = 1
        `)

      const session = sessionResult.recordset[0]
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      // 2. Fetch all scanned items for this session
      const itemsResult = await pool.request()
        .input('sessionId', sql.Int, parseInt(sessionId))
        .query(`
          SELECT ai.AuditItemID, ai.AuditSessionID, ai.SKU, ai.Quantity, ai.ScanTime, ai.CreatedBy, ai.Notes,
                 sp.PartName
          FROM dbo.GI_SparePartAuditItem ai
          LEFT JOIN dbo.GI_SparePart sp ON ai.SKU = sp.SKU
          WHERE ai.AuditSessionID = @sessionId AND ai.IsActive = 1
          ORDER BY ai.ScanTime DESC
        `)

      return NextResponse.json({ session, items: itemsResult.recordset })
    }

    // 3. Fetch list of all sessions with scan counts (sum of quantity)
    const result = await pool.request().query(`
      SELECT s.AuditSessionID, s.AuditDate, s.Location, s.Status, s.CreatedBy, s.CreateDate,
             sub.StatusName AS LocationName,
             COALESCE(SUM(i.Quantity), 0) AS CheckedCount
      FROM dbo.GI_SparePartAuditSession s
      LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
      LEFT JOIN dbo.GI_SparePartAuditItem i ON s.AuditSessionID = i.AuditSessionID AND i.IsActive = 1
      WHERE s.IsActive = 1
      GROUP BY s.AuditSessionID, s.AuditDate, s.Location, s.Status, s.CreatedBy, s.CreateDate, sub.StatusName
      ORDER BY s.AuditDate DESC, s.CreateDate DESC
    `)

    return NextResponse.json({ sessions: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Get Session Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { sessionId, status, notes } = await request.json()
    if (!sessionId || !status) {
      return NextResponse.json({ error: 'Missing sessionId or status' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    await pool.request()
      .input('sessionId', sql.Int, sessionId)
      .input('status', sql.NVarChar, status)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        UPDATE dbo.GI_SparePartAuditSession
        SET Status = @status, 
            Notes = COALESCE(@notes, Notes),
            UpdateDate = GETDATE()
        WHERE AuditSessionID = @sessionId
      `)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update Session Status Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
