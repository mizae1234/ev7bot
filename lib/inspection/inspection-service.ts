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
  InspectionPhotoData,
  AuditSessionData,
  InspectionStatus,
} from './types'

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

/** สร้าง Inspection ใหม่ พร้อม items (atomic) */
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
}): Promise<number> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  // Begin transaction for atomicity
  const transaction = pool.transaction()
  await transaction.begin()

  try {
    // 1. Insert header
    const headerResult = await transaction.request()
      .input('vinNo', sql.NVarChar, params.vinNo)
      .input('registerNo', sql.NVarChar, params.registerNo || null)
      .input('inspectionType', sql.VarChar, params.inspectionType)
      .input('returnItemId', sql.Int, params.returnItemId || null)
      .input('inspectionSessionId', sql.Int, params.inspectionSessionId || null)
      .input('mileage', sql.Int, params.mileage || null)
      .input('inspectionDate', sql.Date, params.inspectionDate)
      .input('inspectorUserID', sql.Int, params.ev7UserId)
      .input('inspectorName', sql.NVarChar, params.ev7UserName)
      .input('remark', sql.NVarChar, params.remark || null)
      .input('createUserID', sql.Int, params.ev7UserId)
      .query(`
        INSERT INTO dbo.EV_Inspection (
          VinNo, RegisterNo, InspectionType, ReturnItemID, InspectionSessionID,
          Mileage, InspectionDate, InspectorUserID, InspectorName,
          Status, Remark, IsActive, CreateDate, CreateUserID
        )
        VALUES (
          @vinNo, @registerNo, @inspectionType, @returnItemId, @inspectionSessionId,
          @mileage, @inspectionDate, @inspectorUserID, @inspectorName,
          'DRAFT', @remark, 1, GETDATE(), @createUserID
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
}): Promise<void> {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  const transaction = pool.transaction()
  await transaction.begin()

  try {
    // 1. Update header
    await transaction.request()
      .input('inspectionId', sql.BigInt, params.inspectionId)
      .input('mileage', sql.Int, params.mileage ?? null)
      .input('remark', sql.NVarChar, params.remark ?? null)
      .input('status', sql.VarChar, params.status || null)
      .input('updateUserID', sql.Int, params.ev7UserId)
      .query(`
        UPDATE dbo.EV_Inspection
        SET Mileage = COALESCE(@mileage, Mileage),
            Remark = COALESCE(@remark, Remark),
            Status = COALESCE(@status, Status),
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

/** ดึงรายการ Inspections */
export async function listInspections(filters: {
  vinNo?: string
  inspectionType?: string
  inspectionSessionId?: number
  status?: string
  limit?: number
}): Promise<InspectionListItem[]> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const req = pool.request()
  let conditions = ['i.IsActive = 1']

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

  const limit = filters.limit || 50
  req.input('limit', sql.Int, limit)

  const result = await req.query(`
    SELECT TOP (@limit)
      i.InspectionID AS inspectionId,
      i.VinNo AS vinNo,
      i.RegisterNo AS registerNo,
      i.InspectionType AS inspectionType,
      i.InspectionDate AS inspectionDate,
      i.InspectorName AS inspectorName,
      i.Status AS status,
      i.Mileage AS mileage,
      i.CreateDate AS createDate,
      (SELECT COUNT(*) FROM dbo.EV_InspectionItem WHERE InspectionID = i.InspectionID) AS itemCount,
      (SELECT COUNT(*) FROM dbo.EV_InspectionPhoto WHERE InspectionID = i.InspectionID) AS photoCount
    FROM dbo.EV_Inspection i
    WHERE ${conditions.join(' AND ')}
    ORDER BY i.CreateDate DESC
  `)

  return result.recordset
}

/** ดึง Inspection detail เต็ม */
export async function getInspectionDetail(inspectionId: number): Promise<InspectionData | null> {
  const pool = await getMSSQLPool()
  if (!pool) throw new Error('Database connection failed')

  const req = pool.request()
  req.input('inspectionId', sql.BigInt, inspectionId)

  const [headerRes, itemsRes, photosRes] = await Promise.all([
    req.query(`
      SELECT InspectionID AS inspectionId, VinNo AS vinNo, RegisterNo AS registerNo,
             InspectionType AS inspectionType, ReturnItemID AS returnItemId,
             InspectionSessionID AS inspectionSessionId, Mileage AS mileage,
             InspectionDate AS inspectionDate, InspectorUserID AS inspectorUserID,
             InspectorName AS inspectorName, Status AS status, Remark AS remark
      FROM dbo.EV_Inspection
      WHERE InspectionID = @inspectionId AND IsActive = 1
    `),
    pool.request().input('inspectionId', sql.BigInt, inspectionId).query(`
      SELECT InspectionItemID AS inspectionItemId, Category AS category, ItemCode AS itemCode,
             Value AS value, Detail AS detail, NumericValue AS numericValue, ExpiryDate AS expiryDate
      FROM dbo.EV_InspectionItem
      WHERE InspectionID = @inspectionId
      ORDER BY InspectionItemID
    `),
    pool.request().input('inspectionId', sql.BigInt, inspectionId).query(`
      SELECT InspectionPhotoID AS inspectionPhotoId, Category AS category, ItemCode AS itemCode,
             PhotoPosition AS photoPosition, S3Key AS s3Key, FileName AS fileName,
             FileSize AS fileSize, ContentType AS contentType
      FROM dbo.EV_InspectionPhoto
      WHERE InspectionID = @inspectionId
      ORDER BY InspectionPhotoID
    `),
  ])

  const header = headerRes.recordset[0]
  if (!header) return null

  return {
    ...header,
    items: itemsRes.recordset,
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
    .query(`
      INSERT INTO dbo.EV_InspectionPhoto (
        InspectionID, Category, ItemCode, PhotoPosition, S3Key, FileName, FileSize, ContentType
      )
      VALUES (
        @inspectionId, @category, @itemCode, @photoPosition, @s3Key, @fileName, @fileSize, @contentType
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
