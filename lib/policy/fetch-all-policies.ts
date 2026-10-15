import { PolicyVehicleRecord } from './policy-types'

const EXPORT_PAGE_SIZE = 5000

/**
 * Fetches every record matching `filters` from /api/policy (for Excel export),
 * paging until `total` is reached so exports are never truncated at one page.
 */
export async function fetchAllPolicyRecords(filters: URLSearchParams): Promise<PolicyVehicleRecord[]> {
  const all: PolicyVehicleRecord[] = []
  let page = 1
  let totalPages = 1

  do {
    const query = new URLSearchParams(filters)
    query.set('page', String(page))
    query.set('limit', String(EXPORT_PAGE_SIZE))

    const res = await fetch(`/api/policy?${query.toString()}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || `โหลดข้อมูลไม่สำเร็จ (${res.status})`)

    all.push(...((data.records as PolicyVehicleRecord[]) || []))
    totalPages = data.totalPages || 1
    page++
  } while (page <= totalPages)

  return all
}
