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
  'IN_MAINTENANCE': 'อยู่ระหว่างการซ่อม',
  'WAITING_FOR_MAINTENANCE': 'รอเข้าซ่อม',
  'STILL_WORK': 'ยังวิ่งอยู่',
}

const mapCode = (code: unknown, map: Record<string, string>): string => {
  const s = (code as string) || ''
  return map[s] || s.replace(/_/g, ' ') || '-'
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
    let statusWhere = ''
    if (statusFilter && statusFilter !== 'all') {
      statusWhere = ` AND m.CarStatusCode = @statusFilter`
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
    const summaryResult = await summaryReq.query(`
      SELECT
        COUNT(DISTINCT InventoryItemID) AS total,
        COUNT(DISTINCT CASE WHEN CarStatusCode = 'IN_MAINTENANCE' THEN InventoryItemID END) AS in_maintenance,
        0 AS complete,
        COUNT(DISTINCT CASE WHEN CarStatusCode IN ('WAITING_FOR_MAINTENANCE','STILL_WORK') THEN InventoryItemID END) AS waiting
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1
    `)

    // Unique locations
    const locReq = pool.request()
    const locResult = await locReq.query(`
      SELECT DISTINCT ServiceLocationCode
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1 AND ServiceLocationCode IS NOT NULL AND ServiceLocationCode != ''
      ORDER BY ServiceLocationCode
    `)

    // Repairs by location summary
    const repairByLocReq = pool.request()
    const repairByLocResult = await repairByLocReq.query(`
      SELECT 
        ISNULL(NULLIF(m.ServiceLocationCode, ''), 'ไม่ระบุ') AS Location,
        COUNT(DISTINCT m.InventoryItemID) AS Count
      FROM dbo.EV_MaintenanceItem m
      WHERE m.IsActive = 1
        AND m.CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'STILL_WORK')
      GROUP BY m.ServiceLocationCode
      ORDER BY Count DESC
    `)

    // Maintenance items (active only, optionally filtered)
    const itemReq = pool.request()
    if (statusFilter && statusFilter !== 'all') {
      itemReq.input('statusFilter', sql.NVarChar, statusFilter)
    }
    if (locationFilter && locationFilter !== 'all' && locationFilter !== 'ไม่ระบุ') {
      itemReq.input('locationFilter', sql.NVarChar, locationFilter)
    }

    const itemResult = await itemReq.query(`
      SELECT TOP 500
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
        m.FollowUpDetail
      FROM dbo.EV_MaintenanceItem m
      LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
      WHERE m.IsActive = 1${statusWhere}${locationWhere}
      ORDER BY 
        CASE WHEN m.CarStatusCode IN ('IN_MAINTENANCE','WAITING_FOR_MAINTENANCE','STILL_WORK') THEN 0 ELSE 1 END,
        m.ReportDate DESC
    `)

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
      problem_type: mapCode(m.ProblemTypeCode, problemTypeMap),
      fault_party: mapCode(m.FaultPartyCode, faultPartyMap),
      car_case: mapCode(m.CarCaseCode, carCaseMap),
      service_location: ((m.ServiceLocationCode as string) || '-').replace(/_/g, ' '),
      service_location_code: m.ServiceLocationCode,
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
    }))

    return NextResponse.json({
      items,
      summary: summaryResult.recordset[0] || { total: 0, in_maintenance: 0, complete: 0, waiting: 0 },
      locations: locResult.recordset.map((r: { ServiceLocationCode: string }) => r.ServiceLocationCode),
      locationSummary: repairByLocResult.recordset || [],
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Maintenance API Error]', error)
    return NextResponse.json({ error: 'Failed to fetch maintenance data' }, { status: 500 })
  }
}
