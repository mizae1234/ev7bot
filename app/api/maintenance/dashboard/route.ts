import { NextResponse } from 'next/server'
import { getMSSQLPool } from '@/lib/mssql'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Helper maps
const problemTypeMap: Record<string, string> = {
  'PRODUCT': 'ผลิตภัณฑ์',
  'ACCIDENT': 'อุบัติเหตุ',
  'SUPPLIER_REPAIR': 'งานซ่อมจาก Supplier',
  'OTHER': 'อื่นๆ',
  'OTHER_2': 'อื่นๆ',
}

const locationMap: Record<string, string> = {
  'AION_GI_KANCHANAPISEK': 'Aion กาญจนาฯ',
  'AION_GI_RAMINTRA_EXPRESSWAY': 'Aion เลียบด่วนฯ',
  'AION_GI_PIBULSONGKRAM': 'Aion พิบูลฯ',
  'AION_GI_MINBURI': 'Aion มีนบุรี',
  'AION_GI_MAHACHAI': 'Aion มหาชัย',
  'AION_GI_SALAYA': 'Aion ศาลายา',
  'EV7_YARD_PRAPADAENG': 'EV7 Yard พระประแดง',
  'SMART_TAXI': 'สมาร์ทเแท็กซี่',
  'GARAGE_BUNGKHWANG': 'อู่ บึงขวาง',
  'GARAGE_TS': 'อู่ TS',
  'GARAGE_88_CAR': 'อู่ 88 คาร์',
  'GARAGE_CRN_PAKKRET': 'อู่ CRN ปากเกร็ด',
  'GARAGE_56_COLOR': 'อู่ 56 Color',
  'GARAGE_PRICHA': 'อู่ ปรีชา',
  'GARAGE_PERFECTCAR': 'อู่ เพอร์เฟคคาร์',
  'GARAGE_SAHACAR': 'อู่ สหาคาร์',
  'GARAGE_PREMIUMCAR': 'อู่ พรีเมี่ยมคาร์',
  'GARAGE_BESTCARPAINT': 'อู่ เบสท์คาร์เพ้นท์',
  'BRANCH_AYUTTHAYA': 'สาขา อยุธยา',
  'BB_CARPAINT': 'อู่ บีบี คาร์เพ้นท์',
  'AUTOHAUS': 'อู่ Autohaus'
}

export async function GET() {
  if (env.MOCK_MODE) {
    const mockStats = {
      total: 35,
      in_maintenance: 18,
      waiting: 12,
      complete: 5
    }

    const mockLocations = [
      { LocationCode: 'GARAGE_88_CAR', LocationName: 'อู่ 88 คาร์', Count: 8 },
      { LocationCode: 'EV7_YARD_PRAPADAENG', LocationName: 'EV7 Yard พระประแดง', Count: 6 },
      { LocationCode: 'AION_GI_SALAYA', LocationName: 'Aion ศาลายา', Count: 5 },
      { LocationCode: 'GARAGE_PERFECTCAR', LocationName: 'อู่ เพอร์เฟคคาร์', Count: 4 },
      { LocationCode: 'ไม่ระบุ', LocationName: 'ไม่ระบุ / นอกสถานที่', Count: 7 }
    ]

    const mockProblemTypes = [
      { ProblemTypeCode: 'ACCIDENT', ProblemTypeName: 'อุบัติเหตุ', Count: 18 },
      { ProblemTypeCode: 'PRODUCT', ProblemTypeName: 'ผลิตภัณฑ์', Count: 10 },
      { ProblemTypeCode: 'SUPPLIER_REPAIR', ProblemTypeName: 'งานซ่อมจาก Supplier', Count: 4 },
      { ProblemTypeCode: 'ไม่ระบุ', ProblemTypeName: 'อื่นๆ', Count: 3 }
    ]

    const mockFollowUps = [
      {
        MaintenanceFollowUpID: 101,
        MaintenanceItemID: 11252,
        FollowUpDate: new Date().toISOString(),
        FollowUpDetail: 'got แจ้งรถซ่อมเสร็จ 29/06/2569 มี EX5000 อู่ออโต้เฮ้าส์',
        CreateDate: new Date().toISOString(),
        CreateUserName: 'witchaya',
        IssueTitle: 'เฉี่ยวชน แก้มหน้าซ้ายบุบ',
        RegisterNo: 'ทอ 4530'
      },
      {
        MaintenanceFollowUpID: 102,
        MaintenanceItemID: 11250,
        FollowUpDate: new Date(Date.now() - 3600000).toISOString(),
        FollowUpDetail: '📍 อัปเดตสถานที่ซ่อมบำรุงเป็น: อู่ 88 คาร์',
        CreateDate: new Date(Date.now() - 3600000).toISOString(),
        CreateUserName: 'System Admin',
        IssueTitle: 'ช่วงล่างมีเสียงดังพวงมาลัยสั่น',
        RegisterNo: 'ทอ 1234'
      },
      {
        MaintenanceFollowUpID: 103,
        MaintenanceItemID: 11248,
        FollowUpDate: new Date(Date.now() - 7200000).toISOString(),
        FollowUpDetail: 'รออะไหล่กันชนหน้าสั่งจากศูนย์ใหญ่ คาดว่าเข้าซ่อมสัปดาห์หน้า',
        CreateDate: new Date(Date.now() - 7200000).toISOString(),
        CreateUserName: 'กิตติศักดิ์',
        IssueTitle: 'ชนหมา สปอยเลอร์ล่างแตก',
        RegisterNo: 'ทอ 9876'
      }
    ]

    const mockLongestRepairs = [
      {
        MaintenanceItemID: 11200,
        RegisterNo: 'ทอ 9988',
        Model: 'AION ES',
        Project: 'Line Man',
        IssueTitle: 'มอเตอร์ขับเคลื่อนขัดข้อง ไฟเตือนระบบ EV โชว์',
        CarStatusCode: 'IN_MAINTENANCE',
        ServiceLocationCode: 'AION_GI_SALAYA',
        ReportDate: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
        MaintenanceStartDate: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
        DaysActive: 14,
        FollowUpDetail: 'รอผลเคลมกล่องควบคุมจาก Aion Thailand'
      },
      {
        MaintenanceItemID: 11215,
        RegisterNo: 'ทอ 3456',
        Model: 'Y Plus 490 Premium',
        Project: 'EV7 Rental',
        IssueTitle: 'กระจกหน้าแตกร้าวทั้งบานจากสะเก็ดหิน',
        CarStatusCode: 'IN_MAINTENANCE',
        ServiceLocationCode: 'GARAGE_88_CAR',
        ReportDate: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        MaintenanceStartDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        DaysActive: 8,
        FollowUpDetail: 'อู่ถอดกระจกเก่าออกแล้ว เตรียมวางกระจกใหม่'
      },
      {
        MaintenanceItemID: 11222,
        RegisterNo: 'ทอ 7788',
        Model: 'AION ES',
        Project: 'Lalamove',
        IssueTitle: 'ชนเสาไฟหน้าซ้ายยุบถึงห้องเครื่อง',
        CarStatusCode: 'WAITING_FOR_MAINTENANCE',
        ServiceLocationCode: 'GARAGE_PERFECTCAR',
        ReportDate: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        MaintenanceStartDate: null,
        DaysActive: 8,
        FollowUpDetail: 'อยู่ระหว่างประกันคุมราคาประเมินค่าซ่อม'
      }
    ]

    const mockSlaStats = {
      d1_5: 5,
      d6_10: 8,
      d11_15: 7,
      d16_30: 6,
      d30_plus: 4,
      total: 30,
      avgDays: 14.2,
      maxDays: 45
    }

    return NextResponse.json({
      stats: mockStats,
      slaStats: mockSlaStats,
      locations: mockLocations,
      problemTypes: mockProblemTypes,
      followUps: mockFollowUps,
      longestRepairs: mockLongestRepairs
    })
  }

  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    const [statsResult, ticketStatsResult] = await Promise.all([
      pool.request().query(`
        WITH LatestTickets AS (
          SELECT 
            m.InventoryItemID,
            m.CarStatusCode,
            ROW_NUMBER() OVER (
              PARTITION BY m.InventoryItemID 
              ORDER BY 
                CASE 
                  WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1
                  WHEN m.CarStatusCode = 'READY_PICKUP_MAINTENANCE' THEN 2
                  WHEN m.CarStatusCode = 'STILL_WORK' THEN 3
                  ELSE 4
                END ASC,
                m.MaintenanceItemID DESC
            ) AS rn
          FROM dbo.EV_MaintenanceItem m
          WHERE m.IsActive = 1
        ),
        VehiclesWithStatus AS (
          SELECT 
            i.InventoryItemID,
            i.StatusType,
            COALESCE(t.CarStatusCode, '') AS LatestCarStatusCode
          FROM dbo.EV_InventoryItem i
          LEFT JOIN LatestTickets t ON i.InventoryItemID = t.InventoryItemID AND t.rn = 1
          WHERE i.Status = 'MAINTENANCE' AND i.IsActive = 1
        )
        SELECT
          SUM(CASE WHEN LatestCarStatusCode = 'READY_PICKUP_MAINTENANCE' THEN 1 ELSE 0 END) AS ready_pickup,
          SUM(CASE WHEN LatestCarStatusCode <> 'READY_PICKUP_MAINTENANCE' AND StatusType = 'NEW_MAINTENANCE' THEN 1 ELSE 0 END) AS waiting,
          SUM(CASE WHEN LatestCarStatusCode <> 'READY_PICKUP_MAINTENANCE' AND StatusType = 'USE_MAINTENANCE' THEN 1 ELSE 0 END) AS in_maintenance,
          SUM(CASE WHEN LatestCarStatusCode <> 'READY_PICKUP_MAINTENANCE' AND StatusType = 'ON_RENT_MAINTENANCE' THEN 1 ELSE 0 END) AS on_rent_maintenance,
          SUM(CASE WHEN LatestCarStatusCode <> 'READY_PICKUP_MAINTENANCE' AND StatusType = 'REPLACEMENT_MAINTENANCE' THEN 1 ELSE 0 END) AS replacement_maintenance,
          (SELECT COUNT(*) FROM dbo.EV_MaintenanceItem WHERE CarStatusCode = 'COMPLETE') AS complete,
          COUNT(*) AS total
        FROM VehiclesWithStatus
      `),
      pool.request().query(`
        SELECT
          COUNT(*) AS total_tickets,
          SUM(CASE WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1 ELSE 0 END) AS in_maintenance_tickets,
          SUM(CASE WHEN m.CarStatusCode IN ('READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE') THEN 1 ELSE 0 END) AS ready_pickup_tickets
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.IsActive = 1 AND i.Status = 'MAINTENANCE'
          AND m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')
      `)
    ])

    // 2. Service Location Breakdown (Only count cars currently in MAINTENANCE status, once per car)
    const locationResult = await pool.request().query(`
      WITH LatestTickets AS (
        SELECT 
          m.InventoryItemID,
          m.ServiceLocationCode,
          ROW_NUMBER() OVER (
            PARTITION BY m.InventoryItemID 
            ORDER BY 
              CASE 
                WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1
                WHEN m.CarStatusCode = 'READY_PICKUP_MAINTENANCE' THEN 2
                WHEN m.CarStatusCode = 'STILL_WORK' THEN 3
                ELSE 4
              END ASC,
              m.MaintenanceItemID DESC
          ) as rn
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.Status = 'MAINTENANCE' AND i.IsActive = 1
      )
      SELECT 
        ISNULL(NULLIF(ServiceLocationCode, ''), 'ไม่ระบุ') AS LocationCode,
        COUNT(*) AS Count
      FROM LatestTickets
      WHERE rn = 1
      GROUP BY ISNULL(NULLIF(ServiceLocationCode, ''), 'ไม่ระบุ')
      ORDER BY Count DESC
    `)

    // 3. Problem Type Breakdown (Only count cars currently in MAINTENANCE status, once per car)
    const problemTypeResult = await pool.request().query(`
      WITH LatestTickets AS (
        SELECT 
          m.InventoryItemID,
          m.ProblemTypeCode,
          ROW_NUMBER() OVER (
            PARTITION BY m.InventoryItemID 
            ORDER BY 
              CASE 
                WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1
                WHEN m.CarStatusCode = 'READY_PICKUP_MAINTENANCE' THEN 2
                WHEN m.CarStatusCode = 'STILL_WORK' THEN 3
                ELSE 4
              END ASC,
              m.MaintenanceItemID DESC
          ) as rn
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.Status = 'MAINTENANCE' AND i.IsActive = 1
      )
      SELECT 
        ISNULL(NULLIF(ProblemTypeCode, ''), 'ไม่ระบุ') AS ProblemTypeCode,
        COUNT(*) AS Count
      FROM LatestTickets
      WHERE rn = 1
      GROUP BY ISNULL(NULLIF(ProblemTypeCode, ''), 'ไม่ระบุ')
      ORDER BY Count DESC
    `)

    // 4. Latest 15 Follow-Up Logs
    const followUpsResult = await pool.request().query(`
      SELECT TOP 15
        f.MaintenanceFollowUpID,
        f.MaintenanceItemID,
        f.FollowUpDate,
        f.FollowUpDetail,
        f.CreateDate,
        ISNULL(u.FirstName + ' ' + ISNULL(u.LastName, ''), 'คนขับ/ผู้แจ้ง') AS CreateUserName,
        m.IssueTitle,
        i.RegisterNo
      FROM dbo.EV_MaintenanceFollowUp f
      JOIN dbo.EV_MaintenanceItem m ON f.MaintenanceItemID = m.MaintenanceItemID
      LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.EV_User u ON f.CreateUserID = u.UserID
      WHERE f.IsActive = 1
      ORDER BY f.CreateDate DESC
    `)

    // 5. Longest active repairs (Stuck repairs) (All 584 cars currently in MAINTENANCE status, once per car)
    const longestRepairsResult = await pool.request().query(`
      WITH LatestTickets AS (
        SELECT 
          m.MaintenanceItemID,
          m.InventoryItemID,
          m.IssueTitle,
          m.CarStatusCode,
          m.ServiceLocationCode,
          m.ReportDate,
          m.MaintenanceStartDate,
          m.FollowUpDetail,
          m.MaintenanceFinishDate,
          m.CreateDate,
          ROW_NUMBER() OVER (
            PARTITION BY m.InventoryItemID 
            ORDER BY 
              CASE 
                WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1
                WHEN m.CarStatusCode = 'READY_PICKUP_MAINTENANCE' THEN 2
                WHEN m.CarStatusCode = 'STILL_WORK' THEN 3
                ELSE 4
              END ASC,
              m.MaintenanceItemID DESC
          ) as rn
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.IsActive = 1 AND i.Status = 'MAINTENANCE' AND i.IsActive = 1
      )
      SELECT 
        t.MaintenanceItemID,
        COALESCE(i.RegisterNo, '') AS RegisterNo,
        COALESCE(i.VinNo, '') AS VinNo,
        i.Model,
        i.ProjectType AS Project,
        ISNULL(t.IssueTitle, 'รอดำเนินการเปิดใบงานซ่อม') AS IssueTitle,
        COALESCE(t.CarStatusCode, i.StatusType, 'WAITING_FOR_MAINTENANCE') AS CarStatusCode,
        ISNULL(sub.StatusName, CASE WHEN t.CarStatusCode IS NULL THEN 'รอเปิดใบงานซ่อม' ELSE t.CarStatusCode END) AS CarStatusName,
        ISNULL(t.ServiceLocationCode, 'ไม่ระบุ') AS ServiceLocationCode,
        t.ReportDate,
        t.MaintenanceStartDate,
        t.MaintenanceFinishDate,
        ISNULL(DATEDIFF(day, COALESCE(t.MaintenanceStartDate, t.ReportDate, i.UpdateDate, i.CreateDate), GETDATE()), 0) AS DaysActive,
        t.FollowUpDetail,
        CASE 
          WHEN t.MaintenanceStartDate IS NOT NULL THEN 'START_DATE'
          WHEN t.ReportDate IS NOT NULL THEN 'REPORT_DATE'
          ELSE 'VEHICLE_DATE'
        END AS SlaDateType
      FROM dbo.EV_InventoryItem i
      LEFT JOIN LatestTickets t ON i.InventoryItemID = t.InventoryItemID AND t.rn = 1
      LEFT JOIN dbo.EV_MsSubStatus sub ON t.CarStatusCode = sub.StatusCode
      WHERE i.Status = 'MAINTENANCE' AND i.IsActive = 1
      ORDER BY COALESCE(t.MaintenanceStartDate, t.ReportDate, i.UpdateDate, i.CreateDate) ASC
    `)

    // 6. Still Driveable repairs (STILL_WORK status, active tickets, regardless of inventory status)
    const stillWorkRepairsResult = await pool.request().query(`
      WITH LatestTickets AS (
        SELECT 
          m.MaintenanceItemID,
          m.InventoryItemID,
          m.IssueTitle,
          m.CarStatusCode,
          m.ServiceLocationCode,
          m.ReportDate,
          m.MaintenanceStartDate,
          m.FollowUpDetail,
          m.CreateDate,
          ROW_NUMBER() OVER (
            PARTITION BY m.InventoryItemID 
            ORDER BY 
              CASE 
                WHEN m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE') THEN 1
                WHEN m.CarStatusCode = 'READY_PICKUP_MAINTENANCE' THEN 2
                WHEN m.CarStatusCode = 'STILL_WORK' THEN 3
                ELSE 4
              END ASC,
              m.MaintenanceItemID DESC
          ) as rn
        FROM dbo.EV_MaintenanceItem m
        WHERE m.IsActive = 1
      )
      SELECT 
        t.MaintenanceItemID,
        COALESCE(i.RegisterNo, '') AS RegisterNo,
        COALESCE(i.VinNo, '') AS VinNo,
        i.Model,
        i.ProjectType AS Project,
        t.IssueTitle,
        t.CarStatusCode,
        ISNULL(sub.StatusName, t.CarStatusCode) AS CarStatusName,
        t.ServiceLocationCode,
        t.ReportDate,
        t.MaintenanceStartDate,
        ISNULL(DATEDIFF(day, COALESCE(t.MaintenanceStartDate, t.ReportDate, t.CreateDate), GETDATE()), 0) AS DaysActive,
        t.FollowUpDetail
      FROM LatestTickets t
      JOIN dbo.EV_InventoryItem i ON t.InventoryItemID = i.InventoryItemID
      LEFT JOIN dbo.EV_MsSubStatus sub ON t.CarStatusCode = sub.StatusCode
      WHERE t.rn = 1 AND t.CarStatusCode = 'STILL_WORK' AND i.IsActive = 1
      ORDER BY COALESCE(t.MaintenanceStartDate, t.ReportDate, t.CreateDate) ASC
    `)

    // Map database results with readable names and merge duplicates
    const locationMapObj: Record<string, { LocationCode: string; LocationName: string; Count: number }> = {}
    for (const row of locationResult.recordset) {
      const code = row.LocationCode
      const name = locationMap[code] || code
      if (!locationMapObj[name]) {
        locationMapObj[name] = { LocationCode: code, LocationName: name, Count: 0 }
      }
      locationMapObj[name].Count += row.Count
    }
    const locationsMapped = Object.values(locationMapObj).sort((a, b) => b.Count - a.Count)

    const problemTypesMapped = problemTypeResult.recordset.map(row => ({
      ProblemTypeCode: row.ProblemTypeCode,
      ProblemTypeName: problemTypeMap[row.ProblemTypeCode] || row.ProblemTypeCode,
      Count: row.Count
    }))

    // Calculate SLA Aging stats for stuck repairs
    const stuckList = longestRepairsResult.recordset.filter(
      (r: { CarStatusCode?: string }) => r.CarStatusCode !== 'READY_PICKUP_MAINTENANCE'
    )
    const readyPickupList = longestRepairsResult.recordset.filter(
      (r: { CarStatusCode?: string }) => r.CarStatusCode === 'READY_PICKUP_MAINTENANCE'
    )

    let d1_5 = 0
    let d6_10 = 0
    let d11_15 = 0
    let d16_30 = 0
    let d30_plus = 0
    let totalDays = 0
    let maxDays = 0

    let startDateCount = 0
    let reportDateCount = 0
    let vehicleDateCount = 0

    for (const item of stuckList) {
      const d = typeof item.DaysActive === 'number' && !isNaN(item.DaysActive) ? Math.max(0, item.DaysActive) : 0
      if (d <= 5) d1_5++
      else if (d <= 10) d6_10++
      else if (d <= 15) d11_15++
      else if (d <= 30) d16_30++
      else d30_plus++

      totalDays += d
      if (d > maxDays) maxDays = d

      if (item.SlaDateType === 'START_DATE') startDateCount++
      else if (item.SlaDateType === 'REPORT_DATE') reportDateCount++
      else vehicleDateCount++
    }

    const slaStats = {
      d1_5,
      d6_10,
      d11_15,
      d16_30,
      d30_plus,
      total: stuckList.length,
      avgDays: stuckList.length > 0 ? Math.round((totalDays / stuckList.length) * 10) / 10 : 0,
      maxDays,
      startDateCount,
      reportDateCount,
      vehicleDateCount,
      stuckTotal: stuckList.length,
      readyPickupTotal: readyPickupList.length,
      allVehiclesTotal: longestRepairsResult.recordset.length,
    }

    return NextResponse.json(
      {
        stats: {
          ...(statsResult.recordset[0] || { total: 0, in_maintenance: 0, waiting: 0, complete: 0, on_rent_maintenance: 0, ready_pickup: 0, replacement_maintenance: 0 }),
          ...(ticketStatsResult.recordset[0] || { total_tickets: 0, in_maintenance_tickets: 0, ready_pickup_tickets: 0 }),
        },
        slaStats,
        locations: locationsMapped,
        problemTypes: problemTypesMapped,
        followUps: followUpsResult.recordset,
        longestRepairs: longestRepairsResult.recordset,
        stillWorkRepairs: stillWorkRepairsResult.recordset
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('Error fetching maintenance dashboard:', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของระบบ: ' + errorMsg }, { status: 500 })
  }
}
