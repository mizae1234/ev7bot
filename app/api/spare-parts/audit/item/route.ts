import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool, sql } from '@/lib/mssql'

// POST: Add a scanned item
export async function POST(request: NextRequest) {
  try {
    const { sessionId, sku, quantity, createdBy, notes } = await request.json()
    if (!sessionId || !sku) {
      return NextResponse.json({ error: 'Missing sessionId or sku' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Check if the part exists (optional, but good for validation)
    const partResult = await pool.request()
      .input('sku', sql.NVarChar, sku)
      .query(`SELECT PartName FROM dbo.GI_SparePart WHERE SKU = @sku AND IsActive = 1`)

    let itemNotes = notes || ''
    let partName = null
    if (partResult.recordset.length === 0) {
      return NextResponse.json({ error: `ไม่พบข้อมูลอะไหล่รหัส: ${sku} ในระบบ ไม่สามารถบันทึกได้`, notFound: true }, { status: 404 })
    } else {
      partName = partResult.recordset[0].PartName
    }

    const qty = quantity && quantity > 0 ? quantity : 1

    // Check if the item already exists in this session
    const existingResult = await pool.request()
      .input('sessionId', sql.Int, sessionId)
      .input('sku', sql.NVarChar, sku)
      .query(`
        SELECT AuditItemID FROM dbo.GI_SparePartAuditItem 
        WHERE AuditSessionID = @sessionId AND SKU = @sku AND IsActive = 1
      `)

    let auditItemId;

    if (existingResult.recordset.length > 0) {
      // Update existing record by adding quantity
      auditItemId = existingResult.recordset[0].AuditItemID
      await pool.request()
        .input('auditItemId', sql.Int, auditItemId)
        .input('quantity', sql.Int, qty)
        .input('createdBy', sql.NVarChar, createdBy || 'System')
        .input('notes', sql.NVarChar, itemNotes)
        .query(`
          UPDATE dbo.GI_SparePartAuditItem
          SET Quantity = Quantity + @quantity,
              ScanTime = GETDATE(),
              CreatedBy = @createdBy,
              Notes = CASE WHEN @notes <> '' THEN @notes ELSE Notes END
          WHERE AuditItemID = @auditItemId
        `)
    } else {
      // Insert new record
      const result = await pool.request()
        .input('sessionId', sql.Int, sessionId)
        .input('sku', sql.NVarChar, sku)
        .input('quantity', sql.Int, qty)
        .input('createdBy', sql.NVarChar, createdBy || 'System')
        .input('notes', sql.NVarChar, itemNotes)
        .query(`
          INSERT INTO dbo.GI_SparePartAuditItem (AuditSessionID, SKU, Quantity, ScanTime, CreatedBy, Notes, IsActive)
          VALUES (@sessionId, @sku, @quantity, GETDATE(), @createdBy, @notes, 1);
          SELECT SCOPE_IDENTITY() AS AuditItemID;
        `)
      auditItemId = result.recordset[0]?.AuditItemID
    }

    return NextResponse.json({ 
      success: true, 
      auditItemId: auditItemId,
      partName: partName,
      quantity: qty
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Add Scan Item Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Soft delete a scanned item
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const auditItemId = searchParams.get('id')
    if (!auditItemId) {
      return NextResponse.json({ error: 'Missing auditItemId' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    await pool.request()
      .input('auditItemId', sql.Int, parseInt(auditItemId))
      .query(`
        UPDATE dbo.GI_SparePartAuditItem
        SET IsActive = 0
        WHERE AuditItemID = @auditItemId
      `)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Delete Scan Item Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: Update quantity of a scanned item
export async function PUT(request: NextRequest) {
  try {
    const { auditItemId, quantity } = await request.json()
    if (!auditItemId || typeof quantity !== 'number') {
      return NextResponse.json({ error: 'Missing auditItemId or quantity' }, { status: 400 })
    }

    const pool = await getMSSQLPool()
    if (!pool) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    if (quantity <= 0) {
      // Soft delete if quantity reaches 0
      await pool.request()
        .input('auditItemId', sql.Int, auditItemId)
        .query(`
          UPDATE dbo.GI_SparePartAuditItem
          SET IsActive = 0
          WHERE AuditItemID = @auditItemId
        `)
    } else {
      await pool.request()
        .input('auditItemId', sql.Int, auditItemId)
        .input('quantity', sql.Int, quantity)
        .query(`
          UPDATE dbo.GI_SparePartAuditItem
          SET Quantity = @quantity
          WHERE AuditItemID = @auditItemId
        `)
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Update Scan Item Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
