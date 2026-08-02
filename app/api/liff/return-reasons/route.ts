import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool } from '@/lib/mssql'

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อ SQL Server ได้' }, { status: 500 })
    }

    const result = await pool.request().query(`
      SELECT StatusCode AS code, StatusName AS name 
      FROM dbo.EV_MsSubStatus 
      WHERE Type = 'RETURN_REASON' AND IsActive = 1
      ORDER BY Seq ASC, StatusName ASC
    `)

    return NextResponse.json(result.recordset)
  } catch (error) {
    console.error('[API Return Reasons Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงเหตุผลการคืนรถ' }, { status: 500 })
  }
}
