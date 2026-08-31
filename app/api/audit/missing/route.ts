import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

// GET /api/audit/missing?sessionId=18&search=&status=&location=&reportType=missing|mismatch
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionIdParam = searchParams.get('sessionId')
    const search = (searchParams.get('search') || '').trim()
    const statusFilter = searchParams.get('status') || 'ALL'
    const customLocation = searchParams.get('location') || ''
    const reportType = searchParams.get('reportType') || 'all' // 'missing' | 'mismatch' | 'all'

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // 1. Fetch list of all audit sessions for dropdown selection
    const sessionsRes = await pool.request().query(`
      SELECT 
        s.AuditSessionID,
        s.AuditDate,
        s.Location,
        s.Status,
        s.CreatedBy,
        s.CreateDate,
        s.Notes,
        sub.StatusName AS LocationName,
        COUNT(i.AuditItemID) AS CheckedCount
      FROM dbo.EV_AuditSession s
      LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
      LEFT JOIN dbo.EV_AuditItem i ON s.AuditSessionID = i.AuditSessionID AND i.IsActive = 1
      GROUP BY s.AuditSessionID, s.AuditDate, s.Location, s.Status, s.CreatedBy, s.CreateDate, s.Notes, sub.StatusName
      ORDER BY s.AuditDate DESC, s.AuditSessionID DESC
    `)
    const sessions = sessionsRes.recordset

    // Determine target sessionId: if not provided or invalid, use the latest session
    let targetSessionId = parseInt(sessionIdParam || '0', 10)
    if (!targetSessionId || isNaN(targetSessionId)) {
      targetSessionId = sessions[0]?.AuditSessionID || 18
    }

    // 2. Fetch target session detail
    const sessionRes = await pool.request()
      .input('sessionId', sql.Int, targetSessionId)
      .query(`
        SELECT 
          s.AuditSessionID,
          s.AuditDate,
          s.Location,
          s.Status,
          s.CreatedBy,
          s.CreateDate,
          s.Notes,
          sub.StatusName AS LocationName
        FROM dbo.EV_AuditSession s
        LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
        WHERE s.AuditSessionID = @sessionId
      `)
    const targetSession = sessionRes.recordset[0]

    if (!targetSession) {
      return NextResponse.json({
        sessions,
        session: null,
        missingVehicles: [],
        mismatchedVehicles: [],
        totalInLocation: 0,
        auditedCount: 0,
        missingCount: 0,
        mismatchCount: 0,
        statusSummary: [],
        mismatchStatusSummary: [],
        message: 'ไม่พบรอบ Audit Session ที่ระบุ'
      })
    }

    const targetLocation = customLocation || targetSession.Location

    // 3. Count audited items in this session
    const auditedCountRes = await pool.request()
      .input('sessionId', sql.Int, targetSessionId)
      .query(`
        SELECT COUNT(*) AS AuditedCount 
        FROM dbo.EV_AuditItem 
        WHERE AuditSessionID = @sessionId AND IsActive = 1
      `)
    const auditedCount = auditedCountRes.recordset[0]?.AuditedCount || 0

    // 4. Count total vehicles in system at this location
    const totalInLocRes = await pool.request()
      .input('location', sql.NVarChar, targetLocation)
      .query(`
        SELECT COUNT(*) AS TotalCount 
        FROM dbo.EV_InventoryItem 
        WHERE IsActive = 1 AND CurrentLocation = @location
      `)
    const totalInLocation = totalInLocRes.recordset[0]?.TotalCount || 0

    const cleanSearch = search.replace(/[-\s]/g, '')

    // Determine previous session ID (for comparison / history check)
    const prevSession = sessions.find((s: { AuditSessionID: number }) => s.AuditSessionID < targetSessionId)
    const prevSessionId = prevSession?.AuditSessionID || (targetSessionId > 1 ? targetSessionId - 1 : 0)

    // 5. Query missing vehicles (CurrentLocation = targetLocation AND NOT IN EV_AuditItem for targetSessionId)
    const missingReq = pool.request()
      .input('sessionId', sql.Int, targetSessionId)
      .input('location', sql.NVarChar, targetLocation)
      .input('prevSessionId', sql.Int, prevSessionId)

    let missingWhereClause = `
      WHERE ii.IsActive = 1 
        AND ii.CurrentLocation = @location
        AND NOT EXISTS (
          SELECT 1 
          FROM dbo.EV_AuditItem ai 
          WHERE ai.AuditSessionID = @sessionId 
            AND ai.VinNo = ii.VinNo 
            AND ai.IsActive = 1
        )
    `

    if (search) {
      missingReq.input('search', sql.NVarChar, `%${search}%`)
      missingReq.input('cleanSearch', sql.NVarChar, `%${cleanSearch}%`)
      missingWhereClause += ` AND (
        ii.VinNo LIKE @search 
        OR ii.RegisterNo LIKE @search 
        OR REPLACE(REPLACE(ii.VinNo, ' ', ''), '-', '') LIKE @cleanSearch
        OR REPLACE(REPLACE(ii.RegisterNo, ' ', ''), '-', '') LIKE @cleanSearch
        OR ii.Model LIKE @search
        OR ii.Company LIKE @search
      )`
    }

    if (statusFilter && statusFilter !== 'ALL') {
      missingReq.input('statusFilter', sql.NVarChar, statusFilter)
      missingWhereClause += ` AND (ii.Status = @statusFilter OR ii.StatusType = @statusFilter)`
    }

    const missingRes = await missingReq.query(`
      SELECT 
        ii.InventoryItemID,
        COALESCE(NULLIF(RTRIM(LTRIM(ii.RegisterNo)), ''), N'รถใหม่') AS RegisterNo,
        ii.VinNo,
        ii.Model,
        ii.Exterior_Color,
        ii.Status,
        ii.StatusType,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, sub_s.DescriptionStatus, sub_s.StatusName, ii.Status) AS StatusThai,
        ii.CurrentLocation,
        sub_loc.StatusName AS CurrentLocationName,
        ii.StockLocation,
        ii.Company,
        ii.ProjectType,
        prev.AuditRow AS PrevAuditRow,
        prev.AuditSlot AS PrevAuditSlot,
        prev.ScanTime AS PrevScanTime,
        CASE WHEN prev.VinNo IS NOT NULL THEN 1 ELSE 0 END AS ScannedInPrevSession
      FROM dbo.EV_InventoryItem ii
      LEFT JOIN dbo.EV_MsSubStatus sub_loc 
        ON ii.CurrentLocation = sub_loc.StatusCode AND sub_loc.Type = 'LOCATION'
      LEFT JOIN dbo.EV_MsSubStatus sub_st 
        ON ii.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_s 
        ON ii.Status = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      LEFT JOIN (
        SELECT VinNo, AuditRow, AuditSlot, ScanTime
        FROM dbo.EV_AuditItem
        WHERE AuditSessionID = @prevSessionId AND IsActive = 1
      ) prev ON ii.VinNo = prev.VinNo
      ${missingWhereClause}
      ORDER BY ii.Status ASC, ii.RegisterNo ASC
    `)
    const missingVehicles = missingRes.recordset

    // 6. Summary breakdown by Status / StatusType of all missing vehicles
    const summaryReq = pool.request()
      .input('sessionId', sql.Int, targetSessionId)
      .input('location', sql.NVarChar, targetLocation)

    const summaryRes = await summaryReq.query(`
      SELECT 
        ii.Status,
        ii.StatusType,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, sub_s.DescriptionStatus, sub_s.StatusName, ii.Status) AS StatusThai,
        COUNT(*) AS Count
      FROM dbo.EV_InventoryItem ii
      LEFT JOIN dbo.EV_MsSubStatus sub_st 
        ON ii.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_s 
        ON ii.Status = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      WHERE ii.IsActive = 1 
        AND ii.CurrentLocation = @location
        AND NOT EXISTS (
          SELECT 1 
          FROM dbo.EV_AuditItem ai 
          WHERE ai.AuditSessionID = @sessionId 
            AND ai.VinNo = ii.VinNo 
            AND ai.IsActive = 1
        )
      GROUP BY 
        ii.Status,
        ii.StatusType,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, sub_s.DescriptionStatus, sub_s.StatusName, ii.Status)
      ORDER BY Count DESC
    `)

    // 7. Query Location Mismatch vehicles (EV_InventoryItem AS BASE -> audited in session, but Location in inventory != session.Location)
    const mismatchReq = pool.request()
      .input('sessionId', sql.Int, targetSessionId)

    let mismatchWhereClause = `
      WHERE ii.IsActive = 1
        AND (ii.CurrentLocation IS NULL OR ii.CurrentLocation != s.Location)
    `

    if (search) {
      mismatchReq.input('search', sql.NVarChar, `%${search}%`)
      mismatchReq.input('cleanSearch', sql.NVarChar, `%${cleanSearch}%`)
      mismatchWhereClause += ` AND (
        ii.VinNo LIKE @search 
        OR ii.RegisterNo LIKE @search 
        OR REPLACE(REPLACE(ii.VinNo, ' ', ''), '-', '') LIKE @cleanSearch
        OR REPLACE(REPLACE(ii.RegisterNo, ' ', ''), '-', '') LIKE @cleanSearch
        OR ii.Model LIKE @search
        OR ii.Company LIKE @search
        OR ii.ProjectType LIKE @search
      )`
    }

    if (statusFilter && statusFilter !== 'ALL') {
      mismatchReq.input('statusFilter', sql.NVarChar, statusFilter)
      mismatchWhereClause += ` AND (ii.Status = @statusFilter OR ii.StatusType = @statusFilter)`
    }

    const mismatchRes = await mismatchReq.query(`
      SELECT 
        ii.InventoryItemID,
        COALESCE(NULLIF(RTRIM(LTRIM(ii.RegisterNo)), ''), N'รถใหม่') AS RegisterNo,
        ii.VinNo,
        ii.Status,
        ii.StatusType,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, sub_s.DescriptionStatus, sub_s.StatusName, ii.Status) AS StatusThai,
        ISNULL(ii.CurrentLocation, N'ไม่ระบุ') AS CurrentLocation,
        ISNULL(sub_loc_curr.StatusName, ii.CurrentLocation) AS CurrentLocationName,
        s.Location AS AuditLocation,
        ISNULL(sub_loc_audit.StatusName, s.Location) AS AuditLocationName,
        ii.Model,
        ii.Exterior_Color,
        ii.Company,
        ii.ProjectType,
        ai.AuditRow,
        ai.AuditSlot,
        ai.SlotPosition,
        ai.ScanTime,
        ai.CreatedBy AS AuditedBy,
        ai.DetectedStatus
      FROM dbo.EV_InventoryItem ii
      INNER JOIN dbo.EV_AuditItem ai 
          ON ii.VinNo = ai.VinNo 
          AND ai.AuditSessionID = @sessionId 
          AND ai.IsActive = 1
      INNER JOIN dbo.EV_AuditSession s 
          ON ai.AuditSessionID = s.AuditSessionID
      LEFT JOIN dbo.EV_MsSubStatus sub_s 
          ON ii.Status = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      LEFT JOIN dbo.EV_MsSubStatus sub_st 
          ON ii.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_loc_curr 
          ON ii.CurrentLocation = sub_loc_curr.StatusCode AND sub_loc_curr.Type = 'LOCATION'
      LEFT JOIN dbo.EV_MsSubStatus sub_loc_audit 
          ON s.Location = sub_loc_audit.StatusCode AND sub_loc_audit.Type = 'LOCATION'
      ${mismatchWhereClause}
      ORDER BY ii.RegisterNo ASC
    `)
    const mismatchedVehicles = mismatchRes.recordset

    // 8. Summary breakdown for mismatch vehicles
    const mismatchSummaryReq = pool.request()
      .input('sessionId', sql.Int, targetSessionId)

    const mismatchSummaryRes = await mismatchSummaryReq.query(`
      SELECT 
        ii.Status,
        ii.StatusType,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, sub_s.DescriptionStatus, sub_s.StatusName, ii.Status) AS StatusThai,
        COUNT(*) AS Count
      FROM dbo.EV_InventoryItem ii
      INNER JOIN dbo.EV_AuditItem ai 
          ON ii.VinNo = ai.VinNo 
          AND ai.AuditSessionID = @sessionId 
          AND ai.IsActive = 1
      INNER JOIN dbo.EV_AuditSession s 
          ON ai.AuditSessionID = s.AuditSessionID
      LEFT JOIN dbo.EV_MsSubStatus sub_st 
          ON ii.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_s 
          ON ii.Status = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      WHERE ii.IsActive = 1
        AND (ii.CurrentLocation IS NULL OR ii.CurrentLocation != s.Location)
      GROUP BY 
        ii.Status,
        ii.StatusType,
        COALESCE(sub_st.DescriptionStatus, sub_st.StatusName, sub_s.DescriptionStatus, sub_s.StatusName, ii.Status)
      ORDER BY Count DESC
    `)

    return NextResponse.json({
      sessions,
      session: targetSession,
      prevSessionId,
      missingVehicles,
      mismatchedVehicles,
      totalInLocation,
      auditedCount,
      missingCount: missingVehicles.length,
      mismatchCount: mismatchedVehicles.length,
      allMissingCount: summaryRes.recordset.reduce((acc: number, cur: { Count: number }) => acc + cur.Count, 0),
      allMismatchCount: mismatchSummaryRes.recordset.reduce((acc: number, cur: { Count: number }) => acc + cur.Count, 0),
      statusSummary: summaryRes.recordset,
      mismatchStatusSummary: mismatchSummaryRes.recordset
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Audit Report API Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
