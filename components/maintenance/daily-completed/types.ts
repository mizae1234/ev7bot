export interface CompletedMaintenanceItem {
  id: number
  finish_date_key: string // YYYY-MM-DD directly from SQL
  finish_date: string | null
  start_date: string | null
  report_date: string | null
  return_date: string | null
  register_no: string | null
  vin: string
  model: string | null
  project: string | null
  issue_title: string
  status_code: string
  status_text: string
  problem_type_code: string
  problem_type: string
  car_case: string
  car_case_code: string | null
  service_location_code: string
  service_location_name: string
  repair_days: number | null
  updater_name: string
}

export interface BranchOption {
  code: string
  name: string
  count: number
}

export interface ProblemTypeOption {
  code: string
  name: string
  count: number
}

export interface DailyCompletedResponse {
  year: number
  month: number // 1-12
  items: CompletedMaintenanceItem[]
  branches: BranchOption[]
  problemTypes: ProblemTypeOption[]
  fetchedAt: string
}

export type DailyViewMode = 'calendar' | 'matrix'
export type SubBreakdownMode = 'auto' | 'case' | 'problem' | 'model' | 'none'
export type CompletionScope = 'all' | 'COMPLETE' | 'READY_PICKUP'

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

export const THAI_WEEKDAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

// Deterministic palette for dynamic branches from EV_MsSubStatus (no hardcoded branch names)
const BRANCH_PALETTES = [
  {
    pill: 'border-l-[3px] border-cyan-500 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 dark:bg-cyan-950/30',
    dot: 'bg-cyan-500',
  },
  {
    pill: 'border-l-[3px] border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/30',
    dot: 'bg-emerald-500',
  },
  {
    pill: 'border-l-[3px] border-orange-500 bg-orange-500/10 text-orange-800 dark:text-orange-300 dark:bg-orange-950/30',
    dot: 'bg-orange-500',
  },
  {
    pill: 'border-l-[3px] border-indigo-500 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/30',
    dot: 'bg-indigo-500',
  },
  {
    pill: 'border-l-[3px] border-teal-500 bg-teal-500/10 text-teal-800 dark:text-teal-300 dark:bg-teal-950/30',
    dot: 'bg-teal-500',
  },
  {
    pill: 'border-l-[3px] border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 dark:bg-amber-950/30',
    dot: 'bg-amber-500',
  },
]

const UNSPECIFIED_PALETTE = {
  pill: 'border-l-[3px] border-zinc-400 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 dark:bg-zinc-800/60',
  dot: 'bg-zinc-400',
}

export function getBranchPalette(code: string): { pill: string; dot: string } {
  if (!code || code === 'UNSPECIFIED') return UNSPECIFIED_PALETTE
  let hash = 0
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 31 + code.charCodeAt(i)) >>> 0
  }
  return BRANCH_PALETTES[hash % BRANCH_PALETTES.length]
}

export function getBangkokTodayParts(): { year: number; month: number; dateKey: string } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const [y, m] = formatted.split('-')
  return {
    year: parseInt(y, 10) || new Date().getUTCFullYear(),
    month: parseInt(m, 10) || (new Date().getUTCMonth() + 1),
    dateKey: formatted,
  }
}

export function formatDateThUtc(dateStr: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getUTCDate()
    const month = THAI_MONTHS_SHORT[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    return `${day} ${month} ${year}`
  } catch {
    return dateStr
  }
}

export function formatDateKeyFullTh(dateKey: string): string {
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey
  const y = parseInt(parts[0], 10) + 543
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  return `${d} ${THAI_MONTHS_FULL[m] || ''} ${y}`
}

export function formatDateKeyShortTh(dateKey: string): string {
  const parts = dateKey.split('-')
  if (parts.length !== 3) return dateKey
  const y = parseInt(parts[0], 10) + 543
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  return `${d} ${THAI_MONTHS_SHORT[m] || ''} ${y}`
}

export function buildSubBreakdownEntries(
  list: CompletedMaintenanceItem[],
  mode: SubBreakdownMode,
  showWhenAuto: boolean
): [string, number][] {
  const effectiveMode = mode === 'auto' ? (showWhenAuto ? 'case' : 'none') : mode
  if (effectiveMode === 'none') return []

  const counts: Record<string, number> = {}
  for (const item of list) {
    let key = ''
    if (effectiveMode === 'case') key = item.car_case && item.car_case !== '-' ? item.car_case : 'ไม่ระบุเคส'
    else if (effectiveMode === 'problem') key = item.problem_type && item.problem_type !== '-' ? item.problem_type : 'ไม่ระบุประเภท'
    else if (effectiveMode === 'model') key = item.model || 'ไม่ระบุรุ่น'
    counts[key] = (counts[key] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}
