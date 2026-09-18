import { QCItemStatusResult } from './types'

/**
 * Returns Bangkok current date formatted as YYYY-MM-DD
 */
export function getBangkokTodayYMD(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

/**
 * Returns yesterday's date in Bangkok timezone (YYYY-MM-DD)
 */
export function getYesterdayBangkokYMD(): string {
  const d = new Date(Date.now() - 86400000)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(d)
}

/**
 * Returns 7 days ago date in Bangkok timezone (YYYY-MM-DD)
 */
export function getSevenDaysAgoBangkokYMD(): string {
  const d = new Date(Date.now() - 7 * 86400000)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(d)
}

/**
 * Extracts YYYY-MM-DD from inspectionDate string using UTC
 */
export function getInspectionDateYMD(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return (dateStr || '').slice(0, 10)
  }
}

/**
 * Masks staff full name to show only first name (Data Privacy Compliance)
 */
export function maskStaffName(name?: string | null): string {
  if (!name) return '-'
  const clean = name.trim()
  const parts = clean.split(/\s+/)
  return parts[0] || '-'
}

/**
 * Formats date/time string with Bangkok UTC-safe conversion to prevent double +7 offset
 */
export function getThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('th-TH', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Returns appropriate intuitive emoji for checklist category (with dynamic fallback)
 */
export function getQCItemIcon(category: string): string {
  const cat = (category || '').toUpperCase()
  if (cat.includes('CLEAN')) return '🧼'
  if (cat.includes('KEY')) return '🔑'
  if (cat.includes('TAX') && cat.includes('VEHICLE')) return '📄'
  if (cat.includes('TAX') || cat.includes('METER')) return '⏱️'
  if (cat.includes('PARK') || cat.includes('POSITION')) return '📍'
  if (cat.includes('BATTERY')) return '🔋'
  if (cat.includes('QR')) return '📱'
  if (cat.includes('WIPER')) return '🌧️'
  if (cat.includes('TIRE')) return '🛞'
  if (cat.includes('CAM')) return '📹'
  if (cat.includes('LIGHT')) return '💡'
  if (cat.includes('SEAT')) return '💺'
  if (cat.includes('BRAKE')) return '🛑'
  return '📋'
}

/**
 * Dynamically resolves item label from DB Master items (supporting PascalCase and camelCase properties)
 */
export function getQCItemLabel(category: string, itemCode: string, masterItems?: any[]): string {
  if (masterItems && masterItems.length > 0) {
    const found = masterItems.find(m => {
      const mCat = m.Category || m.category
      const mCode = m.ItemCode || m.itemCode
      return mCat === category && mCode === itemCode
    })
    const label = found?.Label || found?.labelTh || found?.label
    if (label) return label
  }

  // Fallback defaults if master is loading or not yet loaded
  switch (category) {
    case 'QC_CLEAN':
    case 'QC_CLEANLINESS':
      return '1. ความสะอาด ภายนอก - ภายใน'
    case 'QC_KEY':
      return '2. กุญแจพร้อม'
    case 'QC_TAX_VEHICLE':
      return '3. ทะเบียนเหลือมากกว่า 3 เดือน'
    case 'QC_TAX_METER':
      return '4. ภาษีมิเตอร์เหลือมากกว่า 1 เดือน'
    case 'QC_PARK_POSITION':
      return '5. รถอยู่ในตำแหน่งพร้อมส่ง'
    case 'QC_BATTERY_HV':
      return '6. ไฟแบตลูกใหญ่มากกว่า 40%'
    case 'QC_QR_CODE':
      return '7. QR code มี-ไม่มี'
    case 'QC_WIPER':
      return '8. ยางปัดน้ำฝน'
    case 'QC_TIRE':
      return '9. ยางรถ'
    default:
      return `${category} - ${itemCode}`
  }
}

/**
 * Evaluates the status of an inspection item dynamically
 */
export function formatQCItemStatus(category: string, item?: any): QCItemStatusResult {
  if (!item) return { label: 'ยังไม่ตรวจ', isGood: false }

  const cat = (category || '').toUpperCase()
  if (cat.includes('BATTERY')) {
    if (item.numericValue != null) {
      const num = Number(item.numericValue)
      const ok = num >= 40
      return {
        label: `${num}% ${ok ? '🟢' : '⚠️'}`,
        isGood: ok,
        detail: item.detail || (ok ? null : 'ต่ำกว่า 40%')
      }
    }
    return { label: item.value || '-', isGood: true, detail: item.detail }
  }

  const val = item.value
  let label = val || '-'
  let isGood = true

  if (val === 'CLEAN') label = 'สะอาดพร้อม ✅'
  else if (val === 'NOT_CLEAN') { label = 'ไม่สะอาด 🔴'; isGood = false }
  else if (val === 'READY') label = 'พร้อมใช้งาน ✅'
  else if (val === 'NO_KEY') { label = 'ไม่มีกุญแจ 🔴'; isGood = false }
  else if (val === 'YES' || val === 'PASS' || val === 'NORMAL') label = 'พร้อม / มี ✅'
  else if (val === 'NO' || val === 'FAIL' || val === 'ABNORMAL') { label = 'ไม่มี / ขาด 🔴'; isGood = false }
  else if (val === 'PARK_READY') label = 'จอดพร้อมส่ง ✅'
  else if (val === 'NOT_READY') { label = 'ยังไม่พร้อม 🔴'; isGood = false }
  else if (val === 'WORN_OUT') { label = 'เสื่อมสภาพ 🔴'; isGood = false }

  return { label, isGood, detail: item.detail }
}
