import type { ImportField } from './config'

export type ImportRowStatus =
  | 'READY'
  | 'SKIP_NO_CLAIM'
  | 'SKIP_DUPLICATE_CLAIM'
  | 'SKIP_DUPLICATE_IN_FILE'
  | 'SKIP_NO_PLATE'
  | 'SKIP_VEHICLE_NOT_FOUND'
  | 'SKIP_VEHICLE_AMBIGUOUS'
  | 'SKIP_OPEN_TICKET'
  | 'SKIP_OPEN_TICKET_IN_FILE'
  | 'ERROR'
  | 'IMPORTED'

export const IMPORT_STATUS_LABEL: Record<ImportRowStatus, string> = {
  READY: 'พร้อมนำเข้า',
  IMPORTED: 'นำเข้าแล้ว',
  SKIP_NO_CLAIM: 'ไม่มีเลขเคลม',
  SKIP_DUPLICATE_CLAIM: 'เลขเคลมมีในระบบแล้ว',
  SKIP_DUPLICATE_IN_FILE: 'เลขเคลมซ้ำในไฟล์',
  SKIP_NO_PLATE: 'ไม่มีทะเบียน',
  SKIP_VEHICLE_NOT_FOUND: 'ไม่พบรถในระบบ',
  SKIP_VEHICLE_AMBIGUOUS: 'ทะเบียนตรงกับรถหลายคัน',
  SKIP_OPEN_TICKET: 'รถมีใบซ่อมที่ยังเปิดอยู่',
  SKIP_OPEN_TICKET_IN_FILE: 'รถซ้ำในไฟล์ (มีใบจากแถวก่อนหน้า)',
  ERROR: 'ผิดพลาด',
}

/** One Excel row after header mapping (pure parse, no DB). */
export interface ParsedRow {
  /** 1-based Excel row number (header = row 1). */
  rowNo: number
  fields: Record<ImportField, string>
  /** Normalized incident date `YYYY-MM-DDTHH:mm:ss` (wall-clock), or null. */
  incidentDateIso: string | null
  /** Whole row keyed by header (duplicate headers get a ` (n)` suffix). */
  raw: Record<string, string | number | null>
}

export interface ParseResult {
  rows: ParsedRow[]
  /** File-level problems (e.g. missing required header). Non-empty → reject. */
  errors: string[]
}

export interface EvaluatedRow {
  rowNo: number
  status: ImportRowStatus
  reason: string
  claimNumber: string
  jobNo: string
  registerNo: string
  matchedRegisterNo: string | null
  model: string | null
  incidentDate: string | null
  issueTitle: string
  driverName: string
  faultPartyCode: string | null
  faultPartyName?: string | null
  insuranceCode: string | null
  /** Only set after a successful commit. */
  maintenanceId?: number
}

export interface ImportSummary {
  total: number
  ready: number
  skipped: number
  imported?: number
  failed?: number
  byStatus: Partial<Record<ImportRowStatus, number>>
}

export interface ImportResponse {
  summary: ImportSummary
  rows: EvaluatedRow[]
  warnings: string[]
  batchId?: string
}

/** Request body of both preview and commit endpoints. */
export interface ImportRequestBody {
  fileName?: string
  headers: (string | number | null)[]
  rows: (string | number | null)[][]
  lineUserId?: string | null
}
