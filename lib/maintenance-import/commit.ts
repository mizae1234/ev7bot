import { randomUUID } from 'crypto'
import type { ConnectionPool } from 'mssql'
import { sql } from '@/lib/mssql'
import { IMPORT_CONFIG } from './config'
import type { ImportRowStatus } from './types'
import type { PlannedRow } from './validate'

export const IMPORT_LOG_TABLE_MISSING =
  'ยังไม่ได้สร้างตาราง EV_MaintenanceImportLog กรุณาให้ DBA รัน sql/Create_EV_MaintenanceImportLog.sql และ GRANT สิทธิ์ให้ user เขียนข้อมูล'

export async function importLogTableExists(pool: ConnectionPool): Promise<boolean> {
  const res = await pool.request().query(`SELECT OBJECT_ID('dbo.EV_MaintenanceImportLog', 'U') AS id`)
  return res.recordset[0]?.id != null
}

async function writeLog(
  req: sql.Request,
  batchId: string,
  fileName: string | undefined,
  row: PlannedRow,
  result: ImportRowStatus,
  reason: string,
  maintenanceId: number | null,
  userId: number,
) {
  await req
    .input('batchId', sql.UniqueIdentifier, batchId)
    .input('fileName', sql.NVarChar, fileName?.slice(0, 260) ?? null)
    .input('rowNo', sql.Int, row.rowNo)
    .input('claim', sql.NVarChar, row.claimNumber || null)
    .input('job', sql.NVarChar, row.jobNo || null)
    .input('plate', sql.NVarChar, row.registerNo || null)
    .input('result', sql.VarChar, result)
    .input('reason', sql.NVarChar, reason.slice(0, 500) || null)
    .input('maintId', sql.Int, maintenanceId)
    .input('raw', sql.NVarChar, JSON.stringify(row.parsed.raw))
    .input('userId', sql.Int, userId)
    .query(`
      INSERT INTO dbo.EV_MaintenanceImportLog
        (ImportBatchID, FileName, RowNo, ClaimNumber, InsuranceJobNo, RegisterNo, Result, Reason, MaintenanceItemID, RawJson, CreateUserID)
      VALUES (@batchId, @fileName, @rowNo, @claim, @job, @plate, @result, @reason, @maintId, @raw, @userId)
    `)
}

/**
 * Insert every READY row (each in its own transaction) and log every row.
 * Mutates `rows` in place: READY → IMPORTED / ERROR / SKIP_* (re-checked under lock).
 */
export async function commitRows(
  pool: ConnectionPool,
  rows: PlannedRow[],
  opts: { fileName?: string; userId: number },
): Promise<{ batchId: string }> {
  const batchId = randomUUID()
  const closedList = IMPORT_CONFIG.closedCarStatusCodes.map(c => `'${c}'`).join(',')

  for (const row of rows) {
    if (row.status !== 'READY') {
      await writeLog(pool.request(), batchId, opts.fileName, row, row.status, row.reason, null, opts.userId)
      continue
    }

    const tx = new sql.Transaction(pool)
    try {
      await tx.begin()

      // Re-check under lock: a concurrent import / Quick Report may have created it since preview.
      const dup = await new sql.Request(tx)
        .input('claim', sql.NVarChar, row.claimNumber)
        .query(`SELECT TOP 1 1 AS x FROM dbo.EV_MaintenanceItem WITH (UPDLOCK, HOLDLOCK)
                WHERE UPPER(LTRIM(RTRIM(ClaimNumber))) = UPPER(@claim)`)
      if (dup.recordset.length > 0) {
        await tx.rollback()
        row.status = 'SKIP_DUPLICATE_CLAIM'
        row.reason = `เลขเคลม ${row.claimNumber} มีในระบบแล้ว`
        await writeLog(pool.request(), batchId, opts.fileName, row, row.status, row.reason, null, opts.userId)
        continue
      }
      const open = await new sql.Request(tx)
        .input('invId', sql.Int, row.inventoryItemId!)
        .query(`SELECT TOP 1 1 AS x FROM dbo.EV_MaintenanceItem WITH (UPDLOCK, HOLDLOCK)
                WHERE InventoryItemID = @invId AND IsActive = 1 AND ISNULL(CarStatusCode, '') NOT IN (${closedList})`)
      if (open.recordset.length > 0) {
        await tx.rollback()
        row.status = 'SKIP_OPEN_TICKET'
        row.reason = 'รถมีใบซ่อมที่ยังเปิดอยู่'
        await writeLog(pool.request(), batchId, opts.fileName, row, row.status, row.reason, null, opts.userId)
        continue
      }

      // followUpDetail / carCaseCode / serviceLocationCode are intentionally omitted (NULL).
      const payload = {
        inventoryItemId: row.inventoryItemId,
        registerNo: row.matchedRegisterNo,
        vinNo: row.vinNo,
        driverName: row.driverName || null,
        incidentDate: row.incidentDate,
        carStatusCode: IMPORT_CONFIG.initialCarStatusCode,
        issueTitle: row.issueTitle,
        problemTypeCode: IMPORT_CONFIG.problemTypeCode,
        faultPartyCode: row.faultPartyCode,
        insuranceCode: row.insuranceCode,
        claimNumber: row.claimNumber,
        createUserId: opts.userId,
      }
      const ins = await new sql.Request(tx)
        .input('MaintenanceJson', sql.NVarChar, JSON.stringify(payload))
        .output('NewMaintenanceItemID', sql.Int)
        .execute('dbo.sp_InsertMaintenanceItemJson')
      const maintId: number = ins.output.NewMaintenanceItemID

      // sp_InsertMaintenanceItemJson does not persist ContractNo; set it directly.
      if (row.contractNo) {
        await new sql.Request(tx)
          .input('maintId', sql.Int, maintId)
          .input('contractNo', sql.NVarChar, row.contractNo)
          .query('UPDATE dbo.EV_MaintenanceItem SET ContractNo = @contractNo WHERE MaintenanceItemID = @maintId')
      }

      await writeLog(new sql.Request(tx), batchId, opts.fileName, row, 'IMPORTED', '', maintId, opts.userId)
      await tx.commit()

      row.status = 'IMPORTED'
      row.reason = ''
      row.maintenanceId = maintId
    } catch (err) {
      try { await tx.rollback() } catch { /* already rolled back */ }
      console.error(`[Maintenance Import] Row ${row.rowNo} failed:`, err)
      row.status = 'ERROR'
      row.reason = `บันทึกไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`
      try {
        await writeLog(pool.request(), batchId, opts.fileName, row, 'ERROR', row.reason, null, opts.userId)
      } catch (logErr) {
        console.error('[Maintenance Import] Failed to write error log:', logErr)
      }
    }
  }

  return { batchId }
}
