import { getMSSQLReadOnlyPool as getMSSQLPool, sql } from '@/lib/mssql'
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
  const start = new Date(`${dateStr}T00:00:00.000Z`)
  const end = new Date(`${dateStr}T23:59:59.999Z`)

  const processedItems = rawItems
    .map(item => {
      if (!item.ReleaseDate) {
        return item
      }
      const releaseDate = new Date(item.ReleaseDate)
      if (releaseDate >= start && releaseDate <= end) {
        return item
      }
      if (releaseDate > end) {
        // Released in the future relative to report date, so it was pending
        return {
          ...item,
          ReleaseDate: null
        }
      }
      // Released in the past relative to report date, exclude from today's report
      return null
    })
    .filter(Boolean) as any[]

  const newItems = processedItems.filter(item => item.RentType === 'ONRENT_NEW')
  const usedItems = processedItems.filter(item => item.RentType === 'ONRENT_USE')

  const computeSummaryAndBreakdown = (items: any[]) => {
    const total = items.length
    const completed = items.filter(item => item.ReleaseDate !== null).length
    const pending = items.filter(item => item.ReleaseDate === null).length

    const breakdownMap: Record<string, { project: string, model: string, completed: number, total: number }> = {}
    for (const item of items) {
      const displayProject = item.Project === 'Taxi' ? 'EV7' : item.Project
      const key = `${displayProject}_${item.Model}`
      if (!breakdownMap[key]) {
        breakdownMap[key] = {
          project: displayProject,
          model: item.Model,
          completed: 0,
          total: 0
        }
      }
      if (item.ReleaseDate !== null) {
        breakdownMap[key].completed++
      }
      breakdownMap[key].total++
    }

    const breakdown = Object.values(breakdownMap).map(x => ({
      project: x.project,
      model: x.model,
      count: x.total, // backward compatibility
      completed: x.completed,
      total: x.total
    })).sort((a, b) => b.total - a.total)

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
        r.RentType
      FROM dbo.View_AccumarateReleaseCar r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
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
        r.RentType
      FROM dbo.View_AccumarateReleaseCar r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
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

  // Return stats from View_AccumarateReturnItem
  const returnSummaryReq = pool.request()
  returnSummaryReq.input('startDate', sql.DateTime, start)
  returnSummaryReq.input('endDate', sql.DateTime, end)

  const returnTypeReq = pool.request()
  returnTypeReq.input('startDate', sql.DateTime, start)
  returnTypeReq.input('endDate', sql.DateTime, end)

  const returnReasonReq = pool.request()
  returnReasonReq.input('startDate', sql.DateTime, start)
  returnReasonReq.input('endDate', sql.DateTime, end)

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
    returnSummaryRes,
    returnTypeRes,
    returnReasonRes,
    repSummaryRes,
    repReasonRes,
    repActiveRes,
    repairRes
  ] = await Promise.all([
    planReq.query(`
      SELECT SUM(ISNULL(ES_Count, 0) + ISNULL(Y490_Count, 0) + ISNULL(Y410_Count, 0)) AS planTotal
      FROM dbo.EV_DeliveryPlan
      WHERE PlanDate >= @startDate AND PlanDate <= @endDate
    `),
    completedReq.query(`
      SELECT RentType, COUNT(*) as cnt
      FROM dbo.View_AccumarateReleaseCar
      WHERE IsActive = 1
        AND ReleaseDate >= @startDate AND ReleaseDate <= @endDate
        AND ReleaseDate IS NOT NULL
      GROUP BY RentType
    `),
    pendingReq.query(`
      WITH PreparedRentItems AS (
        SELECT 
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM dbo.View_AccumarateReleaseCar prev 
              WHERE prev.InventoryItemID = r.InventoryItemID 
                AND prev.ReleaseDate IS NOT NULL
            ) THEN 'ONRENT_USE'
            WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
                 OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
            ELSE 'ONRENT_NEW'
          END AS RentType
        FROM dbo.EV_RentItem r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        WHERE r.IsActive = 1
          AND r.ReleaseDate IS NULL
          AND r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate
      )
      SELECT RentType, COUNT(*) as cnt
      FROM PreparedRentItems
      GROUP BY RentType
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
        r.RentType,
        COUNT(*) AS Count
      FROM dbo.View_AccumarateReleaseCar r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
      WHERE r.IsActive = 1
        AND r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate
        AND r.ReleaseDate IS NOT NULL
      GROUP BY i.ProjectType, i.Model, r.RentType
    `),
    returnSummaryReq.query(`
      SELECT 
        COUNT(*) AS TotalReturnCount,
        COUNT(DISTINCT VinNo) AS UniqueVIN
      FROM dbo.View_AccumarateReturnItem
      WHERE ReturnIsActive = 1
        AND ReturnDate >= @startDate AND ReturnDate <= @endDate
    `),
    returnTypeReq.query(`
      SELECT 
        ReturnType,
        COUNT(*) AS TotalCount,
        COUNT(DISTINCT VinNo) AS UniqueVIN
      FROM dbo.View_AccumarateReturnItem
      WHERE ReturnIsActive = 1
        AND ReturnDate >= @startDate AND ReturnDate <= @endDate
      GROUP BY ReturnType
    `),
    returnReasonReq.query(`
      WITH LatestInspection AS (
        SELECT 
          ReturnItemID,
          VinNo,
          ReturnReason,
          ROW_NUMBER() OVER(PARTITION BY COALESCE(ReturnItemID, 0), VinNo ORDER BY InspectionDate DESC, InspectionID DESC) as rn
        FROM dbo.EV_Inspection
        WHERE IsActive = 1
      ),
      EffectiveReturns AS (
        SELECT 
          v.VinNo,
          COALESCE(
            NULLIF(v.ReturnReasonName, ''),
            rs_insp.DescriptionStatus,
            rs_insp.StatusName,
            NULLIF(insp.ReturnReason, ''),
            CASE 
              WHEN v.RemarkForReturnCar LIKE '%Auto-return%' THEN 'เวียนคนขับใหม่ (Lineman)'
              ELSE NULL 
            END,
            'ไม่ระบุเหตุผล'
          ) AS Reason
        FROM dbo.View_AccumarateReturnItem v
        LEFT JOIN LatestInspection insp ON (v.ReturnItemID = insp.ReturnItemID OR (insp.ReturnItemID IS NULL AND v.VinNo = insp.VinNo)) AND insp.rn = 1
        LEFT JOIN dbo.EV_MsSubStatus rs_insp ON insp.ReturnReason = rs_insp.StatusCode
        WHERE v.ReturnIsActive = 1
          AND v.ReturnDate >= @startDate AND v.ReturnDate <= @endDate
      )
      SELECT 
        Reason,
        COUNT(*) AS TotalCount,
        COUNT(DISTINCT VinNo) AS UniqueVIN
      FROM EffectiveReturns
      GROUP BY Reason
      ORDER BY TotalCount DESC
    `),
    pool.request()
      .input('startDate', sql.DateTime, new Date(startDateStr))
      .input('endDate', sql.DateTime, new Date(endDateStr))
      .query(`
        SELECT 
          COUNT(*) AS TotalCount,
          COUNT(DISTINCT r.VinNo) AS UniqueVIN,
          AVG(CAST(DATEDIFF(day, r.ReplacementStartDate, r.ReplacementReturnDate) AS FLOAT)) AS AvgDaysUsed
        FROM dbo.EV_ReplacementItem r
        WHERE r.ReplacementReturnDate >= @startDate AND r.ReplacementReturnDate <= @endDate
      `),
    pool.request()
      .input('startDate', sql.DateTime, new Date(startDateStr))
      .input('endDate', sql.DateTime, new Date(endDateStr))
      .query(`
        SELECT 
          COALESCE(rs.DescriptionStatus, rs.StatusName, r.ReturnReason, insp.ReasonName, 'คืนรถทดแทนเนื่องจากรถหลักซ่อมเสร็จ') AS Reason,
          COUNT(*) AS TotalCount,
          COUNT(DISTINCT r.VinNo) AS UniqueVIN
        FROM dbo.EV_ReplacementItem r
        LEFT JOIN dbo.EV_MsSubStatus rs ON r.ReturnReason = rs.StatusCode AND rs.Type = 'RETURN_REASON'
        OUTER APPLY (
          SELECT TOP 1 rs2.DescriptionStatus AS ReasonName
          FROM dbo.EV_Inspection i
          LEFT JOIN dbo.EV_MsSubStatus rs2 ON i.ReturnReason = rs2.StatusCode AND rs2.Type = 'RETURN_REASON'
          WHERE i.VinNo = r.VinNo AND i.IsActive = 1 AND CAST(i.ReturnDate AS DATE) = CAST(r.ReplacementReturnDate AS DATE)
          ORDER BY i.InspectionID DESC
        ) insp
        WHERE r.ReplacementReturnDate >= @startDate AND r.ReplacementReturnDate <= @endDate
        GROUP BY COALESCE(rs.DescriptionStatus, rs.StatusName, r.ReturnReason, insp.ReasonName, 'คืนรถทดแทนเนื่องจากรถหลักซ่อมเสร็จ')
        ORDER BY TotalCount DESC
      `),
    pool.request().query(`
      SELECT 
        COUNT(*) AS ActiveCount,
        COUNT(DISTINCT r.VinNo) AS UniqueVIN
      FROM dbo.EV_ReplacementItem r
      WHERE r.IsActive = 1 AND (r.ReplacementReturnDate IS NULL OR r.ReplacementReturnDate >= CAST(GETDATE() AS DATE))
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

  // Extract return stats
  let normalReturnCount = 0
  let normalReturnUniqueVin = 0
  let linemanReturnCount = 0
  let linemanReturnUniqueVin = 0

  for (const r of returnTypeRes.recordset) {
    if (r.ReturnType === 'รถเวียนคืน Lineman') {
      linemanReturnCount = r.TotalCount || 0
      linemanReturnUniqueVin = r.UniqueVIN || 0
    } else {
      normalReturnCount = r.TotalCount || 0
      normalReturnUniqueVin = r.UniqueVIN || 0
    }
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
    returns: {
      totalCount: returnSummaryRes.recordset[0]?.TotalReturnCount || 0,
      uniqueVin: returnSummaryRes.recordset[0]?.UniqueVIN || 0,
      normalReturn: {
        count: normalReturnCount,
        uniqueVin: normalReturnUniqueVin,
      },
      linemanReturn: {
        count: linemanReturnCount,
        uniqueVin: linemanReturnUniqueVin,
      },
      byReason: (returnReasonRes.recordset || []).map((r: any) => ({
        reason: r.Reason,
        count: r.TotalCount,
        uniqueVin: r.UniqueVIN,
      })),
    },
    replacementReturns: {
      totalCount: repSummaryRes.recordset[0]?.TotalCount || 0,
      uniqueVin: repSummaryRes.recordset[0]?.UniqueVIN || 0,
      avgDaysUsed: Math.round((repSummaryRes.recordset[0]?.AvgDaysUsed || 0) * 10) / 10,
      activeInUseCount: repActiveRes.recordset[0]?.ActiveCount || 0,
      byReason: (repReasonRes.recordset || []).map((r: any) => ({
        reason: r.Reason,
        count: r.TotalCount,
        uniqueVin: r.UniqueVIN,
      })),
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
      r.IsActive AS rentActive,
      CASE 
        WHEN v.RentType IS NOT NULL THEN v.RentType
        WHEN o.RentType IS NOT NULL THEN o.RentType
        WHEN i.StatusType IN ('AVAILABLE_USE', 'USE_MAINTENANCE', 'REPLACEMENT_AVAILABLE', 'REPLACEMENT_CAR') 
             OR i.Status = 'REPLACEMENT' THEN 'ONRENT_USE'
        ELSE 'ONRENT_NEW'
      END AS RentType
    FROM dbo.EV_InventoryItem i
    LEFT JOIN dbo.EV_RentItem r ON i.InventoryItemID = r.InventoryItemID AND r.IsActive = 1
    LEFT JOIN dbo.View_AccumarateReleaseCar v ON r.RentItemID = v.RentItemID
    LEFT JOIN dbo.View_GetOnrentNewOrUse o ON i.VinNo = o.VinNo
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
    message: result.recordset.length === 0
      ? `ไม่พบข้อมูลสำหรับ "${params.keyword}" ในระบบสต็อกหลัก (dbo.EV_InventoryItem)`
      : undefined,
  }
}

// ─── Function: runCustomQuery (AI-generated SQL, SELECT + EXEC Get* only) ──────
export async function runCustomQuery(params: { sqlQuery: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  // Safety: STRICTLY read-only — only allow SELECT and EXEC Get* statements
  // Step 1: Strip SQL comments to prevent bypass via comment injection
  const stripped = params.sqlQuery
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
  const upper = stripped.toUpperCase()

  // Step 2: Block ALL dangerous keywords anywhere in the query
  const forbidden = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE',
    'GRANT', 'REVOKE', 'MERGE', 'BULK', 'OPENROWSET', 'OPENDATASOURCE',
    'DBCC', 'SHUTDOWN', 'BACKUP', 'RESTORE', 'INTO',
  ]
  for (const word of forbidden) {
    if (new RegExp('\\b' + word + '\\b', 'i').test(upper)) {
      return { error: `⛔ ไม่อนุญาตให้ใช้คำสั่ง ${word} — อนุญาตเฉพาะ SELECT หรือ EXEC Get* เท่านั้น` }
    }
  }
  // Block system stored procedures (sp_, xp_)
  if (/\b(SP_|XP_)/i.test(upper)) {
    return { error: '⛔ ไม่อนุญาตให้เรียก system stored procedures (sp_, xp_)' }
  }

  // Step 3: Must start with SELECT or EXEC Get*
  const isSelect = upper.startsWith('SELECT')
  const isExecGet = (upper.startsWith('EXEC ') || upper.startsWith('EXECUTE ')) && /EXEC(?:UTE)?\s+GET/i.test(upper)
  if (!isSelect && !isExecGet) {
    return { error: '⛔ อนุญาตเฉพาะ SELECT หรือ EXEC Get* (Stored Procedures ขึ้นต้นด้วย Get) เท่านั้น' }
  }

  // Step 4: Block multiple statements (semicolons) to prevent chained attacks
  if (stripped.includes(';')) {
    return { error: '⛔ ไม่อนุญาตให้รัน SQL หลายคำสั่งพร้อมกัน (ห้ามใช้ ;)' }
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

// ─── Function: getMonthlyPlanAndCompleted ─────────────────────────
export async function getMonthlyPlanAndCompleted(params: { date: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { newPlanTotal: 0, usedPlanTotal: 0, newCompleted: 0, usedCompleted: 0 }

  const d = new Date(params.date)
  const targetYear = d.getUTCFullYear()
  const targetMonth = d.getUTCMonth() + 1 // 1-indexed

  try {
    const [planRes, completedRes] = await Promise.all([
      pool.request()
        .input('targetYear', sql.Int, targetYear)
        .input('targetMonth', sql.Int, targetMonth)
        .query(`
          SELECT SUM(ISNULL(ES_Count, 0) + ISNULL(Y490_Count, 0) + ISNULL(Y410_Count, 0)) AS planTotal
          FROM dbo.EV_DeliveryPlan
          WHERE YEAR(PlanDate) = @targetYear AND MONTH(PlanDate) = @targetMonth
        `),
      pool.request()
        .input('targetYear', sql.Int, targetYear)
        .input('targetMonth', sql.Int, targetMonth)
        .query(`
          SELECT RentType, COUNT(*) as cnt
          FROM dbo.View_AccumarateReleaseCar
          WHERE IsActive = 1
            AND YEAR(ReleaseDate) = @targetYear AND MONTH(ReleaseDate) = @targetMonth
            AND ReleaseDate IS NOT NULL
          GROUP BY RentType
        `)
    ])

    const newPlanTotal = planRes.recordset[0]?.planTotal || 0
    let newCompleted = 0
    let usedCompleted = 0
    for (const r of completedRes.recordset) {
      if (r.RentType === 'ONRENT_NEW') newCompleted = r.cnt
      else if (r.RentType === 'ONRENT_USE') usedCompleted = r.cnt
    }

    return { newPlanTotal, usedPlanTotal: 0, newCompleted, usedCompleted }
  } catch (err) {
    console.error('[getMonthlyPlanAndCompleted] Error:', err)
    return { newPlanTotal: 0, usedPlanTotal: 0, newCompleted: 0, usedCompleted: 0 }
  }
}

// ─── Function: getDeliveryPlanAndActual ───────────────────────────
export async function getDeliveryPlanAndActual(params: { date: string }) {
  const pool = await getMSSQLPool()
  if (!pool) return { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }

  const d = new Date(params.date)
  const targetYear = d.getUTCFullYear()
  const targetMonth = d.getUTCMonth() + 1 // 1-indexed
  const { start, end } = getDateRange(params.date)

  try {
    // 1. Fetch Plan (monthly sum by ProjectType)
    const planReq = pool.request()
    planReq.input('targetYear', sql.Int, targetYear)
    planReq.input('targetMonth', sql.Int, targetMonth)

    // 2. Fetch Monthly Actuals
    const actualReq = pool.request()
    actualReq.input('targetYear', sql.Int, targetYear)
    actualReq.input('targetMonth', sql.Int, targetMonth)

    // 3. Fetch Daily Actuals (for daily card detail)
    const dailyActualReq = pool.request()
    dailyActualReq.input('startDate', sql.DateTime, start)
    dailyActualReq.input('endDate', sql.DateTime, end)

    const [planResult, actualResult, dailyActualResult] = await Promise.all([
      planReq.query(`
        SELECT 
          ProjectType, 
          SUM(ISNULL(ES_Count, 0)) AS ES_Count, 
          SUM(ISNULL(Y490_Count, 0)) AS Y490_Count, 
          SUM(ISNULL(Y410_Count, 0)) AS Y410_Count
        FROM dbo.EV_DeliveryPlan
        WHERE YEAR(PlanDate) = @targetYear AND MONTH(PlanDate) = @targetMonth
        GROUP BY ProjectType
      `),
      actualReq.query(`
        SELECT 
          ISNULL(i.ProjectType, 'ไม่ระบุ') AS ProjectType,
          ISNULL(i.Model, 'ไม่ระบุ') AS Model,
          r.RentType,
          COUNT(*) AS Count
        FROM dbo.View_AccumarateReleaseCar r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        WHERE r.IsActive = 1
          AND YEAR(r.ReleaseDate) = @targetYear AND MONTH(r.ReleaseDate) = @targetMonth
          AND r.ReleaseDate IS NOT NULL
        GROUP BY 
          i.ProjectType, 
          i.Model,
          r.RentType
      `),
      dailyActualReq.query(`
        SELECT 
          ISNULL(i.ProjectType, 'ไม่ระบุ') AS ProjectType,
          ISNULL(i.Model, 'ไม่ระบุ') AS Model,
          r.RentType,
          COUNT(*) AS Count
        FROM dbo.View_AccumarateReleaseCar r
        LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
        WHERE r.IsActive = 1
          AND r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate
          AND r.ReleaseDate IS NOT NULL
        GROUP BY 
          i.ProjectType, 
          i.Model,
          r.RentType
      `)
    ])

    return {
      plans: planResult.recordset,
      actuals: actualResult.recordset,
      dailyActuals: dailyActualResult.recordset,
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
  listTaskNotes: async (p) => {
    const tasks = await getPendingTasks(p.vehicleRef as string, p.assigneeName as string)
    return { tasks }
  },
  completeTaskNote: (p) => completeTaskNote(Number(p.taskId)),
}

