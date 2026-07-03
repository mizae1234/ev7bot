import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[External API Proxy] Received Payload:', body)

    if (env.MOCK_MODE) {
      // Simulate saving delay
      await new Promise(resolve => setTimeout(resolve, 800))
      return NextResponse.json({
        success: true,
        message: 'บันทึกข้อมูลเรียบร้อยแล้ว (จำลองสถานะ MOCK_MODE)',
        data: {
          maintenanceId: Math.floor(Math.random() * 100000) + 10000,
          createdAt: new Date().toISOString()
        }
      })
    }

    const pool = await getMSSQLWritePool()
    if (!pool) {
      return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล SQL Server ได้' }, { status: 500 })
    }

    // 1. Get InventoryItemID from RegisterNo or VinNo
    const registerNo = body.carInfo?.registerNo
    const vinNo = body.carInfo?.vin

    if (!registerNo && !vinNo) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลทะเบียนรถหรือหมายเลขตัวถังในการแจ้งซ่อม' }, { status: 400 })
    }

    const carReq = pool.request()
    carReq.input('registerNo', sql.NVarChar, registerNo || '')
    carReq.input('vinNo', sql.NVarChar, vinNo || '')
    const carRes = await carReq.query(`
      SELECT TOP 1 InventoryItemID 
      FROM dbo.EV_InventoryItem 
      WHERE (RegisterNo = @registerNo OR VinNo = @vinNo) AND IsActive = 1
    `)

    if (carRes.recordset.length === 0) {
      return NextResponse.json({ error: `ไม่พบข้อมูลรถในระบบสำหรับทะเบียน ${registerNo || vinNo}` }, { status: 404 })
    }

    const inventoryItemId = carRes.recordset[0].InventoryItemID

    // 2. Resolve ev7UserId from lineUserId
    let dbUserId = 1 // Default to 1 (System / LIFF User)
    if (body.lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId: body.lineUserId }
        })
        if (reg && reg.ev7UserId !== null) {
          dbUserId = reg.ev7UserId
        }
      } catch (e) {
        console.error('[Prisma read ev7UserId Error]', e)
      }
    }

    // 3. Execute Stored Procedure sp_InsertMaintenanceItemJson
    const maintenanceObj = {
      inventoryItemId,
      registerNo: registerNo || null,
      vinNo: vinNo || null,
      driverName: body.driverName || null,
      incidentDate: body.incidentDate ? new Date(body.incidentDate).toISOString() : null,
      carStatusCode: body.carStatusCode || null,
      issueTitle: body.issueDescription || null,
      problemTypeCode: body.problemType || null,
      faultPartyCode: body.faultPartyCode || null,
      carCaseCode: body.carCaseCode || null,
      serviceLocationCode: body.serviceLocationCode || null,
      insuranceCode: body.insurance || null,
      followUpDetail: body.issueDescription || null,
      createUserId: dbUserId,
      claimNumber: body.claimNo || null
    }

    const insertReq = pool.request()
    insertReq.input('MaintenanceJson', sql.NVarChar, JSON.stringify(maintenanceObj))
    insertReq.output('NewMaintenanceItemID', sql.Int)

    const insertRes = await insertReq.execute('dbo.sp_InsertMaintenanceItemJson')
    const newMaintenanceId = insertRes.output.NewMaintenanceItemID

    // ─── If new report is WAITING_FOR_MAINTENANCE (เข้าซ่อม), update inventory and other pending tickets ───
    if (body.carStatusCode === 'WAITING_FOR_MAINTENANCE') {
      try {
        // 1. Get current Status and StatusType of the vehicle
        const invReq = pool.request()
        invReq.input('invId', sql.Int, inventoryItemId)
        const invRes = await invReq.query(`
          SELECT Status, StatusType FROM dbo.EV_InventoryItem WHERE InventoryItemID = @invId
        `)

        if (invRes.recordset.length > 0) {
          const currentStatus = invRes.recordset[0].Status
          const currentStatusType = invRes.recordset[0].StatusType

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

          if (newStatus && newStatusType) {
            const updReq = pool.request()
            updReq.input('newStatus', sql.NVarChar, newStatus)
            updReq.input('newStatusType', sql.NVarChar, newStatusType)
            updReq.input('invId', sql.Int, inventoryItemId)
            updReq.input('userId', sql.Int, dbUserId)
            await updReq.query(`
              UPDATE dbo.EV_InventoryItem
              SET Status = @newStatus, StatusType = @newStatusType, UpdateUserID = @userId, UpdateDate = GETDATE()
              WHERE InventoryItemID = @invId
            `)
            console.log(`[Inventory Update from New Ticket] InventoryItemID=${inventoryItemId}: ${currentStatus}/${currentStatusType} → ${newStatus}/${newStatusType}`)
          }
        }

        // 2. Update OTHER pending tickets of this vehicle to WAITING_FOR_MAINTENANCE
        const locCode = body.serviceLocationCode || null
        const locName = body.serviceLocationName || 'ไม่ระบุ / นอกสถานที่'

        const pendingReq = pool.request()
        pendingReq.input('invId', sql.Int, inventoryItemId)
        pendingReq.input('newMaintId', sql.Int, newMaintenanceId)
        const pendingRes = await pendingReq.query(`
          SELECT MaintenanceItemID 
          FROM dbo.EV_MaintenanceItem 
          WHERE InventoryItemID = @invId 
            AND MaintenanceItemID != @newMaintId
            AND CarStatusCode NOT IN ('COMPLETE', 'READY_PICKUP_MAINTENANCE')
            AND IsActive = 1
        `)

        const otherTickets = pendingRes.recordset
        if (otherTickets.length > 0) {
          console.log(`[New Ticket WAITING_FOR_MAINTENANCE] Found ${otherTickets.length} other pending tickets to update.`)
          for (const ticket of otherTickets) {
            const tId = ticket.MaintenanceItemID

            // Update ticket status & location
            const updTicketReq = pool.request()
            updTicketReq.input('maintId', sql.Int, tId)
            updTicketReq.input('locCode', sql.NVarChar, locCode)
            updTicketReq.input('userId', sql.Int, dbUserId)
            await updTicketReq.query(`
              UPDATE dbo.EV_MaintenanceItem
              SET CarStatusCode = 'WAITING_FOR_MAINTENANCE',
                  ServiceLocationCode = @locCode,
                  UpdateUserID = @userId,
                  UpdateDate = GETDATE()
              WHERE MaintenanceItemID = @maintId
            `)

            // Insert follow-up log for this ticket
            const followUpMsg = `ระบบอัพเดต : เข้าซ่อม ณ สถานที่: ${locName}`
            const insFollowUpReq = pool.request()
            insFollowUpReq.input('maintId', sql.Int, tId)
            insFollowUpReq.input('detail', sql.NVarChar, followUpMsg)
            insFollowUpReq.input('userId', sql.Int, dbUserId)
            await insFollowUpReq.query(`
              INSERT INTO dbo.EV_MaintenanceFollowUp (
                MaintenanceItemID, FollowUpDate, FollowUpDetail, IsActive,
                CreateDate, CreateUserID, UpdateDate, UpdateUserID
              )
              VALUES (
                @maintId, GETDATE(), @detail, 1,
                GETDATE(), @userId, GETDATE(), @userId
              )
            `)
          }
        }
      } catch (bulkErr) {
        console.error('[New Ticket WAITING_FOR_MAINTENANCE Bulk Action Error]', bulkErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อมูลแจ้งซ่อมเรียบร้อยแล้ว',
      data: {
        maintenanceId: newMaintenanceId,
        createdAt: new Date().toISOString()
      }
    })
  } catch (err: any) {
    console.error('[External API Proxy] Error:', err.message)
    return NextResponse.json({ error: `เกิดข้อผิดพลาดในการบันทึก: ${err.message}` }, { status: 500 })
  }
}
