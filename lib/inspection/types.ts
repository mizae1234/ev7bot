// =====================================================
// Vehicle Inspection Checklist — Shared Types
// =====================================================

/** ประเภทการตรวจ */
export type InspectionType = 'RETURN' | 'AUDIT'

/** สถานะ Inspection */
export type InspectionStatus = 'DRAFT' | 'COMPLETED'

/** สถานะ Audit Session */
export type AuditSessionStatus = 'OPEN' | 'CLOSED'

// ------- Input Types for checklist items -------

/** ประเภท input ของ checklist item */
export type ChecklistInputType = 'select' | 'boolean' | 'boolean_expiry' | 'number' | 'three_way' | 'photos_only'

/** Option สำหรับ select/boolean/three_way */
export interface ChecklistOption {
  value: string
  label: string
}

/** นิยาม checklist item 1 ข้อ (template) */
export interface ChecklistItemDef {
  category: string
  itemCode: string
  label: string
  inputType: ChecklistInputType
  options?: ChecklistOption[]
  hasExpiry?: boolean        // มีช่อง วันหมดอายุ
  hasPhoto?: boolean         // มีช่องอัปโหลดรูป (default: true)
  photoPositions?: string[]  // ถ้าต้องถ่ายหลายมุม (เช่น FRONT, BACK, LEFT, RIGHT)
  required?: boolean         // บังคับกรอก (default: false, เพราะ DRAFT ไม่บังคับ)
}

/** นิยาม section 1 หมวด */
export interface ChecklistSectionDef {
  category: string
  label: string
  icon: string
  items: ChecklistItemDef[]
}

// ------- Data (saved/loaded) -------

/** ค่าที่กรอกใน checklist item 1 ข้อ */
export interface InspectionItemData {
  inspectionItemId?: number  // จาก DB (ถ้า load มา)
  category: string
  itemCode: string
  value: string | null
  detail: string | null
  numericValue: number | null
  expiryDate: string | null  // 'YYYY-MM-DD'
}

/** รูปภาพ 1 รูป */
export interface InspectionPhotoData {
  inspectionPhotoId?: number
  category: string
  itemCode: string | null
  photoPosition: string | null
  s3Key: string
  fileName: string
  fileSize: number | null
  contentType: string | null
}

/** รูปภาพที่ยังไม่ upload (อยู่ใน client) */
export interface PendingPhoto {
  id: string                 // client-side unique id
  category: string
  itemCode: string | null
  photoPosition: string | null
  file: File
  previewUrl?: string
}

/** Inspection header (saved/loaded) */
export interface InspectionData {
  inspectionId?: number
  vinNo: string
  registerNo: string | null
  inspectionType: InspectionType
  returnItemId: number | null
  inspectionSessionId: number | null
  mileage: number | null
  inspectionDate: string     // 'YYYY-MM-DD'
  inspectorUserID: number | null
  inspectorName: string | null
  status: InspectionStatus
  remark: string | null
  items: InspectionItemData[]
  photos: InspectionPhotoData[]
  returnDate?: string
  location?: string
  rentItemId?: number | null
  contractNo?: string | null
  returnReason?: string | null
  customerName?: string | null
  customerContact?: string | null
  contractCancellationDate?: string | null
  isPendingChecklist?: boolean | null
  model?: string | null
  project?: string | null
  locationName?: string | null
  assessmentResult?: string | null
}

/** Inspection list item (สำหรับแสดงรายการ) */
export interface InspectionListItem {
  inspectionId: number
  vinNo: string
  registerNo: string | null
  inspectionType: InspectionType
  inspectionDate: string
  inspectorName: string | null
  status: InspectionStatus
  mileage: number | null
  itemCount: number
  photoCount: number
  createDate: string
  updateDate?: string | null
  location?: string | null
  locationName?: string
  returnReason?: string | null
  assessmentResult?: string | null
  customerName?: string | null
  customerContact?: string | null
  contractCancellationDate?: string | null
  isPendingChecklist?: boolean | null
  createdByName?: string | null
  updatedByName?: string | null
  damagedCount?: number
  damagedItems?: Array<{
    category: string
    categoryLabel: string
    categoryIcon: string
    itemCode: string
    label: string
    value: string
    valueLabel: string
    detail?: string | null
  }>
}

/** Audit Session */
export interface AuditSessionData {
  inspectionSessionId: number
  sessionName: string
  sessionDate: string
  location: string | null
  locationName?: string
  status: AuditSessionStatus
  notes: string | null
  createdBy: number | null
  inspectionCount?: number
}

// ------- API Request/Response -------

export interface CreateInspectionRequest {
  vinNo: string
  registerNo?: string
  inspectionType: InspectionType
  returnItemId?: number
  inspectionSessionId?: number
  mileage?: number
  inspectionDate: string
  remark?: string
  items: InspectionItemData[]
  lineUserId?: string       // จะ resolve เป็น ev7UserId ใน API
  returnDate?: string
  location?: string
  inspectorName?: string
  returnReason?: string
  customerName?: string | null
  customerContact?: string | null
  contractCancellationDate?: string | null
  isPendingChecklist?: boolean
}

export interface UpdateInspectionRequest {
  inspectionId: number
  mileage?: number
  remark?: string
  status?: InspectionStatus
  items: InspectionItemData[]
  lineUserId?: string
  returnDate?: string
  location?: string
  inspectorName?: string
  returnReason?: string
  customerName?: string | null
  customerContact?: string | null
  contractCancellationDate?: string | null
  isPendingChecklist?: boolean
}

export type { MasterItemDef } from './checklist-config'
