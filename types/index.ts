// types/index.ts

export interface DeliverySummary {
  total: number
  completed: number
  pending: number
  pendingActual?: number
}

export interface RepairSummary {
  total: number
  closed: number
  open: number
}

export interface TrendDataPoint {
  date: string        // 'YYYY-MM-DD'
  deliveries: number
  completed: number
  repairsReported: number
  repairsClosed: number
}

export interface DeliveryRecord {
  vehicle_id: string
  vin: string
  model: string
  status: 'pending' | 'in_progress' | 'complete' | 'delivered'
  delivered_at: string | null
  project: string | null
  expected_release_date: string | null
  release_date: string | null
}

export interface RepairRecord {
  order_id: string
  vehicle_id: string
  description: string
  status: 'open' | 'in_progress' | 'closed'
  closed_at: string | null
  vin: string | null
  model: string | null
  report_date: string | null
  start_date: string | null
  finish_date: string | null
  status_code: string | null
  service_location: string | null
  problem_type: string | null
  fault_party: string | null
  car_case: string | null
  insurance: string | null
  project: string | null
  incident_date?: string | null
  follow_up?: string | null
  driver_name?: string | null
  root_cause?: string | null
  fix_action?: string | null
  last_follow_up_date?: string | null
  parent_maintenance_id?: number | string | null
  create_date?: string | null
  update_date?: string | null
  create_user_id?: number | null
  update_user_id?: number | null
  replacements?: { vin: string; register_no: string | null; start_date: string | null }[]
}

export interface ReplacementRecord {
  replacement_id: string
  maintenance_id: string
  vin: string
  start_date: string | null
  return_date: string | null
  location: string | null
  remark: string | null
}

export interface ReturnRecord {
  return_id: string
  model: string
  vin: string
  register_no: string | null
  return_date: string | null
  receive_date: string | null
  customer_name: string | null
  mileage: number
  park_location: string | null
  remark: string | null
}

export interface DashboardData {
  delivery: DeliverySummary
  repair: RepairSummary
  trend: TrendDataPoint[]
  deliveryList: DeliveryRecord[]
  repairList: RepairRecord[]
  replacementList: ReplacementRecord[]
  returnList: ReturnRecord[]
  fetchedAt: string
  mockMode: boolean
}
