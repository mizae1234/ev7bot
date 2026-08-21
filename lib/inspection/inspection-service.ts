// =====================================================
// Vehicle Inspection — Database Service Layer
// =====================================================
// Business logic + SQL queries แยกจาก route handlers
// =====================================================

import { getMSSQLPool, getMSSQLWritePool, sql } from '@/lib/mssql'
import { prisma } from '@/lib/prisma'
import type {
  InspectionData,
  InspectionListItem,
  InspectionItemData,
  AuditSessionData,
  InspectionStatus,
} from './types'
import { parseDamagedItems } from './checklist-config'

// =====================================================
// User Resolution: LINE userId → EV_User
// =====================================================

/** Resolve LINE userId to EV_User.UserID + FirstName */
export async function resolveEv7User(lineUserId: string | undefined): Promise<{ userId: number; name: string }> {
  const fallback = { userId: 1, name: 'System' }
  if (!lineUserId) return fallback

  try {
    const reg = await prisma.lineRegistration.findUnique({
      where: { lineUserId },
    })
    if (!reg?.ev7UserId) return fallback

    const pool = await getMSSQLPool()
    if (!pool) return { userId: reg.ev7UserId, name: 'Unknown' }

    const result = await pool.request()
      .input('userId', sql.Int, reg.ev7UserId)
      .query(`
        SELECT ISNULL(NULLIF(FirstName + ' ' + ISNULL(LastName, ''), ''), UserName) AS FullName
        FROM dbo.EV_User
        WHERE UserID = @userId
      `)

    return {
      userId: reg.ev7UserId,
      name: result.recordset[0]?.FullName || 'Unknown',
    }
  } catch {
    return fallback
  }
}

// =====================================================
// Inspection CRUD
// =====================================================

export async function createInspection(params: {
  vinNo: string
  registerNo?: string
  inspectionType: string
  returnItemId?: number
  inspectionSessionId?: number
  mileage?: number
  inspectionDate: string
  remark?: string
  items: InspectionItemData[]
  ev7UserId: number
  ev7UserName: string
  returnDate?: string
  location?: string
  inspectorName?: string
  inspectorUserId?: number
  returnReason?: string
  carStatus?: string
  carStatusType?: string
  assessmentResult?: string | null
  customerName?: string | null
  customerContact?: string | null
  contractCancellationDate?: string | null
  isPendingChecklist?: boolean | null
}): Promise<number> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  // Begin transaction for atomicity
  const transaction = pool.transaction()
  await transaction.begin()

  try {
    // Query active or latest contract for the VinNo to populate RentItemID, ContractNo, and default customer name
    const rentResult = await transaction.request()
      .input('vinNo', sql.VarChar, params.vinNo)
      .query(`
        SELECT TOP 1 RentItemID, ContractNo, FirstName, LastName
        FROM dbo.EV_RentItem
        WHERE VinNo = @vinNo AND IsActive = 1
        ORDER BY ReleaseDate DESC, RentItemID DESC
      `)
    const activeRent = rentResult.recordset[0]
    const resolvedRentItemId = activeRent?.RentItemID || null
    const resolvedContractNo = activeRent?.ContractNo || null

    let resolvedCustomerName = params.customerName
    if (!resolvedCustomerName && activeRent) {
      resolvedCustomerName = (activeRent.FirstName + (activeRent.LastName ? ' ' + activeRent.LastName : '')).trim() || null
    }
    const resolvedCustomerContact = params.customerContact || null

    const mileageFromItems = params.items?.find(it => it.category === 'MILEAGE' && it.itemCode === 'VALUE')?.numericValue
    const resolvedMileage = params.mileage ?? (mileageFromItems != null ? Math.round(Number(mileageFromItems)) : null)

    // 1. Insert header
    const headerResult = await transaction.request()
      .input('vinNo', sql.NVarChar, params.vinNo)
      .input('registerNo', sql.NVarChar, params.registerNo || null)
      .input('inspectionType', sql.VarChar, params.inspectionType)
      .input('returnItemId', sql.Int, params.returnItemId || null)
      .input('inspectionSessionId', sql.Int, params.inspectionSessionId || null)
      .input('mileage', sql.Int, resolvedMileage)
      .input('inspectionDate', sql.Date, params.inspectionDate)
      .input('inspectorUserID', sql.Int, params.inspectorUserId || params.ev7UserId)
      .input('inspectorName', sql.NVarChar, params.inspectorName || params.ev7UserName)
      .input('remark', sql.NVarChar, params.remark || null)
      .input('createUserID', sql.Int, params.ev7UserId)
      .input('returnDate', sql.Date, params.returnDate || null)
      .input('location', sql.VarChar, params.location || null)
      .input('rentItemId', sql.BigInt, resolvedRentItemId)
      .input('contractNo', sql.VarChar, resolvedContractNo)
      .input('returnReason', sql.VarChar, params.returnReason || null)
      .input('carStatus', sql.VarChar, params.carStatus || null)
      .input('carStatusType', sql.VarChar, params.carStatusType || null)
      .input('assessmentResult', sql.VarChar, params.assessmentResult || null)
      .input('customerName', sql.NVarChar, resolvedCustomerName)
      .input('customerContact', sql.VarChar, resolvedCustomerContact)
      .input('contractCancellationDate', sql.Date, params.contractCancellationDate || null)
      .input('isPendingChecklist', sql.Bit, params.isPendingChecklist ? 1 : 0)
      .query(`
        INSERT INTO dbo.EV_Inspection (
          VinNo, RegisterNo, InspectionType, ReturnItemID, InspectionSessionID,
          Mileage, InspectionDate, InspectorUserID, InspectorName,
          Status, Remark, IsActive, CreateDate, CreateUserID,
          ReturnDate, Location, RentItemID, ContractNo, ReturnReason,
          CarStatus, CarStatusType, AssessmentResult, CustomerName, CustomerContact,
          ContractCancellationDate, IsPendingChecklist
        )
        VALUES (
          @vinNo, @registerNo, @inspectionType, @returnItemId, @inspectionSessionId,
          @mileage, @inspectionDate, @inspectorUserID, @inspectorName,
          'DRAFT', @remark, 1, GETDATE(), @createUserID,
          @returnDate, @location, @rentItemId, @contractNo, @returnReason,
          @carStatus, @carStatusType, @assessmentResult, @customerName, @customerContact,
          @contractCancellationDate, @isPendingChecklist
        );
        SELECT SCOPE_IDENTITY() AS InspectionID;
      `)

    const inspectionId = headerResult.recordset[0]?.InspectionID
    if (!inspectionId) throw new Error('Failed to create inspection header')

    // 2. Insert items (batch)
    await insertItems(transaction, inspectionId, params.items)

    await transaction.commit()
    return inspectionId
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

/** อัปเดต Inspection (items จะ delete แล้ว insert ใหม่ทั้งหมด) */
export async function updateInspection(params: {
  inspectionId: number
  mileage?: number
  remark?: string
  status?: InspectionStatus
  items: InspectionItemData[]
  ev7UserId: number
  returnDate?: string
  location?: string
  inspectorName?: string
  inspectorUserId?: number
  returnReason?: string
  carStatus?: string
  carStatusType?: string
  assessmentResult?: string | null
  customerName?: string | null
  customerContact?: string | null
  contractCancellationDate?: string | null
  isPendingChecklist?: boolean
}): Promise<void> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  const transaction = pool.transaction()
  await transaction.begin()

  try {
    // Resolve RentItemID & ContractNo if they are null in the database
    const inspectResult = await transaction.request()
      .input('inspectionId', sql.BigInt, params.inspectionId)
      .query(`
        SELECT VinNo, RentItemID, ContractNo 
        FROM dbo.EV_Inspection 
        WHERE InspectionID = @inspectionId
      `)
    const currentInspect = inspectResult.recordset[0]
    let resolvedRentItemId = currentInspect?.RentItemID
    let resolvedContractNo = currentInspect?.ContractNo

    if (currentInspect && (!resolvedRentItemId || !resolvedContractNo)) {
      let rentFallbackResult = await transaction.request()
        .input('vinNo', sql.VarChar, currentInspect.VinNo)
        .query(`
          SELECT TOP 1 RentItemID, ContractNo
          FROM dbo.EV_RentItem
          WHERE VinNo = @vinNo AND IsActive = 1
          ORDER BY ReleaseDate DESC, RentItemID DESC
        `)
      let rent = rentFallbackResult.recordset[0]
      if (!rent) {
        rentFallbackResult = await transaction.request()
          .input('vinNo', sql.VarChar, currentInspect.VinNo)
          .query(`
            SELECT TOP 1 RentItemID, ContractNo
            FROM dbo.EV_RentItem
            WHERE VinNo = @vinNo
            ORDER BY ReleaseDate DESC, RentItemID DESC
          `)
        rent = rentFallbackResult.recordset[0]
      }
      if (rent) {
        resolvedRentItemId = resolvedRentItemId || rent.RentItemID
        resolvedContractNo = resolvedContractNo || rent.ContractNo
      }
    }

    const mileageFromItems = params.items?.find(it => it.category === 'MILEAGE' && it.itemCode === 'VALUE')?.numericValue
    const resolvedMileage = params.mileage ?? (mileageFromItems != null ? Math.round(Number(mileageFromItems)) : null)

    // 1. Update header
    await transaction.request()
      .input('inspectionId', sql.BigInt, params.inspectionId)
      .input('mileage', sql.Int, resolvedMileage)
      .input('remark', sql.NVarChar, params.remark ?? null)
      .input('status', sql.VarChar, params.status || null)
      .input('updateUserID', sql.Int, params.ev7UserId)
      .input('returnDate', sql.Date, params.returnDate || null)
      .input('location', sql.VarChar, params.location || null)
      .input('rentItemId', sql.BigInt, resolvedRentItemId || null)
      .input('contractNo', sql.VarChar, resolvedContractNo || null)
      .input('inspectorName', sql.NVarChar, params.inspectorName || null)
      .input('inspectorUserId', sql.Int, params.inspectorUserId || null)
      .input('returnReason', sql.VarChar, params.returnReason || null)
      .input('carStatus', sql.VarChar, params.carStatus || null)
      .input('carStatusType', sql.VarChar, params.carStatusType || null)
      .input('assessmentResult', sql.VarChar, params.assessmentResult || null)
      .input('customerName', sql.NVarChar, params.customerName ?? null)
      .input('customerContact', sql.VarChar, params.customerContact ?? null)
      .input('contractCancellationDate', sql.Date, params.contractCancellationDate || null)
      .input('isPendingChecklist', sql.Bit, params.isPendingChecklist !== undefined ? (params.isPendingChecklist ? 1 : 0) : null)
      .query(`
        UPDATE dbo.EV_Inspection
        SET Mileage = COALESCE(@mileage, Mileage),
            Remark = COALESCE(@remark, Remark),
            Status = COALESCE(@status, Status),
            ReturnDate = COALESCE(@returnDate, ReturnDate),
            Location = COALESCE(@location, Location),
            RentItemID = COALESCE(RentItemID, @rentItemId),
            ContractNo = COALESCE(ContractNo, @contractNo),
            InspectorName = COALESCE(@inspectorName, InspectorName),
            InspectorUserID = COALESCE(@inspectorUserId, InspectorUserID),
            ReturnReason = COALESCE(@returnReason, ReturnReason),
            CarStatus = COALESCE(@carStatus, CarStatus),
            CarStatusType = COALESCE(@carStatusType, CarStatusType),
            AssessmentResult = COALESCE(@assessmentResult, AssessmentResult),
            CustomerName = COALESCE(@customerName, CustomerName),
            CustomerContact = COALESCE(@customerContact, CustomerContact),
            ContractCancellationDate = COALESCE(@contractCancellationDate, ContractCancellationDate),
            IsPendingChecklist = COALESCE(@isPendingChecklist, IsPendingChecklist),
            UpdateDate = GETDATE(),
            UpdateUserID = @updateUserID
        WHERE InspectionID = @inspectionId
      `)

    // 2. Replace items: delete old + insert new
    if (params.items.length > 0) {
      await transaction.request()
        .input('inspectionId', sql.BigInt, params.inspectionId)
        .query(`DELETE FROM dbo.EV_InspectionItem WHERE InspectionID = @inspectionId`)

      await insertItems(transaction, params.inspectionId, params.items)
    }

    // 3. Sync to EV_ReturnItem and EV_RentItem when COMPLETED
    if (params.status === 'COMPLETED') {
      const inspectResult = await transaction.request()
        .input('inspectionId', sql.BigInt, params.inspectionId)
        .query(`
          SELECT i.VinNo, i.RegisterNo, i.ReturnItemID, i.Mileage, i.ReturnDate, i.Location,
                 v.Model, i.RentItemID, i.ContractNo, i.InspectionType, i.CarStatus, i.CarStatusType,
                 i.ContractCancellationDate, i.ReturnReason
          FROM dbo.EV_Inspection i
          LEFT JOIN dbo.EV_InventoryItem v ON i.VinNo = v.VinNo
          WHERE i.InspectionID = @inspectionId
        `)
      const inspect = inspectResult.recordset[0]

      if (inspect && inspect.InspectionType === 'RETURN') {
        const activeCarStatus = params.carStatus || inspect.CarStatus
        const activeCarStatusType = params.carStatusType || inspect.CarStatusType
        const activeVinNo = inspect.VinNo

        const normalizedStatus = activeCarStatus?.toUpperCase()
        const normalizedStatusType = activeCarStatusType?.toUpperCase()

        // Case A: ON_RENT / ON_RENT_MAINTENANCE
        if (
          normalizedStatus === 'ON_RENT' || 
          (normalizedStatus === 'MAINTENANCE' && normalizedStatusType === 'ON_RENT_MAINTENANCE')
        ) {
          let returnItemId = inspect.ReturnItemID

          // If we don't have ReturnItemID, look for a pending one
          if (!returnItemId) {
            const pendingReturn = await transaction.request()
              .input('vinNo', sql.VarChar, inspect.VinNo)
              .query(`
                SELECT TOP 1 ReturnItemID 
                FROM dbo.EV_ReturnItem 
                WHERE VinNo = @vinNo AND IsActive = 1 AND (Status = 'DRAFT' OR Status IS NULL)
                ORDER BY ReturnItemID DESC
              `)
            returnItemId = pendingReturn.recordset[0]?.ReturnItemID
          }

          const finalReturnDate = params.returnDate || inspect.ReturnDate
          const finalLocation = params.location || inspect.Location
          const finalMileage = resolvedMileage || params.mileage || inspect.Mileage
          const finalRentItemId = inspect.RentItemID
          const finalReturnReason = params.returnReason || inspect.ReturnReason || null

          let targetRentItemId = finalRentItemId
          if (!targetRentItemId && returnItemId) {
            const returnItemData = await transaction.request()
              .input('returnItemId', sql.BigInt, returnItemId)
              .query(`SELECT RentItemID FROM dbo.EV_ReturnItem WHERE ReturnItemID = @returnItemId`)
            targetRentItemId = returnItemData.recordset[0]?.RentItemID || null
          }

          if (!returnItemId) {
            // Find latest rent item / active contract for the VinNo
            const rentResult = await transaction.request()
              .input('rentItemId', sql.BigInt, targetRentItemId)
              .query(`
                SELECT r.RentItemID, 
                       ISNULL(NULLIF(LTRIM(RTRIM(r.FirstName + ' ' + ISNULL(r.LastName, ''))), ''), 'ลูกค้าทั่วไป') AS CustomerName,
                       i.Model, i.RegisterNo, r.PhoneNo
                FROM dbo.EV_RentItem r
                LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
                WHERE r.RentItemID = @rentItemId
              `)
            let rent = rentResult.recordset[0]

            if (!rent) {
              const rentFallbackResult = await transaction.request()
                .input('vinNo', sql.VarChar, inspect.VinNo)
                .query(`
                  SELECT TOP 1 r.RentItemID, 
                         ISNULL(NULLIF(LTRIM(RTRIM(r.FirstName + ' ' + ISNULL(r.LastName, ''))), ''), 'ลูกค้าทั่วไป') AS CustomerName,
                         i.Model, i.RegisterNo, r.PhoneNo
                  FROM dbo.EV_RentItem r
                  LEFT JOIN dbo.EV_InventoryItem i ON r.InventoryItemID = i.InventoryItemID
                  WHERE r.VinNo = @vinNo AND r.IsActive = 1
                  ORDER BY r.RentItemID DESC
                `)
              rent = rentFallbackResult.recordset[0]
            }

            // Insert new EV_ReturnItem
            const insertReturnResult = await transaction.request()
              .input('rentItemId', sql.BigInt, rent?.RentItemID || targetRentItemId || null)
              .input('vinNo', sql.VarChar, inspect.VinNo)
              .input('model', sql.NVarChar, rent?.Model || inspect.Model || null)
              .input('registerNo', sql.NVarChar, rent?.RegisterNo || inspect.RegisterNo || null)
              .input('customerName', sql.NVarChar, params.customerName || rent?.CustomerName || inspect.CustomerName || 'ลูกค้าทั่วไป')
              .input('phoneNo', sql.VarChar, params.customerContact || rent?.PhoneNo || inspect.CustomerContact || null)
              .input('mileage', sql.Int, finalMileage || null)
              .input('parkLocation', sql.NVarChar, finalLocation || null)
              .input('returnDate', sql.Date, finalReturnDate || null)
              .input('returnReason', sql.NVarChar, finalReturnReason)
              .input('createUserID', sql.Int, params.ev7UserId)
              .query(`
                INSERT INTO dbo.EV_ReturnItem (
                  RentItemID, VinNo, Model, RegisterNo, CustomerName, PhoneNo,
                  Mileage, ParkLocation, ReturnDate, [Group], Status, IsActive, CreateDate, CreateUserID, IsSentToK2
                )
                VALUES (
                  @rentItemId, @vinNo, @model, @registerNo, @customerName, @phoneNo,
                  @mileage, @parkLocation, @returnDate, @returnReason, 'SUBMIT', 1, GETDATE(), @createUserID, 0
                );
                SELECT SCOPE_IDENTITY() AS ReturnItemID;
              `)
            returnItemId = insertReturnResult.recordset[0]?.ReturnItemID

            // Link newly created ReturnItemID back to EV_Inspection
            if (returnItemId) {
              await transaction.request()
                .input('inspectionId', sql.BigInt, params.inspectionId)
                .input('returnItemId', sql.BigInt, returnItemId)
                .query(`UPDATE dbo.EV_Inspection SET ReturnItemID = @returnItemId WHERE InspectionID = @inspectionId`)
            }
          } else {
            // Update existing EV_ReturnItem
            await transaction.request()
              .input('returnItemId', sql.BigInt, returnItemId)
              .input('mileage', sql.Int, finalMileage || null)
              .input('parkLocation', sql.NVarChar, finalLocation || null)
              .input('returnDate', sql.Date, finalReturnDate || null)
              .input('returnReason', sql.NVarChar, finalReturnReason)
              .input('updateUserID', sql.Int, params.ev7UserId)
              .query(`
                UPDATE dbo.EV_ReturnItem
                SET Mileage = COALESCE(@mileage, Mileage),
                    ParkLocation = COALESCE(@parkLocation, ParkLocation),
                    ReturnDate = COALESCE(@returnDate, ReturnDate),
                    [Group] = COALESCE(@returnReason, [Group]),
                    Status = 'SUBMIT',
                    UpdateDate = GETDATE(),
                    UpdateUserID = @updateUserID
                WHERE ReturnItemID = @returnItemId
              `)

            await transaction.request()
              .input('inspectionId', sql.BigInt, params.inspectionId)
              .input('returnItemId', sql.BigInt, returnItemId)
              .query(`
                UPDATE dbo.EV_Inspection
                SET ReturnItemID = @returnItemId
                WHERE InspectionID = @inspectionId AND (ReturnItemID IS NULL OR ReturnItemID != @returnItemId)
              `)
          }

          // Update EV_RentItem (set IsActive = 0, ContractCancellationDate, UpdateUserID, UpdateDate)
          if (targetRentItemId) {
            const finalCancellationDate = params.contractCancellationDate || inspect.ContractCancellationDate || finalReturnDate || new Date().toISOString().slice(0, 10)
            await transaction.request()
              .input('rentItemId', sql.BigInt, targetRentItemId)
              .input('cancellationDate', sql.Date, finalCancellationDate)
              .input('updateUserID', sql.Int, params.ev7UserId)
              .query(`
                UPDATE dbo.EV_RentItem
                SET IsActive = 0,
                    ContractCancellationDate = @cancellationDate,
                    UpdateDate = GETDATE(),
                    UpdateUserID = @updateUserID
                WHERE RentItemID = @rentItemId
              `)
          }

          // Update EV_InventoryItem (Status = AVAILABLE, StatusType = AVAILABLE_USE)
          if (activeVinNo) {
            const vehicleResult = await transaction.request()
              .input('vinNo', sql.VarChar, activeVinNo)
              .query(`
                SELECT InventoryItemID, Status, StatusType, CurrentLocation
                FROM dbo.EV_InventoryItem
                WHERE VinNo = @vinNo
              `)
            const vehicle = vehicleResult.recordset[0]

            await transaction.request()
              .input('vinNo', sql.VarChar, activeVinNo)
              .input('location', sql.VarChar, finalLocation || null)
              .input('updateUserID', sql.Int, params.ev7UserId)
              .query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = 'AVAILABLE',
                    StatusType = 'AVAILABLE_USE',
                    CurrentLocation = COALESCE(@location, CurrentLocation),
                    UpdateDate = GETDATE(),
                    UpdateUserID = @updateUserID
                WHERE VinNo = @vinNo;
              `)

            if (vehicle) {
              // Record location change log if location is updated
              if (finalLocation && finalLocation !== vehicle.CurrentLocation) {
                try {
                  await transaction.request()
                    .input('itemId', sql.Int, vehicle.InventoryItemID)
                    .input('vin', sql.VarChar, activeVinNo)
                    .input('oldLoc', sql.NVarChar, vehicle.CurrentLocation || null)
                    .input('newLoc', sql.NVarChar, finalLocation)
                    .input('action', sql.VarChar, 'INSPECTION_RETURN')
                    .input('refType', sql.VarChar, 'INSPECTION')
                    .input('refId', sql.Int, Number(params.inspectionId))
                    .input('userId', sql.Int, params.ev7UserId || 1)
                    .query(`
                      INSERT INTO dbo.EV_VehicleLocationLog (
                        InventoryItemID, VinNo, OldLocation, NewLocation, ActionCode, RefType, RefID, CreateDate, CreateUserID
                      )
                      VALUES (
                        @itemId, @vin, @oldLoc, @newLoc, @action, @refType, @refId, GETDATE(), @userId
                      )
                    `)
                } catch (locLogErr) {
                  console.error('[LocationLog Error in Inspection Case A]', locLogErr)
                }
              }

              const oldStatusStr = `${vehicle.Status || 'NULL'}${vehicle.StatusType ? ` (${vehicle.StatusType})` : ''}`
              const noteDetail = `ระบบตรวจคืนรถ: เปลี่ยนสถานะรถจาก ${oldStatusStr} เป็น AVAILABLE (AVAILABLE_USE) (บันทึกอัตโนมัติจากการทำใบตรวจคืนรถ Inspection ID: ${params.inspectionId})`
              await transaction.request()
                .input('itemId', sql.Int, vehicle.InventoryItemID)
                .input('noteDetail', sql.NVarChar, noteDetail)
                .input('userId', sql.Int, params.ev7UserId || null)
                .input('inspectionId', sql.VarChar, String(params.inspectionId))
                .query(`
                  INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive, SourceProcess, RefDocNo)
                  VALUES (@itemId, @noteDetail, GETDATE(), @userId, 1, 'INSPECTION', @inspectionId)
                `)
            }
          }
        }

        // Case B: REPLACEMENT_CAR
        if (normalizedStatusType === 'REPLACEMENT_CAR') {
          if (activeVinNo) {
            const finalReturnDate = params.returnDate || inspect.ReturnDate
            const finalLocation = params.location || inspect.Location
            const finalReturnReason = params.returnReason || inspect.ReturnReason || null
            // 1. Update EV_ReplacementItem (Set return date, ReturnReason, IsActive = 0, audit fields)
            await transaction.request()
              .input('vinNo', sql.VarChar, activeVinNo)
              .input('returnDate', sql.Date, finalReturnDate || null)
              .input('returnReason', sql.NVarChar, finalReturnReason)
              .input('updateUserID', sql.Int, params.ev7UserId)
              .query(`
                IF COL_LENGTH('dbo.EV_ReplacementItem', 'ReturnReason') IS NOT NULL
                BEGIN
                  EXEC sp_executesql 
                    N'UPDATE dbo.EV_ReplacementItem 
                      SET ReplacementReturnDate = @returnDate,
                          ReturnReason = @returnReason,
                          IsActive = 0,
                          UpdateDate = GETDATE(),
                          UpdateUserID = @updateUserID
                      WHERE VinNo = @vinNo AND IsActive = 1 AND ReplacementReturnDate IS NULL;',
                    N'@returnDate DATE, @returnReason NVARCHAR(50), @updateUserID INT, @vinNo VARCHAR(50)',
                    @returnDate, @returnReason, @updateUserID, @vinNo;
                END
                ELSE
                BEGIN
                  UPDATE dbo.EV_ReplacementItem
                  SET ReplacementReturnDate = @returnDate,
                      IsActive = 0,
                      UpdateDate = GETDATE(),
                      UpdateUserID = @updateUserID
                  WHERE VinNo = @vinNo AND IsActive = 1 AND ReplacementReturnDate IS NULL;
                END
              `)

            // Get original vehicle status before update
            const vehicleResult = await transaction.request()
              .input('vinNo', sql.VarChar, activeVinNo)
              .query(`
                SELECT InventoryItemID, Status, StatusType, CurrentLocation
                FROM dbo.EV_InventoryItem
                WHERE VinNo = @vinNo
              `)
            const vehicle = vehicleResult.recordset[0]

            // 2. Update EV_InventoryItem (Status = REPLACEMENT, StatusType = REPLACEMENT_AVAILABLE)
            await transaction.request()
              .input('vinNo', sql.VarChar, activeVinNo)
              .input('location', sql.VarChar, finalLocation || null)
              .input('updateUserID', sql.Int, params.ev7UserId)
              .query(`
                UPDATE dbo.EV_InventoryItem
                SET Status = 'REPLACEMENT',
                    StatusType = 'REPLACEMENT_AVAILABLE',
                    CurrentLocation = COALESCE(@location, CurrentLocation),
                    UpdateDate = GETDATE(),
                    UpdateUserID = @updateUserID
                WHERE VinNo = @vinNo;
              `)

            if (vehicle) {
              // Record location change log if location is updated
              if (finalLocation && finalLocation !== vehicle.CurrentLocation) {
                try {
                  await transaction.request()
                    .input('itemId', sql.Int, vehicle.InventoryItemID)
                    .input('vin', sql.VarChar, activeVinNo)
                    .input('oldLoc', sql.NVarChar, vehicle.CurrentLocation || null)
                    .input('newLoc', sql.NVarChar, finalLocation)
                    .input('action', sql.VarChar, 'INSPECTION_RETURN')
                    .input('refType', sql.VarChar, 'INSPECTION')
                    .input('refId', sql.Int, Number(params.inspectionId))
                    .input('userId', sql.Int, params.ev7UserId || 1)
                    .query(`
                      INSERT INTO dbo.EV_VehicleLocationLog (
                        InventoryItemID, VinNo, OldLocation, NewLocation, ActionCode, RefType, RefID, CreateDate, CreateUserID
                      )
                      VALUES (
                        @itemId, @vin, @oldLoc, @newLoc, @action, @refType, @refId, GETDATE(), @userId
                      )
                    `)
                } catch (locLogErr) {
                  console.error('[LocationLog Error in Inspection Case B]', locLogErr)
                }
              }

              const oldStatusStr = `${vehicle.Status || 'NULL'}${vehicle.StatusType ? ` (${vehicle.StatusType})` : ''}`
              const noteDetail = `ระบบตรวจคืนรถ: เปลี่ยนสถานะรถจาก ${oldStatusStr} เป็น REPLACEMENT (REPLACEMENT_AVAILABLE) (บันทึกอัตโนมัติจากการทำใบตรวจคืนรถ Inspection ID: ${params.inspectionId})`
              await transaction.request()
                .input('itemId', sql.Int, vehicle.InventoryItemID)
                .input('noteDetail', sql.NVarChar, noteDetail)
                .input('userId', sql.Int, params.ev7UserId || null)
                .input('inspectionId', sql.VarChar, String(params.inspectionId))
                .query(`
                  INSERT INTO dbo.EV_VehicleNote (InventoryItemID, NoteDetail, CreateDate, CreateUserID, IsActive, SourceProcess, RefDocNo)
                  VALUES (@itemId, @noteDetail, GETDATE(), @userId, 1, 'INSPECTION', @inspectionId)
                `)
            }
          }
        }
      }
    }

    await transaction.commit()
  } catch (err) {
    await transaction.rollback()
    throw err
  }
}

/** Insert items ใน transaction */
async function insertItems(
  transaction: import('mssql').Transaction,
  inspectionId: number,
  items: InspectionItemData[]
): Promise<void> {
  for (const item of items) {
    // Skip items with no value at all
    if (!item.value && item.numericValue == null && !item.detail && !item.expiryDate) continue

    await transaction.request()
      .input('inspectionId', sql.BigInt, inspectionId)
      .input('category', sql.VarChar, item.category)
      .input('itemCode', sql.VarChar, item.itemCode)
      .input('value', sql.NVarChar, item.value || null)
      .input('detail', sql.NVarChar, item.detail || null)
      .input('numericValue', sql.Decimal(10, 2), item.numericValue ?? null)
      .input('expiryDate', sql.Date, item.expiryDate || null)
      .query(`
        INSERT INTO dbo.EV_InspectionItem (InspectionID, Category, ItemCode, Value, Detail, NumericValue, ExpiryDate)
        VALUES (@inspectionId, @category, @itemCode, @value, @detail, @numericValue, @expiryDate)
      `)
  }
}

// =====================================================
// Inspection Read Queries
// =====================================================

let hasResolveColumnsCache: boolean | null = null
let lastResolveColCheck = 0

export async function checkResolveColumnsExist(pool: any): Promise<boolean> {
  const now = Date.now()
  if (hasResolveColumnsCache !== null && now - lastResolveColCheck < 30000) {
    return hasResolveColumnsCache
  }
  try {
    const res = await pool.request().query(`
      SELECT COUNT(*) AS cnt
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'EV_InspectionItem' AND COLUMN_NAME = 'ResolveStatus'
    `)
    hasResolveColumnsCache = (res.recordset?.[0]?.cnt || 0) > 0
    lastResolveColCheck = now
    return hasResolveColumnsCache
  } catch {
    return false
  }
}

/** ดึงรายการ Inspections */
export async function listInspections(filters: {
  vinNo?: string
  inspectionType?: string
  inspectionSessionId?: number
  status?: string
  limit?: number
  location?: string
  startDate?: string
  endDate?: string
}): Promise<InspectionListItem[]> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const req = pool.request()
  const conditions = ['i.IsActive = 1']

  if (filters.vinNo) {
    req.input('vinNo', sql.NVarChar, filters.vinNo)
    conditions.push('i.VinNo = @vinNo')
  }
  if (filters.inspectionType) {
    req.input('inspectionType', sql.VarChar, filters.inspectionType)
    conditions.push('i.InspectionType = @inspectionType')
  }
  if (filters.inspectionSessionId) {
    req.input('inspectionSessionId', sql.Int, filters.inspectionSessionId)
    conditions.push('i.InspectionSessionID = @inspectionSessionId')
  }
  if (filters.status) {
    req.input('status', sql.VarChar, filters.status)
    conditions.push('i.Status = @status')
  }
  if (filters.location) {
    req.input('location', sql.VarChar, filters.location)
    conditions.push('i.Location = @location')
  }
  if (filters.startDate) {
    req.input('startDate', sql.Date, filters.startDate)
    conditions.push('i.InspectionDate >= @startDate')
  }
  if (filters.endDate) {
    req.input('endDate', sql.Date, filters.endDate)
    conditions.push('i.InspectionDate <= @endDate')
  }

  const limit = filters.limit || 50
  req.input('limit', sql.Int, limit)

  const hasResolveCols = await checkResolveColumnsExist(pool)
  const resolveItemCols = hasResolveCols
    ? 'it.ResolveStatus AS resolveStatus, it.ResolveRemark AS resolveRemark, it.ResolveDate AS resolveDate'
    : 'CAST(NULL AS VARCHAR(30)) AS resolveStatus, CAST(NULL AS NVARCHAR(500)) AS resolveRemark, CAST(NULL AS DATETIME) AS resolveDate'
  const repairHeaderCol = hasResolveCols
    ? 'i.RepairStatus AS repairStatus, i.RepairRemark AS repairRemark'
    : 'CAST(NULL AS VARCHAR(30)) AS repairStatus, CAST(NULL AS NVARCHAR(500)) AS repairRemark'

  const result = await req.query(`
    SELECT TOP (@limit)
      i.InspectionID AS inspectionId,
      i.VinNo AS vinNo,
      i.RegisterNo AS registerNo,
      i.InspectionType AS inspectionType,
      i.InspectionDate AS inspectionDate,
      i.InspectorName AS inspectorName,
      i.Status AS status,
      COALESCE(i.Mileage, (
        SELECT TOP 1 CAST(NumericValue AS INT)
        FROM dbo.EV_InspectionItem
        WHERE InspectionID = i.InspectionID AND Category = 'MILEAGE' AND ItemCode = 'VALUE'
      )) AS mileage,
      i.CreateDate AS createDate,
      i.UpdateDate AS updateDate,
      i.Location AS location,
      sub.StatusName AS locationName,
      i.ReturnReason AS returnReason,
      COALESCE(rs.DescriptionStatus, rs.StatusName, i.ReturnReason) AS returnReasonName,
      i.AssessmentResult AS assessmentResult,
      ${repairHeaderCol},
      i.CustomerName AS customerName,
      i.CustomerContact AS customerContact,
      i.ContractCancellationDate AS contractCancellationDate,
      i.IsPendingChecklist AS isPendingChecklist,
      ISNULL(NULLIF(cu.FirstName + CASE WHEN cu.LastName IS NOT NULL AND cu.LastName != '' THEN ' ' + LEFT(cu.LastName, 1) + '.' ELSE '' END, ''), cu.UserName) AS createdByName,
      ISNULL(NULLIF(uu.FirstName + CASE WHEN uu.LastName IS NOT NULL AND uu.LastName != '' THEN ' ' + LEFT(uu.LastName, 1) + '.' ELSE '' END, ''), uu.UserName) AS updatedByName,
      (SELECT COUNT(*) FROM dbo.EV_InspectionItem WHERE InspectionID = i.InspectionID AND (Value IS NOT NULL OR NumericValue IS NOT NULL)) AS itemCount,
      (SELECT COUNT(*) FROM dbo.EV_InspectionPhoto WHERE InspectionID = i.InspectionID AND IsActive = 1) AS photoCount,
      (
        SELECT 
          it.InspectionItemID AS inspectionItemId,
          it.Category AS category,
          it.ItemCode AS itemCode,
          it.Value AS [value],
          it.Detail AS detail,
          ${resolveItemCols}
        FROM dbo.EV_InspectionItem it
        WHERE it.InspectionID = i.InspectionID
          AND (
            (it.Category = 'ACCIDENT' AND it.Value = 'YES')
            OR (it.Category <> 'CAR_PHOTOS' AND it.Category <> 'ACCIDENT' AND it.Value IN ('SCRATCH', 'DENT', 'NO', 'NONE', 'FRONT_ONLY', 'BACK_ONLY'))
          )
        FOR JSON PATH
      ) AS damagedItemsJson
    FROM dbo.EV_Inspection i
    LEFT JOIN dbo.EV_MsSubStatus sub ON i.Location = sub.StatusCode AND sub.Type = 'LOCATION'
    LEFT JOIN dbo.EV_MsSubStatus rs ON i.ReturnReason = rs.StatusCode AND rs.Type = 'RETURN_REASON'
    LEFT JOIN dbo.EV_User cu ON i.CreateUserID = cu.UserID
    LEFT JOIN dbo.EV_User uu ON i.UpdateUserID = uu.UserID
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.CreateDate DESC
  `)

  return result.recordset.map((row: any) => {
    const damagedItems = parseDamagedItems(row.damagedItemsJson)
    return {
      ...row,
      damagedCount: damagedItems.length,
      damagedItems,
    }
  })
}

/** ดึง Inspection detail เต็ม */
export async function getInspectionDetail(inspectionId: number): Promise<InspectionData | null> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const hasResolveCols = await checkResolveColumnsExist(pool)
  const resolveItemCols = hasResolveCols
    ? 'ResolveStatus AS resolveStatus, ResolveRemark AS resolveRemark, ResolveUserID AS resolveUserId, ResolveDate AS resolveDate'
    : 'CAST(NULL AS VARCHAR(30)) AS resolveStatus, CAST(NULL AS NVARCHAR(500)) AS resolveRemark, CAST(NULL AS INT) AS resolveUserId, CAST(NULL AS DATETIME) AS resolveDate'
  const repairHeaderCol = hasResolveCols
    ? 'i.RepairStatus AS repairStatus, i.RepairRemark AS repairRemark'
    : 'CAST(NULL AS VARCHAR(30)) AS repairStatus, CAST(NULL AS NVARCHAR(500)) AS repairRemark'

  const [headerRes, itemsRes, photosRes] = await Promise.all([
    pool.request().input('inspectionId', sql.BigInt, inspectionId).query(`
      SELECT i.InspectionID AS inspectionId, i.VinNo AS vinNo, i.RegisterNo AS registerNo,
             inv.InventoryItemID AS inventoryItemId, inv.Model AS model, inv.Project AS project,
             i.InspectionType AS inspectionType, i.ReturnItemID AS returnItemId,
             i.InspectionSessionID AS inspectionSessionId, i.Mileage AS mileage,
             i.InspectionDate AS inspectionDate, i.InspectorUserID AS inspectorUserID,
             i.InspectorName AS inspectorName, i.Status AS status, i.Remark AS remark,
             i.ReturnDate AS returnDate, i.Location AS location, sub.StatusName AS locationName,
             i.RentItemID AS rentItemId, i.ContractNo AS contractNo,
             i.ReturnReason AS returnReason,
             COALESCE(rs.DescriptionStatus, rs.StatusName, i.ReturnReason) AS returnReasonName,
             i.AssessmentResult AS assessmentResult,
             ${repairHeaderCol},
             i.IsDistributed AS isDistributed, i.DistributionDate AS distributionDate,
             i.DistributionUserID AS distributionUserID,
             i.CustomerName AS customerName, i.CustomerContact AS customerContact,
             i.ContractCancellationDate AS contractCancellationDate,
             i.IsPendingChecklist AS isPendingChecklist
      FROM dbo.EV_Inspection i
      LEFT JOIN dbo.EV_InventoryItem inv ON i.VinNo = inv.VinNo
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.Location = sub.StatusCode AND sub.Type = 'LOCATION'
      LEFT JOIN dbo.EV_MsSubStatus rs ON i.ReturnReason = rs.StatusCode AND rs.Type = 'RETURN_REASON'
      WHERE i.InspectionID = @inspectionId AND i.IsActive = 1
    `),
    pool.request().input('inspectionId', sql.BigInt, inspectionId).query(`
      SELECT InspectionItemID AS inspectionItemId, Category AS category, ItemCode AS itemCode,
             Value AS value, Detail AS detail, NumericValue AS numericValue, ExpiryDate AS expiryDate,
             ${resolveItemCols}
      FROM dbo.EV_InspectionItem
      WHERE InspectionID = @inspectionId
      ORDER BY InspectionItemID
    `),
    pool.request().input('inspectionId', sql.BigInt, inspectionId).query(`
      SELECT InspectionPhotoID AS inspectionPhotoId, Category AS category, ItemCode AS itemCode,
             PhotoPosition AS photoPosition, S3Key AS s3Key, FileName AS fileName,
             FileSize AS fileSize, ContentType AS contentType
      FROM dbo.EV_InspectionPhoto
      WHERE InspectionID = @inspectionId AND IsActive = 1
      ORDER BY InspectionPhotoID
    `),
  ])

  const header = headerRes.recordset[0]
  if (!header) return null

  const items = itemsRes.recordset
  const mileageItem = items.find((it: any) => it.category === 'MILEAGE' && it.itemCode === 'VALUE')
  const mileageFromItems = mileageItem?.numericValue != null ? Math.round(Number(mileageItem.numericValue)) : null

  return {
    ...header,
    mileage: header.mileage ?? mileageFromItems,
    items,
    photos: photosRes.recordset,
  }
}

// =====================================================
// Photo Operations
// =====================================================

/** บันทึก record photo ลง DB (หลังจาก upload S3 เสร็จ) */
export async function saveInspectionPhoto(params: {
  inspectionId: number
  category: string
  itemCode: string | null
  photoPosition: string | null
  s3Key: string
  fileName: string
  fileSize: number | null
  contentType: string | null
  createUserId?: number | null
}): Promise<number> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  const result = await pool.request()
    .input('inspectionId', sql.BigInt, params.inspectionId)
    .input('category', sql.VarChar, params.category)
    .input('itemCode', sql.VarChar, params.itemCode || null)
    .input('photoPosition', sql.VarChar, params.photoPosition || null)
    .input('s3Key', sql.NVarChar, params.s3Key)
    .input('fileName', sql.NVarChar, params.fileName)
    .input('fileSize', sql.Int, params.fileSize || null)
    .input('contentType', sql.NVarChar, params.contentType || null)
    .input('createUserId', sql.Int, params.createUserId || null)
    .query(`
      INSERT INTO dbo.EV_InspectionPhoto (
        InspectionID, Category, ItemCode, PhotoPosition, S3Key, FileName, FileSize, ContentType, CreateUserID
      )
      VALUES (
        @inspectionId, @category, @itemCode, @photoPosition, @s3Key, @fileName, @fileSize, @contentType, @createUserId
      );
      SELECT SCOPE_IDENTITY() AS InspectionPhotoID;
    `)

  return result.recordset[0]?.InspectionPhotoID
}

// =====================================================
// Audit Session Operations
// =====================================================

/** ดึงรายการ Audit Sessions */
export async function listAuditSessions(): Promise<AuditSessionData[]> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const result = await pool.request().query(`
    SELECT
      s.InspectionSessionID AS inspectionSessionId,
      s.SessionName AS sessionName,
      s.SessionDate AS sessionDate,
      s.Location AS location,
      sub.StatusName AS locationName,
      s.Status AS status,
      s.Notes AS notes,
      s.CreatedBy AS createdBy,
      (SELECT COUNT(*) FROM dbo.EV_Inspection WHERE InspectionSessionID = s.InspectionSessionID AND IsActive = 1) AS inspectionCount
    FROM dbo.EV_InspectionSession s
    LEFT JOIN dbo.EV_MsSubStatus sub ON s.Location = sub.StatusCode AND sub.Type = 'LOCATION'
    ORDER BY s.SessionDate DESC, s.CreateDate DESC
  `)

  return result.recordset
}

/** สร้าง Audit Session ใหม่ */
export async function createAuditSession(params: {
  sessionName: string
  sessionDate: string
  location?: string
  notes?: string
  createdBy: number
}): Promise<number> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  const result = await pool.request()
    .input('sessionName', sql.NVarChar, params.sessionName)
    .input('sessionDate', sql.Date, params.sessionDate)
    .input('location', sql.NVarChar, params.location || null)
    .input('notes', sql.NVarChar, params.notes || null)
    .input('createdBy', sql.Int, params.createdBy)
    .query(`
      INSERT INTO dbo.EV_InspectionSession (SessionName, SessionDate, Location, Status, Notes, CreatedBy)
      VALUES (@sessionName, @sessionDate, @location, 'OPEN', @notes, @createdBy);
      SELECT SCOPE_IDENTITY() AS InspectionSessionID;
    `)

  return result.recordset[0]?.InspectionSessionID
}

/** ปิดรอบตรวจ */
export async function closeAuditSession(sessionId: number): Promise<void> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  await pool.request()
    .input('sessionId', sql.Int, sessionId)
    .query(`
      UPDATE dbo.EV_InspectionSession
      SET Status = 'CLOSED', UpdateDate = GETDATE()
      WHERE InspectionSessionID = @sessionId
    `)
}

/** ลบรูปภาพ Inspection (Soft delete โดยตั้ง IsActive = 0) */
export async function deleteInspectionPhoto(photoId: number, updateUserId?: number | null): Promise<boolean> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  await pool.request()
    .input('photoId', sql.BigInt, photoId)
    .input('updateUserId', sql.Int, updateUserId || null)
    .query(`
      UPDATE dbo.EV_InspectionPhoto
      SET IsActive = 0, UpdateDate = GETDATE(), UpdateUserID = @updateUserId
      WHERE InspectionPhotoID = @photoId
    `)

  return true
}

/** ดึงข้อมูลรายการเช็คลิสต์ตรวจสภาพรถจาก Master Table */
export async function getInspectionItemMaster(): Promise<any[]> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const result = await pool.request().query(`
    SELECT Category, ItemCode, Label, InputType, SortOrder
    FROM dbo.EV_InspectionItemMaster
    WHERE IsActive = 1
    ORDER BY SortOrder
  `)
  return result.recordset.map((item: any) => {
    if (item.Category === 'BATTERY_HV' && item.ItemCode === 'LEVEL') {
      return {
        ...item,
        Label: 'แบต 12 volt (%)',
      }
    }
    return item
  })
}

/** ดึงข้อมูล Master เหตุผลการคืนรถจาก EV_MsSubStatus (Type='RETURN_REASON') แบบไดนามิก */
export async function getReturnReasonsMaster(): Promise<Array<{ code: string; name: string }>> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const result = await pool.request().query(`
    SELECT StatusCode AS code, COALESCE(DescriptionStatus, StatusName, StatusCode) AS name
    FROM dbo.EV_MsSubStatus
    WHERE Type = 'RETURN_REASON' AND IsActive = 1
    ORDER BY Seq ASC, StatusName ASC
  `)
  return result.recordset
}

/** อัปเดตสถานะการจัดการจุดชำรุดเสียหาย (PENDING / IN_PROGRESS / RESOLVED / NO_ACTION_NEEDED) */
export async function updateInspectionItemResolution(params: {
  inspectionId: number
  inspectionItemId?: number | null
  category: string
  itemCode: string
  resolveStatus: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'NO_ACTION_NEEDED'
  resolveRemark?: string | null
  ev7UserId?: number | null
}): Promise<{ success: boolean; updatedRepairStatus: string }> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  const hasCols = await checkResolveColumnsExist(pool)
  if (!hasCols) {
    throw new Error('ฐานข้อมูลยังไม่มีคอลัมน์ ResolveStatus กรุณารัน SQL Migration (Alter_InspectionItem_Add_ResolveStatus.sql) บนฐานข้อมูลก่อน')
  }

  const req = pool.request()
  req.input('inspectionId', sql.BigInt, params.inspectionId)
  req.input('category', sql.NVarChar, params.category)
  req.input('itemCode', sql.NVarChar, params.itemCode)
  req.input('resolveStatus', sql.VarChar(30), params.resolveStatus)
  req.input('resolveRemark', sql.NVarChar(500), params.resolveRemark || null)
  req.input('resolveUserId', sql.Int, params.ev7UserId || null)

  let whereItem = 'InspectionID = @inspectionId AND Category = @category AND ItemCode = @itemCode'
  if (params.inspectionItemId) {
    req.input('inspectionItemId', sql.BigInt, params.inspectionItemId)
    whereItem = 'InspectionID = @inspectionId AND InspectionItemID = @inspectionItemId'
  }

  // Update item
  await req.query(`
    UPDATE dbo.EV_InspectionItem
    SET ResolveStatus = @resolveStatus,
        ResolveRemark = @resolveRemark,
        ResolveUserID = @resolveUserId,
        ResolveDate = GETDATE()
    WHERE ${whereItem}
  `)

  // Check remaining items to update overall RepairStatus in EV_Inspection
  const countReq = pool.request()
  countReq.input('inspectionId', sql.BigInt, params.inspectionId)
  const itemsRes = await countReq.query(`
    SELECT Category, ItemCode, Value, ResolveStatus
    FROM dbo.EV_InspectionItem
    WHERE InspectionID = @inspectionId
      AND (
        (Category = 'ACCIDENT' AND Value = 'YES')
        OR (Category <> 'CAR_PHOTOS' AND Category <> 'ACCIDENT' AND Value IN ('SCRATCH', 'DENT', 'NO', 'NONE', 'FRONT_ONLY', 'BACK_ONLY'))
      )
  `)

  const damagedItems = itemsRes.recordset || []
  let newRepairStatus = 'RESOLVED'

  if (damagedItems.length === 0) {
    newRepairStatus = 'RESOLVED'
  } else {
    const hasPending = damagedItems.some((d: any) => !d.ResolveStatus || d.ResolveStatus === 'PENDING')
    const hasInProgress = damagedItems.some((d: any) => d.ResolveStatus === 'IN_PROGRESS')
    const allNoAction = damagedItems.every((d: any) => d.ResolveStatus === 'NO_ACTION_NEEDED')

    if (hasPending) {
      newRepairStatus = 'PENDING'
    } else if (hasInProgress) {
      newRepairStatus = 'IN_PROGRESS'
    } else if (allNoAction) {
      newRepairStatus = 'NO_ACTION_NEEDED'
    } else {
      newRepairStatus = 'RESOLVED'
    }
  }

  const updateHeaderReq = pool.request()
  updateHeaderReq.input('inspectionId', sql.BigInt, params.inspectionId)
  updateHeaderReq.input('repairStatus', sql.VarChar(30), newRepairStatus)
  await updateHeaderReq.query(`
    UPDATE dbo.EV_Inspection
    SET RepairStatus = @repairStatus
    WHERE InspectionID = @inspectionId
  `)

  return { success: true, updatedRepairStatus: newRepairStatus }
}

