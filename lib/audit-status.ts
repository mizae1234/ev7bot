// Vehicle Status display utilities for Audit system
// Maps raw status codes to Thai labels and color schemes

export interface StatusStyle {
  label: string
  bg: string
  border: string
  text: string
}

// Status/StatusType → Thai label mapping
const STATUS_LABEL_MAP: Record<string, string> = {
  // VehicleStatus (when no StatusType)
  'ON_RENT': 'ให้เช่าอยู่',
  'AVAILABLE': 'รถพร้อม',
  'MAINTENANCE': 'ซ่อมบำรุง',
  'REPLACEMENT': 'รถทดแทน',
  'SOLD': 'ขายแล้ว',
  'WRITTEN_OFF': 'ตัดบัญชี',

  // StatusType values
  'AVAILABLE_NEW': 'รถใหม่พร้อมใช้',
  'AVAILABLE_USE': 'รถใช้แล้วพร้อมใช้',
  'ON_RENT_MAINTENANCE': 'เช่าอยู่-ส่งซ่อม',
  'USE_MAINTENANCE': 'ใช้แล้ว-ส่งซ่อม',
  'NEW_MAINTENANCE': 'ใหม่-ส่งซ่อม',
  'REPLACEMENT_MAINTENANCE': 'ทดแทน-ส่งซ่อม',
  'REPLACEMENT_CAR': 'รถทดแทน (ใช้งาน)',
  'REPLACEMENT_AVAILABLE': 'รถทดแทน (ว่าง)',
}

// Color scheme by status category
const STATUS_COLORS: { match: (key: string) => boolean; style: Omit<StatusStyle, 'label'> }[] = [
  {
    match: (k) => k.includes('ON_RENT') || k.includes('ON RENT') || k.includes('ให้เช่า') || k.includes('เช่าอยู่'),
    style: { bg: 'bg-violet-500/15', border: 'border-violet-500/25', text: 'text-violet-300' },
  },
  {
    match: (k) => k.includes('AVAILABLE') || k.includes('พร้อม'),
    style: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', text: 'text-emerald-300' },
  },
  {
    match: (k) => k.includes('MAINTENANCE') || k.includes('ซ่อม'),
    style: { bg: 'bg-amber-500/15', border: 'border-amber-500/25', text: 'text-amber-300' },
  },
  {
    match: (k) => k.includes('REPLACEMENT') || k.includes('ทดแทน'),
    style: { bg: 'bg-sky-500/15', border: 'border-sky-500/25', text: 'text-sky-300' },
  },
  {
    match: (k) => k.includes('ไม่ทราบ'),
    style: { bg: 'bg-slate-500/15', border: 'border-slate-500/25', text: 'text-slate-400' },
  },
]

const DEFAULT_STYLE: Omit<StatusStyle, 'label'> = {
  bg: 'bg-indigo-500/15',
  border: 'border-indigo-500/25',
  text: 'text-indigo-300',
}

/**
 * Get Thai label for a raw status code.
 * Falls back to the raw code if no mapping is found.
 */
export function getStatusThaiLabel(rawLabel: string): string {
  // Check exact match first
  const upperKey = rawLabel.toUpperCase().trim()
  if (STATUS_LABEL_MAP[upperKey]) return STATUS_LABEL_MAP[upperKey]

  // Check if the label is already Thai (from MsSubStatus.StatusName join)
  // If it contains Thai characters, return as-is
  if (/[\u0E00-\u0E7F]/.test(rawLabel)) return rawLabel

  // Fallback to raw
  return rawLabel
}

/**
 * Get color style for a status label.
 */
export function getStatusColor(label: string): Omit<StatusStyle, 'label'> {
  const upper = label.toUpperCase()
  for (const rule of STATUS_COLORS) {
    if (rule.match(upper) || rule.match(label)) return rule.style
  }
  return DEFAULT_STYLE
}

/**
 * Get full StatusStyle (label + colors) for a raw status code.
 */
export function getStatusStyle(rawLabel: string): StatusStyle {
  const label = getStatusThaiLabel(rawLabel)
  const colors = getStatusColor(label)
  return { label, ...colors }
}
