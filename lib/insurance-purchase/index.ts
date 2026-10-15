// Client-side helpers for the iCare "getAllService" API (ข้อมูลการซื้อประกัน).
// Like Case Delivery, this API is called from the browser (bypasses Cloudflare).

import { ev7CoreGet, EV7_CORE_UNAVAILABLE_MESSAGE } from '@/lib/ev7-core-api'

export interface InsuranceServiceItem {
  ServiceContractNo: string
  ServiceContractDate: string
  ServiceStatus: string
  ServiceCreateDate: string
  InsuranceName: string
  InsurancePrice: number
  InsurancePriceDay: number
  InsuranceStartDate: string
  InsuranceEndDate: string
  ContractNo: string
  VinNo: string
  MotorNo: string
  RegisterNo: string
  CarSeries: string
  CarModel: string
  CarRentPerDay: number
  totalRentPerDay: number
  GetCarDate: string
  Prefix: string
  FirstName: string
  LastName: string
  Tel: string
  Email: string
  Birthday: string
  IdentityCard: string
  Address: string
  District: string
  Amphure: string
  Province: string
  Zipcode: string
}

/** Minimal fields needed for the /policies conflict check (no customer PII kept in memory) */
export type ServiceBrief = Pick<
  InsuranceServiceItem,
  'VinNo' | 'ServiceStatus' | 'ServiceContractNo' | 'InsuranceName' | 'InsuranceStartDate' | 'InsuranceEndDate'
>

export function toServiceBrief(d: InsuranceServiceItem): ServiceBrief {
  return {
    VinNo: d.VinNo,
    ServiceStatus: d.ServiceStatus,
    ServiceContractNo: d.ServiceContractNo,
    InsuranceName: d.InsuranceName,
    InsuranceStartDate: d.InsuranceStartDate,
    InsuranceEndDate: d.InsuranceEndDate,
  }
}

export interface FetchServiceParams {
  insurance_start_date?: string // YYYY-MM-DD
  create_date?: string // YYYY-MM-DD
  vin_no?: string
  contract_no?: string
}

export async function fetchAllService(params: FetchServiceParams = {}): Promise<InsuranceServiceItem[]> {
  const res = await ev7CoreGet('getAllService', { ...params })

  let body: { statusCode?: number; message?: string | { list?: InsuranceServiceItem[] } } | null = null
  try {
    body = await res.json()
  } catch {
    // non-JSON response
  }

  if (!res.ok || (body && body.statusCode && body.statusCode !== 200)) {
    // Log details for developers; show only a generic message in the UI
    console.error('[EV7 Core] getAllService failed', { http: res.status, statusCode: body?.statusCode, message: body?.message })
    throw new Error(EV7_CORE_UNAVAILABLE_MESSAGE)
  }

  const message = body?.message
  return (typeof message === 'object' && message?.list) || []
}

// ---------- Date helpers ----------

/** Normalises API date strings (ISO, YYYY-MM-DD, dd/mm/yyyy [hh:mm]) to YYYY-MM-DD, or null. */
export function toISODate(value?: string | null): string | null {
  if (!value) return null
  const s = String(value).trim()
  if (!s) return null

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) {
    let y = parseInt(dmy[3], 10)
    if (y > 2400) y -= 543
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  }

  // ISO timestamp with timezone → convert to Bangkok calendar date
  if (/T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
    }
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return null
}

/** DD/MM/YYYY with Buddhist-era year (same format as the /policies page), or '-' */
export function formatDisplayDate(value?: string | null): string {
  const iso = toISODate(value)
  if (!iso) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${parseInt(y, 10) + 543}`
}

// ---------- Status ----------

export type ServiceStatusKind = 'SUCCESS' | 'WAIT' | 'OTHER'

export function getServiceStatusKind(status?: string | null): ServiceStatusKind {
  const s = (status || '').toLowerCase()
  if (s.includes('สำเร็จ') || s === 'success') return 'SUCCESS'
  if (s.includes('รอ') || s.startsWith('wait')) return 'WAIT'
  return 'OTHER'
}

export type ServiceStatusDetail = 'SUCCESS' | 'WAIT_CREATE' | 'WAIT_UPLOAD' | 'OTHER'

/** Finer-grained status (API doc §4.3): รอสร้างสัญญาประกัน / รออัปโหลดสัญญา / ซื้อสำเร็จ */
export function getServiceStatusDetail(status?: string | null): ServiceStatusDetail {
  const s = (status || '').toLowerCase()
  if (s.includes('สำเร็จ') || s === 'success') return 'SUCCESS'
  if (s.includes('อัปโหลด') || s.includes('อัพโหลด') || s.includes('upload')) return 'WAIT_UPLOAD'
  if (s.includes('รอ') || s.startsWith('wait')) return 'WAIT_CREATE'
  return 'OTHER'
}

export const SERVICE_STATUS_STYLE: Record<ServiceStatusKind, string> = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  WAIT: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  OTHER: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
}

// ---------- Conflict check (system policy vs API) ----------

export type ConflictStatus =
  | 'MATCH' // system and API dates agree
  | 'MISMATCH' // both exist but start/end dates differ
  | 'API_ONLY' // API purchase succeeded but system has no insurance
  | 'PENDING' // API purchase not completed yet
  | 'NO_API' // VIN not in API (not a conflict)

export interface ConflictResult {
  status: ConflictStatus
  service: ServiceBrief | null
  diffs: string[]
}

export const CONFLICT_LABEL: Record<ConflictStatus, { label: string; className: string }> = {
  MATCH: { label: '✅ ตรงกัน', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' },
  MISMATCH: { label: '❌ ข้อมูลไม่ตรงกัน', className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
  API_ONLY: { label: '⚠️ มีใน EV7 Core แต่ระบบไม่มี', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800' },
  PENDING: { label: '⏳ EV7 Core รอดำเนินการ', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' },
  NO_API: { label: '— ไม่มีใน EV7 Core', className: 'bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' },
}

export function isConflict(status: ConflictStatus): boolean {
  return status === 'MISMATCH' || status === 'API_ONLY'
}

/** Groups services by VIN; per VIN prefers a successful purchase with the latest end date. */
export function buildBestServiceMap<T extends ServiceBrief>(list: T[]): Record<string, T> {
  const rank = (s: ServiceBrief) => (getServiceStatusKind(s.ServiceStatus) === 'SUCCESS' ? 1 : 0)
  const map: Record<string, T> = {}
  for (const item of list) {
    const vin = (item.VinNo || '').trim().toUpperCase()
    if (!vin) continue
    const cur = map[vin]
    if (!cur) {
      map[vin] = item
      continue
    }
    const a = rank(item)
    const b = rank(cur)
    if (a > b || (a === b && (toISODate(item.InsuranceEndDate) || '') > (toISODate(cur.InsuranceEndDate) || ''))) {
      map[vin] = item
    }
  }
  return map
}

export function compareInsurance(
  system: { insuranceStartDate?: string | null; insuranceEndDate?: string | null },
  service: ServiceBrief | undefined | null
): ConflictResult {
  if (!service) return { status: 'NO_API', service: null, diffs: [] }

  const sysStart = toISODate(system.insuranceStartDate)
  const sysEnd = toISODate(system.insuranceEndDate)
  const hasSystem = !!(sysStart || sysEnd)
  const kind = getServiceStatusKind(service.ServiceStatus)

  if (kind !== 'SUCCESS') return { status: 'PENDING', service, diffs: [] }
  if (!hasSystem) return { status: 'API_ONLY', service, diffs: ['ระบบไม่มีข้อมูลประกัน'] }

  const diffs: string[] = []
  const apiStart = toISODate(service.InsuranceStartDate)
  const apiEnd = toISODate(service.InsuranceEndDate)
  if (apiStart && sysStart && apiStart !== sysStart) diffs.push('วันเริ่มคุ้มครอง')
  if (apiEnd && sysEnd && apiEnd !== sysEnd) diffs.push('วันสิ้นสุด')
  if (apiStart && !sysStart) diffs.push('วันเริ่มคุ้มครอง (ระบบว่าง)')
  if (apiEnd && !sysEnd) diffs.push('วันสิ้นสุด (ระบบว่าง)')

  return { status: diffs.length ? 'MISMATCH' : 'MATCH', service, diffs }
}

// ---------- Cached map for /policies (avoids re-downloading the full list on every visit) ----------

const SERVICE_MAP_TTL_MS = 5 * 60 * 1000
let serviceMapCache: { at: number; map: Record<string, ServiceBrief> } | null = null
let serviceMapInflight: Promise<Record<string, ServiceBrief>> | null = null

/**
 * Best service record per VIN for the whole list, cached in memory for 5 minutes.
 * Concurrent callers share one request; only the brief fields are kept (customer PII is dropped).
 */
export function getCachedServiceMap(force = false): Promise<Record<string, ServiceBrief>> {
  if (!force && serviceMapCache && Date.now() - serviceMapCache.at < SERVICE_MAP_TTL_MS) {
    return Promise.resolve(serviceMapCache.map)
  }
  if (serviceMapInflight) return serviceMapInflight

  serviceMapInflight = fetchAllService()
    .then((list) => {
      const map = buildBestServiceMap(list.map(toServiceBrief))
      serviceMapCache = { at: Date.now(), map }
      return map
    })
    .finally(() => {
      serviceMapInflight = null
    })
  return serviceMapInflight
}
