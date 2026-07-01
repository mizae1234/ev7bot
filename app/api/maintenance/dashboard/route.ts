import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
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

export async function GET(req: NextRequest) {
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
        DaysActive: 15,
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
        DaysActive: 10,
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
        DaysActive: 8,
        FollowUpDetail: 'อยู่ระหว่างประกันคุมราคาประเมินค่าซ่อม'
      }
    ]

    return NextResponse.json({
      stats: mockStats,
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

    // 1. Basic Stats
    const statsResult = await pool.request().query(`
      SELECT
        COUNT(CASE WHEN m.CarStatusCode = 'WAITING_FOR_MAINTENANCE' THEN 1 END) AS waiting,
        COUNT(CASE WHEN m.CarStatusCode = 'IN_MAINTENANCE' THEN 1 END) AS in_maintenance,
        COUNT(CASE WHEN m.CarStatusCode = 'COMPLETE' THEN 1 END) AS complete,
        COUNT(*) AS total
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1
    `)

    // 2. Service Location Breakdown
    const locationResult = await pool.request().query(`
      SELECT 
        ISNULL(NULLIF(m.ServiceLocationCode, ''), 'ไม่ระบุ') AS LocationCode,
        COUNT(*) AS Count
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1 AND m.CarStatusCode != 'COMPLETE'
      GROUP BY m.ServiceLocationCode
      ORDER BY Count DESC
    `)

    // 3. Problem Type Breakdown
    const problemTypeResult = await pool.request().query(`
      SELECT 
        ISNULL(NULLIF(m.ProblemTypeCode, ''), 'ไม่ระบุ') AS ProblemTypeCode,
        COUNT(*) AS Count
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1 AND m.CarStatusCode != 'COMPLETE'
      GROUP BY m.ProblemTypeCode
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
      ORDER BY f.FollowUpDate DESC, f.CreateDate DESC
    `)

    // 5. Longest active repairs (Stuck repairs)
    const longestRepairsResult = await pool.request().query(`
      SELECT TOP 15
        m.MaintenanceItemID,
        COALESCE(i.RegisterNo, '') AS RegisterNo,
        i.Model,
        i.ProjectType AS Project,
        m.IssueTitle,
        m.CarStatusCode,
        m.ServiceLocationCode,
        m.ReportDate,
        DATEDIFF(day, m.ReportDate, GETDATE()) AS DaysActive,
        m.FollowUpDetail
      FROM dbo.EV_MaintenanceItem m
      LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      WHERE m.IsActive = 1 AND m.CarStatusCode != 'COMPLETE'
      ORDER BY m.ReportDate ASC
    `)

    // Map database results with readable names
    const locationsMapped = locationResult.recordset.map(row => ({
      LocationCode: row.LocationCode,
      LocationName: locationMap[row.LocationCode] || row.LocationCode,
      Count: row.Count
    }))

    const problemTypesMapped = problemTypeResult.recordset.map(row => ({
      ProblemTypeCode: row.ProblemTypeCode,
      ProblemTypeName: problemTypeMap[row.ProblemTypeCode] || row.ProblemTypeCode,
      Count: row.Count
    }))

    return NextResponse.json({
      stats: statsResult.recordset[0] || { total: 0, in_maintenance: 0, waiting: 0, complete: 0 },
      locations: locationsMapped,
      problemTypes: problemTypesMapped,
      followUps: followUpsResult.recordset,
      longestRepairs: longestRepairsResult.recordset
    })
  } catch (err: any) {
    console.error('Error fetching maintenance dashboard:', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดของระบบ: ' + err.message }, { status: 500 })
  }
}
