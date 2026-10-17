import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Code → Thai Description Maps ──────────────────────────────────
const problemTypeMap: Record<string, string> = {
  'PRODUCT': 'ผลิตภัณฑ์',
  'ACCIDENT': 'อุบัติเหตุ',
  'USAGE': 'การใช้งาน',
  'WEAR': 'สึกหรอ',
}
const faultPartyMap: Record<string, string> = {
  'FAULT_DRIVER': 'คนขับ',
  'FAULT_COUNTERPARTY': 'คู่กรณี',
  'FAULT_OTHER': 'อื่นๆ',
  'FAULT_MANUFACTURER': 'ผู้ผลิต',
  'DRIVER': 'คนขับ',
  'COUNTERPART': 'คู่กรณี',
  'OTHER': 'อื่นๆ',
  'MANUFACTURER': 'ผู้ผลิต',
}
const carCaseMap: Record<string, string> = {
  'DAMAGE_LIGHT': 'เคสซ่อมเบา',
  'DAMAGE_HEAVY': 'เคสซ่อมหนัก',
}
const insuranceMap: Record<string, string> = {
  'ICARE_INSURANCE': 'ไอแคร์ประกันภัย',
  'MUANGTHAI_INSURANCE': 'เมืองไทยประกันภัย',
  'NO_INSURANCE': 'ไม่มีประกัน',
}
const carStatusMap: Record<string, string> = {
  'COMPLETE': 'ซ่อมเสร็จ',
  'IN_MAINTENANCE': 'รถอยู่ระหว่างซ่อม',
  'WAITING_FOR_MAINTENANCE': 'รถจอดรอซ่อม',
  'STILL_WORK': 'รถยังขับใช้งานได้อยู่',
  'READY_PICKUP_MAINTENANCE': 'รถซ่อมเสร็จ รอลูกค้ามารับ',
  'GARAGE_COMPLETE': 'รถซ่อมเสร็จ รอลูกค้ามารับ',
}

const mapCode = (code: unknown, map: Record<string, string>): string => {
  const s = (code as string) || ''
  return map[s] || s.replace(/_/g, ' ') || '-'
}

function maskDriverName(driverName?: string): string {
  if (!driverName) return '-'
  const trimmed = driverName.trim()
  if (trimmed === 'รถใหม่ยังไม่มีเจ้าของ' || trimmed === 'รถทดแทน') return trimmed
  
  const parts = trimmed.split(/\s+/)
  if (parts.length === 0) return '-'
  
  if (parts[0] === 'คุณ' && parts.length > 1) {
    const firstName = parts[1]
    const remaining = parts.slice(2)
    if (remaining.length === 0) {
      return `คุณ ${firstName}`
    }
    const maskedRemaining = remaining.map(part => {
      if (part === 'คืนรถ') return 'คืนรถ'
      return '***'
    }).join(' ')
    return `คุณ ${firstName} ${maskedRemaining}`
  } else {
    const firstName = parts[0]
    const remaining = parts.slice(1)
    if (remaining.length === 0) return firstName
    const maskedRemaining = remaining.map(part => {
      if (part === 'คืนรถ') return 'คืนรถ'
      return '***'
    }).join(' ')
    return `${firstName} ${maskedRemaining}`
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status') // e.g. 'IN_MAINTENANCE', 'COMPLETE', 'all'
  const locationFilter = searchParams.get('location')

  if (env.MOCK_MODE) {
    return NextResponse.json({ items: [], summary: { total: 0, in_maintenance: 0, complete: 0, waiting: 0 }, locations: [] })
  }

  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // Build WHERE clause dynamically
    // STILL_WORK tickets (reported, car not yet in the workshop — e.g. imported claims) belong to
    // vehicles that are still ON_RENT/AVAILABLE, so that view must not require Status = MAINTENANCE.
    const isStillWorkView = statusFilter === 'STILL_WORK'
    const vehicleStatusWhere = isStillWorkView ? '' : ` AND i.Status = 'MAINTENANCE'`
    let statusWhere = ''
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'READY_PICKUP_MAINTENANCE') {
        statusWhere = ` AND m.CarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')`
      } else if (statusFilter === 'ACTIVE_REPAIR') {
        statusWhere = ` AND m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE')`
      } else if (statusFilter === 'PENDING_ALL') {
        statusWhere = ` AND m.CarStatusCode NOT IN ('COMPLETE')`
      } else {
        statusWhere = ` AND m.CarStatusCode = @statusFilter`
      }
    } else {
      // By default (all), return all maintenance tickets for these vehicles including COMPLETE
      statusWhere = ''
    }
    let locationWhere = ''
    if (locationFilter && locationFilter !== 'all') {
      if (locationFilter === 'ไม่ระบุ') {
        locationWhere = ` AND (m.ServiceLocationCode IS NULL OR m.ServiceLocationCode = '')`
      } else {
        locationWhere = ` AND m.ServiceLocationCode = @locationFilter`
      }
    }

    // Summary counts
    const summaryReq = pool.request()
    if (locationFilter && locationFilter !== 'all' && locationFilter !== 'ไม่ระบุ') {
      summaryReq.input('locationFilter', sql.NVarChar, locationFilter)
    }

    // Unique locations
    const locReq = pool.request()

    // Repairs by location summary
    const repairByLocReq = pool.request()
    if (statusFilter && statusFilter !== 'all') {
      repairByLocReq.input('statusFilter', sql.NVarChar, statusFilter)
    }

    // Problem types from master table
    const problemTypeReq = pool.request()

    // Maintenance items (active only, optionally filtered)
    const itemReq = pool.request()
    if (statusFilter && statusFilter !== 'all') {
      itemReq.input('statusFilter', sql.NVarChar, statusFilter)
    }
    if (locationFilter && locationFilter !== 'all' && locationFilter !== 'ไม่ระบุ') {
      itemReq.input('locationFilter', sql.NVarChar, locationFilter)
    }

    // Count of reported-but-not-yet-in-workshop tickets (independent of vehicle status)
    const stillWorkReq = pool.request()

    // Ticket-level summary for maintenance items
    const ticketSummaryReq = pool.request()

    // Run queries concurrently for performance optimization
    const [
      stillWorkResult,
      summaryResult,
      ticketSummaryResult,
      locResult,
      repairByLocResult,
      itemResult,
      problemTypeResult
    ] = await Promise.all([
      stillWorkReq.query(`
        SELECT 
          COUNT(*) AS still_work,
          COUNT(*) AS still_work_tickets,
          COUNT(DISTINCT m.InventoryItemID) AS still_work_cars
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.IsActive = 1 AND m.CarStatusCode = 'STILL_WORK'
      `),
      summaryReq.query(`
        WITH LatestVehicleTicket AS (
          SELECT 
            m.InventoryItemID,
            m.CarStatusCode,
            ROW_NUMBER() OVER (
              PARTITION BY m.InventoryItemID 
              ORDER BY 
                CASE 
                  WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1
                  WHEN m.CarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE') THEN 2
                  WHEN m.CarStatusCode = 'STILL_WORK' THEN 3
                  ELSE 4
                END ASC,
                m.MaintenanceItemID DESC
            ) AS rn
          FROM dbo.EV_MaintenanceItem m
          WHERE m.IsActive = 1 AND m.CarStatusCode NOT IN ('COMPLETE')
        ),
        VehiclesWithStatus AS (
          SELECT 
            i.InventoryItemID,
            i.StatusType,
            COALESCE(t.CarStatusCode, 'NO_TICKET') AS PrimaryCarStatusCode
          FROM dbo.EV_InventoryItem i
          LEFT JOIN LatestVehicleTicket t ON i.InventoryItemID = t.InventoryItemID AND t.rn = 1
          WHERE i.Status = 'MAINTENANCE' AND i.IsActive = 1
        )
        SELECT
          COUNT(*) AS total,
          COUNT(*) AS total_cars,
          SUM(CASE WHEN PrimaryCarStatusCode = 'IN_MAINTENANCE' THEN 1 ELSE 0 END) AS in_maintenance,
          SUM(CASE WHEN PrimaryCarStatusCode = 'IN_MAINTENANCE' THEN 1 ELSE 0 END) AS in_maintenance_cars,
          0 AS complete,
          SUM(CASE WHEN PrimaryCarStatusCode = 'WAITING_FOR_MAINTENANCE' OR PrimaryCarStatusCode = 'NO_TICKET' THEN 1 ELSE 0 END) AS waiting,
          SUM(CASE WHEN PrimaryCarStatusCode = 'WAITING_FOR_MAINTENANCE' OR PrimaryCarStatusCode = 'NO_TICKET' THEN 1 ELSE 0 END) AS waiting_cars,
          SUM(CASE WHEN PrimaryCarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE') THEN 1 ELSE 0 END) AS ready_pickup_cars
        FROM VehiclesWithStatus
      `),
      ticketSummaryReq.query(`
        SELECT
          COUNT(*) AS total_tickets,
          SUM(CASE WHEN m.CarStatusCode = 'IN_MAINTENANCE' THEN 1 ELSE 0 END) AS in_maintenance_tickets,
          SUM(CASE WHEN m.CarStatusCode = 'WAITING_FOR_MAINTENANCE' THEN 1 ELSE 0 END) AS waiting_tickets,
          SUM(CASE WHEN m.CarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE') THEN 1 ELSE 0 END) AS ready_pickup_tickets,
          SUM(CASE WHEN m.CarStatusCode = 'COMPLETE' THEN 1 ELSE 0 END) AS complete_tickets,
          SUM(CASE WHEN m.CarStatusCode = 'STILL_WORK' THEN 1 ELSE 0 END) AS still_work_tickets
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.IsActive = 1 AND i.Status = 'MAINTENANCE'
      `),
      locReq.query(`
        SELECT DISTINCT m.ServiceLocationCode
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.IsActive = 1 AND i.Status = 'MAINTENANCE' 
          AND m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')
          AND m.ServiceLocationCode IS NOT NULL AND m.ServiceLocationCode != ''
        ORDER BY m.ServiceLocationCode
      `),
      repairByLocReq.query(`
        SELECT 
          ISNULL(NULLIF(m.ServiceLocationCode, ''), 'ไม่ระบุ') AS Location,
          COUNT(m.MaintenanceItemID) AS Count,
          COUNT(DISTINCT m.InventoryItemID) AS VehicleCount
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.IsActive = 1 AND i.Status = 'MAINTENANCE'
          AND m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')
        GROUP BY ISNULL(NULLIF(m.ServiceLocationCode, ''), 'ไม่ระบุ')
        ORDER BY Count DESC
      `),
      itemReq.query(`
        SELECT TOP 2000
          m.MaintenanceItemID,
          COALESCE(i.RegisterNo, '') AS RegisterNo,
          m.VinNo,
          i.Model,
          i.ProjectType AS Project,
          m.IssueTitle,
          m.CarStatusCode,
          m.ProblemTypeCode,
          m.FaultPartyCode,
          m.CarCaseCode,
          m.ServiceLocationCode,
          m.InsuranceCode,
          m.ReportDate,
          m.IncidentDate,
          m.MaintenanceStartDate,
          m.MaintenanceFinishDate,
          m.MaintenanceReturnDate,
          m.FollowUpDetail,
          m.DriverName,
          m.RootCauseFound,
          m.FixAction,
          m.LastFollowUpDate,
          m.ParentMaintenanceItemID,
          m.CreateDate,
          m.UpdateDate,
          m.CreateUserID,
          m.UpdateUserID,
          cu.FirstName AS CreateUserFirstName,
          cu.LastName AS CreateUserLastName,
          uu.FirstName AS UpdateUserFirstName,
          uu.LastName AS UpdateUserLastName,
          i.CurrentLocation AS CarCurrentLocation,
          loc.StatusName AS CarCurrentLocationName
        FROM dbo.EV_MaintenanceItem m
        LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        LEFT JOIN dbo.EV_User cu ON m.CreateUserID = cu.UserID
        LEFT JOIN dbo.EV_User uu ON m.UpdateUserID = uu.UserID
        LEFT JOIN dbo.EV_MsSubStatus loc ON i.CurrentLocation = loc.StatusCode AND loc.Type = 'LOCATION'
        WHERE m.IsActive = 1${vehicleStatusWhere}${statusWhere}${locationWhere}
        ORDER BY 
          CASE WHEN m.CarStatusCode IN ('IN_MAINTENANCE','WAITING_FOR_MAINTENANCE','STILL_WORK') THEN 0 ELSE 1 END,
          m.ReportDate DESC
      `),
      problemTypeReq.query(`
        SELECT StatusCode, StatusName, DescriptionStatus
        FROM dbo.EV_MsSubStatus
        WHERE Type = 'MAINTENANCE_PROBLEM_TYPE' AND IsActive = 1
        ORDER BY StatusCode
      `)
    ])



    // Get replacement cars for items
    const maintIds = itemResult.recordset.map((m: { MaintenanceItemID: number }) => m.MaintenanceItemID)
    let replacements: Record<number, { VinNo: string; RegisterNo: string | null; ReplacementStartDate: string | null }[]> = {}

    if (maintIds.length > 0) {
      const replReq = pool.request()
      const idList = maintIds.map((_: number, i: number) => `@rid${i}`).join(',')
      maintIds.forEach((id: number, i: number) => {
        replReq.input(`rid${i}`, sql.Int, id)
      })
      const replResult = await replReq.query(`
        SELECT r.MaintenanceItemID, r.VinNo, i.RegisterNo, r.ReplacementStartDate
        FROM dbo.EV_ReplacementItem r
        LEFT JOIN dbo.EV_InventoryItem i ON r.VinNo = i.VinNo
        WHERE r.MaintenanceItemID IN (${idList}) AND r.IsActive = 1
      `)
      for (const r of replResult.recordset) {
        if (!replacements[r.MaintenanceItemID]) replacements[r.MaintenanceItemID] = []
        replacements[r.MaintenanceItemID].push(r)
      }
    }

    // Dynamic Problem Type Map from Master Table
    const dynamicProblemTypeMap: Record<string, string> = { ...problemTypeMap }
    for (const pt of problemTypeResult.recordset) {
      if (pt.StatusCode && pt.StatusName) {
        dynamicProblemTypeMap[pt.StatusCode] = pt.StatusName
      }
    }

    // Map to output
    const items = itemResult.recordset.map((m: Record<string, unknown>) => ({
      id: m.MaintenanceItemID,
      register_no: m.RegisterNo || null,
      vin: m.VinNo,
      model: m.Model,
      project: m.Project,
      issue_title: m.IssueTitle,
      status_code: m.CarStatusCode,
      status_text: mapCode(m.CarStatusCode, carStatusMap),
      problem_type: mapCode(m.ProblemTypeCode, dynamicProblemTypeMap),
      fault_party: mapCode(m.FaultPartyCode, faultPartyMap),
      car_case: mapCode(m.CarCaseCode, carCaseMap),
      service_location: ((m.ServiceLocationCode as string) || '-').replace(/_/g, ' '),
      service_location_code: m.ServiceLocationCode,
      current_location: (m.CarCurrentLocationName as string) || (m.CarCurrentLocation as string) || null,
      insurance: mapCode(m.InsuranceCode, insuranceMap),
      report_date: m.ReportDate,
      incident_date: m.IncidentDate,
      start_date: m.MaintenanceStartDate,
      finish_date: m.MaintenanceFinishDate,
      return_date: m.MaintenanceReturnDate,
      follow_up: m.FollowUpDetail,
      replacements: (replacements[(m.MaintenanceItemID as number)] || []).map(r => ({
        vin: r.VinNo,
        register_no: r.RegisterNo,
        start_date: r.ReplacementStartDate,
      })),
      driver_name: maskDriverName(m.DriverName as string),
      root_cause: m.RootCauseFound || null,
      fix_action: m.FixAction || null,
      last_follow_up_date: m.LastFollowUpDate || null,
      parent_maintenance_id: m.ParentMaintenanceItemID || null,
      create_date: m.CreateDate || null,
      update_date: m.UpdateDate || null,
      create_user_id: m.CreateUserID || null,
      update_user_id: m.UpdateUserID || null,
      create_user_name: m.CreateUserFirstName ? `${m.CreateUserFirstName} ${m.CreateUserLastName || ''}`.trim() : null,
      update_user_name: m.UpdateUserFirstName ? `${m.UpdateUserFirstName} ${m.UpdateUserLastName || ''}`.trim() : null,
    }))

    return NextResponse.json(
      {
        items,
        summary: {
          ...(summaryResult.recordset[0] || { total: 0, in_maintenance: 0, complete: 0, waiting: 0 }),
          ...(ticketSummaryResult.recordset[0] || { total_tickets: 0, in_maintenance_tickets: 0, waiting_tickets: 0, ready_pickup_tickets: 0 }),
          ...(stillWorkResult.recordset[0] || { still_work: 0, still_work_tickets: 0, still_work_cars: 0 }),
        },
        locations: locResult.recordset.map((r: { ServiceLocationCode: string }) => r.ServiceLocationCode),
        locationSummary: repairByLocResult.recordset || [],
        problemTypes: problemTypeResult.recordset.map((r: any) => ({
          code: r.StatusCode,
          name: r.StatusName || r.DescriptionStatus || r.StatusCode,
        })),
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    )
  } catch (error) {
    console.error('[Maintenance API Error]', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance data' }, { status: 500 })
  }
}
