import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { maintenanceId, carStatusCode, followUpDetail, serviceLocationCode, serviceLocationName, startDate, finishDate, lineUserId, deletedAttachmentIds, driverName, incidentDate, issueTitle, problemTypeCode, faultPartyCode, carCaseCode, insuranceCode, claimNumber } = await req.json()

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

    // Convert datetime-local format (2026-07-03T02:43) to MSSQL-compatible (2026-07-03 02:43:00)
    const toMssqlDate = (d: string | null | undefined): string | null => {
      if (!d) return null
      // Replace T with space, add :00 seconds if missing
      let result = d.replace('T', ' ')
      if (result.split(':').length === 2) result += ':00' // add seconds
      return result
    }

    // Execute Stored Procedure sp_UpdateMaintenanceItemJson
    const updateObj = {
      maintenanceId,
      carStatusCode: carStatusCode || null,
      startDate: toMssqlDate(startDate),
      finishDate: toMssqlDate(finishDate),
      serviceLocationCode: serviceLocationCode !== undefined ? serviceLocationCode : null,
      serviceLocationName: serviceLocationCode !== undefined ? (serviceLocationName || serviceLocationCode || 'นอกสถานที่ / ไม่ระบุ') : null,
      followUpDetail: (followUpDetail && followUpDetail.trim()) ? followUpDetail.trim() : null,
      updateUserId: dbUserId,
      deletedAttachmentIds: (deletedAttachmentIds && Array.isArray(deletedAttachmentIds) && deletedAttachmentIds.length > 0) ? deletedAttachmentIds : null,
      driverName: driverName || null,
      incidentDate: toMssqlDate(incidentDate),
      issueTitle: issueTitle || null,
      problemTypeCode: problemTypeCode || null,
      faultPartyCode: faultPartyCode || null,
      carCaseCode: carCaseCode || null,
      insuranceCode: insuranceCode || null,
      claimNumber: claimNumber || null,
    }

    await pool.request()
      .input('UpdateJson', sql.NVarChar, JSON.stringify(updateObj))
      .execute('dbo.sp_UpdateMaintenanceItemJson')

    // ─── Update EV_InventoryItem Status when entering maintenance (เข้าซ่อม) ───
    if (carStatusCode === 'WAITING_FOR_MAINTENANCE') {
      try {
        // 1. Get InventoryItemID from the maintenance item
        const maintReq = pool.request()
        maintReq.input('maintId', sql.Int, maintenanceId)
        const maintRes = await maintReq.query(`
          SELECT InventoryItemID FROM dbo.EV_MaintenanceItem WHERE MaintenanceItemID = @maintId
        `)

        if (maintRes.recordset.length > 0) {
          const inventoryItemId = maintRes.recordset[0].InventoryItemID

          // 2. Get current Status and StatusType of the vehicle
          const invReq = pool.request()
          invReq.input('invId', sql.Int, inventoryItemId)
          const invRes = await invReq.query(`
            SELECT Status, StatusType FROM dbo.EV_InventoryItem WHERE InventoryItemID = @invId
          `)

          if (invRes.recordset.length > 0) {
            const currentStatus = invRes.recordset[0].Status
            const currentStatusType = invRes.recordset[0].StatusType
            console.log(`[Inventory Check] InventoryItemID=${inventoryItemId}, Status='${currentStatus}', StatusType='${currentStatusType}'`)

            let newStatus: string | null = null
            let newStatusType: string | null = null

            // Mapping logic
            if (currentStatus === 'MAINTENANCE') {
              // Already in maintenance, do nothing
            } else if (currentStatus === 'ON_RENT') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'ON_RENT_MAINTENANCE'
            } else if (currentStatusType === 'AVAILABLE_USE') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'USE_MAINTENANCE'
            } else if (currentStatusType === 'AVAILABLE') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'NEW_MAINTENANCE'
            } else if (currentStatusType === 'REPLACEMENT_CAR') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'REPLACEMENT_MAINTENANCE'
            } else if (currentStatusType === 'REPLACEMENT_AVAILABLE') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'REPLACEMENT_MAINTENANCE'
            }

            // 3. Update if mapping matched
            if (newStatus && newStatusType) {
              const updReq = pool.request()
              updReq.input('newStatus', sql.NVarChar, newStatus)
              updReq.input('newStatusType', sql.NVarChar, newStatusType)
              updReq.input('invId2', sql.Int, inventoryItemId)
              updReq.input('userId', sql.Int, dbUserId)
              await updReq.query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = @newStatus, StatusType = @newStatusType, UpdateUserID = @userId, UpdateDate = GETDATE()
                WHERE InventoryItemID = @invId2
              `)
              console.log(`[Inventory Update] InventoryItemID=${inventoryItemId}: ${currentStatus}/${currentStatusType} → ${newStatus}/${newStatusType}`)
            }
          }
        }
      } catch (invErr) {
        console.error('[Inventory Status Update Error]', invErr)
        // Don't fail the whole request — maintenance update already succeeded
      }
    }

    // ─── Direct update EV_MaintenanceItem for เริ่มซ่อม (IN_MAINTENANCE) ───
    if (carStatusCode === 'IN_MAINTENANCE') {
      try {
        const startReq = pool.request()
        startReq.input('maintId', sql.Int, maintenanceId)
        startReq.input('statusCode', sql.NVarChar, 'IN_MAINTENANCE')
        startReq.input('startDate', sql.NVarChar, toMssqlDate(startDate) || new Date().toISOString().replace('T', ' ').slice(0, 19))
        startReq.input('locCode', sql.NVarChar, serviceLocationCode || null)
        startReq.input('locName', sql.NVarChar, serviceLocationName || serviceLocationCode || null)
        startReq.input('userId', sql.Int, dbUserId)
        await startReq.query(`
          UPDATE dbo.EV_MaintenanceItem
          SET CarStatusCode = @statusCode,
              MaintenanceStartDate = @startDate,
              ServiceLocationCode = @locCode,
              ServiceLocationName = @locName,
              UpdateUserID = @userId,
              UpdateDate = GETDATE()
          WHERE MaintenanceItemID = @maintId
        `)
        console.log(`[Start Maintenance] MaintenanceItemID=${maintenanceId}: set IN_MAINTENANCE, StartDate=${startDate}, Location=${serviceLocationCode}`)
      } catch (startErr) {
        console.error('[Start Maintenance Update Error]', startErr)
      }
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
