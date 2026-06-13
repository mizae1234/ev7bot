import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import type { DashboardData, DeliveryRecord, RepairRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Mock data generator matching user's screenshot exactly for June 2026
function getMockDashboardData(startDateStr: string, endDateStr: string, yearNum: number): DashboardData {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  
  // Custom mock data generation for June 2026
  const deliveries: DeliveryRecord[] = []
  const repairs: RepairRecord[] = []
  
  // Define helper to add mock delivery
  const addDelivery = (dateStr: string, project: string, model: string, count: number, isComplete: boolean) => {
    for (let i = 0; i < count; i++) {
      const idStr = Math.floor(1000 + Math.random() * 9000)
      const vinStr = 'LNADHAB' + Math.floor(30 + Math.random() * 9) + 'R1E0' + Math.floor(10000 + Math.random() * 90000)
      const releasedAt = isComplete ? new Date(`${dateStr}T10:${String(Math.floor(10 + Math.random() * 40))}:00.000Z`).toISOString() : null
      
      deliveries.push({
        vehicle_id: `ทอ-${idStr}`,
        vin: vinStr,
        model: model,
        status: isComplete ? 'complete' : 'pending',
        delivered_at: releasedAt,
        project: project,
        expected_release_date: `${dateStr}T09:00:00.000Z`,
        release_date: releasedAt
      })
    }
  }

  // Define helper to add mock repair
  const addRepair = (dateStr: string, description: string, status: 'closed' | 'open' | 'in_progress', count: number) => {
    for (let i = 0; i < count; i++) {
      const orderId = String(Math.floor(1000 + Math.random() * 9000))
      const idStr = Math.floor(1000 + Math.random() * 9000)
      const vinStr = 'LNADHAB38R1E0' + Math.floor(10000 + Math.random() * 90000)
      
      repairs.push({
        order_id: orderId,
        vehicle_id: `ทอ-${idStr}`,
        description: description,
        status: status,
        closed_at: status === 'closed' ? `${dateStr}T15:30:00.000Z` : null,
        vin: vinStr,
        model: Math.random() > 0.5 ? 'Y Plus 490 Premium' : 'AION ES',
        report_date: `${dateStr}T09:00:00.000Z`,
        start_date: `${dateStr}T10:00:00.000Z`,
        finish_date: status === 'closed' ? `${dateStr}T15:30:00.000Z` : null,
        status_code: status === 'closed' ? 'COMPLETE' : status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE',
        service_location: Math.random() > 0.5 ? 'AION_GI_SALAYA' : 'EV7_HEAD_OFFICE',
        problem_type: Math.random() > 0.5 ? 'PRODUCT' : 'ACCIDENT',
        fault_party: Math.random() > 0.5 ? 'DRIVER' : 'MANUFACTURER',
        car_case: Math.random() > 0.5 ? 'DAMAGE_LIGHT' : 'DAMAGE_HEAVY',
        insurance: 'ICARE_INSURANCE',
        project: null
      })
    }
  }

  // Populate mock data if dates fall inside June 2026
  const isWithinJune2026 = (start.getFullYear() === 2026 && start.getMonth() === 5) || (end.getFullYear() === 2026 && end.getMonth() === 5)

  if (isWithinJune2026) {
    // 02 Jun: EV7: 4, Grab: 3
    addDelivery('2026-06-02', 'EV7', 'AION ES', 2, true)
    addDelivery('2026-06-02', 'EV7', 'Y Plus 490 Premium', 2, true)
    addDelivery('2026-06-02', 'Grab', 'Y Plus 410 Premium', 3, true)
    
    addRepair('2026-06-02', 'ตรวจเช็คไฟเครื่องโชว์', 'closed', 2)
    addRepair('2026-06-02', 'เสียงดังใต้ท้องรถ', 'open', 1)

    // 04 Jun: EV7: 3, Line Man: 36 (ES: 7, Y Plus 410: 1, Y Plus 490: 28)
    addDelivery('2026-06-04', 'EV7', 'AION ES', 2, true)
    addDelivery('2026-06-04', 'EV7', 'Y Plus 490 Premium', 1, true)
    addDelivery('2026-06-04', 'Line Man', 'AION ES', 7, true)
    addDelivery('2026-06-04', 'Line Man', 'Y Plus 410 Premium', 1, true)
    addDelivery('2026-06-04', 'Line Man', 'Y Plus 490 Premium', 28, true)
    
    addRepair('2026-06-04', 'เคลมสีกันชนหน้า', 'closed', 3)
    addRepair('2026-06-04', 'ระบบแอร์ไม่เย็น', 'in_progress', 2)

    // 05 Jun: EV7: 8, Line Man: 32
    addDelivery('2026-06-05', 'EV7', 'AION ES', 5, true)
    addDelivery('2026-06-05', 'EV7', 'Y Plus 490 Premium', 3, true)
    addDelivery('2026-06-05', 'Line Man', 'Y Plus 490 Premium', 30, true)
    addDelivery('2026-06-05', 'Line Man', 'AION ES', 2, true)
    
    addRepair('2026-06-05', 'ตรวจสภาพ PDI ประจำปี', 'closed', 5)

    // 06 Jun: EV7: 6
    addDelivery('2026-06-06', 'EV7', 'Y Plus 490 Premium', 6, true)

    // 08 Jun: EV7: 4, Grab: 4, Line Man: 2
    addDelivery('2026-06-08', 'EV7', 'AION ES', 2, true)
    addDelivery('2026-06-08', 'EV7', 'Y Plus 490 Premium', 2, true)
    addDelivery('2026-06-08', 'Grab', 'Y Plus 410 Premium', 4, true)
    addDelivery('2026-06-08', 'Line Man', 'AION ES', 2, true)
    
    addRepair('2026-06-08', 'แบตเตอรี่เสื่อมสภาพ', 'closed', 2)
    addRepair('2026-06-08', 'มีเสียงดังขณะเลี้ยว', 'open', 2)

    // 09 Jun: EV7: 11, Line Man: 8
    addDelivery('2026-06-09', 'EV7', 'AION ES', 8, true)
    addDelivery('2026-06-09', 'EV7', 'Y Plus 490 Premium', 3, true)
    addDelivery('2026-06-09', 'Line Man', 'Y Plus 490 Premium', 8, true)
    
    addRepair('2026-06-09', 'ระบบเซ็นเซอร์ถอยหลังมีปัญหา', 'closed', 4)

    // 10 Jun: EV7: 2, Line Man: 24
    addDelivery('2026-06-10', 'EV7', 'Y Plus 490 Premium', 2, true)
    addDelivery('2026-06-10', 'Line Man', 'Y Plus 490 Premium', 20, true)
    addDelivery('2026-06-10', 'Line Man', 'AION ES', 4, true)
    
    addRepair('2026-06-10', 'เปลี่ยนผ้าเบรคหน้า-หลัง', 'closed', 3)
    addRepair('2026-06-10', 'ไฟหน้าไม่ติด', 'in_progress', 1)

    // 11 Jun: Grab: 6
    addDelivery('2026-06-11', 'Grab', 'Y Plus 410 Premium', 6, true)
    addRepair('2026-06-11', 'เคลมประกันภัยรอบคัน', 'open', 3)
  } else {
    // Generate dummy records for other months
    const durationDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    for (let day = 0; day <= durationDays; day++) {
      const d = new Date(start.getTime() + day * 24 * 60 * 60 * 1000)
      if (d > end) break
      
      const dateStr = d.toISOString().split('T')[0]
      // Skip weekends randomly
      if (d.getDay() === 0 || d.getDay() === 6) continue
      
      const deliveriesCount = (d.getDate() * 7) % 15
      if (deliveriesCount > 0) {
        const project = d.getDate() % 3 === 0 ? 'Line Man' : d.getDate() % 3 === 1 ? 'Grab' : 'EV7'
        const model = d.getDate() % 2 === 0 ? 'Y Plus 490 Premium' : 'AION ES'
        addDelivery(dateStr, project, model, deliveriesCount, true)
      }
      
      const repairsCount = (d.getDate() * 4) % 6
      if (repairsCount > 0) {
        addRepair(dateStr, 'ตรวจสอบระบบไฟฟ้าประจำวัน', d.getDate() % 2 === 0 ? 'closed' : 'open', repairsCount)
      }
    }
  }

  // Filter deliveries within range
  const filteredDeliveries = deliveries.filter(d => {
    const deliveryDate = new Date(d.release_date || d.expected_release_date || '')
    return deliveryDate >= start && deliveryDate <= end
  })

  // Filter repairs within range
  const filteredRepairs = repairs.filter(r => {
    const reportDate = new Date(r.report_date || '')
    return reportDate >= start && reportDate <= end
  })

  // Calculations for summaries
  const deliveryCompleted = filteredDeliveries.filter(d => d.status === 'complete').length
  const repairClosed = filteredRepairs.filter(r => r.status === 'closed').length
  const repairOpen = filteredRepairs.filter(r => r.status === 'open' || r.status === 'in_progress').length

  // Create 12-month trend dynamically for the selected year
  const monthlyTrendMap: Record<number, { date: string; deliveries: number; completed: number; repairsReported: number; repairsClosed: number }> = {}
  
  for (let m = 1; m <= 12; m++) {
    const paddedMonth = String(m).padStart(2, '0')
    monthlyTrendMap[m] = {
      date: `${yearNum}-${paddedMonth}-01`,
      deliveries: 0,
      completed: 0,
      repairsReported: 0,
      repairsClosed: 0
    }
  }

  // Populate mock plan values for the months
  if (yearNum === 2026) {
    monthlyTrendMap[1].deliveries = 400
    monthlyTrendMap[2].deliveries = 450
    monthlyTrendMap[3].deliveries = 500
    monthlyTrendMap[4].deliveries = 300
    monthlyTrendMap[5].deliveries = 600
    monthlyTrendMap[6].deliveries = 900 // June plan is 900
    monthlyTrendMap[7].deliveries = 800
    monthlyTrendMap[8].deliveries = 850
    monthlyTrendMap[9].deliveries = 900
    monthlyTrendMap[10].deliveries = 950
    monthlyTrendMap[11].deliveries = 1000
    monthlyTrendMap[12].deliveries = 1050

    // Mock repair trends for 2026
    monthlyTrendMap[1].repairsReported = 35; monthlyTrendMap[1].repairsClosed = 32
    monthlyTrendMap[2].repairsReported = 40; monthlyTrendMap[2].repairsClosed = 38
    monthlyTrendMap[3].repairsReported = 45; monthlyTrendMap[3].repairsClosed = 42
    monthlyTrendMap[4].repairsReported = 30; monthlyTrendMap[4].repairsClosed = 28
    monthlyTrendMap[5].repairsReported = 55; monthlyTrendMap[5].repairsClosed = 52
    monthlyTrendMap[6].repairsReported = 41; monthlyTrendMap[6].repairsClosed = 25 // June: 41 reported, 25 closed
    monthlyTrendMap[7].repairsReported = 38; monthlyTrendMap[7].repairsClosed = 0
    monthlyTrendMap[8].repairsReported = 42; monthlyTrendMap[8].repairsClosed = 0
    monthlyTrendMap[9].repairsReported = 45; monthlyTrendMap[9].repairsClosed = 0
    monthlyTrendMap[10].repairsReported = 48; monthlyTrendMap[10].repairsClosed = 0
    monthlyTrendMap[11].repairsReported = 50; monthlyTrendMap[11].repairsClosed = 0
    monthlyTrendMap[12].repairsReported = 52; monthlyTrendMap[12].repairsClosed = 0
  } else {
    for (let m = 1; m <= 12; m++) {
      monthlyTrendMap[m].deliveries = 300 + m * 50
      monthlyTrendMap[m].repairsReported = 20 + m * 2
      monthlyTrendMap[m].repairsClosed = 18 + m * 2
    }
  }

  // Populate completed values based on mock deliveries in range
  filteredDeliveries.forEach(d => {
    const deliveryDate = new Date(d.release_date || d.expected_release_date || '')
    if (deliveryDate.getFullYear() === yearNum) {
      const mNum = deliveryDate.getMonth() + 1
      if (d.status === 'complete' && monthlyTrendMap[mNum]) {
        monthlyTrendMap[mNum].completed++
      }
    }
  })

  // If June 2026 is in range, manually set completed to 222 (matching user request)
  if (yearNum === 2026 && monthlyTrendMap[6]) {
    monthlyTrendMap[6].completed = 222
  }

  const trend = Object.entries(monthlyTrendMap)
    .map(([mNum, data]) => ({
      date: data.date,
      deliveries: data.deliveries,
      completed: data.completed,
      repairsReported: data.repairsReported,
      repairsClosed: data.repairsClosed,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Calculate mock plan total across the range
  // For June 2026, we know the real database plan total is 900, let's hardcode 900 for exact mock matching.
  const mockPlanTotal = isWithinJune2026 
    ? 900 
    : Object.values(monthlyTrendMap).reduce((sum, item) => sum + item.deliveries, 0)

  const mockPending = Math.max(0, mockPlanTotal - deliveryCompleted)

  return {
    delivery: {
      total: mockPlanTotal,
      completed: deliveryCompleted,
      pending: mockPending,
    },
    repair: {
      total: filteredRepairs.length,
      closed: repairClosed,
      open: repairOpen,
    },
    trend,
    deliveryList: filteredDeliveries,
    repairList: filteredRepairs,
    replacementList: [],
    returnList: [],
    fetchedAt: new Date().toISOString(),
    mockMode: true,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startDateStr = searchParams.get('startDate')
  const endDateStr = searchParams.get('endDate')
  const yearStr = searchParams.get('year')

  // Default date parameters: first and last days of the current month
  const now = new Date()
  const defaultStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const defaultEndStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const startDate = startDateStr || defaultStartStr
  const endDate = endDateStr || defaultEndStr
  const year = yearStr ? Number(yearStr) : new Date(startDate).getFullYear()

  if (env.MOCK_MODE) {
    return NextResponse.json(getMockDashboardData(startDate, endDate, year))
  }

  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      console.warn('[Dashboard API] SQL Server pool is not initialized, using mock data.')
      return NextResponse.json(getMockDashboardData(startDate, endDate, year))
    }

    const startDateTime = new Date(`${startDate}T00:00:00.000Z`)
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`)

    // --- Get planned count from EV_DeliveryPlan ---
    const planRequest = pool.request()
    planRequest.input('startDate', sql.DateTime, startDateTime)
    planRequest.input('endDate', sql.DateTime, endDateTime)
    const planResult = await planRequest.query(`
      SELECT SUM(ISNULL(ES_Count, 0) + ISNULL(Y490_Count, 0) + ISNULL(Y410_Count, 0)) AS planTotal
      FROM dbo.EV_DeliveryPlan
      WHERE PlanDate >= @startDate AND PlanDate <= @endDate
    `)
    const planTotal = planResult.recordset[0]?.planTotal || 0

    // --- Delivery summary inside date range ---
    const deliverySummaryRequest = pool.request()
    deliverySummaryRequest.input('startDate', sql.DateTime, startDateTime)
    deliverySummaryRequest.input('endDate', sql.DateTime, endDateTime)
    const deliverySummaryResult = await deliverySummaryRequest.query(`
      SELECT
        SUM(CASE WHEN ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed
      FROM dbo.EV_RentItem
      WHERE IsActive = 1
        AND (
          (ExpectedReleaseDate >= @startDate AND ExpectedReleaseDate <= @endDate)
          OR (ReleaseDate >= @startDate AND ReleaseDate <= @endDate)
        )
    `)

    // --- Repair summary inside date range ---
    const repairSummaryRequest = pool.request()
    repairSummaryRequest.input('startDate', sql.DateTime, startDateTime)
    repairSummaryRequest.input('endDate', sql.DateTime, endDateTime)
    const repairSummaryResult = await repairSummaryRequest.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN CarStatusCode = 'COMPLETE' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'STILL_WORK') THEN 1 ELSE 0 END) AS [open]
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1
        AND (
          (ReportDate >= @startDate AND ReportDate <= @endDate)
          OR (MaintenanceStartDate >= @startDate AND MaintenanceStartDate <= @endDate)
          OR (MaintenanceFinishDate >= @startDate AND MaintenanceFinishDate <= @endDate)
        )
    `)

    // --- Monthly trend inside the selected year (Plan vs Actual) ---
    const planTrendRequest = pool.request()
    planTrendRequest.input('year', sql.Int, year)
    const planTrendResult = await planTrendRequest.query(`
      SELECT
        MONTH(PlanDate) AS monthNum,
        SUM(ISNULL(ES_Count, 0) + ISNULL(Y490_Count, 0) + ISNULL(Y410_Count, 0)) AS planTotal
      FROM dbo.EV_DeliveryPlan
      WHERE YEAR(PlanDate) = @year
      GROUP BY MONTH(PlanDate)
    `)

    const actualTrendRequest = pool.request()
    actualTrendRequest.input('year', sql.Int, year)
    const actualTrendResult = await actualTrendRequest.query(`
      SELECT
        MONTH(ReleaseDate) AS monthNum,
        COUNT(*) AS completed
      FROM dbo.EV_RentItem
      WHERE IsActive = 1
        AND YEAR(ReleaseDate) = @year
        AND ReleaseDate IS NOT NULL
      GROUP BY MONTH(ReleaseDate)
    `)

    // --- Monthly repair trend inside the selected year (Reported vs Closed) ---
    const repairReportedTrendRequest = pool.request()
    repairReportedTrendRequest.input('year', sql.Int, year)
    const repairReportedTrendResult = await repairReportedTrendRequest.query(`
      SELECT
        MONTH(ReportDate) AS monthNum,
        COUNT(*) AS reported
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1
        AND YEAR(ReportDate) = @year
      GROUP BY MONTH(ReportDate)
    `)

    const repairClosedTrendRequest = pool.request()
    repairClosedTrendRequest.input('year', sql.Int, year)
    const repairClosedTrendResult = await repairClosedTrendRequest.query(`
      SELECT
        MONTH(MaintenanceFinishDate) AS monthNum,
        COUNT(*) AS closed
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1
        AND CarStatusCode = 'COMPLETE'
        AND YEAR(MaintenanceFinishDate) = @year
        AND MaintenanceFinishDate IS NOT NULL
      GROUP BY MONTH(MaintenanceFinishDate)
    `)

    // --- Detailed delivery list inside date range ---
    const deliveryListRequest = pool.request()
    deliveryListRequest.input('startDate', sql.DateTime, startDateTime)
    deliveryListRequest.input('endDate', sql.DateTime, endDateTime)
    const deliveryListResult = await deliveryListRequest.query(`
      SELECT TOP 200
        COALESCE(r.RegisterNo, i.RegisterNo, 'ID: ' + CAST(r.InventoryItemID AS VARCHAR)) AS vehicle_id,
        r.VinNo AS vin,
        i.Model AS model,
        i.ProjectType AS project,
        CASE WHEN r.ReleaseDate IS NOT NULL THEN 'complete' ELSE 'pending' END AS status,
        r.ExpectedReleaseDate AS expected_release_date,
        r.ReleaseDate AS release_date
      FROM dbo.EV_RentItem r
      LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
      WHERE r.IsActive = 1
        AND (
          (r.ExpectedReleaseDate >= @startDate AND r.ExpectedReleaseDate <= @endDate)
          OR (r.ReleaseDate >= @startDate AND r.ReleaseDate <= @endDate)
        )
      ORDER BY r.ReleaseDate DESC, r.ExpectedReleaseDate DESC
    `)

    // --- Detailed repair list inside date range ---
    const repairListRequest = pool.request()
    repairListRequest.input('startDate', sql.DateTime, startDateTime)
    repairListRequest.input('endDate', sql.DateTime, endDateTime)
    const repairListResult = await repairListRequest.query(`
      SELECT TOP 200
        m.MaintenanceItemID AS order_id,
        COALESCE(m.RegisterNo, i.RegisterNo, 'ID: ' + CAST(m.InventoryItemID AS VARCHAR)) AS vehicle_id,
        m.IssueTitle AS description,
        CASE 
          WHEN m.CarStatusCode = 'COMPLETE' THEN 'closed'
          WHEN m.CarStatusCode = 'IN_MAINTENANCE' THEN 'in_progress'
          ELSE 'open'
        END AS status,
        m.VinNo AS vin,
        i.Model AS model,
        m.ReportDate AS report_date,
        m.MaintenanceStartDate AS start_date,
        m.MaintenanceFinishDate AS finish_date,
        m.CarStatusCode AS status_code,
        m.ServiceLocationCode AS service_location,
        m.ProblemTypeCode AS problem_type,
        m.FaultPartyCode AS fault_party,
        m.CarCaseCode AS car_case,
        m.InsuranceCode AS insurance,
        i.ProjectType AS project
      FROM dbo.EV_MaintenanceItem m
      LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      WHERE m.IsActive = 1
        AND (
          (m.ReportDate >= @startDate AND m.ReportDate <= @endDate)
          OR (m.MaintenanceStartDate >= @startDate AND m.MaintenanceStartDate <= @endDate)
          OR (m.MaintenanceFinishDate >= @startDate AND m.MaintenanceFinishDate <= @endDate)
        )
      ORDER BY m.ReportDate DESC
    `)

    // --- Replacement list inside date range ---
    const replacementListRequest = pool.request()
    replacementListRequest.input('startDate', sql.DateTime, startDateTime)
    replacementListRequest.input('endDate', sql.DateTime, endDateTime)
    const replacementListResult = await replacementListRequest.query(`
      SELECT TOP 200
        r.ReplacementItemID AS replacement_id,
        r.MaintenanceItemID AS maintenance_id,
        r.VinNo AS vin,
        r.ReplacementStartDate AS start_date,
        r.ReplacementReturnDate AS return_date,
        r.Location AS location,
        r.Remark AS remark
      FROM dbo.EV_ReplacementItem r
      WHERE (
        (r.ReplacementStartDate >= @startDate AND r.ReplacementStartDate <= @endDate)
        OR (r.ReplacementReturnDate >= @startDate AND r.ReplacementReturnDate <= @endDate)
        OR r.ReplacementReturnDate IS NULL
      )
      ORDER BY r.ReplacementStartDate DESC
    `)

    // --- Return list inside date range ---
    const returnListRequest = pool.request()
    returnListRequest.input('startDate', sql.DateTime, startDateTime)
    returnListRequest.input('endDate', sql.DateTime, endDateTime)
    const returnListResult = await returnListRequest.query(`
      SELECT TOP 200
        r.ReturnItemID AS return_id,
        r.Model AS model,
        r.VinNo AS vin,
        r.RegisterNo AS register_no,
        r.ReturnDate AS return_date,
        r.ReceiveDate AS receive_date,
        r.CustomerName AS customer_name,
        r.Mileage AS mileage,
        r.ParkLocation AS park_location,
        r.RemarkForCustomer AS remark
      FROM dbo.EV_ReturnItem r
      WHERE (
        (r.ReceiveDate >= @startDate AND r.ReceiveDate <= @endDate)
        OR (r.ReturnDate >= @startDate AND r.ReturnDate <= @endDate)
      )
      ORDER BY r.ReceiveDate DESC
    `)

    const monthlyTrendMap: Record<number, { date: string; deliveries: number; completed: number; repairsReported: number; repairsClosed: number }> = {}

    // Initialize 12 months
    for (let m = 1; m <= 12; m++) {
      const paddedMonth = String(m).padStart(2, '0')
      monthlyTrendMap[m] = {
        date: `${year}-${paddedMonth}-01`,
        deliveries: 0,
        completed: 0,
        repairsReported: 0,
        repairsClosed: 0
      }
    }

    // Merge plans
    for (const row of planTrendResult.recordset || []) {
      const mNum = Number(row.monthNum)
      if (monthlyTrendMap[mNum]) {
        monthlyTrendMap[mNum].deliveries = Number(row.planTotal || 0)
      }
    }

    // Merge completed actuals
    for (const row of actualTrendResult.recordset || []) {
      const mNum = Number(row.monthNum)
      if (monthlyTrendMap[mNum]) {
        monthlyTrendMap[mNum].completed = Number(row.completed || 0)
      }
    }

    // Merge reported repairs
    for (const row of repairReportedTrendResult.recordset || []) {
      const mNum = Number(row.monthNum)
      if (monthlyTrendMap[mNum]) {
        monthlyTrendMap[mNum].repairsReported = Number(row.reported || 0)
      }
    }

    // Merge closed repairs
    for (const row of repairClosedTrendResult.recordset || []) {
      const mNum = Number(row.monthNum)
      if (monthlyTrendMap[mNum]) {
        monthlyTrendMap[mNum].repairsClosed = Number(row.closed || 0)
      }
    }

    const trend = Object.values(monthlyTrendMap)
      .sort((a, b) => a.date.localeCompare(b.date))

    const realCompleted = Number(deliverySummaryResult.recordset[0]?.completed || 0)
    const realPending = Math.max(0, Number(planTotal) - realCompleted)

    return NextResponse.json({
      delivery: {
        total: Number(planTotal),
        completed: realCompleted,
        pending: realPending,
      },
      repair: {
        total: Number(repairSummaryResult.recordset[0]?.total || 0),
        closed: Number(repairSummaryResult.recordset[0]?.closed || 0),
        open: Number(repairSummaryResult.recordset[0]?.open || 0),
      },
      trend,
      deliveryList: deliveryListResult.recordset || [],
      repairList: repairListResult.recordset || [],
      replacementList: replacementListResult.recordset || [],
      returnList: returnListResult.recordset || [],
      fetchedAt: new Date().toISOString(),
      mockMode: false,
    })
  } catch (error) {
    console.error('[Dashboard API Error]', error)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Dashboard API] Error occurred, returning fallback mock data.')
      return NextResponse.json(getMockDashboardData(startDate, endDate, year))
    }
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
