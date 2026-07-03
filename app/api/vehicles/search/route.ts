import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const cleanQuery = `%${q.replace(/[\s-]/g, '')}%`
    
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    const request = pool.request()
    request.input('cleanQuery', sql.NVarChar, cleanQuery)

    // Query top 15 matching active vehicles
    const result = await request.query(`
      SELECT TOP 15 InventoryItemID, VinNo, RegisterNo, Model, Project
      FROM dbo.EV_InventoryItem
      WHERE IsActive = 1
        AND (
          REPLACE(REPLACE(RegisterNo, ' ', ''), '-', '') LIKE @cleanQuery
          OR REPLACE(REPLACE(VinNo, ' ', ''), '-', '') LIKE @cleanQuery
        )
      ORDER BY RegisterNo ASC
    `)

    return NextResponse.json(result.recordset)
  } catch (error) {
    console.error('[Vehicle Search API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
