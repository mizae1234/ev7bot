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
        i.InventoryItemID, i.VinNo, i.MotorNo, i.RegisterNo, i.Model, i.Project, i.ProjectType, i.Company, i.Status, i.StatusType, i.CurrentLocation,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName,
        rsvInfo.ReplacementReservedType,
        rsvInfo.ReplacementReservedRemark,
        vhInfo.ReplacementReadyDetails
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      OUTER APPLY (
        SELECT TOP 1 
          rr.Type AS ReplacementReservedType,
          rr.Remark AS ReplacementReservedRemark
        FROM dbo.EV_ReplacementReserved rr
        WHERE rr.VinNo = i.VinNo AND rr.IsActive = 1
        ORDER BY rr.CreateDate DESC
      ) rsvInfo
      OUTER APPLY (
        SELECT TOP 1 
          vh.ReplacementReadyDetails
        FROM dbo.View_VehicleStatusHierarchy vh
        WHERE vh.VinNo = i.VinNo
      ) vhInfo
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
