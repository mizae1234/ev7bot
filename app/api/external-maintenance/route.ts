import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import { insertLocationLog } from '@/lib/location-log'
import { env } from '@/lib/env'
import { sendMentionNotifications } from '@/lib/line'

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

    // 1. Get InventoryItemID from RegisterNo or VinNo (Supports both LIFF carInfo and Admin root fields)
    const registerNo = body.carInfo?.registerNo || body.registerNo || null
    const vinNo = body.carInfo?.vin || body.vinNo || body.vin || null

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
    let senderName = 'ผู้ใช้ LINE'
    if (body.lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId: body.lineUserId }
        })
        if (reg) {
          if (reg.ev7UserId !== null) {
            dbUserId = reg.ev7UserId
          }
          if (reg.displayName) {
            senderName = reg.displayName
          }
        }
      } catch (e) {
        console.error('[Prisma read ev7UserId Error]', e)
      }
    }

    // Verify if dbUserId exists in SQL Server EV_User table to resolve senderName
    if (dbUserId < 10000) {
      try {
        const userCheckRes = await pool.request()
          .input('userId', sql.Int, dbUserId)
          .query(`
            SELECT FirstName, LastName FROM dbo.EV_User WHERE UserID = @userId AND IsActive = 1
          `)
        if (userCheckRes.recordset.length > 0) {
          const userRow = userCheckRes.recordset[0]
          senderName = userRow.FirstName.trim()
        }
      } catch (userErr) {
        console.error('[User name check error]', userErr)
      }
    }

    // 3. Execute Stored Procedure sp_InsertMaintenanceItemJson (Handle both issueTitle and issueDescription)
    const carStatusCode = body.carStatusCode || body.statusCode || null
    const issueTitle = body.issueDescription || body.issueTitle || null

    if (carStatusCode === 'WAITING_FOR_MAINTENANCE' || carStatusCode === 'IN_MAINTENANCE') {
      const loc = body.serviceLocationCode || body.serviceLocation
      if (!loc || !loc.trim()) {
        return NextResponse.json({ error: 'กรุณาระบุสถานที่/อู่ที่ซ่อม' }, { status: 400 })
      }
    }

    const maintenanceObj = {
      inventoryItemId,
      registerNo: registerNo,
      vinNo: vinNo,
      driverName: body.driverName || null,
      incidentDate: body.incidentDate ? new Date(body.incidentDate).toISOString() : null,
      carStatusCode: carStatusCode,
      issueTitle: issueTitle,
      problemTypeCode: body.problemType || null,
      faultPartyCode: body.faultPartyCode || body.faultParty || null,
      carCaseCode: body.carCaseCode || body.carCase || null,
      serviceLocationCode: body.serviceLocationCode || body.serviceLocation || null,
      insuranceCode: body.insuranceCode || body.insurance || null,
      followUpDetail: issueTitle,
      createUserId: dbUserId,
      claimNumber: body.claimNo || body.claimNumber || null,
      contractNo: body.contractNo || null
    }

    const insertReq = pool.request()
    insertReq.input('MaintenanceJson', sql.NVarChar, JSON.stringify(maintenanceObj))
    insertReq.output('NewMaintenanceItemID', sql.Int)

    const insertRes = await insertReq.execute('dbo.sp_InsertMaintenanceItemJson')
    const newMaintenanceId = insertRes.output.NewMaintenanceItemID

    // 0. Save Replacement Car (if requested, independent of ticket status)
    if (body.hasReplacement && body.replacementVin) {
      try {
        console.log(`[Replacement Car Assignment] New Ticket #${newMaintenanceId}: Assigning replacement car VinNo=${body.replacementVin} at Location=${body.replacementLocation}`)
        
        // 1. Insert into EV_ReplacementItem
        const insReplReq = pool.request()
        insReplReq.input('maintId', sql.Int, newMaintenanceId)
        insReplReq.input('vin', sql.VarChar, body.replacementVin)
        insReplReq.input('startDate', sql.Date, body.replacementStartDate ? body.replacementStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
        insReplReq.input('location', sql.VarChar, body.replacementLocation || null)
        insReplReq.input('userId', sql.Int, dbUserId)
        await insReplReq.query(`
          INSERT INTO dbo.EV_ReplacementItem (
            MaintenanceItemID, VinNo, ReplacementStartDate, Location, IsActive, CreateDate, CreateUserID
          )
          VALUES (
            @maintId, @vin, @startDate, @location, 1, GETDATE(), @userId
          )
        `)

        // 2. Update replacement car status to REPLACEMENT_CAR
        const updReplCarReq = pool.request()
        updReplCarReq.input('vin', sql.VarChar, body.replacementVin)
        updReplCarReq.input('userId', sql.Int, dbUserId)
        await updReplCarReq.query(`
          UPDATE dbo.EV_InventoryItem
          SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', CurrentLocation = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
          WHERE VinNo = @vin AND IsActive = 1
        `)
        // 3. Update EV_ReplacementReserved if exists
        const updResReq = pool.request()
        updResReq.input('targetVin', sql.VarChar, vinNo)
        updResReq.input('replVin', sql.VarChar, body.replacementVin)
        updResReq.input('maintId', sql.Int, newMaintenanceId)
        updResReq.input('userId', sql.Int, dbUserId)
        await updResReq.query(`
          UPDATE dbo.EV_ReplacementReserved
          SET IsActive = 0,
              ClosedByMaintenanceItemID = @maintId,
              ClosedByReplacementVinNo = @replVin,
              UpdateUserID = @userId,
              UpdateDate = GETDATE()
          WHERE TargetVinNo = @targetVin 
            AND IsActive = 1
            AND ClosedByMaintenanceItemID IS NULL
        `)
        console.log(`[Replacement Reservation Closed] For target vehicle ${vinNo} mapped to replacement ${body.replacementVin} on Ticket #${newMaintenanceId}`)
      } catch (replErr) {
        console.error('[New Ticket Replacement Assignment Error]', replErr)
      }
    }

    // ─── If new report is WAITING_FOR_MAINTENANCE or IN_MAINTENANCE, update inventory and other pending tickets ───
    if (carStatusCode === 'WAITING_FOR_MAINTENANCE' || carStatusCode === 'IN_MAINTENANCE') {
      try {

        const locCode = body.serviceLocationCode || body.serviceLocation || null
        const locName = body.serviceLocationName || 'ไม่ระบุ / นอกสถานที่'

        // 1. Get current Status, StatusType, and CurrentLocation of the vehicle
        const invReq = pool.request()
        invReq.input('invId', sql.Int, inventoryItemId)
        const invRes = await invReq.query(`
          SELECT Status, StatusType, CurrentLocation FROM dbo.EV_InventoryItem WHERE InventoryItemID = @invId
        `)

        if (invRes.recordset.length > 0) {
          const currentStatus = (invRes.recordset[0].Status || '').toUpperCase().trim()
          const currentStatusType = (invRes.recordset[0].StatusType || '').toUpperCase().trim()
          const oldLocationCode = invRes.recordset[0].CurrentLocation || null

          let newStatus: string | null = null
          let newStatusType: string | null = null

          // Mapping logic
          let forceUpdate = false
          if (currentStatus === 'MAINTENANCE') {
            // It's already in maintenance, but let's make sure the StatusType is correct if it was a replacement car
            if (currentStatusType === 'REPLACEMENT_CAR' || currentStatusType === 'REPLACEMENT_AVAILABLE' || currentStatusType === 'REPLACEMENT') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'REPLACEMENT_MAINTENANCE'
              forceUpdate = true
            }
          } else if (currentStatus === 'ON_RENT') {
            newStatus = 'MAINTENANCE'
            newStatusType = 'ON_RENT_MAINTENANCE'
          } else if (currentStatusType === 'AVAILABLE_USE') {
            newStatus = 'MAINTENANCE'
            newStatusType = 'USE_MAINTENANCE'
          } else if (currentStatus === 'REPLACEMENT' || currentStatusType === 'REPLACEMENT_CAR' || currentStatusType === 'REPLACEMENT_AVAILABLE') {
            newStatus = 'MAINTENANCE'
            newStatusType = 'REPLACEMENT_MAINTENANCE'
          } else if (currentStatus === 'AVAILABLE' || currentStatusType === 'AVAILABLE' || currentStatusType === 'AVAILABLE_NEW') {
            newStatus = 'MAINTENANCE'
            newStatusType = 'NEW_MAINTENANCE'
          }

          // 2. Update CurrentLocation and Status/StatusType in EV_InventoryItem
          const updReq = pool.request()
          updReq.input('newStatus', sql.NVarChar, newStatus || currentStatus)
          updReq.input('newStatusType', sql.NVarChar, newStatusType || currentStatusType)
          updReq.input('currentLocation', sql.NVarChar, locCode)
          updReq.input('invId', sql.Int, inventoryItemId)
          updReq.input('userId', sql.Int, dbUserId)
          await updReq.query(`
            UPDATE dbo.EV_InventoryItem
            SET Status = @newStatus, 
                StatusType = @newStatusType, 
                CurrentLocation = @currentLocation, 
                UpdateUserID = @userId, 
                UpdateDate = GETDATE()
            WHERE InventoryItemID = @invId
          `)
          console.log(`[Inventory Update from New Ticket] InventoryItemID=${inventoryItemId}: Status=${newStatus || currentStatus}, StatusType=${newStatusType || currentStatusType}, CurrentLocation=${locCode}`)

          // 3. Location log & note if location actually changed
          if (oldLocationCode !== locCode) {
            console.log(`[LOC CHANGE - New Ticket] old='${oldLocationCode}' new='${locCode}'`)

            // 3a. LocationLog
            try {
              await insertLocationLog({
                inventoryItemId: Number(inventoryItemId),
                oldLocation: oldLocationCode || null,
                newLocation: locCode || null,
                actionCode: 'QUICK_REPORT_NEW',
                refType: 'EV_MaintenanceItem',
                refId: newMaintenanceId,
                createUserId: dbUserId
              })
            } catch (logErr) {
              console.error('[LocationLog Error - New Ticket]', logErr)
            }

            // 3b. VehicleNote
            try {
              let oldName = oldLocationCode || 'ไม่ระบุ'
              let newName = locName || 'ไม่ระบุ'
              if (oldLocationCode) {
                const nameRes = await pool.request()
                  .input('code', sql.NVarChar, oldLocationCode)
                  .query(`SELECT TOP 1 StatusName FROM dbo.CM_StatusMaster WHERE StatusCode = @code AND StatusGroup = 'SERVICE_LOCATION'`)
                if (nameRes.recordset[0]?.StatusName) oldName = nameRes.recordset[0].StatusName
              }
              const noteDetail = `📍 ย้ายสถานที่: ${oldName} → ${newName} | โดย: ${senderName}`
              await pool.request()
                .input('itemId', sql.Int, Number(inventoryItemId))
                .input('note', sql.NVarChar, noteDetail)
                .input('userId', sql.Int, dbUserId)
                .query(`
                  INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive)
                  VALUES (@itemId, @note, GETDATE(), @userId, 1)
                `)
            } catch (noteErr) {
              console.error('[VehicleNote Error - New Ticket]', noteErr)
            }
          }
        }

        // 1.5. Update READY_PICKUP_MAINTENANCE tickets of this vehicle to COMPLETE
        const readyPickupReq = pool.request()
        readyPickupReq.input('invId', sql.Int, inventoryItemId)
        readyPickupReq.input('newMaintId', sql.Int, newMaintenanceId)
        const readyPickupRes = await readyPickupReq.query(`
          SELECT MaintenanceItemID 
          FROM dbo.EV_MaintenanceItem 
          WHERE InventoryItemID = @invId 
            AND MaintenanceItemID != @newMaintId
            AND CarStatusCode = 'READY_PICKUP_MAINTENANCE'
            AND IsActive = 1
        `)

        const readyTickets = readyPickupRes.recordset
        if (readyTickets.length > 0) {
          console.log(`[New Ticket] Found ${readyTickets.length} ready-to-pickup tickets to complete automatically.`)
          for (const ticket of readyTickets) {
            const tId = ticket.MaintenanceItemID

            // Update ticket status & MaintenanceFinishDate
            const updReadyReq = pool.request()
            updReadyReq.input('maintId', sql.Int, tId)
            updReadyReq.input('userId', sql.Int, dbUserId)
            await updReadyReq.query(`
              UPDATE dbo.EV_MaintenanceItem
              SET CarStatusCode = 'GARAGE_COMPLETE',
                  UpdateUserID = @userId,
                  UpdateDate = GETDATE()
              WHERE MaintenanceItemID = @maintId
            `)

            // Insert follow-up log for this ticket
            const followUpMsg = `ระบบอัพเดต : ปรับสถานะเป็นเสร็จงานซ่อม (GARAGE_COMPLETE) อัตโนมัติเนื่องจากมีใบแจ้งซ่อมใหม่ (${issueTitle || 'ไม่ระบุอาการ'})`
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

        // 2. Update OTHER pending tickets of this vehicle to WAITING_FOR_MAINTENANCE
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
          console.log(`[New Ticket] Found ${otherTickets.length} other pending tickets to update to WAITING_FOR_MAINTENANCE.`)
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
        console.error('[New Ticket Bulk Action Error]', bulkErr)
      }
    }

    // Send LINE Mention Notification if issueTitle contains @mentions
    if (issueTitle && issueTitle.trim() && newMaintenanceId) {
      sendMentionNotifications(issueTitle, Number(newMaintenanceId), senderName).catch((err) => {
        console.error('[LINE Mention Error]', err)
      })
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
