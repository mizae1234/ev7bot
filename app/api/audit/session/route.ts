import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// API Route for managing Audit Sessions
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
        INSERT INTO dbo.EV_AuditSession (AuditDate, Location, Status, CreatedBy, CreateDate, Notes)
        VALUES (@date, @location, 'DRAFT', @createdBy, GETDATE(), @notes);
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
          FROM dbo.EV_AuditSession s
          LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
          WHERE s.AuditSessionID = @sessionId
        `)

      const session = sessionResult.recordset[0]
      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 })
      }

      // 2. Fetch all scanned items for this session
      // Join with EV_InventoryItem to get vehicle details (RegisterNo, Model, Exterior_Color)
      const itemsResult = await pool.request()
        .input('sessionId', sql.Int, parseInt(sessionId))
        .query(`
          SELECT ai.AuditItemID, ai.AuditSessionID, ai.VinNo, ai.ScanTime, ai.ScanMethod,
                 ai.DetectedStatus, ai.PreviousLocation, ai.IsConfirmed, ai.CreatedBy, ai.Notes,
                 ai.VehicleStatus, ai.VehicleStatusType,
                 ii.RegisterNo, ii.Model, ii.Exterior_Color,
                 sub_prev.StatusName AS PreviousLocationName,
                 sub_st.StatusName AS StatusTypeName
          FROM dbo.EV_AuditItem ai
          LEFT JOIN dbo.EV_InventoryItem ii ON ai.VinNo = ii.VinNo AND ii.IsActive = 1
          LEFT JOIN dbo.EV_MsSubStatus sub_prev ON ai.PreviousLocation = sub_prev.StatusCode AND sub_prev.Type = 'LOCATION'
          LEFT JOIN dbo.EV_MsSubStatus sub_st ON ai.VehicleStatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
          WHERE ai.AuditSessionID = @sessionId
          ORDER BY ai.ScanTime DESC
        `)

      return NextResponse.json({ session, items: itemsResult.recordset })
    }

    // 3. Fetch list of all sessions with scan counts
    const result = await pool.request().query(`
      SELECT s.AuditSessionID, s.AuditDate, s.Location, s.Status, s.CreatedBy, s.CreateDate,
             sub.StatusName AS LocationName,
             COUNT(i.AuditItemID) AS CheckedCount
      FROM dbo.EV_AuditSession s
      LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
      LEFT JOIN dbo.EV_AuditItem i ON s.AuditSessionID = i.AuditSessionID
      GROUP BY s.AuditSessionID, s.AuditDate, s.Location, s.Status, s.CreatedBy, s.CreateDate, sub.StatusName
      ORDER BY s.AuditDate DESC, s.CreateDate DESC
    `)

    // 4. Fetch vehicle status breakdown per session
    const statusResult = await pool.request().query(`
      SELECT ai.AuditSessionID,
             COALESCE(ISNULL(sub_st.DescriptionStatus, sub_st.StatusName), ISNULL(sub_s.DescriptionStatus, sub_s.StatusName), ai.VehicleStatusType, ai.VehicleStatus, N'ไม่ทราบสถานะ') AS StatusLabel,
             COUNT(*) AS Count
      FROM dbo.EV_AuditItem ai
      LEFT JOIN dbo.EV_MsSubStatus sub_st ON ai.VehicleStatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_s ON ai.VehicleStatus = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      GROUP BY ai.AuditSessionID, COALESCE(ISNULL(sub_st.DescriptionStatus, sub_st.StatusName), ISNULL(sub_s.DescriptionStatus, sub_s.StatusName), ai.VehicleStatusType, ai.VehicleStatus, N'ไม่ทราบสถานะ')
      ORDER BY ai.AuditSessionID, Count DESC
    `)

    return NextResponse.json({ sessions: result.recordset, statusSummary: statusResult.recordset })
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
        UPDATE dbo.EV_AuditSession
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
