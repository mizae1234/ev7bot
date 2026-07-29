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

export async function insertLocationLog(payload: LocationLogPayload): Promise<boolean> {
  try {
    const pool = await getMSSQLWritePool()
    if (!pool) {
      console.error('[LocationLog] Write pool is null (MOCK_MODE?), skipping.')
      return false
    }

    // If both IDs are missing, we can't log
    if (!payload.inventoryItemId && !payload.vinNo) {
      console.warn('[LocationLog] Missing both inventoryItemId and vinNo, skipping log.')
      return false
    }

    let itemId = payload.inventoryItemId ? Number(payload.inventoryItemId) : null
    let vinNo = payload.vinNo || null

    // Resolve missing VinNo or InventoryItemID using a SEPARATE request
    if (itemId && !vinNo) {
      try {
        const lookupReq = pool.request()
        lookupReq.input('qId', sql.Int, itemId)
        const vRes = await lookupReq.query(
          `SELECT VinNo FROM dbo.EV_InventoryItem WHERE InventoryItemID = @qId`
        )
        if (vRes.recordset.length > 0) vinNo = vRes.recordset[0].VinNo
      } catch (lookupErr) {
        console.error('[LocationLog] Error looking up VinNo:', lookupErr)
      }
    } else if (vinNo && !itemId) {
      try {
        const lookupReq = pool.request()
        lookupReq.input('qVin', sql.VarChar, vinNo)
        const iRes = await lookupReq.query(
          `SELECT InventoryItemID FROM dbo.EV_InventoryItem WHERE VinNo = @qVin AND IsActive = 1`
        )
        if (iRes.recordset.length > 0) itemId = Number(iRes.recordset[0].InventoryItemID)
      } catch (lookupErr) {
        console.error('[LocationLog] Error looking up InventoryItemID:', lookupErr)
      }
    }

    // INSERT using a FRESH request (never reuse)
    const insertReq = pool.request()
    insertReq.input('itemId', sql.Int, itemId)
    insertReq.input('vin', sql.VarChar, vinNo)
    insertReq.input('oldLoc', sql.NVarChar, payload.oldLocation)
    insertReq.input('newLoc', sql.NVarChar, payload.newLocation)
    insertReq.input('action', sql.VarChar, payload.actionCode)
    insertReq.input('refType', sql.VarChar, payload.refType || null)
    insertReq.input('refId', sql.Int, payload.refId || null)
    insertReq.input('userId', sql.Int, payload.createUserId)

    await insertReq.query(`
      INSERT INTO dbo.EV_VehicleLocationLog (
        InventoryItemID, VinNo, OldLocation, NewLocation, ActionCode, RefType, RefID, CreateDate, CreateUserID
      )
      VALUES (
        @itemId, @vin, @oldLoc, @newLoc, @action, @refType, @refId, GETDATE(), @userId
      )
    `)

    console.log(`[LocationLog] ✅ Inserted log for VinNo=${vinNo} ItemId=${itemId} (${payload.actionCode})`)
    return true
  } catch (err) {
    console.error('[LocationLog] ❌ Error inserting location log:', err)
    return false
  }
}
