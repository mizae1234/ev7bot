import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import type { DashboardData, DeliveryRecord, RepairRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Mock data generator matching user's screenshot exactly for June 2026
function getMockDashboardData(startDateStr: string, endDateStr: string): DashboardData {
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
        status_code: status === 'closed' ? 'COMPLETE' : status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE'
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
  const deliveryPending = filteredDeliveries.filter(d => d.status === 'pending').length
  const repairClosed = filteredRepairs.filter(r => r.status === 'closed').length
  const repairOpen = filteredRepairs.filter(r => r.status === 'open' || r.status === 'in_progress').length

  // Create 7-day trend dynamically from deliveries
  const trendDays: Record<string, { deliveries: number; completed: number }> = {}
  filteredDeliveries.forEach(d => {
    const dateStr = (d.release_date || d.expected_release_date || '').split('T')[0]
    if (!trendDays[dateStr]) {
      trendDays[dateStr] = { deliveries: 0, completed: 0 }
    }
    trendDays[dateStr].deliveries++
    if (d.status === 'complete') {
      trendDays[dateStr].completed++
    }
  })

  const trend = Object.entries(trendDays)
    .map(([date, counts]) => ({
      date,
      deliveries: counts.deliveries,
      completed: counts.completed,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7)

  return {
    delivery: {
      total: filteredDeliveries.length,
      completed: deliveryCompleted,
      pending: deliveryPending,
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

  // Default date parameters: first and last days of the current month
  const now = new Date()
  const defaultStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const defaultEndStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const startDate = startDateStr || defaultStartStr
  const endDate = endDateStr || defaultEndStr

  if (env.MOCK_MODE) {
    return NextResponse.json(getMockDashboardData(startDate, endDate))
  }

  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      console.warn('[Dashboard API] SQL Server pool is not initialized, using mock data.')
      return NextResponse.json(getMockDashboardData(startDate, endDate))
    }

    const startDateTime = new Date(`${startDate}T00:00:00.000Z`)
    const endDateTime = new Date(`${endDate}T23:59:59.999Z`)

    // --- Delivery summary inside date range ---
    const deliverySummaryRequest = pool.request()
    deliverySummaryRequest.input('startDate', sql.DateTime, startDateTime)
    deliverySummaryRequest.input('endDate', sql.DateTime, endDateTime)
    const deliverySummaryResult = await deliverySummaryRequest.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN ReleaseDate IS NULL THEN 1 ELSE 0 END) AS pending
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

    // --- 7-day trend inside range ---
    const trendRequest = pool.request()
    trendRequest.input('startDate', sql.DateTime, startDateTime)
    trendRequest.input('endDate', sql.DateTime, endDateTime)
    const trendResult = await trendRequest.query(`
      SELECT
        CAST(ExpectedReleaseDate AS DATE) AS date,
        COUNT(*) AS deliveries,
        SUM(CASE WHEN ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed
      FROM dbo.EV_RentItem
      WHERE IsActive = 1
        AND ExpectedReleaseDate >= @startDate AND ExpectedReleaseDate <= @endDate
      GROUP BY CAST(ExpectedReleaseDate AS DATE)
      ORDER BY date ASC
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
        m.CarStatusCode AS status_code
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

    const trend = ((trendResult.recordset || []) as Array<{ date: Date | string; deliveries?: number; completed?: number }>).map((row) => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      deliveries: Number(row.deliveries || 0),
      completed: Number(row.completed || 0),
    }))

    return NextResponse.json({
      delivery: {
        total: Number(deliverySummaryResult.recordset[0]?.total || 0),
        completed: Number(deliverySummaryResult.recordset[0]?.completed || 0),
        pending: Number(deliverySummaryResult.recordset[0]?.pending || 0),
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
      return NextResponse.json(getMockDashboardData(startDate, endDate))
    }
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}
