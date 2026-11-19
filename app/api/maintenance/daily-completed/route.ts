import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

function getBangkokYearMonth(): { year: number; month: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  const [y, m] = formatted.split('-')
  return {
    year: parseInt(y, 10) || new Date().getUTCFullYear(),
    month: parseInt(m, 10) || new Date().getUTCMonth() + 1,
  }
}

function humanizeCode(code: string | null | undefined, emptyLabel = '-'): string {
  const s = (code || '').trim()
  if (!s || s === 'UNSPECIFIED') return emptyLabel
  return s.replace(/_/g, ' ')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const defaultYM = getBangkokYearMonth()
  const rawYear = parseInt(searchParams.get('year') || '', 10)
  const rawMonth = parseInt(searchParams.get('month') || '', 10)

  const year = !isNaN(rawYear) && rawYear >= 2020 && rawYear <= 2100 ? rawYear : defaultYM.year
  const month = !isNaN(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : defaultYM.month

  if (env.MOCK_MODE) {
    return NextResponse.json({
      year,
      month,
      items: [],
      branches: [],
      problemTypes: [],
      pendingSummary: [],
      fetchedAt: new Date().toISOString(),
    })
  }

  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // SQL Server stores Bangkok time directly — pass exact date range strings without timezone drift
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`
    const nextYear = month === 12 ? year + 1 : year
    const nextMonth = month === 12 ? 1 : month + 1
    const nextMonthStartStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`

    const itemsReq = pool.request()
    itemsReq.input('startDate', sql.VarChar(19), startDateStr)
    itemsReq.input('endDate', sql.VarChar(19), nextMonthStartStr)

    const masterLocReq = pool.request()
    const pendingReq = pool.request()

    const [itemsResult, masterLocResult, pendingResult] = await Promise.all([
      itemsReq.query(`
        SELECT
          m.MaintenanceItemID,
          CONVERT(varchar(10), COALESCE(m.MaintenanceFinishDate, m.MaintenanceReturnDate), 23) AS FinishDateKey,
          COALESCE(m.MaintenanceFinishDate, m.MaintenanceReturnDate) AS EffectiveFinishDate,
          m.MaintenanceStartDate,
          m.ReportDate,
          m.MaintenanceReturnDate,
          COALESCE(NULLIF(i.RegisterNo, ''), NULLIF(m.RegisterNo, '')) AS RegisterNo,
          COALESCE(m.VinNo, i.VinNo, '') AS VinNo,
          i.Model,
          i.ProjectType AS Project,
          m.IssueTitle,
          m.CarStatusCode,
          statSub.StatusName AS CarStatusName,
          ISNULL(NULLIF(LTRIM(RTRIM(m.ProblemTypeCode)), ''), 'UNSPECIFIED') AS ProblemTypeCode,
          probSub.StatusName AS ProblemTypeName,
          m.CarCaseCode,
          caseSub.StatusName AS CarCaseName,
          ISNULL(NULLIF(LTRIM(RTRIM(m.ServiceLocationCode)), ''), 'UNSPECIFIED') AS ServiceLocationCode,
          locSub.StatusName AS ServiceLocationName,
          CASE
            WHEN COALESCE(m.MaintenanceStartDate, m.ReportDate) IS NOT NULL
              THEN DATEDIFF(day, COALESCE(m.MaintenanceStartDate, m.ReportDate), COALESCE(m.MaintenanceFinishDate, m.MaintenanceReturnDate))
            ELSE NULL
          END AS RepairDays,
          ISNULL(NULLIF(uu.FirstName, ''), uu.UserName) AS UpdaterFirstName
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_User uu ON m.UpdateUserID = uu.UserID
        LEFT JOIN dbo.EV_MsSubStatus locSub
          ON LTRIM(RTRIM(m.ServiceLocationCode)) = locSub.StatusCode AND locSub.Type = 'LOCATION' AND locSub.IsActive = 1
        LEFT JOIN dbo.EV_MsSubStatus probSub
          ON LTRIM(RTRIM(m.ProblemTypeCode)) = probSub.StatusCode AND probSub.Type = 'MAINTENANCE_PROBLEM_TYPE' AND probSub.IsActive = 1
        LEFT JOIN dbo.EV_MsSubStatus caseSub
          ON m.CarCaseCode = caseSub.StatusCode AND caseSub.Type = 'DAMAGE' AND caseSub.IsActive = 1
        LEFT JOIN dbo.EV_MsSubStatus statSub
          ON m.CarStatusCode = statSub.StatusCode AND statSub.Type IN ('MAINTENANCE_CAR_STATUS', 'STATUS_TYPE_MAINTENANCE') AND statSub.IsActive = 1
        WHERE m.IsActive = 1
          AND m.CarStatusCode IN ('COMPLETE', 'READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')
          AND COALESCE(m.MaintenanceFinishDate, m.MaintenanceReturnDate) >= CAST(@startDate AS DATETIME)
          AND COALESCE(m.MaintenanceFinishDate, m.MaintenanceReturnDate) < CAST(@endDate AS DATETIME)
        ORDER BY
          COALESCE(m.MaintenanceFinishDate, m.MaintenanceReturnDate) DESC,
          m.MaintenanceItemID DESC
      `),
      masterLocReq.query(`
        SELECT Type, LTRIM(RTRIM(StatusCode)) AS StatusCode, StatusName
        FROM dbo.EV_MsSubStatus
        WHERE Type IN ('LOCATION', 'MAINTENANCE_PROBLEM_TYPE') AND IsActive = 1
        ORDER BY StatusName
      `),
      pendingReq.query(`
        SELECT
          ISNULL(NULLIF(LTRIM(RTRIM(m.ServiceLocationCode)), ''), 'UNSPECIFIED') AS ServiceLocationCode,
          locSub.StatusName AS ServiceLocationName,
          ISNULL(NULLIF(LTRIM(RTRIM(m.ProblemTypeCode)), ''), 'UNSPECIFIED') AS ProblemTypeCode,
          probSub.StatusName AS ProblemTypeName,
          COUNT(m.MaintenanceItemID) AS PendingCount
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_MsSubStatus locSub
          ON LTRIM(RTRIM(m.ServiceLocationCode)) = locSub.StatusCode AND locSub.Type = 'LOCATION' AND locSub.IsActive = 1
        LEFT JOIN dbo.EV_MsSubStatus probSub
          ON LTRIM(RTRIM(m.ProblemTypeCode)) = probSub.StatusCode AND probSub.Type = 'MAINTENANCE_PROBLEM_TYPE' AND probSub.IsActive = 1
        WHERE m.IsActive = 1
          AND i.IsActive = 1
          AND i.Status = 'MAINTENANCE'
          AND m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE')
        GROUP BY
          ISNULL(NULLIF(LTRIM(RTRIM(m.ServiceLocationCode)), ''), 'UNSPECIFIED'),
          locSub.StatusName,
          ISNULL(NULLIF(LTRIM(RTRIM(m.ProblemTypeCode)), ''), 'UNSPECIFIED'),
          probSub.StatusName
      `),
    ])

    const masterLocNameMap: Record<string, string> = {}
    const masterProbNameMap: Record<string, string> = {}
    for (const row of masterLocResult.recordset) {
      if (!row.StatusCode || !row.StatusName) continue
      if (row.Type === 'LOCATION') {
        masterLocNameMap[row.StatusCode] = row.StatusName
      } else if (row.Type === 'MAINTENANCE_PROBLEM_TYPE') {
        masterProbNameMap[row.StatusCode] = row.StatusName
      }
    }

    const resolveLocationName = (code: string, joinedName?: string | null): string => {
      if (!code || code === 'UNSPECIFIED') return 'ไม่ระบุสาขา/อู่'
      return joinedName || masterLocNameMap[code] || humanizeCode(code, 'ไม่ระบุสาขา/อู่')
    }

    const resolveProblemTypeName = (code: string, joinedName?: string | null): string => {
      if (!code || code === 'UNSPECIFIED') return 'ไม่ระบุประเภท'
      return joinedName || masterProbNameMap[code] || humanizeCode(code, 'ไม่ระบุประเภท')
    }

    const branchCountMap: Record<string, number> = {}
    const branchNameMap: Record<string, string> = { ...masterLocNameMap }
    const problemCountMap: Record<string, number> = {}
    const problemNameMap: Record<string, string> = { ...masterProbNameMap }

    const items = itemsResult.recordset.map((r: Record<string, unknown>) => {
      const locCode = (r.ServiceLocationCode as string) || 'UNSPECIFIED'
      const locName = resolveLocationName(locCode, r.ServiceLocationName as string | null)
      branchCountMap[locCode] = (branchCountMap[locCode] || 0) + 1
      branchNameMap[locCode] = locName

      const probCode = (r.ProblemTypeCode as string) || 'UNSPECIFIED'
      const probName = resolveProblemTypeName(probCode, r.ProblemTypeName as string | null)
      problemCountMap[probCode] = (problemCountMap[probCode] || 0) + 1
      problemNameMap[probCode] = probName

      const rawDays = typeof r.RepairDays === 'number' ? r.RepairDays : null

      return {
        id: r.MaintenanceItemID as number,
        finish_date_key: r.FinishDateKey as string,
        finish_date: r.EffectiveFinishDate || null,
        start_date: r.MaintenanceStartDate || null,
        report_date: r.ReportDate || null,
        return_date: r.MaintenanceReturnDate || null,
        register_no: (r.RegisterNo as string) || null,
        vin: (r.VinNo as string) || '',
        model: (r.Model as string) || null,
        project: (r.Project as string) || null,
        issue_title: (r.IssueTitle as string) || '-',
        status_code: (r.CarStatusCode as string) || '',
        status_text: (r.CarStatusName as string) || humanizeCode(r.CarStatusCode as string),
        problem_type_code: probCode,
        problem_type: probName,
        car_case: (r.CarCaseName as string) || humanizeCode(r.CarCaseCode as string),
        car_case_code: (r.CarCaseCode as string) || null,
        service_location_code: locCode,
        service_location_name: locName,
        repair_days: rawDays !== null ? Math.max(0, rawDays) : null,
        updater_name: maskStaffName(r.UpdaterFirstName as string | null),
      }
    })

    const pendingSummary = pendingResult.recordset.map((r: Record<string, unknown>) => {
      const locCode = (r.ServiceLocationCode as string) || 'UNSPECIFIED'
      const locName = resolveLocationName(locCode, r.ServiceLocationName as string | null)
      const probCode = (r.ProblemTypeCode as string) || 'UNSPECIFIED'
      const probName = resolveProblemTypeName(probCode, r.ProblemTypeName as string | null)
      branchNameMap[locCode] = locName
      problemNameMap[probCode] = probName
      return {
        location_code: locCode,
        location_name: locName,
        problem_type_code: probCode,
        problem_type: probName,
        count: Number(r.PendingCount) || 0,
      }
    })

    const allKnownCodes = new Set<string>([
      ...Object.keys(masterLocNameMap),
      ...Object.keys(branchCountMap),
      ...pendingSummary.map(p => p.location_code),
    ])

    const branches = Array.from(allKnownCodes)
      .map(code => ({
        code,
        name: branchNameMap[code] || resolveLocationName(code),
        count: branchCountMap[code] || 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        if (a.code === 'UNSPECIFIED') return 1
        if (b.code === 'UNSPECIFIED') return -1
        return a.name.localeCompare(b.name, 'th')
      })

    const allKnownProblemCodes = new Set<string>([
      ...Object.keys(masterProbNameMap),
      ...Object.keys(problemCountMap),
      ...pendingSummary.map(p => p.problem_type_code),
    ])

    const problemTypes = Array.from(allKnownProblemCodes)
      .map(code => ({
        code,
        name: problemNameMap[code] || resolveProblemTypeName(code),
        count: problemCountMap[code] || 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        if (a.code === 'UNSPECIFIED') return 1
        if (b.code === 'UNSPECIFIED') return -1
        return a.name.localeCompare(b.name, 'th')
      })

    return NextResponse.json(
      {
        year,
        month,
        items,
        branches,
        problemTypes,
        pendingSummary,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('[Daily Completed Maintenance API Error]', error)
    return NextResponse.json({ error: 'ไม่สามารถโหลดข้อมูลสรุปยอดปิดงานรายวันได้' }, { status: 500 })
  }
}
