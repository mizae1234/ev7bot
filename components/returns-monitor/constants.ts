// =====================================================
// Returns Monitor — Shared Constants & Utilities
// =====================================================

export const SPACES_ENDPOINT = 'https://sgp1.digitaloceanspaces.com'
export const SPACES_BUCKET = 'space-ev7tracking-prod'

export function getSpacesCDN(): string {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('spaces_cdn')
    if (cached) return cached
  }
  return SPACES_ENDPOINT.replace('https://', `https://${SPACES_BUCKET}.`)
}

// ─── Checklist Option Sets ───────────────────────────
export const LICENSE_PLATE_OPTIONS = [
  { value: 'FRONT_BACK', label: 'ป้ายทะเบียนหน้า-หลัง' },
  { value: 'FRONT_ONLY', label: 'ป้ายทะเบียนหน้า' },
  { value: 'BACK_ONLY', label: 'ป้ายทะเบียนหลัง' },
  { value: 'NONE', label: 'ไม่มีป้ายทะเบียนรถมา' },
] as const

export const BOOLEAN_OPTIONS = [
  { value: 'YES', label: 'มี' },
  { value: 'NO', label: 'ไม่มี' },
] as const

export const BODY_CONDITION_OPTIONS = [
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'SCRATCH', label: 'มีรอยขีดข่วน' },
  { value: 'DENT', label: 'บุบ-แตก' },
] as const

// ─── Assessment Labels ───────────────────────────────
export const ASSESSMENT_MAP: Record<string, string> = {
  NORMAL: 'ปกติ',
  NEED_REPAIR: 'ต้องส่งเข้าซ่อม',
}

export function getAssessmentLabel(code: string | null | undefined): string {
  if (!code) return 'รอผลการตรวจ'
  return ASSESSMENT_MAP[code] || 'รอผลการตรวจ'
}

// ─── Return Reason Labels (Dynamic from DB Master EV_MsSubStatus) ────
export function getReasonLabel(nameOrCode: string | null | undefined): string {
  if (!nameOrCode) return '-'
  return nameOrCode
}

// ─── Date Formatting (UTC to avoid double-offset) ────
export function getThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
  } catch {
    return String(dateStr)
  }
}

export function getThaiDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    })
  } catch {
    return String(dateStr)
  }
}

// ─── Name Masking (Data Privacy Rule: show only first name) ───
export function maskName(name?: string | null): string {
  if (!name) return '-'
  const trimmed = name.trim()
  if (!trimmed) return '-'
  const parts = trimmed.split(/\s+/)
  if (parts.length <= 1) return trimmed
  if (parts[0] === 'คุณ' && parts.length > 1) {
    return `คุณ ${parts[1]}`
  }
  return parts[0]
}

// ─── Pagination Defaults ─────────────────────────────
export const PAGE_SIZE = 25

