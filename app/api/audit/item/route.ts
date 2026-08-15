import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// API Route for managing scanned items in an audit session
// GET: Search for a vehicle by registerNo or vinNo
// POST: Save checked vehicle to EV_AuditItem (with check for duplicates)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const keyword = searchParams.get('keyword')
    const maxSlotSessionId = searchParams.get('sessionId')
    const maxSlotRow = searchParams.get('row')

    // Mode 1: Get max slot for a given row in a session (for auto-increment)
    if (maxSlotSessionId && maxSlotRow) {
      const pool = await getMSSQLPool()
      if (!pool) {
        return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
      }

      const result = await pool.request()
        .input('sessionId', sql.Int, parseInt(maxSlotSessionId) || 0)
        .input('row', sql.NVarChar, maxSlotRow)
        .query(`
          SELECT MAX(TRY_CAST(AuditSlot AS INT)) AS MaxSlot,
                 COUNT(*) AS SlotCount
          FROM dbo.EV_AuditItem
          WHERE AuditSessionID = @sessionId AND AuditRow = @row AND IsActive = 1
        `)

      const maxSlot = result.recordset[0]?.MaxSlot || 0
      const slotCount = result.recordset[0]?.SlotCount || 0
      return NextResponse.json({ maxSlot, slotCount })
    }

    // Mode 2: Search vehicles by keyword
    if (!keyword) {
      return NextResponse.json({ vehicles: [] })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    const cleanedKeyword = keyword.replace(/[\s-]/g, '')

    // Search vehicles (limit 10 for quick dropdown)
    const result = await pool.request()
      .input('keyword', sql.NVarChar, keyword)
      .input('cleanedKeyword', sql.NVarChar, cleanedKeyword)
      .query(`
        SELECT TOP 10 ii.VinNo, ii.RegisterNo, ii.Model, ii.Exterior_Color, ii.Status, ii.StatusType,
               ii.CurrentLocation, ii.StockLocation,
               sub_curr.StatusName AS CurrentLocationName,
               sub_stock.StatusName AS StockLocationName
        FROM dbo.EV_InventoryItem ii
        LEFT JOIN dbo.EV_MsSubStatus sub_curr ON ii.CurrentLocation = sub_curr.StatusCode AND sub_curr.Type = 'LOCATION'
        LEFT JOIN dbo.EV_MsSubStatus sub_stock ON ii.StockLocation = sub_stock.StatusCode AND sub_stock.Type = 'LOCATION'
        WHERE (
          ii.VinNo LIKE '%' + @keyword + '%' 
          OR ii.RegisterNo LIKE '%' + @keyword + '%'
          OR REPLACE(REPLACE(ii.VinNo, ' ', ''), '-', '') LIKE '%' + @cleanedKeyword + '%'
          OR REPLACE(REPLACE(ii.RegisterNo, ' ', ''), '-', '') LIKE '%' + @cleanedKeyword + '%'
        )
        AND ii.IsActive = 1
      `)

    return NextResponse.json({ vehicles: result.recordset })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Search Vehicle Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      auditSessionID,
      vinNo,
      createdBy,
      method,
      detectedStatus,
      previousLocation,
      isConfirmed,
      notes,
      forceSave,
      vehicleStatus,
      vehicleStatusType,
      auditRow,
      auditSlot,
      isDoubleParked
    } = await request.json()

    if (!auditSessionID || !vinNo || !method || !detectedStatus) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // 1. Check if the vehicle is already audited in this session
    const duplicateCheck = await pool.request()
      .input('auditSessionID', sql.Int, auditSessionID)
      .input('vinNo', sql.NVarChar, vinNo)
      .query(`
        SELECT AuditItemID, CreatedBy, ScanTime
        FROM dbo.EV_AuditItem
        WHERE AuditSessionID = @auditSessionID AND VinNo = @vinNo AND IsActive = 1
      `)

    if (duplicateCheck.recordset.length > 0 && !forceSave) {
      const existing = duplicateCheck.recordset[0]
      return NextResponse.json({
        isDuplicate: true,
        message: `รถคันนี้ถูกสแกน/บันทึกไปแล้วในรอบนี้`,
        existingRecord: {
          createdBy: existing.CreatedBy,
          scanTime: existing.ScanTime
        }
      })
    }

    // 2. Insert or update the audit record
    if (duplicateCheck.recordset.length > 0 && forceSave) {
      // Update existing item
      await pool.request()
        .input('auditSessionID', sql.Int, auditSessionID)
        .input('vinNo', sql.NVarChar, vinNo)
        .input('method', sql.NVarChar, method)
        .input('detectedStatus', sql.NVarChar, detectedStatus)
        .input('previousLocation', sql.NVarChar, previousLocation || null)
        .input('isConfirmed', sql.Bit, isConfirmed ? 1 : 0)
        .input('createdBy', sql.NVarChar, createdBy || 'System')
        .input('notes', sql.NVarChar, notes || '')
        .input('vehicleStatus', sql.NVarChar, vehicleStatus || null)
        .input('vehicleStatusType', sql.NVarChar, vehicleStatusType || null)
        .input('auditRow', sql.NVarChar, auditRow || null)
        .input('auditSlot', sql.NVarChar, auditSlot || null)
        .input('slotPosition', sql.Int, isDoubleParked ? 1 : null)
        .query(`
          UPDATE dbo.EV_AuditItem
          SET ScanTime = GETDATE(),
              ScanMethod = @method,
              DetectedStatus = @detectedStatus,
              PreviousLocation = @previousLocation,
              IsConfirmed = @isConfirmed,
              CreatedBy = @createdBy,
              Notes = @notes,
              VehicleStatus = @vehicleStatus,
              VehicleStatusType = @vehicleStatusType,
              AuditRow = @auditRow,
              AuditSlot = @auditSlot,
              SlotPosition = @slotPosition
          WHERE AuditSessionID = @auditSessionID AND VinNo = @vinNo
        `)
    } else {
      // Insert new item
      await pool.request()
        .input('auditSessionID', sql.Int, auditSessionID)
        .input('vinNo', sql.NVarChar, vinNo)
        .input('method', sql.NVarChar, method)
        .input('detectedStatus', sql.NVarChar, detectedStatus)
        .input('previousLocation', sql.NVarChar, previousLocation || null)
        .input('isConfirmed', sql.Bit, isConfirmed ? 1 : 0)
        .input('createdBy', sql.NVarChar, createdBy || 'System')
        .input('notes', sql.NVarChar, notes || '')
        .input('vehicleStatus', sql.NVarChar, vehicleStatus || null)
        .input('vehicleStatusType', sql.NVarChar, vehicleStatusType || null)
        .input('auditRow', sql.NVarChar, auditRow || null)
        .input('auditSlot', sql.NVarChar, auditSlot || null)
        .input('slotPosition', sql.Int, isDoubleParked ? 1 : null)
        .query(`
          INSERT INTO dbo.EV_AuditItem (AuditSessionID, VinNo, ScanTime, ScanMethod, DetectedStatus, PreviousLocation, IsConfirmed, CreatedBy, Notes, VehicleStatus, VehicleStatusType, AuditRow, AuditSlot, SlotPosition)
          VALUES (@auditSessionID, @vinNo, GETDATE(), @method, @detectedStatus, @previousLocation, @isConfirmed, @createdBy, @notes, @vehicleStatus, @vehicleStatusType, @auditRow, @auditSlot, @slotPosition)
        `)
    }

    // Note: We intentionally do NOT update EV_InventoryItem.CurrentLocation here as requested by user.

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Save Audit Item Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: Edit an audit item (row, slot, notes, doubleParked)
export async function PUT(request: NextRequest) {
  try {
    const { auditItemId, auditRow, auditSlot, isDoubleParked, notes } = await request.json()

    if (!auditItemId) {
      return NextResponse.json({ error: 'Missing auditItemId' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    await pool.request()
      .input('auditItemId', sql.Int, auditItemId)
      .input('auditRow', sql.NVarChar, auditRow || null)
      .input('auditSlot', sql.NVarChar, auditSlot || null)
      .input('slotPosition', sql.Int, isDoubleParked ? 1 : null)
      .input('notes', sql.NVarChar, notes || '')
      .query(`
        UPDATE dbo.EV_AuditItem
        SET AuditRow = @auditRow,
            AuditSlot = @auditSlot,
            SlotPosition = @slotPosition,
            Notes = @notes
        WHERE AuditItemID = @auditItemId AND IsActive = 1
      `)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Edit Audit Item Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Soft-delete an audit item (set IsActive = 0)
export async function DELETE(request: NextRequest) {
  try {
    const { auditItemId } = await request.json()

    if (!auditItemId) {
      return NextResponse.json({ error: 'Missing auditItemId' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    await pool.request()
      .input('auditItemId', sql.Int, auditItemId)
      .query(`
        UPDATE dbo.EV_AuditItem
        SET IsActive = 0
        WHERE AuditItemID = @auditItemId
      `)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Delete Audit Item Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
