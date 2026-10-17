import { NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export async function GET() {
  try {
    const pool = await getMSSQLPool()
    if (!pool) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })

    const result = await pool.request().query(`
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
        WHERE m.IsActive = 1 AND m.CarStatusCode NOT IN ('COMPLETE')
      )
      SELECT 
        v.VinNo,
        v.RegisterNo,
        v.VehicleStatus,
        v.VehicleStatusType,
        v.ProjectType,
        v.StatusTypeName,
        v.TopGroup,
        v.SubGroup,
        v.LeafNode,
        v.ReplacementReadyDetails,
        lt.CarStatusCode AS LatestCarStatusCode
      FROM dbo.View_VehicleStatusHierarchy v
      OUTER APPLY (
        SELECT TOP 1 InventoryItemID 
        FROM dbo.EV_InventoryItem inv 
        WHERE inv.VinNo = v.VinNo AND inv.IsActive = 1
      ) inv
      LEFT JOIN LatestTickets lt ON inv.InventoryItemID = lt.InventoryItemID AND lt.rn = 1
    `)

    return NextResponse.json({ items: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Vehicle Status Summary Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
