import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool, sql } from '@/lib/mssql'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { maintenanceId, inventoryItemId: bodyInventoryItemId, carStatusCode, followUpDetail, serviceLocationCode, serviceLocationName, startDate, finishDate, lineUserId, deletedAttachmentIds, driverName, incidentDate, issueTitle, problemTypeCode, faultPartyCode, carCaseCode, insuranceCode, claimNumber, isLastPending, hasReplacement, replacementVin, replacementLocation, replacementStartDate, returnDate, rootCause, fixAction, currentLocation, replacementReturnDate } = body

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
          SELECT UserID FROM dbo.EV_User WHERE UserID = @userId AND IsActive = 1
        `)
        if (userCheckRes.recordset.length === 0) {
          return NextResponse.json({
            error: 'บัญชีผู้ใช้งานของคุณไม่มีอยู่ในตาราง EV_User หรือถูกระงับการใช้งาน กรุณาผูกบัญชีผู้ใช้จริงก่อนทำรายการ'
          }, { status: 400 })
        }
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

      return NextResponse.json({
        success: true,
        message: 'อัปเดตสถานที่ปัจจุบันของรถยนต์เรียบร้อยแล้ว'
      })
    }

    // Resolve CarStatusCode
    let resolvedCarStatusCode = carStatusCode
    let inventoryItemId: number | null = null
    let vehicleStatusType: string | null = null

    try {
      const vehicleInfoReq = pool.request()
      vehicleInfoReq.input('maintId', sql.Int, maintenanceId)
      const vehicleInfoRes = await vehicleInfoReq.query(`
        SELECT m.InventoryItemID, m.CarStatusCode, i.StatusType 
        FROM dbo.EV_MaintenanceItem m
        JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
        WHERE m.MaintenanceItemID = @maintId
      `)

      if (vehicleInfoRes.recordset.length > 0) {
        inventoryItemId = vehicleInfoRes.recordset[0].InventoryItemID
        vehicleStatusType = vehicleInfoRes.recordset[0].StatusType

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
      console.error('[User Log Fix Error]', fixErr)
    }

    // ─── Update EV_InventoryItem Status and Replacement Car when entering maintenance (เข้าซ่อม / เริ่มซ่อม) ───
    if (resolvedCarStatusCode === 'WAITING_FOR_MAINTENANCE' || resolvedCarStatusCode === 'IN_MAINTENANCE') {
      try {
        // 0. Update Replacement Car Assignment (only if explicitly provided in body)
        if (hasReplacement !== undefined) {
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
                updNewCarReq.input('newVin', sql.VarChar, replacementVin)
                updNewCarReq.input('userId', sql.Int, dbUserId)
                await updNewCarReq.query(`
                  UPDATE dbo.EV_InventoryItem
                  SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
                  WHERE VinNo = @newVin AND IsActive = 1
                `)
                console.log(`[Replacement Update] Ticket #${maintenanceId}: Changed replacement car from ${existVin} to ${replacementVin}`)
              } else {
                // Same car, just update Location and StartDate if changed
                const updReplRecReq = pool.request()
                updReplRecReq.input('maintId', sql.Int, maintenanceId)
                updReplRecReq.input('startDate', sql.Date, replacementStartDate ? new Date(replacementStartDate) : new Date())
                updReplRecReq.input('location', sql.VarChar, replacementLocation || null)
                updReplRecReq.input('userId', sql.Int, dbUserId)
                await updReplRecReq.query(`
                  UPDATE dbo.EV_ReplacementItem
                  SET ReplacementStartDate = @startDate, Location = @location, UpdateUserID = @userId, UpdateDate = GETDATE()
                  WHERE MaintenanceItemID = @maintId AND IsActive = 1
                `)
              }
            } else {
              // No existing replacement record, create one!
              const insReplReq = pool.request()
              insReplReq.input('maintId', sql.Int, maintenanceId)
              insReplReq.input('vin', sql.VarChar, replacementVin)
              insReplReq.input('startDate', sql.Date, replacementStartDate ? new Date(replacementStartDate) : new Date())
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
              updNewCarReq.input('newVin', sql.VarChar, replacementVin)
              updNewCarReq.input('userId', sql.Int, dbUserId)
              await updNewCarReq.query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = 'REPLACEMENT', StatusType = 'REPLACEMENT_CAR', UpdateDate = GETDATE(), UpdateUserID = @userId
                WHERE VinNo = @newVin AND IsActive = 1
              `)
              console.log(`[Replacement Update] Ticket #${maintenanceId}: Assigned new replacement car ${replacementVin}`)
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
            const currentStatus = (invRes.recordset[0].Status || '').toUpperCase().trim()
            const currentStatusType = (invRes.recordset[0].StatusType || '').toUpperCase().trim()
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
            } else if (currentStatus === 'AVAILABLE' || currentStatusType === 'AVAILABLE' || currentStatusType === 'AVAILABLE_NEW') {
              newStatus = 'MAINTENANCE'
              newStatusType = 'NEW_MAINTENANCE'
            } else if (currentStatus === 'REPLACEMENT' || currentStatusType === 'REPLACEMENT_CAR' || currentStatusType === 'REPLACEMENT_AVAILABLE') {
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
        const locReq = pool.request()
        locReq.input('currentLocation', sql.NVarChar, locationToUpdate)
        locReq.input('invId', sql.Int, inventoryItemId)
        await locReq.query(`
          UPDATE dbo.EV_InventoryItem
          SET CurrentLocation = @currentLocation
          WHERE InventoryItemID = @invId
        `)
        console.log(`[Inventory CurrentLocation Update] InventoryItemID=${inventoryItemId}: set CurrentLocation=${locationToUpdate}`)
      } catch (locErr) {
        console.error('[Inventory CurrentLocation Update Error]', locErr)
      }
    }

    // ─── Update EV_ReplacementItem Return Details ───
    if ((replacementReturnDate || replacementLocation) && maintenanceId) {
      try {
        const repCheckReq = pool.request()
        repCheckReq.input('maintId', sql.Int, maintenanceId)
        const repCheckRes = await repCheckReq.query(`
          SELECT ReplacementItemID 
          FROM dbo.EV_ReplacementItem 
          WHERE MaintenanceItemID = @maintId 
            AND IsActive = 1 
            AND ReplacementReturnDate IS NULL
        `)
        if (repCheckRes.recordset.length > 0) {
          const repId = repCheckRes.recordset[0].ReplacementItemID
          const repUpdReq = pool.request()
          repUpdReq.input('repId', sql.BigInt, repId)
          repUpdReq.input('retDate', sql.Date, replacementReturnDate ? toMssqlDate(replacementReturnDate) : null)
          repUpdReq.input('loc', sql.NVarChar, replacementLocation || null)
          repUpdReq.input('userId', sql.Int, dbUserId)
          await repUpdReq.query(`
            UPDATE dbo.EV_ReplacementItem
            SET ReplacementReturnDate = COALESCE(@retDate, ReplacementReturnDate),
                Location = COALESCE(@loc, Location),
                UpdateUserID = @userId,
                UpdateDate = GETDATE()
            WHERE ReplacementItemID = @repId
          `)
          console.log(`[Replacement Return Update] ReplacementItemID=${repId}: ReturnDate=${replacementReturnDate}, Location=${replacementLocation}`)
        }
      } catch (repErr) {
        console.error('[Replacement Return Update Error]', repErr)
      }
    }

    // ─── Update EV_InventoryItem Status & StatusType if no pending tickets remain ───
    if (carStatusCode === 'COMPLETE' && inventoryItemId) {
      try {
        // Query remaining pending count
        const countReq = pool.request()
        countReq.input('invId', sql.Int, inventoryItemId)
        const countRes = await countReq.query(`
          SELECT COUNT(*) AS PendingCount 
          FROM dbo.EV_MaintenanceItem 
          WHERE InventoryItemID = @invId 
            AND CarStatusCode NOT IN ('COMPLETE', 'READY_PICKUP_MAINTENANCE', 'GARAGE_COMPLETE')
            AND IsActive = 1
        `)
        const pendingCount = countRes.recordset[0]?.PendingCount || 0
        console.log(`[Pending Check] InventoryItemID=${inventoryItemId}, Remaining Pending Count=${pendingCount}, isLastPending=${isLastPending}`)

        if (isLastPending || pendingCount === 0) {
          let newStatus: string | null = null
          let newStatusType: string | null = null
          let shouldUpdate = false

          if (vehicleStatusType === 'ON_RENT_MAINTENANCE') {
            if (resolvedCarStatusCode === 'COMPLETE') {
              newStatus = 'ON_RENT'
              newStatusType = null
              shouldUpdate = true
            } else {
              shouldUpdate = false
            }
          } else if (vehicleStatusType === 'USE_MAINTENANCE') {
            newStatus = 'AVAILABLE'
            newStatusType = 'AVAILABLE_USE'
            shouldUpdate = true
          } else if (vehicleStatusType === 'NEW_MAINTENANCE') {
            newStatus = 'AVAILABLE'
            newStatusType = 'AVAILABLE'
            shouldUpdate = true
          } else if (vehicleStatusType === 'REPLACEMENT_MAINTENANCE') {
            newStatus = 'REPLACEMENT'
            newStatusType = 'REPLACEMENT_AVAILABLE'
            shouldUpdate = true
          }

          if (shouldUpdate && newStatus) {
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
            console.log(`[Inventory Status Update Success] InventoryItemID=${inventoryItemId} set Status=${newStatus}, StatusType=${newStatusType}`)
          }
        } else {
          console.log(`[Inventory Update Skipped] There are still ${pendingCount} pending tickets.`)
        }
      } catch (invErr) {
        console.error('[Inventory Status Update Error]', invErr)
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
