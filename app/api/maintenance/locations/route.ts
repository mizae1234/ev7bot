import { NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    const result = await pool.request().query(`
      SELECT StatusCode AS code, StatusName AS name
      FROM dbo.EV_MsSubStatus
      WHERE Type = 'LOCATION' AND IsActive = 1
      ORDER BY StatusName
    `)

    return NextResponse.json({ locations: result.recordset })
  } catch (error: any) {
    console.error('[Locations API Error]', error)
    return NextResponse.json({ error: 'Failed to retrieve locations: ' + error.message }, { status: 500 })
  }
}
