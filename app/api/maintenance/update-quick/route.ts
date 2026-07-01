import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { maintenanceId, carStatusCode, followUpDetail, serviceLocationCode, serviceLocationName, startDate, finishDate, lineUserId, deletedAttachmentIds } = await req.json()

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

    const pool = await getMSSQLWritePool()
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

    // Execute Stored Procedure sp_UpdateMaintenanceItemJson
    const updateObj = {
      maintenanceId,
      carStatusCode: carStatusCode || null,
      startDate: startDate || null,
      finishDate: finishDate || null,
      serviceLocationCode: serviceLocationCode !== undefined ? serviceLocationCode : null,
      serviceLocationName: serviceLocationCode !== undefined ? (serviceLocationName || serviceLocationCode || 'นอกสถานที่ / ไม่ระบุ') : null,
      followUpDetail: (followUpDetail && followUpDetail.trim()) ? followUpDetail.trim() : null,
      updateUserId: dbUserId,
      deletedAttachmentIds: (deletedAttachmentIds && Array.isArray(deletedAttachmentIds) && deletedAttachmentIds.length > 0) ? deletedAttachmentIds : null
    }

    await pool.request()
      .input('UpdateJson', sql.NVarChar, JSON.stringify(updateObj))
      .execute('dbo.sp_UpdateMaintenanceItemJson')

    return NextResponse.json({
      success: true,
      message: 'บันทึกการอัปเดตและติดตามผลสำเร็จเรียบร้อย'
    })
  } catch (err: any) {
    console.error('[Update Quick Maintenance Error]', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}` }, { status: 500 })
  }
}
