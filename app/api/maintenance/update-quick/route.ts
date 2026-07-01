import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { maintenanceId, carStatusCode, followUpDetail, serviceLocationCode, serviceLocationName, startDate } = await req.json()

    if (!maintenanceId) {
      return NextResponse.json({ error: 'ไม่พบรหัสใบแจ้งซ่อม (maintenanceId)' }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      console.log('[Mock Mode] Update Quick Maintenance:', { maintenanceId, carStatusCode, followUpDetail, serviceLocationCode, startDate })
      return NextResponse.json({
        success: true,
        message: 'อัปเดตข้อมูลสำเร็จ (จำลองสถานะ MOCK_MODE)'
      })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // 1. Update CarStatusCode only (InventoryItem status sync deferred)
    if (carStatusCode) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('statusCode', sql.NVarChar, carStatusCode)
        .query(`
          -- Update Maintenance Ticket Status
          UPDATE dbo.EV_MaintenanceItem
          SET CarStatusCode = @statusCode,
              UpdateDate = GETDATE()
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)
    }

    // 1.2 Update Start Date if provided
    if (startDate) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('startDate', sql.DateTime, new Date(startDate))
        .query(`
          UPDATE dbo.EV_MaintenanceItem
          SET MaintenanceStartDate = @startDate,
              UpdateDate = GETDATE()
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)
    }

    // 1.5 Update Service Location if provided
    if (serviceLocationCode !== undefined) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('locCode', sql.NVarChar, serviceLocationCode)
        .query(`
          UPDATE dbo.EV_MaintenanceItem
          SET ServiceLocationCode = @locCode,
              UpdateDate = GETDATE()
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)

      // Auto-insert a follow-up log for the location update
      const locText = serviceLocationName || serviceLocationCode || 'นอกสถานที่ / ไม่ระบุ'
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('detail', sql.NVarChar, `📍 อัปเดตสถานที่ซ่อมบำรุงเป็น: ${locText}`)
        .query(`
          INSERT INTO dbo.EV_MaintenanceFollowUp (
            MaintenanceItemID,
            FollowUpDate,
            FollowUpDetail,
            IsActive,
            CreateDate,
            CreateUserID
          ) VALUES (
            @maintId,
            CAST(GETDATE() AS DATE),
            @detail,
            1,
            GETDATE(),
            1
          )
        `)
    }

    // 2. Insert follow-up progress log
    if (followUpDetail && followUpDetail.trim()) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('detail', sql.NVarChar, followUpDetail.trim())
        .query(`
          INSERT INTO dbo.EV_MaintenanceFollowUp (
            MaintenanceItemID,
            FollowUpDate,
            FollowUpDetail,
            IsActive,
            CreateDate,
            CreateUserID
          ) VALUES (
            @maintId,
            CAST(GETDATE() AS DATE),
            @detail,
            1,
            GETDATE(),
            1 -- System User / Mobile LIFF
          )
        `)
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการอัปเดตและติดตามผลสำเร็จเรียบร้อย'
    })
  } catch (err: any) {
    console.error('[Update Quick Maintenance Error]', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}` }, { status: 500 })
  }
}
