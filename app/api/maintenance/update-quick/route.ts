import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { maintenanceId, carStatusCode, followUpDetail, serviceLocationCode, serviceLocationName, startDate, finishDate, lineUserId } = await req.json()

    if (!maintenanceId) {
      return NextResponse.json({ error: 'ไม่พบรหัสใบแจ้งซ่อม (maintenanceId)' }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      console.log('[Mock Mode] Update Quick Maintenance:', { maintenanceId, carStatusCode, followUpDetail, serviceLocationCode, startDate, finishDate, lineUserId })
      return NextResponse.json({
        success: true,
        message: 'อัปเดตข้อมูลสำเร็จ (จำลองสถานะ MOCK_MODE)'
      })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })
    }

    // Resolve ev7UserId from lineUserId
    let dbUserId = 1 // Default to 1 (System / LIFF User)
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId }
        })
        if (reg?.ev7UserId) {
          dbUserId = reg.ev7UserId
        }
      } catch (prismaErr) {
        console.error('[Prisma read ev7UserId Error]', prismaErr)
      }
    }

    // 1. Update CarStatusCode only (InventoryItem status sync deferred)
    if (carStatusCode) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('statusCode', sql.NVarChar, carStatusCode)
        .input('userId', sql.Int, dbUserId)
        .query(`
          -- Update Maintenance Ticket Status
          UPDATE dbo.EV_MaintenanceItem
          SET CarStatusCode = @statusCode,
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)
    }

    // 1.2 Update Start Date if provided
    if (startDate) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('startDate', sql.DateTime, new Date(startDate))
        .input('userId', sql.Int, dbUserId)
        .query(`
          UPDATE dbo.EV_MaintenanceItem
          SET MaintenanceStartDate = @startDate,
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)
    }

    // 1.3 Update Finish Date if provided
    if (finishDate) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('finishDate', sql.DateTime, new Date(finishDate))
        .input('userId', sql.Int, dbUserId)
        .query(`
          UPDATE dbo.EV_MaintenanceItem
          SET MaintenanceFinishDate = @finishDate,
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)
    }

    // 1.5 Update Service Location if provided
    if (serviceLocationCode !== undefined) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('locCode', sql.NVarChar, serviceLocationCode)
        .input('userId', sql.Int, dbUserId)
        .query(`
          UPDATE dbo.EV_MaintenanceItem
          SET ServiceLocationCode = @locCode,
              UpdateDate = GETDATE(),
              UpdateUserID = @userId
          WHERE MaintenanceItemID = @maintId AND IsActive = 1;
        `)

      // Auto-insert a follow-up log for the location update
      const locText = serviceLocationName || serviceLocationCode || 'นอกสถานที่ / ไม่ระบุ'
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('detail', sql.NVarChar, `📍 อัปเดตสถานที่ซ่อมบำรุงเป็น: ${locText}`)
        .input('userId', sql.Int, dbUserId)
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
            @userId
          )
        `)
    }

    // 2. Insert follow-up progress log
    if (followUpDetail && followUpDetail.trim()) {
      await pool.request()
        .input('maintId', sql.Int, maintenanceId)
        .input('detail', sql.NVarChar, followUpDetail.trim())
        .input('userId', sql.Int, dbUserId)
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
            @userId
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
