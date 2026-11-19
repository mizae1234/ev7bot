export interface MaintenanceItem {
  id: number
  register_no: string | null
  vin: string
  model: string
  project: string
  issue_title: string
  status_code: string
  status_text: string
  problem_type: string
  fault_party: string
  car_case: string
  service_location: string
  service_location_code: string
  current_location: string | null
  insurance: string
  report_date: string | null
  incident_date: string | null
  start_date: string | null
  finish_date: string | null
  expected_finish_date: string | null
  return_date: string | null
  follow_up: string | null
  replacements: { vin: string; register_no: string | null; start_date: string | null }[]
  driver_name: string | null
  root_cause: string | null
  fix_action: string | null
  last_follow_up_date: string | null
  parent_maintenance_id: number | string | null
  create_date: string | null
  update_date: string | null
  create_user_id: number | null
  update_user_id: number | null
  create_user_name: string | null
  update_user_name: string | null
}

export interface LocationSummaryItem {
  Location: string
  Count: number
  VehicleCount?: number
}

export interface MaintenanceData {
  items: MaintenanceItem[]
  summary: {
    total: number
    in_maintenance: number
    complete: number
    waiting: number
    still_work?: number
    total_cars?: number
    total_tickets?: number
    in_maintenance_cars?: number
    in_maintenance_tickets?: number
    waiting_cars?: number
    waiting_tickets?: number
    ready_pickup_cars?: number
    ready_pickup_tickets?: number
    still_work_cars?: number
    still_work_tickets?: number
  }
  locations: string[]
  locationNames?: Record<string, string>
  locationSummary: LocationSummaryItem[]
  problemTypes: { code: string; name: string }[]
  fetchedAt: string
}

export type CarCaseFilterType = 'all' | 'HEAVY' | 'LIGHT' | 'TOTAL' | 'UNSPECIFIED'

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

// SQL Server stores Bangkok time directly; mssql appends Z — always format with UTC getters
export function formatDateTh(dateStr: string | null): string {
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
