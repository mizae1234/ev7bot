import { NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export async function GET() {
  try {
    const pool = await getMSSQLPool()
    if (!pool) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })

    const result = await pool.request().query(`
      SELECT 
        VinNo,
        RegisterNo,
        VehicleStatus,
        VehicleStatusType,
        ProjectType,
        StatusTypeName,
        TopGroup,
        SubGroup,
        LeafNode,
        ReplacementReadyDetails
      FROM dbo.View_VehicleStatusHierarchy
    `)

    return NextResponse.json({ items: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Vehicle Status Summary Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
