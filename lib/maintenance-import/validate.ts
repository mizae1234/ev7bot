import type { ConnectionPool } from 'mssql'
import { sql } from '@/lib/mssql'
import { FAULT_PARTY_RULES, INSURANCE_RULES, IMPORT_CONFIG } from './config'
import { normalizePlate } from './parse'
import type { EvaluatedRow, ImportRowStatus, ImportSummary, ParsedRow } from './types'

/** Internal row: evaluation result + data needed by commit. */
export interface PlannedRow extends EvaluatedRow {
  parsed: ParsedRow
  inventoryItemId?: number
  vinNo?: string
  contractNo?: string | null
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const placeholders = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `@${prefix}${i}`).join(',')

async function queryIn<T>(
  pool: ConnectionPool,
  values: (string | number)[],
  type: 'nvarchar' | 'int',
  build: (inList: string) => string,
): Promise<T[]> {
  const out: T[] = []
  for (const part of chunk(values, IMPORT_CONFIG.sqlChunkSize)) {
    const req = pool.request()
    part.forEach((v, i) => req.input(`p${i}`, type === 'int' ? sql.Int : sql.NVarChar, v))
    const res = await req.query(build(placeholders('p', part.length)))
    out.push(...(res.recordset as T[]))
  }
  return out
}

/** Master code → display name (EV_MsSubStatus.StatusName). */
async function loadMasterCodes(pool: ConnectionPool, type: string): Promise<Map<string, string>> {
  const res = await pool.request()
    .input('type', sql.NVarChar, type)
    .query('SELECT StatusCode, StatusName FROM dbo.EV_MsSubStatus WHERE Type = @type AND IsActive = 1')
  return new Map(res.recordset.map((r: { StatusCode: string; StatusName: string | null }) => [r.StatusCode, r.StatusName || r.StatusCode]))
}

export interface EvaluationResult {
  rows: PlannedRow[]
  warnings: string[]
}

/**
 * Evaluate every parsed row against the database (read-only). Rows are decided in file
 * order: the first row for a claim number / vehicle wins, later ones are skipped.
 */
export async function evaluateRows(pool: ConnectionPool, parsedRows: ParsedRow[]): Promise<EvaluationResult> {
  const warnings: string[] = []

  const [faultCodes, insuranceCodes, problemTypeCodes] = await Promise.all([
    loadMasterCodes(pool, IMPORT_CONFIG.masterTypes.faultParty),
    loadMasterCodes(pool, IMPORT_CONFIG.masterTypes.insurance),
    loadMasterCodes(pool, IMPORT_CONFIG.masterTypes.problemType),
  ])

  if (!problemTypeCodes.has(IMPORT_CONFIG.problemTypeCode)) {
    warnings.push(`ไม่พบประเภทปัญหา "${IMPORT_CONFIG.problemTypeCode}" ใน master (${IMPORT_CONFIG.masterTypes.problemType})`)
  }

  const resolveFaultParty = (summary: string): string | null => {
    const rule = FAULT_PARTY_RULES.find(r => summary.includes(r.match))
    const candidates = rule ? [...rule.codes, IMPORT_CONFIG.fallbackFaultPartyCode] : [IMPORT_CONFIG.fallbackFaultPartyCode]
    return candidates.find(c => faultCodes.has(c)) ?? null
  }
  const resolveInsurance = (company: string): string | null => {
    const rule = INSURANCE_RULES.find(r => company.includes(r.match))
    return rule && insuranceCodes.has(rule.code) ? rule.code : null
  }
  if (faultCodes.size > 0 && !faultCodes.has(IMPORT_CONFIG.fallbackFaultPartyCode)) {
    warnings.push(`ไม่พบฝ่ายผิด "${IMPORT_CONFIG.fallbackFaultPartyCode}" ใน master (${IMPORT_CONFIG.masterTypes.faultParty})`)
  }

  // ── Batch lookups ────────────────────────────────────────────────
  const claimKeys = Array.from(new Set(parsedRows.map(r => r.fields.claimNumber.toUpperCase()).filter(Boolean)))
  const existingClaims = new Set(
    (await queryIn<{ c: string }>(pool, claimKeys, 'nvarchar', inList =>
      `SELECT DISTINCT UPPER(LTRIM(RTRIM(ClaimNumber))) AS c FROM dbo.EV_MaintenanceItem WHERE UPPER(LTRIM(RTRIM(ClaimNumber))) IN (${inList})`,
    )).map(r => r.c),
  )

  const plateKeys = Array.from(new Set(parsedRows.map(r => normalizePlate(r.fields.registerNo)).filter(Boolean)))
  const vehicles = await queryIn<{ InventoryItemID: number; RegisterNo: string; VinNo: string; Model: string }>(
    pool, plateKeys, 'nvarchar', inList =>
      `SELECT InventoryItemID, RegisterNo, VinNo, Model FROM dbo.EV_InventoryItem
       WHERE IsActive = 1 AND UPPER(REPLACE(REPLACE(REPLACE(RegisterNo, ' ', ''), '-', ''), '_', '')) IN (${inList})`,
  )
  const vehiclesByPlate = new Map<string, typeof vehicles>()
  for (const v of vehicles) {
    const key = normalizePlate(v.RegisterNo)
    vehiclesByPlate.set(key, [...(vehiclesByPlate.get(key) || []), v])
  }

  const inventoryIds = vehicles.map(v => v.InventoryItemID)
  const closedList = IMPORT_CONFIG.closedCarStatusCodes.map(c => `'${c}'`).join(',') // config constants, not user input
  const openTicketVehicles = new Set(
    (await queryIn<{ InventoryItemID: number }>(pool, inventoryIds, 'int', inList =>
      `SELECT DISTINCT InventoryItemID FROM dbo.EV_MaintenanceItem
       WHERE IsActive = 1 AND ISNULL(CarStatusCode, '') NOT IN (${closedList}) AND InventoryItemID IN (${inList})`,
    )).map(r => r.InventoryItemID),
  )
  const contractByVehicle = new Map<number, string>()
  for (const r of await queryIn<{ InventoryItemID: number; ContractNo: string }>(pool, inventoryIds, 'int', inList =>
    `SELECT InventoryItemID, ContractNo FROM dbo.EV_RentItem WHERE IsActive = 1 AND InventoryItemID IN (${inList})`,
  )) {
    if (r.ContractNo && !contractByVehicle.has(r.InventoryItemID)) contractByVehicle.set(r.InventoryItemID, r.ContractNo)
  }

  // ── Decide row by row (file order) ───────────────────────────────
  const seenClaims = new Set<string>()
  const claimedVehicles = new Set<number>()
  const planned: PlannedRow[] = parsedRows.map(parsed => {
    const f = parsed.fields
    const plateKey = normalizePlate(f.registerNo)
    const claimKey = f.claimNumber.toUpperCase()
    const faultPartyCode = resolveFaultParty(f.faultSummary)
    const matches = plateKey ? vehiclesByPlate.get(plateKey) || [] : []
    const vehicle = matches.length === 1 ? matches[0] : undefined

    const base: PlannedRow = {
      parsed,
      rowNo: parsed.rowNo,
      status: 'READY',
      reason: '',
      claimNumber: f.claimNumber,
      jobNo: f.jobNo,
      registerNo: f.registerNo,
      matchedRegisterNo: vehicle?.RegisterNo ?? null,
      model: vehicle?.Model ?? (f.model || null),
      incidentDate: parsed.incidentDateIso,
      issueTitle: f.issueTitle,
      driverName: f.driverName || f.reporterName,
      faultPartyCode: faultPartyCode,
      faultPartyName: faultPartyCode ? faultCodes.get(faultPartyCode) ?? null : null,
      insuranceCode: resolveInsurance(f.insuranceCompany),
      inventoryItemId: vehicle?.InventoryItemID,
      vinNo: vehicle?.VinNo,
      contractNo: vehicle ? contractByVehicle.get(vehicle.InventoryItemID) ?? null : null,
    }

    const skip = (status: ImportRowStatus, reason: string): PlannedRow => ({ ...base, status, reason })

    if (!claimKey) return skip('SKIP_NO_CLAIM', 'ไม่มีเลขเคลม')
    if (existingClaims.has(claimKey)) return skip('SKIP_DUPLICATE_CLAIM', `เลขเคลม ${f.claimNumber} มีในระบบแล้ว`)
    if (seenClaims.has(claimKey)) return skip('SKIP_DUPLICATE_IN_FILE', `เลขเคลม ${f.claimNumber} ซ้ำกับแถวก่อนหน้าในไฟล์`)
    if (!plateKey) return skip('SKIP_NO_PLATE', 'ไม่มีทะเบียนรถ')
    if (matches.length === 0) return skip('SKIP_VEHICLE_NOT_FOUND', `ไม่พบทะเบียน ${f.registerNo} ในระบบ`)
    if (matches.length > 1) return skip('SKIP_VEHICLE_AMBIGUOUS', `ทะเบียน ${f.registerNo} ตรงกับรถ ${matches.length} คัน`)
    if (!parsed.incidentDateIso) return skip('ERROR', `รูปแบบวันที่เกิดเหตุไม่ถูกต้อง: "${parsed.raw['วันที่เกิดเหตุ'] ?? ''}"`)
    if (!f.issueTitle) return skip('ERROR', 'ไม่มีลักษณะการเกิดเหตุ')
    if (openTicketVehicles.has(vehicle!.InventoryItemID)) return skip('SKIP_OPEN_TICKET', 'รถมีใบซ่อมที่ยังเปิดอยู่')
    if (claimedVehicles.has(vehicle!.InventoryItemID)) return skip('SKIP_OPEN_TICKET_IN_FILE', 'รถคันนี้มีใบจากแถวก่อนหน้าในไฟล์แล้ว')

    seenClaims.add(claimKey)
    claimedVehicles.add(vehicle!.InventoryItemID)
    return base
  })

  return { rows: planned, warnings }
}

export function summarize(rows: Pick<EvaluatedRow, 'status'>[]): ImportSummary {
  const byStatus: ImportSummary['byStatus'] = {}
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1
  const ready = byStatus.READY || 0
  const imported = byStatus.IMPORTED || 0
  return {
    total: rows.length,
    ready,
    skipped: rows.length - ready - imported - (byStatus.ERROR || 0),
    imported,
    failed: byStatus.ERROR || 0,
    byStatus,
  }
}

/** Strip server-only fields before sending rows to the client. */
export function toEvaluatedRow(p: PlannedRow): EvaluatedRow {
  const { parsed: _parsed, inventoryItemId: _i, vinNo: _v, contractNo: _c, ...rest } = p
  return rest
}
