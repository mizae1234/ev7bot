import { getMSSQLPool, sql } from '@/lib/mssql'
import { createTaskNote, getPendingTasks, completeTaskNote } from '@/lib/task-service'

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

function processRawDeliveries(rawItems: any[], dateStr: string) {
  const newItems = rawItems.filter(item => item.RentType === 'ONRENT_NEW')
  const usedItems = rawItems.filter(item => item.RentType === 'ONRENT_USE')

  const computeSummaryAndBreakdown = (items: any[]) => {
    const total = items.length
    const completed = items.filter(item => item.ReleaseDate !== null).length
    const pending = items.filter(item => item.ReleaseDate === null).length

    const breakdownMap: Record<string, { project: string, model: string, count: number }> = {}
    for (const item of items) {
      const key = `${item.Project}_${item.Model}`
      if (!breakdownMap[key]) {
        breakdownMap[key] = {
          project: item.Project,
          model: item.Model,
          count: 0
        }
      }
      breakdownMap[key].count++
    }

    const breakdown = Object.values(breakdownMap).sort((a, b) => b.count - a.count)

    return {
      summary: { total, completed, pending },
      breakdown
    }
  }

  return {
    date: dateStr,
    newVehicles: computeSummaryAndBreakdown(newItems),
    usedVehicles: computeSummaryAndBreakdown(usedItems),
  }
}

// ─── Function: getDeliveryToday ────────────────────────────────────
export async function getDeliveryToday() {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end, dateStr } = getTodayRange()
  const req = pool.request()
  req.input('startDate', sql.DateTime, start)
  req.input('endDate', sql.DateTime, end)

  try {
    const result = await req.query(`
      SELECT
        r.RentItemID,
        r.ReleaseDate,
        r.ExpectedReleaseDate,
        ISNULL(i.Project, 'ไม่ระบุ') AS Project,
        ISNULL(i.Model, 'ไม่ระบุ') AS Model,
        ISNULL(i.ProjectType, 'ไม่ระบุ') AS ProjectType,
        CASE 
          WHEN v.RentType IS NOT NULL THEN v.RentType
          WHEN o.RentType IS NOT NULL THEN o.RentType
          WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
               OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
          ELSE 'ONRENT_NEW'
        END AS RentType
      FROM dbo.EV_RentItem r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.View_AccumarateReleaseCar v ON r.RentItemID = v.RentItemID
      LEFT JOIN dbo.View_GetOnrentNewOrUse o ON i.VinNo = o.VinNo
      WHERE r.IsActive = 1
        AND (
          (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
          OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
        )
    `)

    return processRawDeliveries(result.recordset, dateStr)
  } catch (err: any) {
    console.error('[getDeliveryToday] Error:', err.message)
    return { error: `ดึงข้อมูลส่งมอบไม่สำเร็จ: ${err.message}` }
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

  try {
    const result = await req.query(`
      SELECT
        r.RentItemID,
        r.ReleaseDate,
        r.ExpectedReleaseDate,
        ISNULL(i.Project, 'ไม่ระบุ') AS Project,
        ISNULL(i.Model, 'ไม่ระบุ') AS Model,
        ISNULL(i.ProjectType, 'ไม่ระบุ') AS ProjectType,
        CASE 
          WHEN v.RentType IS NOT NULL THEN v.RentType
          WHEN o.RentType IS NOT NULL THEN o.RentType
          WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
               OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
          ELSE 'ONRENT_NEW'
        END AS RentType
      FROM dbo.EV_RentItem r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.View_AccumarateReleaseCar v ON r.RentItemID = v.RentItemID
      LEFT JOIN dbo.View_GetOnrentNewOrUse o ON i.VinNo = o.VinNo
      WHERE r.IsActive = 1
        AND (
          (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
          OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
        )
    `)

    return processRawDeliveries(result.recordset, params.date)
  } catch (err: any) {
    console.error('[getDeliveryByDate] Error:', err.message)
    return { error: `ดึงข้อมูลส่งมอบไม่สำเร็จ: ${err.message}` }
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

  // Get breakdown by issue
  const issueReq = pool.request()
  issueReq.input('startDate', sql.DateTime, start)
  issueReq.input('endDate', sql.DateTime, end)
  if (params.model) {
    issueReq.input('model', sql.NVarChar, `%${params.model}%`)
  }

  // Execute both queries concurrently for high performance
  const [result, issues] = await Promise.all([
    req.query(`
      SELECT
        COUNT(*) AS total,
        ISNULL(SUM(CASE WHEN m.MaintenanceFinishDate IS NOT NULL THEN 1 ELSE 0 END), 0) AS closed,
        ISNULL(SUM(CASE WHEN m.MaintenanceFinishDate IS NULL THEN 1 ELSE 0 END), 0) AS [open],
        ISNULL(SUM(CASE WHEN m.MaintenanceFinishDate IS NULL AND m.CarStatusCode = 'IN_MAINTENANCE' THEN 1 ELSE 0 END), 0) AS inMaintenance,
        ISNULL(SUM(CASE WHEN m.MaintenanceFinishDate IS NULL AND m.CarStatusCode = 'WAITING_FOR_MAINTENANCE' THEN 1 ELSE 0 END), 0) AS waiting,
        ISNULL(SUM(CASE WHEN m.MaintenanceFinishDate IS NULL AND m.CarStatusCode = 'STILL_WORK' THEN 1 ELSE 0 END), 0) AS stillWork
      FROM dbo.EV_MaintenanceItem m
      LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      WHERE m.IsActive = 1 ${modelFilter}
        AND (
          (m.ReportDate >= @startDate AND m.ReportDate <= @endDate)
          OR (m.MaintenanceStartDate >= @startDate AND m.MaintenanceStartDate <= @endDate)
          OR (m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate)
        )
    `),
    issueReq.query(`
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
  ])

  return {
    date: params.date || getTodayRange().dateStr,
    model: params.model || 'ทุกรุ่น',
    summary: result.recordset[0] || { total: 0, closed: 0, open: 0 },
    topIssues: issues.recordset,
  }
}

// ─── Function: getRepairDailySummary (for morning report) ──────────
export async function getRepairDailySummary(dateStr: string) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end } = getDateRange(dateStr)

  // แจ้งซ่อม — นับจาก ReportDate
  const reportReq = pool.request()
  reportReq.input('startDate', sql.DateTime, start)
  reportReq.input('endDate', sql.DateTime, end)

  // ซ่อมเสร็จ — นับจาก MaintenanceFinishDate
  const finishReq = pool.request()
  finishReq.input('startDate', sql.DateTime, start)
  finishReq.input('endDate', sql.DateTime, end)

  // รถทดแทน — นับจาก ReplacementStartDate
  const replReq = pool.request()
  replReq.input('startDate', sql.DateTime, start)
  replReq.input('endDate', sql.DateTime, end)

  // รถคืน — นับจาก ReplacementReturnDate (คืนรถทดแทน)
  const returnReq = pool.request()
  returnReq.input('startDate', sql.DateTime, start)
  returnReq.input('endDate', sql.DateTime, end)

  // Run all 4 queries concurrently for high performance
  const [reportResult, finishResult, replResult, returnResult] = await Promise.all([
    reportReq.query(`
      SELECT COUNT(DISTINCT m.VinNo) AS newReports
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1
        AND m.ReportDate >= @startDate AND m.ReportDate <= @endDate
    `),
    finishReq.query(`
      SELECT COUNT(DISTINCT m.VinNo) AS completed
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1
        AND m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate
    `),
    replReq.query(`
      SELECT COUNT(DISTINCT r.VinNo) AS replacements
      FROM dbo.EV_ReplacementItem r
      WHERE r.IsActive = 1
        AND r.ReplacementStartDate >= @startDate AND r.ReplacementStartDate <= @endDate
    `),
    returnReq.query(`
      SELECT COUNT(DISTINCT r.VinNo) AS returns
      FROM dbo.EV_ReplacementItem r
      WHERE r.IsActive = 1
        AND r.ReplacementReturnDate >= @startDate AND r.ReplacementReturnDate <= @endDate
    `)
  ])

  return {
    date: dateStr,
    newReports: reportResult.recordset[0]?.newReports || 0,
    completed: finishResult.recordset[0]?.completed || 0,
    replacements: replResult.recordset[0]?.replacements || 0,
    returns: returnResult.recordset[0]?.returns || 0,
  }
}

// ─── Function: getMonthlyStats ─────────────────────────────────────
export async function getMonthlyStats(params: { year?: number; month?: number }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end, year, month } = getMonthRange(params.year, params.month)

  // Get planned count from EV_DeliveryPlan (New only)
  const planReq = pool.request()
  planReq.input('startDate', sql.DateTime, start)
  planReq.input('endDate', sql.DateTime, end)

  // Get completed counts from View_AccumarateReleaseCar
  const completedReq = pool.request()
  completedReq.input('startDate', sql.DateTime, start)
  completedReq.input('endDate', sql.DateTime, end)

  // Get pending counts from EV_RentItem
  const pendingReq = pool.request()
  pendingReq.input('startDate', sql.DateTime, start)
  pendingReq.input('endDate', sql.DateTime, end)

  // Get planned breakdown by ProjectType from EV_DeliveryPlan
  const planBreakdownReq = pool.request()
  planBreakdownReq.input('startDate', sql.DateTime, start)
  planBreakdownReq.input('endDate', sql.DateTime, end)

  // Get actual breakdown by ProjectType, Model and RentType from View_AccumarateReleaseCar
  const actualBreakdownReq = pool.request()
  actualBreakdownReq.input('startDate', sql.DateTime, start)
  actualBreakdownReq.input('endDate', sql.DateTime, end)

  // Repair stats
  const repairReq = pool.request()
  repairReq.input('startDate', sql.DateTime, start)
  repairReq.input('endDate', sql.DateTime, end)

  // Run all queries concurrently for high performance
  const [
    planRes,
    completedRes,
    pendingRes,
    planBreakdownRes,
    actualBreakdownRes,
    repairRes
  ] = await Promise.all([
    planReq.query(`
      SELECT SUM(ISNULL(ES_Count, 0) + ISNULL(Y490_Count, 0) + ISNULL(Y410_Count, 0)) AS planTotal
      FROM dbo.EV_DeliveryPlan
      WHERE PlanDate >= @startDate AND PlanDate <= @endDate
    `),
    completedReq.query(`
      SELECT 
        v.RentType,
        COUNT(*) as cnt
      FROM dbo.View_AccumarateReleaseCar v
      WHERE v.ReleaseDate >= @startDate AND v.ReleaseDate <= @endDate
      GROUP BY v.RentType
    `),
    pendingReq.query(`
      SELECT 
        CASE 
          WHEN o.RentType IS NOT NULL THEN o.RentType
          WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
               OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
          ELSE 'ONRENT_NEW'
        END AS RentType,
        COUNT(*) as cnt
      FROM dbo.EV_RentItem r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.View_GetOnrentNewOrUse o ON i.VinNo = o.VinNo
      WHERE r.IsActive = 1
        AND r.ReleaseDate IS NULL
        AND r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate
      GROUP BY 
        CASE 
          WHEN o.RentType IS NOT NULL THEN o.RentType
          WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
               OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
          ELSE 'ONRENT_NEW'
        END
    `),
    planBreakdownReq.query(`
      SELECT 
        ProjectType,
        SUM(ISNULL(ES_Count, 0)) AS ES_Count,
        SUM(ISNULL(Y490_Count, 0)) AS Y490_Count,
        SUM(ISNULL(Y410_Count, 0)) AS Y410_Count
      FROM dbo.EV_DeliveryPlan
      WHERE PlanDate >= @startDate AND PlanDate <= @endDate
      GROUP BY ProjectType
    `),
    actualBreakdownReq.query(`
      SELECT 
        ISNULL(i.ProjectType, 'ไม่ระบุ') AS ProjectType,
        ISNULL(i.Model, 'ไม่ระบุ') AS Model,
        v.RentType,
        COUNT(*) AS Count
      FROM dbo.View_AccumarateReleaseCar v
      LEFT JOIN dbo.EV_InventoryItem i ON v.InventoryItemID = i.InventoryItemID
      WHERE v.ReleaseDate >= @startDate AND v.ReleaseDate <= @endDate
      GROUP BY i.ProjectType, i.Model, v.RentType
    `),
    repairReq.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN m.MaintenanceFinishDate IS NOT NULL THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN m.MaintenanceFinishDate IS NULL THEN 1 ELSE 0 END) AS [open]
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1
        AND (
          (m.ReportDate >= @startDate AND m.ReportDate <= @endDate)
          OR (m.MaintenanceStartDate >= @startDate AND m.MaintenanceStartDate <= @endDate)
          OR (m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate)
        )
    `)
  ])

  // Extract completed
  let completedNew = 0
  let completedUsed = 0
  for (const r of completedRes.recordset) {
    if (r.RentType === 'ONRENT_USE') completedUsed = r.cnt
    else if (r.RentType === 'ONRENT_NEW') completedNew = r.cnt
  }

  // Extract pending
  let pendingNew = 0
  let pendingUsed = 0
  for (const r of pendingRes.recordset) {
    if (r.RentType === 'ONRENT_USE') pendingUsed = r.cnt
    else if (r.RentType === 'ONRENT_NEW') pendingNew = r.cnt
  }

  const planTotal = planRes.recordset[0]?.planTotal || 0

  return {
    year,
    month,
    newVehicles: {
      planTotal,
      completed: completedNew,
      pendingActual: pendingNew,
      pending: Math.max(0, planTotal - completedNew)
    },
    usedVehicles: {
      planTotal: 0,
      completed: completedUsed,
      pendingActual: pendingUsed,
      pending: 0
    },
    repair: repairRes.recordset[0] || { total: 0, closed: 0, open: 0 },
    plans: planBreakdownRes.recordset,
    actuals: actualBreakdownRes.recordset,
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
    const regex = new RegExp(`\\b${word}\\b`, 'i')
    if (regex.test(trimmed)) {
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
// ใช้ SP GetEV_HeadlineDashboard เพื่อให้ตัวเลขตรงกับ Dashboard ต้นทาง 100%
export async function getPortfolioSummary() {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  try {
    const result = await pool.request()
      .input('DateBegin', sql.Date, null)
      .input('DateEnd', sql.Date, null)
      .execute('GetEV_HeadlineDashboard')

    const row = result.recordset[0]
    if (!row) return { error: 'SP GetEV_HeadlineDashboard ไม่ส่งข้อมูลกลับมา' }

    return {
      total: Number(row.TotalVehicle || 0),
      onRent: {
        total: Number(row.OnRentVehicle || 0),
        onRoad: Number(row.OnRoadVehicle || 0),
        underMaintenance: Number(row.OnRentMaintenanceVehicle || 0),
      },
      onProduction: {
        total: Number(row.OnProductionVehicle || 0),
        pending: Number(row.OnProductionPendingVehicle || 0),
        inProcess: Number(row.OnProductionInProcessVehicle || 0),
        waitingGR: Number(row.OnProductionWaitingForGRVehicle || 0),
      },
      replacement: {
        total: Number(row.ReplacementVehicle || 0),
        available: Number(row.ReplacementAvailableVehicle || 0),
        car: Number(row.ReplacementCarVehicle || 0),
      },
      underMaintenance: {
        total: Number(row.MaintenanceVehicle || 0),
        new: Number(row.NewMaintenanceVehicle || 0),
        onRent: Number(row.OnRentMaintenanceVehicle || 0),
        use: Number(row.UseMaintenanceVehicle || 0),
      },
      available: {
        total: Number(row.AvailableVehicle || 0),
        ev7: Number(row.AvailableEV7Vehicle || 0),
        lineMan: Number(row.AvailableLineManVehicle || 0),
        grab: Number(row.AvailableGrabVehicle || 0),
      },
      company: {
        ev7: Number(row.CompanyEV7 || 0),
        gi: Number(row.CompanyGI || 0),
      },
      active: Number(row.ActiveVehicle || 0),
      released: Number(row.ReleasedVehicle || 0),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[getPortfolioSummary] SP Error:', message)
    return { error: `ดึงข้อมูล Portfolio ไม่สำเร็จ: ${message}` }
  }
}

// ─── Function: getDeliveryPlanAndActual ───────────────────────────
export async function getDeliveryPlanAndActual(params: { date: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const { start, end } = getDateRange(params.date)

  try {
    // 1. Fetch Plan
    const planReq = pool.request()
    planReq.input('targetDate', sql.Date, params.date)

    // 2. Fetch Actuals
    const actualReq = pool.request()
    actualReq.input('startDate', sql.DateTime, start)
    actualReq.input('endDate', sql.DateTime, end)

    // Run plan query and actual query concurrently for high performance
    const [planResult, actualResult] = await Promise.all([
      planReq.query(`
        SELECT ProjectType, ES_Count, Y490_Count, Y410_Count
        FROM dbo.EV_DeliveryPlan
        WHERE PlanDate = @targetDate
      `),
      actualReq.query(`
        SELECT 
          ISNULL(i.ProjectType, 'ไม่ระบุ') AS ProjectType,
          ISNULL(i.Model, 'ไม่ระบุ') AS Model,
          CASE 
            WHEN v.RentType IS NOT NULL THEN v.RentType
            WHEN o.RentType IS NOT NULL THEN o.RentType
            WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
                 OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
            ELSE 'ONRENT_NEW'
          END AS RentType,
          COUNT(*) AS Count
        FROM dbo.EV_RentItem r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.View_AccumarateReleaseCar v ON r.RentItemID = v.RentItemID
        LEFT JOIN dbo.View_GetOnrentNewOrUse o ON i.VinNo = o.VinNo
        WHERE r.IsActive = 1
          AND r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate
          AND r.ReleaseDate IS NOT NULL
        GROUP BY 
          i.ProjectType, 
          i.Model,
          CASE 
            WHEN v.RentType IS NOT NULL THEN v.RentType
            WHEN o.RentType IS NOT NULL THEN o.RentType
            WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
                 OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
            ELSE 'ONRENT_NEW'
          END
      `)
    ])

    return {
      plans: planResult.recordset,
      actuals: actualResult.recordset,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[getDeliveryPlanAndActual] Error:', message)
    return { error: `ดึงข้อมูลแผนเปรียบเทียบไม่สำเร็จ: ${message}` }
  }
}

// ─── Function: getRepairByLocation ─────────────────────────────────
export async function getRepairByLocation() {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  try {
    const result = await pool.request().query(`
      SELECT 
        ISNULL(NULLIF(m.ServiceLocationCode, ''), 'ไม่ระบุ') AS Location,
        COUNT(DISTINCT m.InventoryItemID) AS Count
      FROM dbo.EV_MaintenanceItem m
      JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      WHERE m.IsActive = 1 AND i.IsActive = 1 AND i.Status = 'MAINTENANCE'
      GROUP BY m.ServiceLocationCode
      ORDER BY Count DESC
    `)

    const data = result.recordset
    const totalCount = data.reduce((sum: number, item: any) => sum + (item.Count || 0), 0)

    return {
      data,
      totalCount,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[getRepairByLocation] Error:', message)
    return { error: `ดึงข้อมูลรถค้างซ่อมรายพื้นที่ไม่สำเร็จ: ${message}` }
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
  getDeliveryPlanAndActual: (p) => getDeliveryPlanAndActual(p as { date: string }),
  getRepairByLocation: () => getRepairByLocation(),
  createTaskNote: (p) => createTaskNote({
    vehicleRef: p.vehicleRef as string,
    assigneeName: p.assigneeName as string,
    taskDetail: p.taskDetail as string,
    dueDate: p.dueDate as string,
    createUserId: p.createUserId as string,
    createUserName: p.createUserName as string,
    alertTarget: p.alertTarget as string,
    groupId: p.groupId as string,
    assigneeLineUserId: p.assigneeLineUserId as string,
  }),
  listTaskNotes: (p) => getPendingTasks(p.vehicleRef as string, p.assigneeName as string),
  completeTaskNote: (p) => completeTaskNote(Number(p.taskId)),
}

