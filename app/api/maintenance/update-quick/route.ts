import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { sendMentionNotifications } from '@/lib/line'
import { insertLocationLog } from '@/lib/location-log'

export const dynamic = 'force-dynamic'

const carStatusMap: Record<string, string> = {
  'COMPLETE': 'ซ่อมเสร็จ',
  'IN_MAINTENANCE': 'รถอยู่ระหว่างซ่อม',
  'WAITING_FOR_MAINTENANCE': 'รถจอดรอซ่อม',
  'STILL_WORK': 'รถยังขับใช้งานได้อยู่',
  'READY_PICKUP_MAINTENANCE': 'รถซ่อมเสร็จ รอลูกค้ามารับ',
  'GARAGE_COMPLETE': 'เสร็จงานซ่อม'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { maintenanceId, inventoryItemId: bodyInventoryItemId, carStatusCode, followUpDetail, serviceLocationCode, serviceLocationName, startDate, finishDate, lineUserId, deletedAttachmentIds, driverName, incidentDate, issueTitle, problemTypeCode, faultPartyCode, carCaseCode, insuranceCode, claimNumber, contractNo, isLastPending, hasReplacement, replacementVin, replacementLocation, replacementStartDate, returnDate, rootCause, fixAction, currentLocation, replacementReturnDate, isRepossessed, repossessDate, repossessLocation, repossessRemark, rentItemId } = body

    if (!maintenanceId && !bodyInventoryItemId) {
      return NextResponse.json({ error: 'ไม่พบรหัสใบแจ้งซ่อม หรือรหัสครุภัณฑ์ (InventoryItemID)' }, { status: 400 })
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
    let senderName = 'ผู้ใช้ LINE'
    if (lineUserId) {
      try {
        const reg = await prisma.lineRegistration.findUnique({
          where: { lineUserId }
        })
        if (reg?.ev7UserId) {
          dbUserId = reg.ev7UserId
        } else {
          return NextResponse.json({ error: 'กรุณาทำการลงทะเบียน/ผูกบัญชีเพื่อเปิดสิทธิ์การใช้งานก่อนทำรายการ' }, { status: 400 })
        }
        if (reg?.displayName) {
          senderName = reg.displayName
        }
      } catch (prismaErr) {
        console.error('[Prisma read ev7UserId Error]', prismaErr)
      }
    }

    // Verify if dbUserId exists in SQL Server EV_User table (Only for SQL Server-registered users)
    if (dbUserId < 10000) {
      try {
        const userCheckReq = pool.request()
        userCheckReq.input('userId', sql.Int, dbUserId)
        const userCheckRes = await userCheckReq.query(`
          SELECT UserID, FirstName, LastName FROM dbo.EV_User WHERE UserID = @userId AND IsActive = 1
        `)
        if (userCheckRes.recordset.length === 0) {
          return NextResponse.json({
            error: 'บัญชีผู้ใช้งานของคุณไม่มีอยู่ในตาราง EV_User หรือถูกระงับการใช้งาน กรุณาผูกบัญชีผู้ใช้จริงก่อนทำรายการ'
          }, { status: 400 })
        }
        const userRow = userCheckRes.recordset[0]
        senderName = userRow.FirstName.trim()
      } catch (checkErr: any) {
        console.error('[User check error]', checkErr)
        return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์ผู้ใช้งาน: ' + checkErr.message }, { status: 500 })
      }
    }

    if (!maintenanceId && bodyInventoryItemId) {
      if (env.MOCK_MODE) {
        return NextResponse.json({
          success: true,
          message: 'อัปเดตสถานที่ปัจจุบันของรถยนต์สำเร็จ (จำลองสถานะ MOCK_MODE)'
        })
      }

      // 1. SELECT old location and VinNo before update
      const oldLocRes = await pool.request()
        .input('itemId', sql.Int, bodyInventoryItemId)
        .query(`SELECT CurrentLocation, VinNo FROM dbo.EV_InventoryItem WHERE InventoryItemID = @itemId`)
      const oldLocationCode = oldLocRes.recordset[0]?.CurrentLocation || null
      const vinNo = oldLocRes.recordset[0]?.VinNo || null

      if (isRepossessed) {
        // 1a. Query active rental contract details if not passed from client or to verify
        let finalRentItemId = rentItemId ? Number(rentItemId) : null
        let finalContractNo = contractNo || null
        
        if (!finalRentItemId) {
          try {
            const rentRes = await pool.request()
              .input('itemId', sql.Int, bodyInventoryItemId)
              .query(`
                SELECT TOP 1 RentItemID, ContractNo 
                FROM dbo.EV_RentItem 
                WHERE InventoryItemID = @itemId AND IsActive = 1
              `)
            if (rentRes.recordset.length > 0) {
              finalRentItemId = Number(rentRes.recordset[0].RentItemID)
              finalContractNo = rentRes.recordset[0].ContractNo
            }
          } catch (rentErr) {
            console.error('[Repossess] Error querying active contract:', rentErr)
          }
        }

        // 1b. Insert record into dbo.EV_VehicleRepossess
        const repossessReq = pool.request()
        repossessReq.input('itemId', sql.Int, bodyInventoryItemId)
        repossessReq.input('vin', sql.VarChar, vinNo)
        repossessReq.input('rentId', sql.BigInt, finalRentItemId)
        repossessReq.input('contract', sql.VarChar, finalContractNo)
        repossessReq.input('date', sql.DateTime, repossessDate)
        repossessReq.input('location', sql.NVarChar, repossessLocation)
        repossessReq.input('remark', sql.NVarChar, repossessRemark || null)
        repossessReq.input('userId', sql.Int, dbUserId)

        await repossessReq.query(`
          INSERT INTO dbo.EV_VehicleRepossess (
            InventoryItemID, VinNo, RentItemID, ContractNo, RepossessDate, RepossessLocation, Remark, IsActive, CreateDate, CreateUserID
          )
          VALUES (
            @itemId, @vin, @rentId, @contract, @date, @location, @remark, 1, GETDATE(), @userId
          )
        `)
        console.log(`[Repossess] ✅ Inserted transaction into EV_VehicleRepossess for itemId=${bodyInventoryItemId}`)

        // 1c. Insert note in dbo.EV_VehicleNote
        try {
          const thaiDateStr = new Date(repossessDate).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
          })
          const noteDetail = `📍 ยึดคืนรถยนต์ | สถานที่ยึด: ${repossessLocation} | วันที่ยึด: ${thaiDateStr} | หมายเหตุ: ${repossessRemark || '-'}`
          await pool.request()
            .input('itemId', sql.Int, Number(bodyInventoryItemId))
            .input('note', sql.NVarChar, noteDetail)
            .input('userId', sql.Int, dbUserId)
            .query(`
              INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive)
              VALUES (@itemId, @note, GETDATE(), @userId, 1)
            `)
          console.log(`[Repossess] ✅ Inserted vehicle note for itemId=${bodyInventoryItemId}`)
        } catch (noteErr) {
          console.error('[Repossess] Error inserting vehicle note:', noteErr)
        }
      }

      // 2. UPDATE CurrentLocation
      const updateLocReq = pool.request()
      updateLocReq.input('itemId', sql.Int, bodyInventoryItemId)
      updateLocReq.input('locCode', sql.NVarChar, serviceLocationCode || '')
      updateLocReq.input('userId', sql.Int, dbUserId)

      await updateLocReq.query(`
        UPDATE dbo.EV_InventoryItem
        SET CurrentLocation = @locCode,
            UpdateDate = GETDATE(),
            UpdateUserID = @userId
        WHERE InventoryItemID = @itemId
      `)

      // 3. INSERT logs (only if location actually changed)
      if (oldLocationCode !== (serviceLocationCode || '')) {
        console.log(`[LOC CHANGE] Direct update: old='${oldLocationCode}' new='${serviceLocationCode}' itemId=${bodyInventoryItemId}`)

        let oldName = oldLocationCode || 'ไม่ระบุ'
        let newName = serviceLocationName || serviceLocationCode || 'ไม่ระบุ'
        try {
          if (oldLocationCode) {
            const nameRes = await pool.request()
              .input('code', sql.NVarChar, oldLocationCode)
              .query(`SELECT TOP 1 StatusName FROM dbo.CM_StatusMaster WHERE StatusCode = @code AND StatusGroup = 'SERVICE_LOCATION'`)
            if (nameRes.recordset[0]?.StatusName) oldName = nameRes.recordset[0].StatusName
          }
        } catch (e) { /* ignore name lookup error */ }

        // 3a. LocationLog — independent try-catch
        try {
          await insertLocationLog({
            inventoryItemId: Number(bodyInventoryItemId),
            oldLocation: oldLocationCode || null,
            newLocation: serviceLocationCode || null,
            actionCode: isRepossessed ? 'QUICK_REPORT_REPOSS_LOC' : 'QUICK_REPORT_LOC',
            createUserId: dbUserId
          })
        } catch (logErr) {
          console.error('[LocationLog Error - direct]', logErr)
        }

        // 3b. VehicleNote — independent try-catch (only if NOT repossessed to avoid double notes)
        if (!isRepossessed) {
          try {
            const noteDetail = `📍 ย้ายสถานที่: ${oldName} → ${newName} | โดย: ${senderName}`
            await pool.request()
              .input('itemId', sql.Int, Number(bodyInventoryItemId))
              .input('note', sql.NVarChar, noteDetail)
              .input('userId', sql.Int, dbUserId)
              .query(`
                INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive)
                VALUES (@itemId, @note, GETDATE(), @userId, 1)
              `)
            console.log(`[VehicleNote] ✅ Inserted note for itemId=${bodyInventoryItemId}`)
          } catch (noteErr) {
            console.error('[VehicleNote Error - direct]', noteErr)
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: isRepossessed ? 'บันทึกรายการยึดรถและอัปเดตสถานที่จอดเรียบร้อยแล้ว' : 'อัปเดตสถานที่ปัจจุบันของรถยนต์เรียบร้อยแล้ว'
      })
    }

    // Resolve CarStatusCode
    let resolvedCarStatusCode = carStatusCode
    let inventoryItemId: number | null = null
    let vehicleStatusType: string | null = null
    let oldCarStatusCode: string | null = null
    let oldLocCode: string | null = null
    let vinNo: string | null = null

    try {
      const vehicleInfoReq = pool.request()
      vehicleInfoReq.input('maintId', sql.Int, maintenanceId)
      const vehicleInfoRes = await vehicleInfoReq.query(`
        SELECT m.InventoryItemID, m.CarStatusCode, i.StatusType, i.CurrentLocation, i.VinNo
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.MaintenanceItemID = @maintId
      `)

      if (vehicleInfoRes.recordset.length > 0) {
        inventoryItemId = Number(vehicleInfoRes.recordset[0].InventoryItemID)
        vehicleStatusType = vehicleInfoRes.recordset[0].StatusType
        oldCarStatusCode = vehicleInfoRes.recordset[0].CarStatusCode
        oldLocCode = vehicleInfoRes.recordset[0].CurrentLocation
        vinNo = vehicleInfoRes.recordset[0].VinNo
        console.log(`[Location Debug] inventoryItemId=${inventoryItemId}, oldLocCode='${oldLocCode}', serviceLocationCode='${serviceLocationCode}'`)

        // If carStatusCode is not provided in body, default to the existing one from database
        if (carStatusCode === undefined) {
          resolvedCarStatusCode = vehicleInfoRes.recordset[0].CarStatusCode
        }
      }
    } catch (infoErr) {
      console.error('[Get Vehicle Info Error]', infoErr)
    }

    if (resolvedCarStatusCode === 'COMPLETE') {
      if (vehicleStatusType === 'ON_RENT_MAINTENANCE' && !returnDate) {
        resolvedCarStatusCode = 'READY_PICKUP_MAINTENANCE'
      }
    }

    if (carStatusCode !== undefined && (resolvedCarStatusCode === 'WAITING_FOR_MAINTENANCE' || resolvedCarStatusCode === 'IN_MAINTENANCE')) {
      if (!serviceLocationCode || !serviceLocationCode.trim()) {
        return NextResponse.json({ error: 'กรุณาระบุสถานที่/อู่ที่ซ่อม' }, { status: 400 })
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
      carStatusCode: resolvedCarStatusCode || null,
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
      contractNo: contractNo || null,
    }

    await pool.request()
      .input('UpdateJson', sql.NVarChar, JSON.stringify(updateObj))
      .execute('dbo.sp_UpdateMaintenanceItemJson')

    // ─── Ensure Correct User ID is logged on both MaintenanceItem and Follow-up Log ───
    try {
      // 1. Update main ticket record update user log
      const userFixReq = pool.request()
      userFixReq.input('maintId', sql.Int, maintenanceId)
      userFixReq.input('userId', sql.Int, dbUserId)
      await userFixReq.query(`
        UPDATE dbo.EV_MaintenanceItem
        SET UpdateUserID = @userId, UpdateDate = GETDATE()
        WHERE MaintenanceItemID = @maintId
      `)

      // 2. If followUpDetail was provided, fix the newly created follow-up log's creator user ID
      if (followUpDetail && followUpDetail.trim()) {
        const followUpFixReq = pool.request()
        followUpFixReq.input('maintId', sql.Int, maintenanceId)
        followUpFixReq.input('userId', sql.Int, dbUserId)
        await followUpFixReq.query(`
          UPDATE dbo.EV_MaintenanceFollowUp
          SET CreateUserID = @userId, UpdateUserID = @userId
          WHERE MaintenanceFollowUpID = (
            SELECT TOP 1 f.MaintenanceFollowUpID 
            FROM dbo.EV_MaintenanceFollowUp f
            WHERE f.MaintenanceItemID = @maintId AND f.IsActive = 1
            ORDER BY f.CreateDate DESC, f.MaintenanceFollowUpID DESC
          )
        `)
        console.log(`[Follow-up User Fix] MaintenanceItemID=${maintenanceId}: set creator user ID to ${dbUserId}`)
      }
    } catch (fixErr) {
      console.error('[Post-Update Tasks Error]', fixErr)
    }

    // ─── Update Replacement Car Assignment (only if explicitly provided in body) ───
    if (hasReplacement !== undefined && maintenanceId) {
      try {
        const existReplReq = pool.request()
        existReplReq.input('maintId', sql.Int, maintenanceId)
        const existReplRes = await existReplReq.query(`
          SELECT VinNo, ReplacementItemID FROM dbo.EV_ReplacementItem WHERE MaintenanceItemID = @maintId AND IsActive = 1
        `)

        const hasExistRepl = existReplRes.recordset.length > 0
        const existVin = hasExistRepl ? existReplRes.recordset[0].VinNo : null

        if (hasReplacement && replacementVin) {
          if (hasExistRepl) {
            if (existVin !== replacementVin) {
              // 1. Revert old replacement car to REPLACEMENT_AVAILABLE
              const revOldReq = pool.request()
              revOldReq.input('oldVin', sql.VarChar, existVin)
              revOldReq.input('userId', sql.Int, dbUserId)
              await revOldReq.query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_AVAILABLE', UpdateDate = GETDATE(), UpdateUserID = @userId
                WHERE VinNo = @oldVin AND IsActive = 1
              `)

              // 2. Update existing EV_ReplacementItem record
              const updReplRecReq = pool.request()
              updReplRecReq.input('maintId', sql.Int, maintenanceId)
              updReplRecReq.input('vin', sql.VarChar, replacementVin)
              updReplRecReq.input('startDate', sql.Date, replacementStartDate ? new Date(replacementStartDate) : new Date())
              updReplRecReq.input('location', sql.VarChar, replacementLocation || null)
              updReplRecReq.input('userId', sql.Int, dbUserId)
              await updReplRecReq.query(`
                UPDATE dbo.EV_ReplacementItem
                SET VinNo = @vin, ReplacementStartDate = @startDate, Location = @location, UpdateUserID = @userId, UpdateDate = GETDATE()
                WHERE MaintenanceItemID = @maintId AND IsActive = 1
              `)

              // 3. Set new replacement car to REPLACEMENT_CAR
              const updNewCarReq = pool.request()
              updNewCarReq.input('newVin', sql.NVarChar, replacementVin)
              updNewCarReq.input('userId', sql.Int, dbUserId)
              const updNewCarRes = await updNewCarReq.query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', CurrentLocation = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
                WHERE VinNo = @newVin AND IsActive = 1
              `)
              console.log(`[Replacement Update] Ticket #${maintenanceId}: Changed replacement car from ${existVin} to ${replacementVin}, rowsAffected=${updNewCarRes.rowsAffected?.[0] ?? 0}`)
              // Verify status update
              if ((updNewCarRes.rowsAffected?.[0] ?? 0) === 0) {
                console.warn(`[Replacement Car Status WARNING] UPDATE affected 0 rows for VinNo=${replacementVin} in update-quick (change car). Retrying with RTRIM...`)
                await pool.request()
                  .input('newVin', sql.NVarChar, replacementVin.trim())
                  .input('userId', sql.Int, dbUserId)
                  .query(`
                    UPDATE dbo.EV_InventoryItem
                    SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', CurrentLocation = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
                    WHERE RTRIM(LTRIM(VinNo)) = @newVin AND IsActive = 1
                  `)
              }
            } else {
              // Same car, just update Location and StartDate if changed
              const updReplRecReq = pool.request()
              updReplRecReq.input('maintId', sql.Int, maintenanceId)
              updReplRecReq.input('startDate', sql.Date, replacementStartDate ? replacementStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
              updReplRecReq.input('location', sql.VarChar, replacementLocation || null)
              updReplRecReq.input('userId', sql.Int, dbUserId)
              await updReplRecReq.query(`
                UPDATE dbo.EV_ReplacementItem
                SET ReplacementStartDate = @startDate, Location = @location, UpdateUserID = @userId, UpdateDate = GETDATE()
                WHERE MaintenanceItemID = @maintId AND IsActive = 1
              `)

              // Self-heal: if replacement car is still REPLACEMENT_AVAILABLE, fix it to REPLACEMENT_CAR
              // (skip if it's in maintenance or other states)
              try {
                const chkReq = pool.request()
                chkReq.input('vin', sql.NVarChar, replacementVin)
                const chkRes = await chkReq.query(`
                  SELECT StatusType FROM dbo.EV_InventoryItem WHERE VinNo = @vin AND IsActive = 1
                `)
                if (chkRes.recordset.length > 0 && chkRes.recordset[0].StatusType === 'REPLACEMENT_AVAILABLE') {
                  await pool.request()
                    .input('vin', sql.NVarChar, replacementVin)
                    .input('userId', sql.Int, dbUserId)
                    .query(`
                      UPDATE dbo.EV_InventoryItem
                      SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', CurrentLocation = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
                      WHERE VinNo = @vin AND IsActive = 1
                    `)
                  console.log(`[Replacement Self-Heal] VinNo=${replacementVin}: Fixed REPLACEMENT_AVAILABLE → REPLACEMENT_CAR`)
                }
              } catch (healErr) {
                console.error('[Replacement Self-Heal Error]', healErr)
              }
            }
          } else {
            // No existing replacement record, create one!
            const insReplReq = pool.request()
            insReplReq.input('maintId', sql.Int, maintenanceId)
            insReplReq.input('vin', sql.VarChar, replacementVin)
            insReplReq.input('startDate', sql.Date, replacementStartDate ? replacementStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
            insReplReq.input('location', sql.VarChar, replacementLocation || null)
            insReplReq.input('userId', sql.Int, dbUserId)
            await insReplReq.query(`
              INSERT INTO dbo.EV_ReplacementItem (
                MaintenanceItemID, VinNo, ReplacementStartDate, Location, IsActive, CreateDate, CreateUserID
              )
              VALUES (
                @maintId, @vin, @startDate, @location, 1, GETDATE(), @userId
              )
            `)

            // Update new replacement car status to REPLACEMENT_CAR
            const updNewCarReq = pool.request()
            updNewCarReq.input('newVin', sql.NVarChar, replacementVin)
            updNewCarReq.input('userId', sql.Int, dbUserId)
            const updNewCarRes = await updNewCarReq.query(`
              UPDATE dbo.EV_InventoryItem
              SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', CurrentLocation = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
              WHERE VinNo = @newVin AND IsActive = 1
            `)
            console.log(`[Replacement Update] Ticket #${maintenanceId}: Assigned new replacement car ${replacementVin}, rowsAffected=${updNewCarRes.rowsAffected?.[0] ?? 0}`)
            // Verify status update
            if ((updNewCarRes.rowsAffected?.[0] ?? 0) === 0) {
              console.warn(`[Replacement Car Status WARNING] UPDATE affected 0 rows for VinNo=${replacementVin} in update-quick (new assign). Retrying with RTRIM...`)
              await pool.request()
                .input('newVin', sql.NVarChar, replacementVin.trim())
                .input('userId', sql.Int, dbUserId)
                .query(`
                  UPDATE dbo.EV_InventoryItem
                  SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', CurrentLocation = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
                  WHERE RTRIM(LTRIM(VinNo)) = @newVin AND IsActive = 1
                `)
            }
          }

          // Close reservation in EV_ReplacementReserved if exists
          if (replacementVin && vinNo) {
            const updResReq = pool.request()
            updResReq.input('targetVin', sql.VarChar, vinNo)
            updResReq.input('replVin', sql.VarChar, replacementVin)
            updResReq.input('maintId', sql.Int, maintenanceId)
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
            console.log(`[Replacement Reservation Closed - Update] Target vehicle ${vinNo} mapped to replacement ${replacementVin} on Ticket #${maintenanceId}`)
          }
        } else {
          // Unchecked or hasReplacement is false/null, deactivate any existing replacement
          if (hasExistRepl) {
            // 1. Revert old replacement car to REPLACEMENT_AVAILABLE
            const revOldReq = pool.request()
            revOldReq.input('oldVin', sql.VarChar, existVin)
            revOldReq.input('userId', sql.Int, dbUserId)
            await revOldReq.query(`
              UPDATE dbo.EV_InventoryItem
              SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_AVAILABLE', UpdateDate = GETDATE(), UpdateUserID = @userId
              WHERE VinNo = @oldVin AND IsActive = 1
            `)

            // 2. Soft-delete EV_ReplacementItem record
            const delReplReq = pool.request()
            delReplReq.input('maintId', sql.Int, maintenanceId)
            delReplReq.input('userId', sql.Int, dbUserId)
            await delReplReq.query(`
              UPDATE dbo.EV_ReplacementItem
              SET IsActive = 0, ReplacementReturnDate = GETDATE(), UpdateUserID = @userId, UpdateDate = GETDATE()
              WHERE MaintenanceItemID = @maintId AND IsActive = 1
            `)
            console.log(`[Replacement Update] Ticket #${maintenanceId}: Removed replacement car ${existVin}`)
          }
        }
      } catch (replErr) {
        console.error('[Replacement update error in update-quick]', replErr)
      }
    }

    // ─── Update EV_InventoryItem Status when entering maintenance (เข้าซ่อม / เริ่มซ่อม) ───
    if (resolvedCarStatusCode === 'WAITING_FOR_MAINTENANCE' || resolvedCarStatusCode === 'IN_MAINTENANCE') {
      try {
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
            const currentStatus = (invRes.recordset[0].Status || '').toUpperCase().trim()
            const currentStatusType = (invRes.recordset[0].StatusType || '').toUpperCase().trim()
            console.log(`[Inventory Check] InventoryItemID=${inventoryItemId}, Status='${currentStatus}', StatusType='${currentStatusType}'`)

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

            // 3. Update if mapping matched
            if (forceUpdate || (newStatus && newStatusType)) {
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
        startReq.input('userId', sql.Int, dbUserId)
        await startReq.query(`
          UPDATE dbo.EV_MaintenanceItem
          SET CarStatusCode = @statusCode,
              MaintenanceStartDate = @startDate,
              ServiceLocationCode = @locCode,
              UpdateUserID = @userId,
              UpdateDate = GETDATE()
          WHERE MaintenanceItemID = @maintId
        `)
        console.log(`[Start Maintenance] MaintenanceItemID=${maintenanceId}: set IN_MAINTENANCE, StartDate=${startDate}, Location=${serviceLocationCode}`)
      } catch (startErr) {
        console.error('[Start Maintenance Update Error]', startErr)
      }
    }

    // ─── Direct update EV_MaintenanceItem for ซ่อมเสร็จ (COMPLETE / READY_PICKUP_MAINTENANCE) ───
    if (carStatusCode === 'COMPLETE') {
      try {
        const finishReq = pool.request()
        finishReq.input('maintId', sql.Int, maintenanceId)
        finishReq.input('statusCode', sql.NVarChar, resolvedCarStatusCode)
        finishReq.input('userId', sql.Int, dbUserId)

        let updateFields = [
          'CarStatusCode = @statusCode',
          'UpdateUserID = @userId',
          'UpdateDate = GETDATE()'
        ]

        if (finishDate) {
          finishReq.input('finishDate', sql.NVarChar, toMssqlDate(finishDate))
          updateFields.push('MaintenanceFinishDate = @finishDate')
        }

        if (returnDate !== undefined) {
          finishReq.input('returnDate', sql.NVarChar, toMssqlDate(returnDate))
          updateFields.push('MaintenanceReturnDate = @returnDate')
          // Close case: stamp CompleteDate when returnDate is provided (ปิดเคส)
          updateFields.push('CompleteDate = GETDATE()')
        }
        if (rootCause !== undefined) {
          finishReq.input('rootCause', sql.NVarChar, rootCause || null)
          updateFields.push('RootCauseFound = @rootCause')
        }
        if (fixAction !== undefined) {
          finishReq.input('fixAction', sql.NVarChar, fixAction || null)
          updateFields.push('FixAction = @fixAction')
        }

        const query = `
          UPDATE dbo.EV_MaintenanceItem
          SET ${updateFields.join(', ')}
          WHERE MaintenanceItemID = @maintId
        `
        await finishReq.query(query)
        console.log(`[Finish Maintenance] MaintenanceItemID=${maintenanceId}: set ${resolvedCarStatusCode}, FinishDate=${finishDate}`)
      } catch (finishErr) {
        console.error('[Finish Maintenance Update Error]', finishErr)
      }
    }

    // ─── Update EV_InventoryItem CurrentLocation ───
    const locationToUpdate = currentLocation || serviceLocationCode
    if (locationToUpdate && inventoryItemId) {
      try {
        // 1. SELECT old location before update
        const oldLocRes = await pool.request()
          .input('invId', sql.Int, inventoryItemId)
          .query(`SELECT CurrentLocation FROM dbo.EV_InventoryItem WHERE InventoryItemID = @invId`)
        const oldLocationCode = oldLocRes.recordset[0]?.CurrentLocation || null

        // 2. UPDATE CurrentLocation
        const locReq = pool.request()
        locReq.input('currentLocation', sql.NVarChar, locationToUpdate)
        locReq.input('invId', sql.Int, inventoryItemId)
        await locReq.query(`
          UPDATE dbo.EV_InventoryItem
          SET CurrentLocation = @currentLocation
          WHERE InventoryItemID = @invId
        `)
        console.log(`[Inventory CurrentLocation Update] InventoryItemID=${inventoryItemId}: set CurrentLocation=${locationToUpdate}`)

        // 3. INSERT movement log into EV_VehicleNote (only if location actually changed)
        if (oldLocationCode !== locationToUpdate) {
          try {
            // Resolve old location name
            let oldName = oldLocationCode || 'ไม่ระบุ'
            if (oldLocationCode) {
              const oldNameRes = await pool.request()
                .input('code', sql.NVarChar, oldLocationCode)
                .query(`SELECT TOP 1 StatusName FROM dbo.EV_MsSubStatus WHERE StatusCode = @code AND Type = 'LOCATION'`)
              oldName = oldNameRes.recordset[0]?.StatusName || oldLocationCode
            }
            // Resolve new location name
            let newName = locationToUpdate
            const newNameRes = await pool.request()
              .input('code', sql.NVarChar, locationToUpdate)
              .query(`SELECT TOP 1 StatusName FROM dbo.EV_MsSubStatus WHERE StatusCode = @code AND Type = 'LOCATION'`)
            newName = newNameRes.recordset[0]?.StatusName || locationToUpdate

            const noteDetail = `📍 ย้ายสถานที่: ${oldName} → ${newName} | โดย: ${senderName}`
            await pool.request()
              .input('itemId', sql.Int, inventoryItemId)
              .input('note', sql.NVarChar, noteDetail)
              .input('userId', sql.Int, dbUserId)
              .query(`
                INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive)
                VALUES (@itemId, @note, GETDATE(), @userId, 1)
              `)
            console.log(`[Maintenance Location Log] InventoryItemID=${inventoryItemId}: ${noteDetail}`)

            // Also insert location log
            try {
              await insertLocationLog({
                inventoryItemId: Number(inventoryItemId),
                oldLocation: oldLocationCode || null,
                newLocation: locationToUpdate || null,
                actionCode: 'QUICK_REPORT_LOC_UPDATE',
                refType: 'EV_MaintenanceItem',
                refId: maintenanceId || null,
                createUserId: dbUserId
              })
            } catch (lLogErr) {
              console.error('[LocationLog Error - update-quick]', lLogErr)
            }
          } catch (logErr) {
            console.error('[Maintenance Location Log Error]', logErr)
          }
        }
      } catch (locErr) {
        console.error('[Inventory CurrentLocation Update Error]', locErr)
      }
    }

    // ─── Update EV_ReplacementItem Return Details & Revert Replacement Car Status ───
    if ((replacementReturnDate || replacementLocation) && maintenanceId) {
      try {
        const repCheckReq = pool.request()
        repCheckReq.input('maintId', sql.Int, maintenanceId)
        const repCheckRes = await repCheckReq.query(`
          SELECT ReplacementItemID, VinNo 
          FROM dbo.EV_ReplacementItem 
          WHERE MaintenanceItemID = @maintId 
            AND IsActive = 1 
            AND ReplacementReturnDate IS NULL
        `)
        if (repCheckRes.recordset.length > 0) {
          const repId = repCheckRes.recordset[0].ReplacementItemID
          const repVinNo = repCheckRes.recordset[0].VinNo
          const repUpdReq = pool.request()
          repUpdReq.input('repId', sql.BigInt, repId)
          repUpdReq.input('retDate', sql.Date, replacementReturnDate ? toMssqlDate(replacementReturnDate) : null)
          repUpdReq.input('loc', sql.NVarChar, replacementLocation || null)
          repUpdReq.input('userId', sql.Int, dbUserId)
          await repUpdReq.query(`
            IF COL_LENGTH('dbo.EV_ReplacementItem', 'ReturnReason') IS NOT NULL
            BEGIN
              EXEC sp_executesql 
                N'UPDATE dbo.EV_ReplacementItem
                  SET ReplacementReturnDate = COALESCE(@retDate, ReplacementReturnDate),
                      Location = COALESCE(@loc, Location),
                      ReturnReason = COALESCE(ReturnReason, ''RETURN_REPLACEMENT_GET_MAIN''),
                      IsActive = CASE WHEN @retDate IS NOT NULL THEN 0 ELSE IsActive END,
                      UpdateUserID = @userId,
                      UpdateDate = GETDATE()
                  WHERE ReplacementItemID = @repId;',
                N'@retDate DATE, @loc NVARCHAR(250), @userId INT, @repId BIGINT',
                @retDate, @loc, @userId, @repId;
            END
            ELSE
            BEGIN
              UPDATE dbo.EV_ReplacementItem
              SET ReplacementReturnDate = COALESCE(@retDate, ReplacementReturnDate),
                  Location = COALESCE(@loc, Location),
                  IsActive = CASE WHEN @retDate IS NOT NULL THEN 0 ELSE IsActive END,
                  UpdateUserID = @userId,
                  UpdateDate = GETDATE()
              WHERE ReplacementItemID = @repId;
            END
          `)
          console.log(`[Replacement Return Update] ReplacementItemID=${repId}: ReturnDate=${replacementReturnDate}, Location=${replacementLocation}`)

          // Revert replacement car InventoryItem status to REPLACEMENT_AVAILABLE
          if (repVinNo && replacementReturnDate) {
            try {
              const revertRepCarReq = pool.request()
              revertRepCarReq.input('repVin', sql.VarChar, repVinNo)
              revertRepCarReq.input('loc', sql.NVarChar, replacementLocation || null)
              revertRepCarReq.input('userId', sql.Int, dbUserId)
              await revertRepCarReq.query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = 'REPLACEMENT', 
                    StatusType = 'REPLACEMENT_AVAILABLE', 
                    CurrentLocation = COALESCE(@loc, CurrentLocation),
                    UpdateUserID = @userId, 
                    UpdateDate = GETDATE()
                WHERE VinNo = @repVin AND IsActive = 1
              `)
              console.log(`[Replacement Car Status Revert] VinNo=${repVinNo}: set Status=REPLACEMENT, StatusType=REPLACEMENT_AVAILABLE`)
            } catch (revertErr) {
              console.error('[Replacement Car Status Revert Error]', revertErr)
            }
          }
        }
      } catch (repErr) {
        console.error('[Replacement Return Update Error]', repErr)
      }
    }

    // ─── Update EV_InventoryItem Status & StatusType if no pending tickets remain OR all are STILL_WORK ───
    if ((carStatusCode === 'COMPLETE' || carStatusCode === 'STILL_WORK' || resolvedCarStatusCode === 'COMPLETE' || resolvedCarStatusCode === 'STILL_WORK') && inventoryItemId) {
      try {
        // Query remaining active tickets for this vehicle
        const countReq = pool.request()
        countReq.input('invId', sql.Int, inventoryItemId)
        const countRes = await countReq.query(`
          SELECT CarStatusCode 
          FROM dbo.EV_MaintenanceItem 
          WHERE InventoryItemID = @invId 
            AND IsActive = 1
        `)
        const activeTickets = countRes.recordset
        const openTickets = activeTickets.filter(item => !['COMPLETE', 'GARAGE_COMPLETE'].includes(item.CarStatusCode))
        const hasReadyPickup = openTickets.some(item => item.CarStatusCode === 'READY_PICKUP_MAINTENANCE')
        const hasInRepair = openTickets.some(item => ['IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE'].includes(item.CarStatusCode))
        const allStillWork = openTickets.length > 0 && openTickets.every(item => item.CarStatusCode === 'STILL_WORK')
        const allClosed = openTickets.length === 0

        // รถจะกลับไป ON_RENT หรือ AVAILABLE ได้ ก็ต่อเมื่อ:
        // 1. ไม่มีใบงาน READY_PICKUP_MAINTENANCE ค้างอยู่เด็ดขาด (เพราะรถยังต้องอยู่ที่อู่ รอลูกค้ามารับ/รอปิดเคส)
        // 2. ไม่มีใบงานติดซ่อม (IN_MAINTENANCE / WAITING_FOR_MAINTENANCE)
        // 3. ปิดเคสครบทั้งหมด (allClosed) หรือ "ทุกใบงานที่ยังค้างอยู่" เป็น STILL_WORK ทั้งหมด (allStillWork)
        const shouldRevertToAvailable = !hasReadyPickup && !hasInRepair && (allClosed || allStillWork)
        console.log(`[Pending Check] InventoryItemID=${inventoryItemId}, Total Tickets=${activeTickets.length}, Open Tickets=${openTickets.length}, hasReadyPickup=${hasReadyPickup}, hasInRepair=${hasInRepair}, allStillWork=${allStillWork}, allClosed=${allClosed}, shouldRevert=${shouldRevertToAvailable}`)

        if (shouldRevertToAvailable) {
          let newStatus: string | null = null
          let newStatusType: string | null = null
          let shouldUpdate = false

          if (vehicleStatusType === 'ON_RENT_MAINTENANCE') {
            if (allClosed || allStillWork) {
              newStatus = 'ON_RENT'
              newStatusType = null
              shouldUpdate = true
            }
          } else if ((allClosed || allStillWork) && vehicleStatusType === 'USE_MAINTENANCE') {
            newStatus = 'AVAILABLE'
            newStatusType = 'AVAILABLE_USE'
            shouldUpdate = true
          } else if ((allClosed || allStillWork) && vehicleStatusType === 'NEW_MAINTENANCE') {
            newStatus = 'AVAILABLE'
            newStatusType = 'AVAILABLE'
            shouldUpdate = true
          } else if ((allClosed || allStillWork) && vehicleStatusType === 'REPLACEMENT_MAINTENANCE') {
            newStatus = 'REPLACEMENT'
            newStatusType = 'REPLACEMENT_AVAILABLE'
            shouldUpdate = true
          }

          if (shouldUpdate && newStatus) {
            const updReq = pool.request()
            updReq.input('newStatus', sql.NVarChar, newStatus)
            updReq.input('invId', sql.Int, inventoryItemId)
            updReq.input('userId', sql.Int, dbUserId)
            
            let setStatusType = "StatusType = NULL"
            if (newStatusType !== null) {
              updReq.input('newStatusType', sql.NVarChar, newStatusType)
              setStatusType = "StatusType = @newStatusType"
            }

            let extraUpdate = ''
            if (newStatus === 'ON_RENT' && newStatusType === null) {
              extraUpdate = `, CurrentLocation = 'ON_RENT'`
            }
            
            await updReq.query(`
              UPDATE dbo.EV_InventoryItem
              SET Status = @newStatus, ${setStatusType}${extraUpdate}, UpdateUserID = @userId, UpdateDate = GETDATE()
              WHERE InventoryItemID = @invId
            `)
            console.log(`[Inventory Status Update Success] InventoryItemID=${inventoryItemId} set Status=${newStatus}, StatusType=${newStatusType}`)

            // ─── INSERT LOGS ───
            try {
              // 1. Vehicle Note
              let vehicleNoteDetail = ''
              if (newStatus === 'ON_RENT' && newStatusType === null) {
                vehicleNoteDetail = allStillWork
                  ? `📍 ระบบปรับสถานะเป็นรถเช่าอัตโนมัติ (ON_RENT) เนื่องจากใบแจ้งซ่อมที่ค้างอยู่สามารถใช้งานได้ทั้งหมด`
                  : `📍 ระบบปรับสถานะเป็นรถเช่าอัตโนมัติ (ON_RENT) เนื่องจากปิดเคสงานซ่อมบำรุงครบถ้วนแล้ว`
              } else if (newStatus === 'REPLACEMENT' && newStatusType === 'REPLACEMENT_AVAILABLE') {
                vehicleNoteDetail = allStillWork
                  ? `📍 ระบบปรับสถานะเป็นรถทดแทนพร้อมใช้ (REPLACEMENT_AVAILABLE) เนื่องจากใบแจ้งซ่อมที่ค้างอยู่สามารถใช้งานได้ทั้งหมด`
                  : `📍 ระบบปรับสถานะเป็นรถทดแทนพร้อมใช้ (REPLACEMENT_AVAILABLE) เนื่องจากปิดเคสงานซ่อมบำรุงครบถ้วนแล้ว`
              } else if (newStatus === 'AVAILABLE') {
                vehicleNoteDetail = allStillWork
                  ? `📍 ระบบปรับสถานะเป็นรถพร้อมใช้งาน (${newStatusType || 'AVAILABLE'}) เนื่องจากใบแจ้งซ่อมที่ค้างอยู่สามารถใช้งานได้ทั้งหมด`
                  : `📍 ระบบปรับสถานะเป็นรถพร้อมใช้งาน (${newStatusType || 'AVAILABLE'}) เนื่องจากปิดเคสงานซ่อมบำรุงครบถ้วนแล้ว`
              }

              if (vehicleNoteDetail) {
                await pool.request()
                  .input('itemId', sql.Int, inventoryItemId)
                  .input('note', sql.NVarChar, vehicleNoteDetail)
                  .input('userId', sql.Int, dbUserId)
                  .query(`
                    INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive)
                    VALUES (@itemId, @note, GETDATE(), @userId, 1)
                  `)
              }

              // 2. Maintenance Follow Up
              if (maintenanceId) {
                const oldStatusName = oldCarStatusCode ? (carStatusMap[oldCarStatusCode] || oldCarStatusCode) : 'ไม่ระบุ';
                const newStatusName = resolvedCarStatusCode ? (carStatusMap[resolvedCarStatusCode] || resolvedCarStatusCode) : 'ไม่ระบุ';
                const followUpMsg = `ระบบอัปเดต : เปลี่ยนสถานะจาก ${oldStatusName} เป็น ${newStatusName}`;
                await pool.request()
                  .input('maintId', sql.Int, maintenanceId)
                  .input('detail', sql.NVarChar, followUpMsg)
                  .input('userId', sql.Int, dbUserId)
                  .query(`
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
            } catch (logErr) {
              console.error('[Auto Revert Log Error]', logErr)
            }
          }
        } else {
          console.log(`[Inventory Update Skipped] Vehicle still has active maintenance tickets (${activeTickets.length} active).`)
        }
      } catch (invErr) {
        console.error('[Inventory Status Update Error]', invErr)
      }
    }

    // Send LINE Mention Notification if followUpDetail contains @mentions
    if (followUpDetail && followUpDetail.trim() && maintenanceId) {
      sendMentionNotifications(followUpDetail, Number(maintenanceId), senderName).catch((err) => {
        console.error('[LINE Mention Error]', err)
      })
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
