import { NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export async function GET() {
  try {
    const pool = await getMSSQLPool()

    const result = await pool.request().query(`
      SELECT 
        i.VinNo,
        i.Status AS VehicleStatus,
        i.StatusType AS VehicleStatusType,
        i.ProjectType,
        COALESCE(
          ISNULL(sub_st.DescriptionStatus, sub_st.StatusName),
          ISNULL(sub_s.DescriptionStatus, sub_s.StatusName),
          i.StatusType,
          i.Status
        ) AS StatusTypeName
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsSubStatus sub_st ON i.StatusType = sub_st.StatusCode AND sub_st.Type LIKE 'STATUS_TYPE_%'
      LEFT JOIN dbo.EV_MsSubStatus sub_s ON i.Status = sub_s.StatusCode AND sub_s.Type = 'STATUS'
      WHERE i.IsActive = 1
        AND ISNULL(i.ProjectType,'') NOT IN ('OTH','Fleet')
    `)

    return NextResponse.json({ items: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Vehicle Status Summary Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
