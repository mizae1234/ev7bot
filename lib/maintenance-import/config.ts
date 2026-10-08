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

/** How strongly the importer needs a column — drives the highlight colour in the template. */
export type FieldLevel = 'required' | 'optional' | 'reference'

/** Template column order (required first). Header text = first alias in HEADER_ALIASES. */
export const TEMPLATE_COLUMN_ORDER: ImportField[] = [
  'claimNumber',
  'registerNo',
  'incidentDate',
  'issueTitle',
  'driverName',
  'reporterName',
  'faultSummary',
  'insuranceCompany',
  'jobNo',
  'model',
]

/**
 * Human-readable help per column (guide sheet of the template).
 * `required` fields come from REQUIRED_FIELDS; `level` only matters for the others.
 */
export const FIELD_META: Record<ImportField, { level: FieldLevel; description: string; format?: string; example: string }> = {
  claimNumber: {
    level: 'required',
    description: 'เลขเคลมของบริษัทประกัน ใช้ตรวจข้อมูลซ้ำ (แถวที่ไม่มีเลขเคลม หรือเลขเคลมมีในระบบแล้ว จะถูกข้าม)',
    example: 'ME260091815',
  },
  registerNo: {
    level: 'required',
    description: 'ทะเบียนรถ ใส่ขีดหรือเว้นวรรคหรือไม่ก็ได้ ต้องเป็นรถที่มีในระบบ',
    example: 'ทอ-8100',
  },
  incidentDate: {
    level: 'required',
    description: 'วันที่และเวลาที่เกิดเหตุ (ปี ค.ศ. หรือ พ.ศ. ก็ได้)',
    format: 'dd/MM/yyyy HH:mm',
    example: '20/08/2026 06:50',
  },
  issueTitle: {
    level: 'required',
    description: 'ลักษณะการเกิดเหตุ ใช้เป็น "อาการ" ของใบแจ้งซ่อม',
    example: 'ออกจากซอยชนคู่กรณี',
  },
  driverName: {
    level: 'optional',
    description: 'ชื่อผู้ขับขี่ ถ้าเว้นว่างจะใช้ชื่อ "ผู้แจ้งเหตุ" แทน',
    example: 'สมชาย ใจดี',
  },
  reporterName: {
    level: 'optional',
    description: 'ผู้แจ้งเหตุ ใช้เฉพาะเมื่อไม่มีชื่อผู้ขับขี่',
    example: 'สมชาย ใจดี',
  },
  faultSummary: {
    level: 'optional',
    description: 'สรุปความประมาท ใช้กำหนดฝ่ายที่ผิด (ค่าอื่นหรือเว้นว่าง = อื่นๆ)',
    example: 'รถประกันประมาท',
  },
  insuranceCompany: {
    level: 'optional',
    description: 'บริษัทประกัน ใช้กำหนดรหัสประกัน (ชื่อที่ระบบไม่รู้จักจะเว้นว่างไว้)',
    example: 'ไอแคร์ ประกันภัย จำกัด (มหาชน)',
  },
  jobNo: {
    level: 'reference',
    description: 'เลขงานของระบบประกัน เก็บไว้ใน log การนำเข้าเท่านั้น',
    example: 'ME260091815',
  },
  model: {
    level: 'reference',
    description: 'รุ่นรถ ใช้อ้างอิงเท่านั้น ระบบดึงรุ่นจากทะเบียนเอง',
    example: 'Y PLUS',
  },
}

/**
 * Column headers of the insurer's report, in the original order (70 columns, incl. the repeated
 * "เบอร์โทร"). The template reproduces them exactly so users can paste the report straight in.
 * Only columns matched by HEADER_ALIASES are used by the importer; the rest are kept in the import log.
 */
export const TEMPLATE_HEADERS: string[] = [
  "เลขงาน",
  "เลขเรื่องเซอร์เวย์",
  "บริษัทประกัน",
  "เลขรับแจ้งบริษัทประกัน",
  "เลขเคลม",
  "เลขที่กรมธรรม์",
  "สถานะงาน",
  "ประเภทงาน",
  "ประเภทงานคัดลอก",
  "เหตุผลการยกเลิก",
  "วิดีโอคอล",
  "เคยเป็นวิดีโอคอล",
  "สถานะอนุมัติเคลม",
  "ระยะการเดินทาง (m)",
  "ทะเบียน",
  "จังหวัดทะเบียน",
  "ยี่ห้อ",
  "รุ่น",
  "วันที่เกิดเหตุ",
  "วันที่นัดหมาย",
  "ภาค",
  "ลักษณะการเกิดเหตุ",
  "จังหวัดที่เกิดเหตุ",
  "อำเภอ / เขต ที่เกิดเหตุ",
  "ตำบล / แขวง ที่เกิดเหตุ",
  "สรุปความประมาท",
  "การเรียกร้อง",
  "เคลมหนัก",
  "เรียกร้อง",
  "ประมาณการค่าเสียหายรถประกัน",
  "จำนวนผู้บาดเจ็บ",
  "ค่าประมาณเสียหายรวมผู้บาดเจ็บ",
  "จำนวนคู่กรณี",
  "ค่าประมาณเสียหายรวมคู่กรณี",
  "ผู้แจ้งเหตุ",
  "เบอร์โทร",
  "ผู้ขับขี่",
  "เบอร์โทร",
  "ผู้เอาประกัน",
  "เบอร์โทร",
  "พนักงานรับแจ้ง",
  "วันที่รับแจ้ง",
  "วันที่สร้างงาน",
  "พนักงานจ่ายงาน",
  "วันที่จ่ายงาน",
  "พนักงานตรวจสอบ",
  "เคลมช่วย",
  "บริษัทช่วยวิ่ง",
  "วันที่รับงาน",
  "วันที่ออกเดินทาง",
  "วันที่ถึงที่นัดหมาย",
  "วันที่อนุมัติเสร็จสิ้นหน้างาน",
  "วันที่ปฏิบัติงานเสร็จ",
  "สาเหตุการถึงที่หมายเกินกำหนด",
  "รายละเอียด",
  "วันที่ส่งงานครั้งแรก",
  "วันที่ส่งงานล่าสุด",
  "AHT วันที่ส่งงานครั้งแรก - วันที่อนุมัติครั้งแรก",
  "วันที่อนุมัติครั้งแรก",
  "ระยะเวลาทำงานหัวหน้างาน",
  "ผู้อนุมัติครั้งแรก",
  "วันที่อนุมัติล่าสุด",
  "ผู้อนุมัติล่าสุด",
  "วันที่เสร็จสิ้นครั้งแรก",
  "ผู้อนุมัติเสร็จสิ้นครั้งแรก",
  "วันที่เสร็จสิ้นล่าสุด",
  "ผู้อนุมัติเสร็จสิ้นล่าสุด",
  "วันที่อนุมัติฝั่งประกัน",
  "ผู้อนุมัติฝั่งประกัน",
  "เหตุผลการตีกลับงาน",
]

export const TEMPLATE_CONFIG = {
  fileName: 'template_import_งานซ่อม',
  dataSheetName: 'ข้อมูลนำเข้า',
  guideSheetName: 'คำอธิบาย',
  /** Pre-formatted (coloured, text-format) empty rows in the data sheet. */
  prefilledRows: 200,
  colors: {
    required: { header: 'C00000', cell: 'FFF2CC', label: 'จำเป็นต้องกรอก' },
    optional: { header: '2F75B5', cell: 'DDEBF7', label: 'ควรกรอก (ถ้ามี)' },
    reference: { header: '7F7F7F', cell: 'EDEDED', label: 'อ้างอิง (ไม่บังคับ)' },
    ignored: { header: '595959', cell: 'FFFFFF', label: 'ไม่ไฮไลท์ = ไม่ใช้นำเข้า (เก็บไว้ใน log)' },
  },
} as const
