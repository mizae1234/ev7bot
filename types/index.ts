// types/index.ts

export interface DeliverySummary {
  total: number
  completed: number
  pending: number
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
