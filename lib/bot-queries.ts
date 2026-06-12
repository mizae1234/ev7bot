import { getMSSQLPool, sql } from '@/lib/mssql'

// ─── Helper: Get today's date range ────────────────────────────────
function getTodayRange() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  return {
    start: new Date(`${todayStr}T00:00:00.000Z`),
    end: new Date(`${todayStr}T23:59:59.999Z`),
    dateStr: todayStr,
  }
}

function getDateRange(dateStr: string) {
  return {
    start: new Date(`${dateStr}T00:00:00.000Z`),
    end: new Date(`${dateStr}T23:59:59.999Z`),
    dateStr,
  }
}

function getMonthRange(year?: number, month?: number) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 0, 23, 59, 59, 999)
  return { start, end, year: y, month: m }
}

// ─── Function: getDeliveryToday ────────────────────────────────────
export async function getDeliveryToday() {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end } = getTodayRange()
  const req = pool.request()
  req.input('startDate', sql.DateTime, start)
  req.input('endDate', sql.DateTime, end)

  const result = await req.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN r.ReleaseDate IS NULL THEN 1 ELSE 0 END) AS pending
    FROM dbo.EV_RentItem r
    WHERE r.IsActive = 1
      AND (
        (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
        OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
      )
  `)

  // Also get breakdown by project
  const breakdownReq = pool.request()
  breakdownReq.input('startDate', sql.DateTime, start)
  breakdownReq.input('endDate', sql.DateTime, end)
  const breakdown = await breakdownReq.query(`
    SELECT
      ISNULL(i.Project, 'ไม่ระบุ') AS project,
      ISNULL(i.Model, 'ไม่ระบุ') AS model,
      COUNT(*) AS count
    FROM dbo.EV_RentItem r
    LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
    WHERE r.IsActive = 1
      AND (
        (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
        OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
      )
    GROUP BY i.Project, i.Model
    ORDER BY count DESC
  `)

  return {
    date: getTodayRange().dateStr,
    summary: result.recordset[0] || { total: 0, completed: 0, pending: 0 },
    breakdown: breakdown.recordset,
  }
}

// ─── Function: getDeliveryByDate ───────────────────────────────────
export async function getDeliveryByDate(params: { date: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end } = getDateRange(params.date)
  const req = pool.request()
  req.input('startDate', sql.DateTime, start)
  req.input('endDate', sql.DateTime, end)

  const result = await req.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN r.ReleaseDate IS NULL THEN 1 ELSE 0 END) AS pending
    FROM dbo.EV_RentItem r
    WHERE r.IsActive = 1
      AND (
        (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
        OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
      )
  `)

  const breakdownReq = pool.request()
  breakdownReq.input('startDate', sql.DateTime, start)
  breakdownReq.input('endDate', sql.DateTime, end)
  const breakdown = await breakdownReq.query(`
    SELECT
      ISNULL(i.Project, 'ไม่ระบุ') AS project,
      ISNULL(i.Model, 'ไม่ระบุ') AS model,
      COUNT(*) AS count
    FROM dbo.EV_RentItem r
    LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
    WHERE r.IsActive = 1
      AND (
        (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
        OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
      )
    GROUP BY i.Project, i.Model
    ORDER BY count DESC
  `)

  return {
    date: params.date,
    summary: result.recordset[0] || { total: 0, completed: 0, pending: 0 },
    breakdown: breakdown.recordset,
  }
}

// ─── Function: getRepairStatus ─────────────────────────────────────
export async function getRepairStatus(params: { date?: string; model?: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end } = params.date ? getDateRange(params.date) : getTodayRange()

  const req = pool.request()
  req.input('startDate', sql.DateTime, start)
  req.input('endDate', sql.DateTime, end)

  let modelFilter = ''
  if (params.model) {
    req.input('model', sql.NVarChar, `%${params.model}%`)
    modelFilter = 'AND i.Model LIKE @model'
  }

  const result = await req.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN m.CarStatusCode = 'COMPLETE' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'STILL_WORK') THEN 1 ELSE 0 END) AS [open],
      SUM(CASE WHEN m.CarStatusCode = 'IN_MAINTENANCE' THEN 1 ELSE 0 END) AS inMaintenance,
      SUM(CASE WHEN m.CarStatusCode = 'WAITING_FOR_MAINTENANCE' THEN 1 ELSE 0 END) AS waiting,
      SUM(CASE WHEN m.CarStatusCode = 'STILL_WORK' THEN 1 ELSE 0 END) AS stillWork
    FROM dbo.EV_MaintenanceItem m
    LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
    WHERE m.IsActive = 1 ${modelFilter}
      AND (
        (m.ReportDate >= @startDate AND m.ReportDate <= @endDate)
        OR (m.MaintenanceStartDate >= @startDate AND m.MaintenanceStartDate <= @endDate)
        OR (m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate)
      )
  `)

  // Get breakdown by issue
  const issueReq = pool.request()
  issueReq.input('startDate', sql.DateTime, start)
  issueReq.input('endDate', sql.DateTime, end)
  if (params.model) {
    issueReq.input('model', sql.NVarChar, `%${params.model}%`)
  }
  const issues = await issueReq.query(`
    SELECT TOP 10
      m.IssueTitle AS issue,
      m.CarStatusCode AS status,
      COUNT(*) AS count
    FROM dbo.EV_MaintenanceItem m
    LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
    WHERE m.IsActive = 1 ${modelFilter}
      AND (
        (m.ReportDate >= @startDate AND m.ReportDate <= @endDate)
        OR (m.MaintenanceStartDate >= @startDate AND m.MaintenanceStartDate <= @endDate)
        OR (m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate)
      )
    GROUP BY m.IssueTitle, m.CarStatusCode
    ORDER BY count DESC
  `)

  return {
    date: params.date || getTodayRange().dateStr,
    model: params.model || 'ทุกรุ่น',
    summary: result.recordset[0] || { total: 0, closed: 0, open: 0 },
    topIssues: issues.recordset,
  }
}

// ─── Function: getMonthlyStats ─────────────────────────────────────
export async function getMonthlyStats(params: { year?: number; month?: number }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end, year, month } = getMonthRange(params.year, params.month)

  // Delivery stats
  const deliveryReq = pool.request()
  deliveryReq.input('startDate', sql.DateTime, start)
  deliveryReq.input('endDate', sql.DateTime, end)
  const deliveryRes = await deliveryReq.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN r.ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN r.ReleaseDate IS NULL THEN 1 ELSE 0 END) AS pending
    FROM dbo.EV_RentItem r
    WHERE r.IsActive = 1
      AND (
        (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
        OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
      )
  `)

  // Repair stats
  const repairReq = pool.request()
  repairReq.input('startDate', sql.DateTime, start)
  repairReq.input('endDate', sql.DateTime, end)
  const repairRes = await repairReq.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN m.CarStatusCode = 'COMPLETE' THEN 1 ELSE 0 END) AS closed,
      SUM(CASE WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'STILL_WORK') THEN 1 ELSE 0 END) AS [open]
    FROM dbo.EV_MaintenanceItem m
    WHERE m.IsActive = 1
      AND (
        (m.ReportDate >= @startDate AND m.ReportDate <= @endDate)
        OR (m.MaintenanceStartDate >= @startDate AND m.MaintenanceStartDate <= @endDate)
        OR (m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate)
      )
  `)

  // Project breakdown
  const projectReq = pool.request()
  projectReq.input('startDate', sql.DateTime, start)
  projectReq.input('endDate', sql.DateTime, end)
  const projectRes = await projectReq.query(`
    SELECT
      ISNULL(i.Project, 'ไม่ระบุ') AS project,
      COUNT(*) AS count
    FROM dbo.EV_RentItem r
    LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
    WHERE r.IsActive = 1
      AND (
        (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
        OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
      )
    GROUP BY i.Project
    ORDER BY count DESC
  `)

  return {
    year,
    month,
    delivery: deliveryRes.recordset[0] || { total: 0, completed: 0, pending: 0 },
    repair: repairRes.recordset[0] || { total: 0, closed: 0, open: 0 },
    projectBreakdown: projectRes.recordset,
  }
}

// ─── Function: searchVehicle ───────────────────────────────────────
export async function searchVehicle(params: { keyword: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const req = pool.request()
  req.input('keyword', sql.NVarChar, `%${params.keyword}%`)

  const result = await req.query(`
    SELECT TOP 5
      i.InventoryItemID,
      i.VinNo,
      i.RegisterNo,
      i.Model,
      i.Status AS StatusCode,
      i.StatusType,
      i.Project,
      i.ProjectType,
      i.Company,
      r.ContractNo,
      r.FirstName,
      r.LastName,
      r.PhoneNo,
      r.ReleaseDate,
      r.ExpectedReleaseDate,
      r.IsActive AS rentActive
    FROM dbo.EV_InventoryItem i
    LEFT JOIN dbo.EV_RentItem r ON i.InventoryItemID = r.InventoryItemID AND r.IsActive = 1
    WHERE i.VinNo LIKE @keyword
      OR i.RegisterNo LIKE @keyword
      OR i.Model LIKE @keyword
      OR r.ContractNo LIKE @keyword
      OR r.FirstName LIKE @keyword
      OR r.LastName LIKE @keyword
    ORDER BY r.ReleaseDate DESC
  `)

  return {
    keyword: params.keyword,
    count: result.recordset.length,
    vehicles: result.recordset,
  }
}

// ─── Function: runCustomQuery (AI-generated SQL, SELECT + EXEC Get* only) ──────
export async function runCustomQuery(params: { sqlQuery: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  // Safety: only allow SELECT and EXEC Get* statements
  const trimmed = params.sqlQuery.trim().toUpperCase()
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'GRANT', 'REVOKE', 'MERGE']
  for (const word of forbidden) {
    if (trimmed.includes(word)) {
      return { error: `ไม่อนุญาตให้ใช้คำสั่ง ${word} — อนุญาตเฉพาะ SELECT หรือ EXEC Get* เท่านั้น` }
    }
  }

  const isSelect = trimmed.startsWith('SELECT')
  const isExecGet = (trimmed.startsWith('EXEC ') || trimmed.startsWith('EXECUTE ')) && /EXEC(?:UTE)?\s+GET/i.test(trimmed)
  if (!isSelect && !isExecGet) {
    return { error: 'อนุญาตเฉพาะ SELECT หรือ EXEC Get* (Stored Procedures ขึ้นต้นด้วย Get) เท่านั้น' }
  }

  try {
    const result = await pool.request().query(params.sqlQuery)
    // Limit results to prevent token overflow
    const rows = result.recordset.slice(0, 20)
    return {
      rowCount: result.recordset.length,
      shownRows: rows.length,
      data: rows,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `SQL Error: ${message}` }
  }
}

// ─── Function: getPortfolioSummary (ภาพรวม Portfolio ทั้ง port) ─────
export async function getPortfolioSummary() {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  // 1. Overall status breakdown (excluding Active)
  const statusReq = pool.request()
  const statusResult = await statusReq.query(`
    SELECT Status, StatusType, COUNT(*) AS Total
    FROM dbo.EV_InventoryItem
    WHERE IsActive = 1
    GROUP BY Status, StatusType
    ORDER BY Status, StatusType
  `)

  // Build summary from status breakdown
  let onRentTotal = 0, onRoadCount = 0, underMaintenanceOnRent = 0
  let productionTotal = 0, pendingCount = 0, inProcessCount = 0, waitingGRCount = 0
  let replacementTotal = 0, replacementAvailable = 0, replacementCar = 0
  let maintenanceTotal = 0, newMaintenance = 0, onRentMaintenance = 0, useMaintenance = 0
  let availableTotal = 0

  for (const row of statusResult.recordset) {
    const st = row.Status as string
    const stType = (row.StatusType as string) || ''
    const count = row.Total as number

    switch (st) {
      case 'ON_RENT':
        onRentTotal += count
        if (stType.includes('MAINTENANCE')) {
          underMaintenanceOnRent += count
        } else {
          onRoadCount += count
        }
        break
      case 'PRODUCTION':
        productionTotal += count
        if (stType.includes('PENDING')) pendingCount += count
        else if (stType.includes('PROCESS') || stType.includes('IN_PROCESS')) inProcessCount += count
        else pendingCount += count // fallback
        break
      case 'WAITING_FOR_GR':
        productionTotal += count
        waitingGRCount += count
        break
      case 'REPLACEMENT':
        replacementTotal += count
        if (stType.includes('AVAILABLE')) replacementAvailable += count
        else replacementCar += count
        break
      case 'MAINTENANCE':
        maintenanceTotal += count
        if (stType.includes('ON_RENT')) onRentMaintenance += count
        else if (stType.includes('USE')) useMaintenance += count
        else newMaintenance += count
        break
      case 'AVAILABLE':
        availableTotal += count
        break
      // Active excluded
    }
  }

  return {
    onRent: { total: onRentTotal, onRoad: onRoadCount, underMaintenance: underMaintenanceOnRent },
    onProduction: { total: productionTotal, pending: pendingCount, inProcess: inProcessCount, waitingGR: waitingGRCount },
    replacement: { total: replacementTotal, available: replacementAvailable, car: replacementCar },
    underMaintenance: { total: maintenanceTotal, new: newMaintenance, onRent: onRentMaintenance, use: useMaintenance },
    available: { total: availableTotal },
    rawBreakdown: statusResult.recordset,
  }
}

// ─── Function registry (for AI dispatch) ───────────────────────────
export const botFunctions: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {
  getDeliveryToday: () => getDeliveryToday(),
  getDeliveryByDate: (p) => getDeliveryByDate(p as { date: string }),
  getRepairStatus: (p) => getRepairStatus(p as { date?: string; model?: string }),
  getMonthlyStats: (p) => getMonthlyStats(p as { year?: number; month?: number }),
  searchVehicle: (p) => searchVehicle(p as { keyword: string }),
  runCustomQuery: (p) => runCustomQuery(p as { sqlQuery: string }),
  getPortfolioSummary: () => getPortfolioSummary(),
}

