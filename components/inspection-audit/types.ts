export interface QCPhoto {
  inspectionPhotoId: number
  category: string
  itemCode: string
  photoPosition?: string | null
  s3Key: string
  fileName?: string | null
}

export interface QCItem {
  inspectionItemId: number
  category: string
  itemCode: string
  value: string | null
  detail: string | null
  numericValue?: number | null
  expiryDate?: string | null
}

export interface QCRecord {
  inspectionId: number
  vinNo: string
  registerNo: string | null
  inspectionType?: string
  inspectionDate: string
  inspectorName: string
  status?: string
  mileage?: number
  createDate?: string
  location?: string
  locationName?: string
  assessmentResult?: string
  remark?: string
  itemCount?: number
  itemsCount?: number
  model?: string | null
  photoCount?: number
  photosCount?: number
  photos?: QCPhoto[]
  items?: QCItem[]
}

export type QCDatePreset = 'today' | 'yesterday' | '7days' | 'all' | 'custom'
export type QCViewMode = 'cards' | 'table'
export type QCStatusFilter = 'ALL' | 'PASS' | 'FAIL'

export interface QCItemStatusResult {
  label: string
  isGood: boolean
  detail?: string | null
}
