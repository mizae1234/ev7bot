export type InsuranceCategory = 'VOLUNTARY' | 'COMPULSORY' | 'TAX'

export interface InsuranceMasterType {
  typeCode: string
  typeName: string
  category: InsuranceCategory
  filePrefix: string | null
  description: string | null
  sortOrder: number
  isActive: boolean
}

export interface InsuranceCompanyOption {
  statusCode: string
  statusName: string
}

export type ExpiryStatus = 'ACTIVE' | 'WARNING_60' | 'WARNING_30' | 'EXPIRED' | 'MISSING'

export interface PolicyVehicleRecord {
  inventoryItemId?: string | null
  vinNo: string
  registerNo: string | null
  model: string | null
  project: string | null
  projectType: string | null
  currentLocation: string | null
  locationName?: string | null
  status: string | null
  statusType: string | null
  statusName?: string | null
  
  // Insurance (PLMV - Voluntary)
  insurancePolicyNo: string | null
  insuranceType: string | null
  insuranceTypeName?: string | null
  insuranceStartDate: string | null
  insuranceEndDate: string | null
  insuranceFilePath: string | null
  insuranceCompany: string | null
  insuranceStatus: ExpiryStatus
  insuranceDaysLeft: number | null

  // Act (PLMC - Compulsory)
  actPolicyNo: string | null
  actStartDate: string | null
  actEndDate: string | null
  actFilePath: string | null
  actCompany: string | null
  actStatus: ExpiryStatus
  actDaysLeft: number | null

  // Vehicle Tax (ภาษีรถยนต์ประจำปี)
  vehicleTaxStartDate: string | null
  vehicleTaxEndDate: string | null
  vehicleTaxFilePath?: string | null
  vehicleTaxStatus: ExpiryStatus
  vehicleTaxDaysLeft: number | null

  // Meter Tax (ภาษีตรวจมิเตอร์แท็กซี่)
  meterTaxStartDate: string | null
  meterTaxEndDate: string | null
  meterTaxFilePath?: string | null
  meterTaxStatus: ExpiryStatus
  meterTaxDaysLeft: number | null

  // Driver / Active Contract Info
  contractNo?: string | null
  customerName?: string | null
  phoneNo?: string | null

  updatedAt?: string | null
}

export interface PolicyStatsSummary {
  totalVehicles: number
  insuranceExpiring30: number
  insuranceExpiring60: number
  insuranceExpired: number
  insuranceMissing: number
  actExpiring30: number
  actExpiring60: number
  actExpired: number
  actMissing: number
  taxExpiring30: number
  taxExpiring60: number
  taxExpired: number
  taxMissing: number
  meterExpiring30: number
  meterExpiring60: number
  meterExpired: number
  meterMissing: number
  totalWithPolicy: number
  totalMissingAll: number
  totalMissingAny: number
}

export interface ParsedPolicyFile {
  originalFileName: string
  fileSize: number
  prefix: 'PLMV' | 'PLMC' | 'UNKNOWN'
  docType: 'INSURANCE' | 'ACT' | 'UNKNOWN'
  policyType: string | null // DV1, DV2, DV3, DV5, DAC
  policyTypeName: string | null
  vinNo: string | null
  policyNo: string | null
  rawExpiryBuddhist: string | null // e.g. 17082569
  expiryDateStr: string | null     // e.g. 2026-08-17
  startDateStr: string | null      // e.g. 2025-08-18 (default estimated 1 yr)
  matchedVehicle?: {
    inventoryItemId: string
    registerNo: string | null
    model: string | null
    project: string | null
  } | null
  isValid: boolean
  validationError?: string | null
}

export interface PolicyLogItem {
  logId: string
  vinNo: string
  registerNo: string | null
  docType: string
  policyType: string | null
  policyTypeName: string | null
  policyNo: string | null
  insuranceCompany?: string | null
  startDate: string | null
  endDate: string | null
  originalFileName: string | null
  filePath: string | null
  fileSize: number | null
  uploadSource: string
  isCurrent: boolean
  remark: string | null
  createDate: string
  createUserName?: string | null
}
