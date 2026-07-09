import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim()
    const cleanQuery = `%${q.replace(/[\s-]/g, '')}%`
    
    const isReplacement = searchParams.get('replacement') === 'true'
    
    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    const request = pool.request()
    request.input('cleanQuery', sql.NVarChar, cleanQuery)

    // Query top 15 matching active vehicles
    let sqlQuery = `
      SELECT TOP 15 
        i.InventoryItemID, i.VinNo, i.RegisterNo, i.Model, i.Project, i.Status, i.StatusType,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      WHERE i.IsActive = 1
    `
    if (isReplacement) {
      sqlQuery += ` AND i.StatusType = 'REPLACEMENT_AVAILABLE' `
    }
    sqlQuery += `
        AND (
          REPLACE(REPLACE(i.RegisterNo, ' ', ''), '-', '') LIKE @cleanQuery
          OR REPLACE(REPLACE(i.VinNo, ' ', ''), '-', '') LIKE @cleanQuery
        )
      ORDER BY i.RegisterNo ASC
    `

    const result = await request.query(sqlQuery)
    return NextResponse.json(result.recordset)
  } catch (error) {
    console.error('[Vehicle Search API Error]', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
