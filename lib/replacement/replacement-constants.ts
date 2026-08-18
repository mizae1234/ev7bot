// Format date to Thai string safely using UTC to avoid +7 hour double-offset bug
export function formatThaiDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-'
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) return '-'

    const year = d.getUTCFullYear() + 543
    const monthIndex = d.getUTCMonth()
    const day = d.getUTCDate()

    const thaiMonthsShort = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ]

    return `${day} ${thaiMonthsShort[monthIndex]} ${year}`
  } catch {
    return '-'
  }
}

// Calculate days in use between start date and now (or return date)
export function calculateDaysInUse(startDateStr: string | null, returnDateStr: string | null): number {
  if (!startDateStr) return 0
  try {
    const start = new Date(startDateStr)
    const end = returnDateStr ? new Date(returnDateStr) : new Date()
    if (isNaN(start.getTime())) return 0

    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  } catch {
    return 0
  }
}

// Duration Badge configuration
export function getDurationBadge(days: number): {
  label: string
  bg: string
  text: string
  border: string
  dot: string
  status: 'NORMAL' | 'WARNING' | 'CRITICAL'
} {
  if (days > 30) {
    return {
      label: `ใช้งาน ${days} วัน`,
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-400',
      border: 'border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-500 animate-pulse',
      status: 'CRITICAL'
    }
  }
  if (days >= 14) {
    return {
      label: `ใช้งาน ${days} วัน`,
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
      status: 'WARNING'
    }
  }
  return {
    label: `ใช้งาน ${days} วัน`,
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    status: 'NORMAL'
  }
}

// Pool Car Status & Reservation Badge
export function getPoolCarBadge(
  isReadyToPick: boolean,
  isStandbyAvailable: boolean,
  isReserved: boolean,
  reservedType: string | null,
  reservedTargetVinNo: string | null,
  status: string,
  statusType: string
): {
  label: string
  subLabel?: string
  bg: string
  text: string
  border: string
  dot: string
  category: 'READY' | 'STANDBY' | 'RESERVED_LINEMAN' | 'RESERVED_TARGET' | 'RESERVED_UNASSIGNED' | 'MAINTENANCE' | 'OTHER'
} {
  const s = (status || '').toUpperCase()
  const st = (statusType || '').toUpperCase()

  if (s === 'MAINTENANCE' || st.includes('MAINTENANCE')) {
    return {
      label: 'อยู่ระหว่างซ่อม',
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      text: 'text-rose-700 dark:text-rose-400',
      border: 'border-rose-200 dark:border-rose-800',
      dot: 'bg-rose-500',
      category: 'MAINTENANCE'
    }
  }

  // 1. Replacement Available (รถทดแทนพร้อมใช้งานทันที)
  if (isReadyToPick || st.includes('REPLACEMENT_AVAILABLE') || st.includes('REPLACEMENT AVAILABLE')) {
    return {
      label: 'พร้อมใช้ทันที (Replacement Available)',
      subLabel: 'รถทดแทนในคลัง พร้อมหยิบกุญแจจ่ายงาน',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-300 font-medium',
      border: 'border-emerald-300 dark:border-emerald-700 ring-1 ring-emerald-500/20',
      dot: 'bg-emerald-500 animate-pulse',
      category: 'READY'
    }
  }

  // 2. Available Use (รถ Standby สามารถเปลี่ยนเป็นรถทดแทนได้)
  if (isStandbyAvailable || st.includes('AVAILABLE_USE') || st.includes('AVAILABLE USE') || s === 'AVAILABLE') {
    return {
      label: 'Standby สามารถเปลี่ยนเป็นรถทดแทนได้',
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      text: 'text-sky-700 dark:text-sky-300 font-medium',
      border: 'border-sky-200 dark:border-sky-800',
      dot: 'bg-sky-500',
      category: 'STANDBY'
    }
  }

  // 3. Reserved cars
  if (isReserved || st.includes('RESERVE')) {
    const rType = (reservedType || '').toLowerCase()
    if (rType.includes('line') || rType.includes('lineman')) {
      return {
        label: 'จองให้ Line Man',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40',
        text: 'text-emerald-800 dark:text-emerald-300 font-semibold',
        border: 'border-emerald-300 dark:border-emerald-700',
        dot: 'bg-emerald-600',
        category: 'RESERVED_LINEMAN'
      }
    }
    if (reservedTargetVinNo) {
      return {
        label: 'จองให้คันหลัก',
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        text: 'text-amber-800 dark:text-amber-300 font-medium',
        border: 'border-amber-300 dark:border-amber-700',
        dot: 'bg-amber-500',
        category: 'RESERVED_TARGET'
      }
    }
    return {
      label: 'จองสำรอง (โควตากลาง)',
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-500',
      category: 'RESERVED_UNASSIGNED'
    }
  }

  if (st.includes('REPLACEMENT_CAR') || st.includes('REPLACEMENT CAR')) {
    return {
      label: 'กำลังใช้งานทดแทน',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40',
      text: 'text-indigo-700 dark:text-indigo-400',
      border: 'border-indigo-200 dark:border-indigo-800',
      dot: 'bg-indigo-500',
      category: 'OTHER'
    }
  }

  return {
    label: statusType || status || 'รถทดแทน',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
    category: 'OTHER'
  }
}
