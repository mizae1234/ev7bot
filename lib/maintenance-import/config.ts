/**
 * Central configuration for the maintenance (accident claim) Excel import.
 * Everything that may change with the insurer's report format or business rules
 * lives here — import logic must not hard-code these values.
 */

/** Logical field → accepted Excel header names (first matching header wins). */
export const HEADER_ALIASES = {
  claimNumber: ['เลขเคลม'],
  jobNo: ['เลขงาน'],
  registerNo: ['ทะเบียน'],
  model: ['รุ่น'],
  incidentDate: ['วันที่เกิดเหตุ'],
  issueTitle: ['ลักษณะการเกิดเหตุ'],
  driverName: ['ผู้ขับขี่'],
  reporterName: ['ผู้แจ้งเหตุ'],
  faultSummary: ['สรุปความประมาท'],
  insuranceCompany: ['บริษัทประกัน'],
} as const

export type ImportField = keyof typeof HEADER_ALIASES

/** Fields the file must contain, otherwise the whole file is rejected. */
export const REQUIRED_FIELDS: ImportField[] = ['claimNumber', 'registerNo', 'incidentDate', 'issueTitle']

export const IMPORT_CONFIG = {
  /** Max data rows accepted per import. */
  maxRows: 500,
  /** Max values per SQL IN (...) list (SQL Server limit is ~2100 parameters). */
  sqlChunkSize: 500,
  /** How long the "นำเข้าเสร็จสิ้น" dialog stays before closing itself (ms). */
  successDialogMs: 2500,
  /** Status of every imported ticket: reported, car not yet in the workshop. */
  initialCarStatusCode: 'STILL_WORK',
  /** Imported file is an accident-claim report. */
  problemTypeCode: 'ACCIDENT',
  /** Shown while ServiceLocationCode is NULL; the user picks the real one later. */
  unspecifiedLocationLabel: 'ยังไม่ระบุสถานที่',
  /** Used when สรุปความประมาท is neither driver nor counterparty. */
  fallbackFaultPartyCode: 'OTHER',
  /** Ticket statuses that count as closed (vehicle may receive a new ticket). */
  closedCarStatusCodes: ['COMPLETE', 'GARAGE_COMPLETE'],
  /** EV_MsSubStatus.Type values used to validate mapped codes. */
  masterTypes: {
    faultParty: 'FAULT_PARTY',
    insurance: 'INSURANCE',
    problemType: 'MAINTENANCE_PROBLEM_TYPE',
  },
} as const

/**
 * สรุปความประมาท → FaultPartyCode. `codes` are candidates (the repo has seen both
 * DRIVER and FAULT_DRIVER); the first one that exists in the master table is used.
 */
export const FAULT_PARTY_RULES: { match: string; codes: string[] }[] = [
  { match: 'รถประกันประมาท', codes: ['DRIVER', 'FAULT_DRIVER'] },
  { match: 'รถคู่กรณีประมาท', codes: ['COUNTERPART', 'FAULT_COUNTERPARTY'] },
]

/** บริษัทประกัน (substring match) → InsuranceCode. */
export const INSURANCE_RULES: { match: string; code: string }[] = [
  { match: 'ไอแคร์', code: 'ICARE_INSURANCE' },
]
