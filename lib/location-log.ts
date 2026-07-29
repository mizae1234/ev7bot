import { getMSSQLWritePool, sql } from '@/lib/mssql'

type LocationLogPayload = {
  inventoryItemId?: number;
  vinNo?: string;
  oldLocation: string | null;
  newLocation: string | null;
  actionCode: string;
  refType?: string;
  refId?: number;
  createUserId: number;
}

export async function insertLocationLog(payload: LocationLogPayload) {
  const pool = await getMSSQLWritePool()
  if (!pool) throw new Error('Database connection failed')

  // If both IDs are missing, we can't log
  if (!payload.inventoryItemId && !payload.vinNo) {
    console.warn('[LocationLog] Missing both inventoryItemId and vinNo, skipping log.')
    return
  }

  try {
    const req = pool.request()
    
    // Resolve InventoryItemID and VinNo if one is missing
    if (payload.inventoryItemId && !payload.vinNo) {
      const vRes = await req
        .input('qId', sql.Int, payload.inventoryItemId)
        .query(`SELECT VinNo FROM dbo.EV_InventoryItem WHERE InventoryItemID = @qId`)
      if (vRes.recordset.length > 0) payload.vinNo = vRes.recordset[0].VinNo
    } else if (payload.vinNo && !payload.inventoryItemId) {
      const iRes = await req
        .input('qVin', sql.VarChar, payload.vinNo)
        .query(`SELECT InventoryItemID FROM dbo.EV_InventoryItem WHERE VinNo = @qVin AND IsActive = 1`)
      if (iRes.recordset.length > 0) payload.inventoryItemId = iRes.recordset[0].InventoryItemID
    }

    req.input('itemId', sql.Int, payload.inventoryItemId || null)
    req.input('vin', sql.VarChar, payload.vinNo || null)
    req.input('oldLoc', sql.NVarChar, payload.oldLocation)
    req.input('newLoc', sql.NVarChar, payload.newLocation)
    req.input('action', sql.VarChar, payload.actionCode)
    req.input('refType', sql.VarChar, payload.refType || null)
    req.input('refId', sql.Int, payload.refId || null)
    req.input('userId', sql.Int, payload.createUserId)

    await req.query(`
      INSERT INTO dbo.EV_VehicleLocationLog (
        InventoryItemID, VinNo, OldLocation, NewLocation, ActionCode, RefType, RefID, CreateDate, CreateUserID
      )
      VALUES (
        @itemId, @vin, @oldLoc, @newLoc, @action, @refType, @refId, GETDATE(), @userId
      )
    `)
    
    console.log(`[LocationLog] Inserted log for VinNo=${payload.vinNo} (${payload.actionCode})`)
  } catch (err) {
    console.error('[LocationLog] Error inserting location log:', err)
  }
}
