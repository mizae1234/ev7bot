import { InsuranceMasterType, ExpiryStatus } from './policy-types'

export const DEFAULT_INSURANCE_TYPES: InsuranceMasterType[] = [
  {
    typeCode: 'DV1',
    typeName: 'ประกันภัยชั้น 1',
    category: 'VOLUNTARY',
    filePrefix: 'PLMV',
    description: 'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 1',
    sortOrder: 1,
    isActive: true
  },
  {
    typeCode: 'DV2',
    typeName: 'ประกันภัยชั้น 2',
    category: 'VOLUNTARY',
    filePrefix: 'PLMV',
    description: 'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 2',
    sortOrder: 2,
    isActive: true
  },
  {
    typeCode: 'DV3',
    typeName: 'ประกันภัยชั้น 3',
    category: 'VOLUNTARY',
    filePrefix: 'PLMV',
    description: 'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 3',
    sortOrder: 3,
    isActive: true
  },
  {
    typeCode: 'DV5',
    typeName: 'ประกันภัย 2+, 3+',
    category: 'VOLUNTARY',
    filePrefix: 'PLMV',
    description: 'ประกันภัยรถยนต์ภาคสมัครใจ ประเภท 2+ หรือ 3+',
    sortOrder: 4,
    isActive: true
  },
  {
    typeCode: 'DAC',
    typeName: 'พ.ร.บ. คุ้มครองผู้ประสบภัยจากรถ',
    category: 'COMPULSORY',
    filePrefix: 'PLMC',
    description: 'ประกันภัยภาคบังคับ (พ.ร.บ.)',
    sortOrder: 5,
    isActive: true
  },
  {
    typeCode: 'TAX_VEHICLE',
    typeName: 'ภาษีรถยนต์ประจำปี',
    category: 'TAX',
    filePrefix: null,
    description: 'ป้ายภาษี/ต่อภาษีรถยนต์ประจำปี',
    sortOrder: 6,
    isActive: true
  },
  {
    typeCode: 'TAX_METER',
    typeName: 'ภาษีตรวจมิเตอร์แท็กซี่',
    category: 'TAX',
    filePrefix: null,
    description: 'การตรวจรับรองมิเตอร์แท็กซี่ประจำปี',
    sortOrder: 7,
    isActive: true
  }
]

export function computeExpiryStatus(endDateStr?: string | null): { status: ExpiryStatus; daysLeft: number | null } {
  if (!endDateStr) return { status: 'MISSING', daysLeft: null }
  
  const target = new Date(endDateStr)
  if (isNaN(target.getTime())) return { status: 'MISSING', daysLeft: null }

  // Use UTC dates to avoid local timezone offset issues
  const now = new Date()
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const targetUTC = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  
  const diffDays = Math.ceil((targetUTC - todayUTC) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return { status: 'EXPIRED', daysLeft: diffDays }
  } else if (diffDays <= 30) {
    return { status: 'WARNING_30', daysLeft: diffDays }
  } else if (diffDays <= 60) {
    return { status: 'WARNING_60', daysLeft: diffDays }
  } else {
    return { status: 'ACTIVE', daysLeft: diffDays }
  }
}

export function formatThaiDate(dateStr?: string | null, includeBuddhistYear = true): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'

  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const year = includeBuddhistYear ? d.getUTCFullYear() + 543 : d.getUTCFullYear()

  return `${day}/${month}/${year}`
}

export function getExpiryBadge(status: ExpiryStatus, daysLeft: number | null) {
  switch (status) {
    case 'EXPIRED':
      return {
        label: `หมดอายุแล้ว (${Math.abs(daysLeft ?? 0)} วัน)`,
        bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
        dot: 'bg-rose-500'
      }
    case 'WARNING_30':
      return {
        label: `เหลือ ${daysLeft} วัน`,
        bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        dot: 'bg-amber-500'
      }
    case 'WARNING_60':
      return {
        label: `เหลือ ${daysLeft} วัน`,
        bg: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
        dot: 'bg-yellow-500'
      }
    case 'ACTIVE':
      return {
        label: `ปกติ (${daysLeft} วัน)`,
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500'
      }
    case 'MISSING':
    default:
      return {
        label: 'ไม่มีข้อมูล',
        bg: 'bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20',
        dot: 'bg-zinc-400'
      }
  }
}
