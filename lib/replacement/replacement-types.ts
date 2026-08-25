export interface ReplacementActiveItem {
  replacementItemId: number
  maintenanceItemId: number
  // Replacement Car Info
  replacementVin: string
  replacementRegisterNo: string | null
  replacementModel: string | null
  replacementLocation: string | null
  replacementLocationName: string | null
  replacementStatus: string | null
  // Main Damaged / Repairing Car Info
  mainInventoryItemId: number | null
  mainRegisterNo: string | null
  mainVinNo: string | null
  mainModel: string | null
  mainStatus: string | null
  mainLocation: string | null
  mainLocationName?: string | null
  // Maintenance Details
  issueTitle: string | null
  maintenanceStartDate: string | null
  maintenanceFinishDate: string | null
  garageName: string | null
  technicianName: string | null
  serviceType: string | null
  // Replacement Timeline & Status
  replacementStartDate: string | null
  replacementReturnDate: string | null
  daysInUse: number
  durationStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' // <14d, 14-30d, >30d
  returnReason?: string | null
  returnReasonName?: string | null
  remark: string | null
  createUserName: string | null
  createDate: string | null
  updateUserName: string | null
  updateDate: string | null
}

export interface ReplacementPoolCar {
  inventoryItemId: string
  vinNo: string
  registerNo: string | null
  model: string | null
  exteriorColor: string | null
  interiorColor: string | null
  lot: string | null
  project: string | null
  status: string
  statusType: string
  location: string | null
  // Reservation Info
  isReserved: boolean
  isReadyToPick: boolean
  isStandbyAvailable: boolean
  poolCategory: 'REPLACEMENT_AVAILABLE' | 'AVAILABLE_USE' | 'REPLACEMENT_RESERVED' | 'MAINTENANCE'
  reservedTargetVinNo: string | null
  reservedTargetRegisterNo?: string | null
  reservedReleaseDate: string | null
  reservedRemark: string | null
  reservedType: string | null
  customerName: string | null
  totalCount?: number
}

export interface ReplacementHistoryItem {
  registerNo: string | null
  vinNo: string
  model: string | null
  vinNoReplacement: string
  replacementRegisterNo?: string | null
  replacementModel?: string | null
  replacementStartDate: string | null
  replacementReturnDate: string | null
  daysUsed: number | null
  location: string | null
  returnReason?: string | null
  returnReasonName?: string | null
  remark: string | null
  isActive: boolean
  replacementStatus: string | null
  createDate: string | null
  createName: string | null
  updateDate: string | null
  updateName: string | null
}

export interface ReplacementStatsSummary {
  totalFleet: number
  activeInUse: number
  readyToPick: number // Replacement Available (12 cars - พร้อมใช้งานทันที)
  availableUseStandby: number // Available Use (190 cars - รถ standby นำมาแปลงเป็นรถทดแทนได้)
  reservedLineman: number
  reservedOthers: number
  reservedUnassigned: number
  inMaintenance: number
  criticalDurationAlert: number // > 30 days
  warningDurationAlert: number // 14-30 days
}

export interface ReplacementFilterOptions {
  search?: string
  status?: string
  location?: string
  model?: string
  reservationType?: string
  durationFilter?: string
  page?: number
  limit?: number
}
