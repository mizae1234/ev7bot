'use client'

import React, { useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { exportToExcel, formatDateForExcelRaw } from '@/lib/exportExcel'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface DashboardStats {
  total: number
  in_maintenance: number
  waiting: number
  complete: number
  on_rent_maintenance?: number
  ready_pickup?: number
  replacement_maintenance?: number
  total_tickets?: number
}

interface LocationStat {
  LocationCode: string
  LocationName: string
  Count: number
}

interface ProblemTypeStat {
  ProblemTypeCode: string
  ProblemTypeName: string
  Count: number
}

interface FollowUpItem {
  MaintenanceFollowUpID: number
  MaintenanceItemID: number
  FollowUpDate: string
  FollowUpDetail: string
  CreateDate: string
  CreateUserName: string
  IssueTitle: string
  RegisterNo: string
}

interface LongestRepairItem {
  MaintenanceItemID: number | null
  RegisterNo: string
  VinNo: string
  Model: string
  Project: string
  IssueTitle: string
  CarStatusCode: string
  CarStatusName: string
  ServiceLocationCode: string
  ReportDate: string
  MaintenanceStartDate?: string | null
  MaintenanceFinishDate?: string
  DaysActive: number
  FollowUpDetail: string | null
  SlaDateType?: 'START_DATE' | 'REPORT_DATE' | 'VEHICLE_DATE'
}

interface SLAStats {
  d1_5: number
  d6_10: number
  d11_15: number
  d16_30: number
  d30_plus: number
  total: number
  avgDays: number
  maxDays: number
  startDateCount?: number
  reportDateCount?: number
  vehicleDateCount?: number
  stuckTotal?: number
  readyPickupTotal?: number
  allVehiclesTotal?: number
}

interface MaintenanceDashboardData {
  stats: DashboardStats
  slaStats?: SLAStats
  locations: LocationStat[]
  problemTypes: ProblemTypeStat[]
  followUps: FollowUpItem[]
  longestRepairs: LongestRepairItem[]
  stillWorkRepairs: LongestRepairItem[]
}

const locationMap: Record<string, string> = {
  'AION_GI_KANCHANAPISEK': 'Aion กาญจนาฯ',
  'AION_GI_RAMINTRA_EXPRESSWAY': 'Aion เลียบด่วนฯ',
  'AION_GI_PIBULSONGKRAM': 'Aion พิบูลฯ',
  'AION_GI_MINBURI': 'Aion มีนบุรี',
  'AION_GI_MAHACHAI': 'Aion มหาชัย',
  'AION_GI_SALAYA': 'Aion ศาลายา',
  'EV7_YARD_PRAPADAENG': 'EV7 Yard พระประแดง',
  'SMART_TAXI': 'สมาร์ทเแท็กซี่',
  'GARAGE_BUNGKHWANG': 'อู่ บึงขวาง',
  'GARAGE_TS': 'อู่ TS',
  'GARAGE_88_CAR': 'อู่ 88 คาร์',
  'GARAGE_CRN_PAKKRET': 'อู่ CRN ปากเกร็ด',
  'GARAGE_56_COLOR': 'อู่ 56 Color',
  'GARAGE_PRICHA': 'อู่ ปรีชา',
  'GARAGE_PERFECTCAR': 'อู่ เพอร์เฟคคาร์',
  'GARAGE_SAHACAR': 'อู่ สหาคาร์',
  'GARAGE_PREMIUMCAR': 'อู่ พรีเมี่ยมคาร์',
  'GARAGE_BESTCARPAINT': 'อู่ เบสท์คาร์เพ้นท์',
  'BRANCH_AYUTTHAYA': 'สาขา อยุธยา',
  'BB_CARPAINT': 'อู่ บีบี คาร์เพ้นท์',
  'AUTOHAUS': 'อู่ Autohaus'
}

function formatThaiDate(dateStr: string, includeTime = false) {
  if (!dateStr) return '-'
  try {
    // SQL Server stores Bangkok time directly — use UTC methods to avoid double +7 offset
    const d = new Date(dateStr)
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    if (!includeTime) {
      return `${day} ${month} ${year}`
    }
    const hour = d.getUTCHours().toString().padStart(2, '0')
    const minute = d.getUTCMinutes().toString().padStart(2, '0')
    return `${day} ${month} ${year} ${hour}:${minute}`
  } catch {
    return dateStr
  }
}

function MaintenanceDashboardContent() {
  const { data, error, isLoading, mutate, isValidating } = useSWR<MaintenanceDashboardData>(
    '/api/maintenance/dashboard',
    fetcher,
    { refreshInterval: 30_000 } // Auto refresh every 30s
  )

  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [stuckSearchQuery, setStuckSearchQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    router.push(`/vehicle/${encodeURIComponent(q)}`)
  }

  const stats = data?.stats || { total: 0, in_maintenance: 0, waiting: 0, complete: 0 }
  const locations = data?.locations || []
  const problemTypes = data?.problemTypes || []
  const followUps = data?.followUps || []
  const longestRepairs = data?.longestRepairs || []
  const stillWorkRepairs = data?.stillWorkRepairs || []

  const [stillWorkSearchQuery, setStillWorkSearchQuery] = useState('')
  const [readyPickupSearchQuery, setReadyPickupSearchQuery] = useState('')
  type SlaRange = 'all' | '1-5' | '6-10' | '11-15' | '16-30' | '>30'
  type SlaScope = 'stuck' | 'ready' | 'all'
  const [selectedSlaFilter, setSelectedSlaFilter] = useState<SlaRange>('all')
  const [slaScope, setSlaScope] = useState<SlaScope>('stuck')
  const [slaModalRange, setSlaModalRange] = useState<SlaRange | null>(null)
  const [modalSearchQuery, setModalSearchQuery] = useState('')

  // Separate longestRepairs into ready-to-release and still stuck
  const readyPickupRepairs = longestRepairs.filter(r => r.CarStatusCode === 'READY_PICKUP_MAINTENANCE')
  const actualStuckRepairs = longestRepairs.filter(r => r.CarStatusCode !== 'READY_PICKUP_MAINTENANCE')

  // Scoped list based on user selection in SLA block
  const scopedRepairs = slaScope === 'stuck' 
    ? actualStuckRepairs 
    : slaScope === 'ready' 
    ? readyPickupRepairs 
    : longestRepairs

  // Filter ready to release repairs
  let filteredReadyPickupRepairs = selectedLocationFilter
    ? readyPickupRepairs.filter(r => r.ServiceLocationCode === selectedLocationFilter || (selectedLocationFilter === 'ไม่ระบุ' && !r.ServiceLocationCode))
    : readyPickupRepairs

  if (readyPickupSearchQuery.trim()) {
    const q = readyPickupSearchQuery.toLowerCase().replace(/[\s-]/g, '')
    filteredReadyPickupRepairs = filteredReadyPickupRepairs.filter(r => {
      const reg = (r.RegisterNo || '').toLowerCase().replace(/[\s-]/g, '')
      const vin = (r.VinNo || '').toLowerCase().replace(/[\s-]/g, '')
      return reg.includes(q) || vin.includes(q)
    })
  }

  // Base stuck repairs considering the selected location filter (if any) and SLA scope
  const baseStuckRepairs = selectedLocationFilter
    ? scopedRepairs.filter(r => r.ServiceLocationCode === selectedLocationFilter || (selectedLocationFilter === 'ไม่ระบุ' && !r.ServiceLocationCode))
    : scopedRepairs

  // Date type counts
  const countStartDate = baseStuckRepairs.filter(r => r.SlaDateType === 'START_DATE').length
  const countReportDate = baseStuckRepairs.filter(r => r.SlaDateType === 'REPORT_DATE').length
  const countVehicleDate = baseStuckRepairs.filter(r => r.SlaDateType === 'VEHICLE_DATE').length

  // Dynamic SLA aging counts based on baseStuckRepairs
  const d1_5List = baseStuckRepairs.filter(r => (r.DaysActive || 0) <= 5)
  const d6_10List = baseStuckRepairs.filter(r => (r.DaysActive || 0) >= 6 && (r.DaysActive || 0) <= 10)
  const d11_15List = baseStuckRepairs.filter(r => (r.DaysActive || 0) >= 11 && (r.DaysActive || 0) <= 15)
  const d16_30List = baseStuckRepairs.filter(r => (r.DaysActive || 0) >= 16 && (r.DaysActive || 0) <= 30)
  const d30_plusList = baseStuckRepairs.filter(r => (r.DaysActive || 0) > 30)

  const currentSlaTotal = baseStuckRepairs.length
  const currentSlaAvg = currentSlaTotal > 0
    ? Math.round((baseStuckRepairs.reduce((acc, r) => acc + (r.DaysActive || 0), 0) / currentSlaTotal) * 10) / 10
    : 0
  const currentSlaMax = currentSlaTotal > 0
    ? Math.max(...baseStuckRepairs.map(r => r.DaysActive || 0))
    : 0

  // Filter longest repairs if location card or SLA card is clicked, otherwise show all
  let filteredLongestRepairs = baseStuckRepairs
  if (selectedSlaFilter === '1-5') {
    filteredLongestRepairs = d1_5List
  } else if (selectedSlaFilter === '6-10') {
    filteredLongestRepairs = d6_10List
  } else if (selectedSlaFilter === '11-15') {
    filteredLongestRepairs = d11_15List
  } else if (selectedSlaFilter === '16-30') {
    filteredLongestRepairs = d16_30List
  } else if (selectedSlaFilter === '>30') {
    filteredLongestRepairs = d30_plusList
  }

  if (stuckSearchQuery.trim()) {
    const q = stuckSearchQuery.toLowerCase().replace(/[\s-]/g, '')
    filteredLongestRepairs = filteredLongestRepairs.filter(r => {
      const reg = (r.RegisterNo || '').toLowerCase().replace(/[\s-]/g, '')
      const vin = (r.VinNo || '').toLowerCase().replace(/[\s-]/g, '')
      return reg.includes(q) || vin.includes(q)
    })
  }

  // Raw items for the SLA details modal
  const modalRawItems = slaModalRange === '1-5'
    ? d1_5List
    : slaModalRange === '6-10'
    ? d6_10List
    : slaModalRange === '11-15'
    ? d11_15List
    : slaModalRange === '16-30'
    ? d16_30List
    : slaModalRange === '>30'
    ? d30_plusList
    : baseStuckRepairs

  // Filter items in modal by search query
  const modalItems = modalSearchQuery.trim()
    ? modalRawItems.filter(r => {
        const q = modalSearchQuery.toLowerCase().replace(/[\s-]/g, '')
        const reg = (r.RegisterNo || '').toLowerCase().replace(/[\s-]/g, '')
        const vin = (r.VinNo || '').toLowerCase().replace(/[\s-]/g, '')
        const loc = (locationMap[r.ServiceLocationCode] || r.ServiceLocationCode || '').toLowerCase()
        const issue = (r.IssueTitle || '').toLowerCase()
        const model = (r.Model || '').toLowerCase()
        return reg.includes(q) || vin.includes(q) || loc.includes(q) || issue.includes(q) || model.includes(q)
      })
    : modalRawItems

  const handleOpenSlaModal = (range: SlaRange) => {
    setSelectedSlaFilter(range)
    setSlaModalRange(range)
    setModalSearchQuery('')
  }

  const handleExportSla = (itemsToExport: LongestRepairItem[], rangeLabel?: string) => {
    const rLabel = rangeLabel || (selectedSlaFilter === 'all' ? 'ทุกช่วงเวลา' : selectedSlaFilter === '1-5' ? '1-5 วัน' : selectedSlaFilter === '6-10' ? '6-10 วัน' : selectedSlaFilter === '11-15' ? '11-15 วัน' : selectedSlaFilter === '16-30' ? '16-30 วัน' : '> 30 วัน')
    const locLabel = selectedLocationFilter ? (locationMap[selectedLocationFilter] || selectedLocationFilter) : 'ทุกสถานที่/อู่'
    const scopeLabel = slaScope === 'stuck' ? 'เฉพาะรถอยู่ระหว่างซ่อม' : slaScope === 'ready' ? 'เฉพาะรถซ่อมเสร็จรอลูกค้ารับ' : 'รวมรถซ่อมทั้งหมด'

    exportToExcel({
      reportName: `รายงาน SLA รถซ่อมคงค้าง (${rLabel})`,
      periodLabel: `ช่วงเวลา SLA: ${rLabel} | ขอบเขต: ${scopeLabel} | สถานที่: ${locLabel} | จำนวน: ${itemsToExport.length} คัน | หมายเหตุ: คำนวณจาก Start Date หากไม่มีจะใช้ Report Date แทน`,
      headers: [
        'ลำดับ',
        'เลขใบซ่อม',
        'ทะเบียน',
        'เลขตัวถัง (VIN)',
        'รุ่นรถ',
        'โครงการ',
        'อาการ/ปัญหาที่แจ้งซ่อม',
        'สถานะงานซ่อม',
        'สถานที่ซ่อม/อู่',
        'ผู้รับผิดชอบ',
        'วันที่นำรถเข้าซ่อม (Start Date)',
        'วันที่แจ้งซ่อม (Report Date)',
        'เกณฑ์วันที่ใช้คำนวณ SLA',
        'จำนวนวันค้าง (วัน)',
        'ช่วงเวลา SLA',
        'บันทึกติดตามงานล่าสุด'
      ],
      rows: itemsToExport.map((item, idx) => {
        const d = item.DaysActive || 0
        const bracket = d <= 5 ? '1 - 5 วัน' : d <= 10 ? '6 - 10 วัน' : d <= 15 ? '11 - 15 วัน' : d <= 30 ? '16 - 30 วัน' : '> 30 วัน'
        const resp = item.CarStatusCode === 'READY_PICKUP_MAINTENANCE' || item.CarStatusCode === 'STILL_WORK' 
          ? 'EV7/ICI' 
          : (locationMap[item.ServiceLocationCode] || item.ServiceLocationCode || 'ไม่ระบุ')
        const dateTypeLabel = item.SlaDateType === 'START_DATE'
          ? 'วันที่เริ่มซ่อม (Start Date)'
          : item.SlaDateType === 'REPORT_DATE'
          ? 'วันที่แจ้งซ่อม (Report Date - ไม่มีวันเริ่ม)'
          : 'วันที่รับรถ (รอเปิดใบงานซ่อม)'

        return [
          idx + 1,
          item.MaintenanceItemID ? `#${item.MaintenanceItemID}` : 'รอเปิดใบงาน',
          item.RegisterNo || 'ไม่มีทะเบียน',
          item.VinNo || '-',
          item.Model || '-',
          item.Project || '-',
          item.IssueTitle || '-',
          item.CarStatusName || item.CarStatusCode || '-',
          locationMap[item.ServiceLocationCode] || item.ServiceLocationCode || 'ไม่ระบุ',
          resp,
          formatDateForExcelRaw(item.MaintenanceStartDate || null),
          formatDateForExcelRaw(item.ReportDate || null),
          dateTypeLabel,
          d,
          bracket,
          item.FollowUpDetail || '-'
        ]
      }),
      fileName: `SLA_รถซ่อมค้าง_${rLabel.replace(/[\s->]/g, '_')}`
    })
  }

  // Filter still work repairs by search query
  let filteredStillWorkRepairs = stillWorkRepairs
  if (stillWorkSearchQuery.trim()) {
    const q = stillWorkSearchQuery.toLowerCase().replace(/[\s-]/g, '')
    filteredStillWorkRepairs = filteredStillWorkRepairs.filter(r => {
      const reg = (r.RegisterNo || '').toLowerCase().replace(/[\s-]/g, '')
      const vin = (r.VinNo || '').toLowerCase().replace(/[\s-]/g, '')
      return reg.includes(q) || vin.includes(q)
    })
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 pb-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8 relative z-10">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">📊</span>
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  ระบบวิเคราะห์งานซ่อมบำรุง (Maintenance Dashboard)
                </h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  ภาพรวมรถซ่อมบำรุง สถานะอู่คู่สัญญา เคสที่จอดซ่อมนานสุด และบันทึกติดตามความคืบหน้าล่าสุด
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end flex-wrap">
            <form onSubmit={handleSearch} className="flex items-center gap-1.5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาทะเบียน / VIN..."
                className="w-44 text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400 shadow-sm"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition active:scale-95 shadow-sm"
              >
                🔍
              </button>
            </form>
            <button
              onClick={() => mutate()}
              disabled={isValidating}
              className="bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition border border-slate-200 flex items-center gap-1.5 active:scale-95 shadow-sm"
            >
              <svg className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
              {isValidating ? 'กำลังรีเฟรช...' : 'รีเฟรชข้อมูล'}
            </button>
            <a
              href="/maintenance"
              className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-1 active:scale-95 shadow-sm"
            >
              🔧 รายการใบซ่อมบำรุง
            </a>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <div key={n} className="bg-white border border-slate-200 rounded-3xl h-32 animate-pulse shadow-sm col-span-1" />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center space-y-3">
            <p className="text-sm text-rose-600 font-bold">⚠️ ดึงข้อมูลแดชบอร์ดไม่สำเร็จ</p>
            <p className="text-xs text-slate-500">กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือติดต่อผู้ดูแลระบบ</p>
          </div>
        )}

        {/* KPI Cards */}
        {!isLoading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Card 1: Total */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-350 transition duration-300 col-span-1">
              <div className="absolute -right-4 -bottom-4 text-7xl text-slate-100 font-bold select-none group-hover:scale-110 transition duration-300">
                🛠️
              </div>
              <p className="text-xs text-slate-500 font-bold">รวมรถซ่อมค้างทั้งหมด</p>
              <p className="text-3xl font-black text-slate-900 mt-1.5">
                {stats.total} <span className="text-xs font-normal text-slate-500">คัน</span>
              </p>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {stats.total_tickets || stats.total} ใบงาน
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-slate-400 h-full rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Card 2: New Maintenance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-350 transition duration-300 col-span-1">
              <div className="absolute -right-4 -bottom-4 text-7xl text-rose-500/5 font-bold select-none group-hover:scale-110 transition duration-300">
                🟡
              </div>
              <p className="text-xs text-rose-600 font-bold">🟡 รถใหม่เข้าซ่อม</p>
              <p className="text-3xl font-black text-rose-655 mt-1.5">
                {stats.waiting || 0} <span className="text-xs font-normal text-slate-500">คัน</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-rose-550 h-full rounded-full" style={{ width: stats.total ? `${((stats.waiting || 0) / stats.total) * 100}%` : '0%' }} />
              </div>
            </div>

            {/* Card 3: Use Maintenance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-350 transition duration-300 col-span-1">
              <div className="absolute -right-4 -bottom-4 text-7xl text-amber-500/5 font-bold select-none group-hover:scale-110 transition duration-300">
                🔴
              </div>
              <p className="text-xs text-amber-600 font-bold">🔴 รถใช้แล้วเข้าซ่อม</p>
              <p className="text-3xl font-black text-amber-600 mt-1.5">
                {stats.in_maintenance || 0} <span className="text-xs font-normal text-slate-500">คัน</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: stats.total ? `${((stats.in_maintenance || 0) / stats.total) * 100}%` : '0%' }} />
              </div>
            </div>

            {/* Card 4: On Rent Maintenance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-350 transition duration-300 col-span-1">
              <div className="absolute -right-4 -bottom-4 text-7xl text-indigo-500/5 font-bold select-none group-hover:scale-110 transition duration-300">
                🔵
              </div>
              <p className="text-xs text-indigo-650 font-bold">🔵 รถเช่าเข้าซ่อม</p>
              <p className="text-3xl font-black text-indigo-650 mt-1.5">
                {stats.on_rent_maintenance || 0} <span className="text-xs font-normal text-slate-500">คัน</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full" style={{ width: stats.total ? `${((stats.on_rent_maintenance || 0) / stats.total) * 100}%` : '0%' }} />
              </div>
            </div>

            {/* Card 5: Ready to Pickup */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-350 transition duration-300 col-span-1">
              <div className="absolute -right-4 -bottom-4 text-7xl text-orange-500/5 font-bold select-none group-hover:scale-110 transition duration-300">
                🟠
              </div>
              <p className="text-xs text-orange-600 font-bold">🟠 รถซ่อมเสร็จ รอลูกค้ามารับ</p>
              <p className="text-3xl font-black text-orange-600 mt-1.5">
                {stats.ready_pickup || 0} <span className="text-xs font-normal text-slate-500">คัน</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-orange-500 h-full rounded-full" style={{ width: stats.total ? `${((stats.ready_pickup || 0) / stats.total) * 100}%` : '0%' }} />
              </div>
            </div>

            {/* Card 6: Replacement Maintenance */}
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden group hover:border-slate-350 transition duration-300 col-span-1">
              <div className="absolute -right-4 -bottom-4 text-7xl text-purple-500/5 font-bold select-none group-hover:scale-110 transition duration-300">
                🟣
              </div>
              <p className="text-xs text-purple-600 font-bold">🟣 รถสำรองเข้าซ่อม</p>
              <p className="text-3xl font-black text-purple-600 mt-1.5">
                {stats.replacement_maintenance || 0} <span className="text-xs font-normal text-slate-500">คัน</span>
              </p>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-purple-500 h-full rounded-full" style={{ width: stats.total ? `${((stats.replacement_maintenance || 0) / stats.total) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>
        )}

        {/* SLA & Repair Aging Analysis Block */}
        {!isLoading && !error && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-5">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
                    <span className="text-xl">⏱️</span> วิเคราะห์ระยะเวลาการซ่อมคงค้าง (Repair Aging & SLA Tracking)
                  </h2>
                  {selectedLocationFilter && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                      📍 {locationMap[selectedLocationFilter] || selectedLocationFilter}
                    </span>
                  )}
                  {selectedSlaFilter !== 'all' && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-1 animate-pulse">
                      <span>กำลังกรอง: {selectedSlaFilter === '1-5' ? '1-5 วัน' : selectedSlaFilter === '6-10' ? '6-10 วัน' : selectedSlaFilter === '11-15' ? '11-15 วัน' : selectedSlaFilter === '16-30' ? '16-30 วัน' : '> 30 วัน'}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  สถิติจำนวนรถที่ค้างซ่อมตามช่วงเวลา (SLA Brackets) คำนวณจากวันที่นำรถเข้าซ่อม (Start Date) เป็นหลัก หากไม่มีวันที่เริ่มซ่อมจะคำนวณจากวันที่แจ้งซ่อม (Report Date) แทนโดยอัตโนมัติ • คลิกที่การ์ดเพื่อกรองรายการรถด้านล่าง
                </p>
              </div>

              {/* Summary Metrics & Export & Reset */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleExportSla(baseStuckRepairs, selectedSlaFilter !== 'all' ? selectedSlaFilter : 'ทั้งหมด')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-300 hover:border-emerald-600 px-3 py-2 rounded-2xl transition-all shadow-xs hover:shadow-md cursor-pointer active:scale-95"
                  title="ดาวน์โหลดไฟล์ Excel รายการรถซ่อมค้าง"
                >
                  <span>📥</span>
                  <span>Export Excel ({baseStuckRepairs.length} คัน)</span>
                </button>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-1.5 text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">เฉลี่ยจอดซ่อม</span>
                  <span className="text-sm font-black text-slate-800 font-mono">{currentSlaAvg} <span className="text-xs font-normal text-slate-500">วัน</span></span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-3.5 py-1.5 text-right">
                  <span className="text-[10px] text-rose-500 font-bold block uppercase tracking-wider">ค้างนานที่สุด</span>
                  <span className="text-sm font-black text-rose-700 font-mono">{currentSlaMax} <span className="text-xs font-normal text-rose-500">วัน</span></span>
                </div>
                {selectedSlaFilter !== 'all' && (
                  <button
                    onClick={() => setSelectedSlaFilter('all')}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-2xl transition flex items-center gap-1 cursor-pointer"
                  >
                    ✕ ล้างตัวกรอง SLA
                  </button>
                )}
              </div>
            </div>

            {/* Reconcile & Scope Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3">
              {/* Scope Switcher Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <span>🎯</span> ขอบเขตรถ:
                </span>
                <button
                  type="button"
                  onClick={() => setSlaScope('stuck')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    slaScope === 'stuck'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  รถค้างซ่อม ({actualStuckRepairs.length} คัน)
                </button>
                <button
                  type="button"
                  onClick={() => setSlaScope('ready')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    slaScope === 'ready'
                      ? 'bg-orange-500 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  ซ่อมเสร็จ รอลูกค้ารับ ({readyPickupRepairs.length} คัน)
                </button>
                <button
                  type="button"
                  onClick={() => setSlaScope('all')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    slaScope === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  รวมรถซ่อมทั้งหมด ({longestRepairs.length} คัน)
                </button>
              </div>

              {/* Reconcile Breakdown note */}
              <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap bg-white border border-slate-200 px-3 py-1 rounded-xl">
                <span className="font-extrabold text-indigo-700">📊 Reconcile:</span>
                <span>ค้างซ่อม <strong>{actualStuckRepairs.length}</strong> คัน</span>
                <span className="text-slate-300">+</span>
                <span>ซ่อมเสร็จรอลูกค้ารับ <strong>{readyPickupRepairs.length}</strong> คัน</span>
                <span className="text-slate-300">=</span>
                <span className="font-extrabold text-slate-900">รวมทั้งหมด {longestRepairs.length} คัน</span>
                <span className="text-slate-400 font-normal">({stats.total_tickets || 748} ใบงาน)</span>
              </div>
            </div>

            {/* Date Calculation Method Explanatory Banner */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] bg-amber-50/60 border border-amber-200/60 rounded-xl px-3.5 py-2 text-amber-900">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">💡</span>
                <span>
                  <strong>เกณฑ์การคำนวณวัน:</strong> คำนวณจาก <strong>วันที่เริ่มซ่อม (Start Date)</strong> เป็นหลัก · หากไม่มีวันที่เริ่มซ่อมจะคำนวณจาก <strong>วันที่แจ้งซ่อม (Report Date)</strong> แทนโดยอัตโนมัติ
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10.5px] font-mono text-amber-800 shrink-0">
                <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                  ใช้วันเริ่มซ่อม: <strong>{countStartDate}</strong> คัน
                </span>
                <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                  ใช้วันแจ้งซ่อม: <strong>{countReportDate}</strong> คัน
                </span>
                {countVehicleDate > 0 && (
                  <span className="bg-white/80 px-2 py-0.5 rounded border border-amber-200">
                    รอเปิดใบงาน: <strong>{countVehicleDate}</strong> คัน
                  </span>
                )}
              </div>
            </div>

            {/* Visual Distribution Bar */}
            {currentSlaTotal > 0 && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex shadow-inner">
                  {d1_5List.length > 0 && (
                    <div
                      style={{ width: `${(d1_5List.length / currentSlaTotal) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                      title={`1-5 วัน: ${d1_5List.length} คัน (${Math.round((d1_5List.length / currentSlaTotal) * 100)}%)`}
                      onClick={() => setSelectedSlaFilter(selectedSlaFilter === '1-5' ? 'all' : '1-5')}
                    />
                  )}
                  {d6_10List.length > 0 && (
                    <div
                      style={{ width: `${(d6_10List.length / currentSlaTotal) * 100}%` }}
                      className="bg-sky-500 h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                      title={`6-10 วัน: ${d6_10List.length} คัน (${Math.round((d6_10List.length / currentSlaTotal) * 100)}%)`}
                      onClick={() => setSelectedSlaFilter(selectedSlaFilter === '6-10' ? 'all' : '6-10')}
                    />
                  )}
                  {d11_15List.length > 0 && (
                    <div
                      style={{ width: `${(d11_15List.length / currentSlaTotal) * 100}%` }}
                      className="bg-amber-500 h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                      title={`11-15 วัน: ${d11_15List.length} คัน (${Math.round((d11_15List.length / currentSlaTotal) * 100)}%)`}
                      onClick={() => setSelectedSlaFilter(selectedSlaFilter === '11-15' ? 'all' : '11-15')}
                    />
                  )}
                  {d16_30List.length > 0 && (
                    <div
                      style={{ width: `${(d16_30List.length / currentSlaTotal) * 100}%` }}
                      className="bg-orange-500 h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                      title={`16-30 วัน: ${d16_30List.length} คัน (${Math.round((d16_30List.length / currentSlaTotal) * 100)}%)`}
                      onClick={() => setSelectedSlaFilter(selectedSlaFilter === '16-30' ? 'all' : '16-30')}
                    />
                  )}
                  {d30_plusList.length > 0 && (
                    <div
                      style={{ width: `${(d30_plusList.length / currentSlaTotal) * 100}%` }}
                      className="bg-rose-600 h-full transition-all duration-500 hover:opacity-90 cursor-pointer"
                      title={`> 30 วัน: ${d30_plusList.length} คัน (${Math.round((d30_plusList.length / currentSlaTotal) * 100)}%)`}
                      onClick={() => setSelectedSlaFilter(selectedSlaFilter === '>30' ? 'all' : '>30')}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 5 SLA Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {/* Bracket 1: 1 - 5 วัน */}
              <button
                type="button"
                onClick={() => handleOpenSlaModal('1-5')}
                className={`text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  selectedSlaFilter === '1-5'
                    ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500 shadow-md scale-[1.02]'
                    : 'bg-slate-50/70 hover:bg-emerald-50/30 border-slate-200 hover:border-emerald-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                    1 - 5 วัน
                  </span>
                  {selectedSlaFilter === '1-5' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white">✓ กรอง</span>
                  ) : (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">ปกติ</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {d1_5List.length} <span className="text-xs font-normal text-slate-500 font-sans">คัน</span>
                  </p>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {currentSlaTotal > 0 ? Math.round((d1_5List.length / currentSlaTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: currentSlaTotal > 0 ? `${(d1_5List.length / currentSlaTotal) * 100}%` : '0%' }}
                  />
                </div>
                <div className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
                  <span>🔍 ดูรายการ &amp; Export</span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>

              {/* Bracket 2: 6 - 10 วัน */}
              <button
                type="button"
                onClick={() => handleOpenSlaModal('6-10')}
                className={`text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  selectedSlaFilter === '6-10'
                    ? 'bg-sky-50/90 border-sky-400 ring-2 ring-sky-500 shadow-md scale-[1.02]'
                    : 'bg-slate-50/70 hover:bg-sky-50/30 border-slate-200 hover:border-sky-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0 inline-block" />
                    6 - 10 วัน
                  </span>
                  {selectedSlaFilter === '6-10' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-600 text-white">✓ กรอง</span>
                  ) : (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">เริ่มติดตาม</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {d6_10List.length} <span className="text-xs font-normal text-slate-500 font-sans">คัน</span>
                  </p>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {currentSlaTotal > 0 ? Math.round((d6_10List.length / currentSlaTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all"
                    style={{ width: currentSlaTotal > 0 ? `${(d6_10List.length / currentSlaTotal) * 100}%` : '0%' }}
                  />
                </div>
                <div className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
                  <span>🔍 ดูรายการ &amp; Export</span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>

              {/* Bracket 3: 11 - 15 วัน */}
              <button
                type="button"
                onClick={() => handleOpenSlaModal('11-15')}
                className={`text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  selectedSlaFilter === '11-15'
                    ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500 shadow-md scale-[1.02]'
                    : 'bg-slate-50/70 hover:bg-amber-50/30 border-slate-200 hover:border-amber-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 inline-block" />
                    11 - 15 วัน
                  </span>
                  {selectedSlaFilter === '11-15' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white">✓ กรอง</span>
                  ) : (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">เริ่มล่าช้า</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {d11_15List.length} <span className="text-xs font-normal text-slate-500 font-sans">คัน</span>
                  </p>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {currentSlaTotal > 0 ? Math.round((d11_15List.length / currentSlaTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: currentSlaTotal > 0 ? `${(d11_15List.length / currentSlaTotal) * 100}%` : '0%' }}
                  />
                </div>
                <div className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
                  <span>🔍 ดูรายการ &amp; Export</span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>

              {/* Bracket 4: 16 - 30 วัน */}
              <button
                type="button"
                onClick={() => handleOpenSlaModal('16-30')}
                className={`text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  selectedSlaFilter === '16-30'
                    ? 'bg-orange-50/90 border-orange-400 ring-2 ring-orange-500 shadow-md scale-[1.02]'
                    : 'bg-slate-50/70 hover:bg-orange-50/30 border-slate-200 hover:border-orange-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0 inline-block" />
                    16 - 30 วัน
                  </span>
                  {selectedSlaFilter === '16-30' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-600 text-white">✓ กรอง</span>
                  ) : (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">ล่าช้าสูง</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                    {d16_30List.length} <span className="text-xs font-normal text-slate-500 font-sans">คัน</span>
                  </p>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {currentSlaTotal > 0 ? Math.round((d16_30List.length / currentSlaTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-orange-500 h-full rounded-full transition-all"
                    style={{ width: currentSlaTotal > 0 ? `${(d16_30List.length / currentSlaTotal) * 100}%` : '0%' }}
                  />
                </div>
                <div className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
                  <span>🔍 ดูรายการ &amp; Export</span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>

              {/* Bracket 5: > 30 วัน */}
              <button
                type="button"
                onClick={() => handleOpenSlaModal('>30')}
                className={`text-left p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden group cursor-pointer ${
                  selectedSlaFilter === '>30'
                    ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500 shadow-md scale-[1.02]'
                    : 'bg-slate-50/70 hover:bg-rose-50/30 border-slate-200 hover:border-rose-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0 inline-block animate-ping" />
                    &gt; 30 วัน
                  </span>
                  {selectedSlaFilter === '>30' ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">✓ กรอง</span>
                  ) : (
                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">วิกฤต</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
                    {d30_plusList.length} <span className="text-xs font-normal text-slate-500 font-sans">คัน</span>
                  </p>
                  <span className="text-[11px] font-bold text-rose-500 font-mono">
                    {currentSlaTotal > 0 ? Math.round((d30_plusList.length / currentSlaTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-slate-200/80 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-rose-600 h-full rounded-full transition-all"
                    style={{ width: currentSlaTotal > 0 ? `${(d30_plusList.length / currentSlaTotal) * 100}%` : '0%' }}
                  />
                </div>
                <div className="text-[10px] font-bold text-indigo-600 group-hover:text-indigo-800 flex items-center justify-between mt-3 pt-2 border-t border-slate-200/60">
                  <span>🔍 ดูรายการ &amp; Export</span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Main Dashboard Layout */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Columns: Stuck Repairs & Yards */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Card: Yard / Workshop Load */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span>📍</span> อู่คู่สัญญาและสถานที่ซ่อมบำรุงที่คิวยาวที่สุด (Workshop Load)
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">จำนวนรถยนต์คงค้างที่ถูกส่งซ่อมแยกตามสถานที่ (คลิกเพื่อกรองข้อมูลด้านล่าง)</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {locations.map((loc) => {
                    const isSelected = selectedLocationFilter === loc.LocationCode
                    return (
                      <button
                        key={loc.LocationCode}
                        onClick={() => setSelectedLocationFilter(isSelected ? null : loc.LocationCode)}
                        className={`text-left p-2.5 sm:p-3 rounded-xl border transition duration-200 flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-800 shadow-sm ring-1 ring-indigo-300'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-350 text-slate-700'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{loc.LocationName || 'ไม่ระบุ / นอกสถานที่'}</p>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-indigo-500 h-full rounded-full"
                              style={{ width: `${Math.min((loc.Count / 10) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-black">{loc.Count}</span>
                          <span className="text-[10px] text-slate-450 block leading-none mt-0.5">คัน</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Card: Ready to Release (รถซ่อมเสร็จ รอปล่อย) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🟠</span> รายการรถซ่อมเสร็จ รอลูกค้ามารับ (Ready to Release)
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">รถยนต์ที่ซ่อมเสร็จเรียบร้อยและอยู่ระหว่างติดตามส่งมอบคืนลูกค้า/ผู้เช่า (รถซ่อมเสร็จ รอลูกค้ามารับ)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={readyPickupSearchQuery}
                      onChange={(e) => setReadyPickupSearchQuery(e.target.value)}
                      placeholder="ค้นหาทะเบียน / VIN ในตาราง..."
                      className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 focus:border-transparent placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {filteredReadyPickupRepairs.length > 0 ? (
                    filteredReadyPickupRepairs.map((item) => (
                      <a
                        key={item.MaintenanceItemID}
                        href={`/vehicle/${encodeURIComponent(item.RegisterNo || '')}`}
                        className="block bg-orange-50/20 border border-orange-100 hover:border-orange-400 hover:shadow-xs rounded-xl p-2.5 transition no-underline text-inherit cursor-pointer"
                      >
                        <div className="flex flex-row items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            {/* License plate */}
                            <span className="text-xxs font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-orange-200 shadow-xxs shrink-0 font-mono">
                              {item.RegisterNo || 'ไม่มีทะเบียน'}
                            </span>

                            {/* Status */}
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 bg-orange-100 border-orange-200 text-orange-700">
                              {item.CarStatusName || 'รถซ่อมเสร็จ รอลูกค้ามารับ'}
                            </span>

                            {/* Issue Title */}
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[100px] sm:max-w-[200px]" title={item.IssueTitle}>
                              {item.IssueTitle}
                            </span>

                            {/* Details (Project & Location) */}
                            <span className="text-[10px] text-slate-400 shrink-0">|</span>
                            <span className="text-[10px] text-slate-500 truncate">
                              ผู้รับผิดชอบ: <strong className="text-orange-650 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 text-[9px]">EV7</strong>
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">|</span>
                            <span className="text-[10px] text-slate-500 truncate">
                              สถานที่: <strong className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[9px]">{locationMap[item.ServiceLocationCode] || item.ServiceLocationCode || 'ไม่ระบุ'}</strong>
                            </span>

                            {/* Latest follow-up inline */}
                            {item.FollowUpDetail && (
                              <>
                                <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">|</span>
                                <span className="text-[10px] text-slate-500 italic truncate max-w-[180px] lg:max-w-[250px] hidden sm:inline" title={item.FollowUpDetail}>
                                  💬 {item.FollowUpDetail}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Right side: Finish Date / Wait Days */}
                          <div className="flex items-center gap-1.5 shrink-0 pl-2 sm:pl-3 border-l border-orange-200 text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">รอปล่อย</span>
                            <span className="text-xs sm:text-sm font-black font-mono shrink-0 text-orange-600">
                              {item.MaintenanceFinishDate ? `${Math.max(0, Math.floor((Date.now() - new Date(item.MaintenanceFinishDate).getTime()) / (1000 * 60 * 60 * 24)))}` : '0'} วัน
                            </span>
                          </div>
                        </div>

                        {/* Mobile-only follow-up row */}
                        {item.FollowUpDetail && (
                          <div className="mt-1 text-[10px] text-slate-500 italic sm:hidden truncate">
                            💬 {item.FollowUpDetail}
                          </div>
                        )}
                      </a>
                    ))
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-450 italic">
                      ไม่มีรายการรถซ่อมเสร็จรอปล่อยตัว
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Stuck Repairs (ซ่อมนานที่สุด) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span>⚠️</span> รถยนต์ที่อยู่ระหว่างซ่อมค้างนานที่สุด (Stuck Repairs)
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                        {filteredLongestRepairs.length} คัน
                      </span>
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">เรียงลำดับตามวันที่เริ่มเกิดเหตุ/วันที่แจ้งซ่อมคงค้าง</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleExportSla(filteredLongestRepairs, selectedSlaFilter !== 'all' ? selectedSlaFilter : 'ทั้งหมด')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-300 hover:border-emerald-600 px-3 py-1.5 rounded-xl transition-all shadow-xs hover:shadow cursor-pointer active:scale-95"
                      title="ดาวน์โหลดรายการรถที่กำลังแสดงเป็น Excel"
                    >
                      <span>📥</span>
                      <span>Export ({filteredLongestRepairs.length})</span>
                    </button>
                    {selectedSlaFilter !== 'all' && (
                      <button
                        onClick={() => setSelectedSlaFilter('all')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                        title="คลิกเพื่อล้างตัวกรอง SLA"
                      >
                        <span>SLA: {selectedSlaFilter === '1-5' ? '1-5 วัน' : selectedSlaFilter === '6-10' ? '6-10 วัน' : selectedSlaFilter === '11-15' ? '11-15 วัน' : selectedSlaFilter === '16-30' ? '16-30 วัน' : '> 30 วัน'}</span>
                        <span className="text-xs font-bold">✕</span>
                      </button>
                    )}
                    <input
                      type="text"
                      value={stuckSearchQuery}
                      onChange={(e) => setStuckSearchQuery(e.target.value)}
                      placeholder="ค้นหาทะเบียน / VIN ในตาราง..."
                      className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400"
                    />
                    {selectedLocationFilter && (
                      <button
                        onClick={() => setSelectedLocationFilter(null)}
                        className="text-xs font-bold text-indigo-650 hover:underline shrink-0"
                      >
                        ล้างอู่
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredLongestRepairs.length > 0 ? (
                    filteredLongestRepairs.map((item) => (
                      <a
                        key={item.MaintenanceItemID}
                        href={`/vehicle/${encodeURIComponent(item.RegisterNo || '')}`}
                        className="block bg-slate-50 border border-slate-150 hover:border-indigo-400 hover:shadow-xs rounded-xl p-2.5 transition no-underline text-inherit cursor-pointer"
                      >
                        <div className="flex flex-row items-center justify-between gap-2.5">
                          {/* Left contents aligned in a single row */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            {/* License plate */}
                            <span className="text-xxs font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-250 shadow-xxs shrink-0 font-mono">
                              {item.RegisterNo || 'ไม่มีทะเบียน'}
                            </span>

                            {/* Status */}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                              item.CarStatusCode === 'IN_MAINTENANCE'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : item.CarStatusCode === 'READY_PICKUP_MAINTENANCE'
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : item.CarStatusCode === 'STILL_WORK'
                                ? 'bg-sky-50 border-sky-200 text-sky-700'
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                              {item.CarStatusName || item.CarStatusCode}
                            </span>

                            {/* Issue Title */}
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[100px] sm:max-w-[200px]" title={item.IssueTitle}>
                              {item.IssueTitle}
                            </span>

                            {/* Details (Project & Location) */}
                            <span className="text-[10px] text-slate-400 shrink-0">|</span>
                            <span className="text-[10px] text-slate-500 truncate">
                              ผู้รับผิดชอบ: <strong className={item.CarStatusCode === 'READY_PICKUP_MAINTENANCE' || item.CarStatusCode === 'STILL_WORK' ? 'text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[9px]' : 'text-emerald-650'}>{item.CarStatusCode === 'READY_PICKUP_MAINTENANCE' || item.CarStatusCode === 'STILL_WORK' ? 'EV7/ICI' : (locationMap[item.ServiceLocationCode] || item.ServiceLocationCode || 'ไม่ระบุ')}</strong>
                            </span>

                            {/* Date criteria inline */}
                            <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">|</span>
                            <span className="text-[10px] text-slate-500 hidden sm:inline">
                              {item.SlaDateType === 'START_DATE' && item.MaintenanceStartDate ? (
                                <span>เริ่ม: <strong className="text-slate-700">{formatThaiDate(item.MaintenanceStartDate)}</strong></span>
                              ) : item.ReportDate ? (
                                <span>แจ้ง: <strong className="text-slate-700">{formatThaiDate(item.ReportDate)}</strong> <span className="text-amber-700 text-[9px] font-semibold">(ใช้วันแจ้งซ่อม)</span></span>
                              ) : (
                                <span className="text-slate-400">รอเปิดใบงาน</span>
                              )}
                            </span>

                            {/* Latest follow-up inline */}
                            {item.FollowUpDetail && (
                              <>
                                <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">|</span>
                                <span className="text-[10px] text-slate-500 italic truncate max-w-[180px] lg:max-w-[250px] hidden sm:inline" title={item.FollowUpDetail}>
                                  💬 {item.FollowUpDetail}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Right side: Days count in a compact, single-line format */}
                          <div className="flex items-center gap-1.5 shrink-0 pl-2 sm:pl-3 border-l border-slate-200 text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">
                              {item.CarStatusCode === 'STILL_WORK' ? 'ค้างเคส' : 'จอดซ่อม'}
                            </span>
                            <span className={`text-xs sm:text-sm font-black font-mono shrink-0 ${
                              item.DaysActive > 30
                                ? 'text-rose-700 font-extrabold'
                                : item.DaysActive >= 16
                                ? 'text-orange-600'
                                : item.DaysActive >= 11
                                ? 'text-amber-600'
                                : item.DaysActive >= 6
                                ? 'text-sky-600'
                                : 'text-emerald-600'
                            }`}>
                              {item.DaysActive} วัน
                            </span>
                          </div>
                        </div>

                        {/* Mobile-only follow-up row to keep layout clean */}
                        {item.FollowUpDetail && (
                          <div className="mt-1 text-[10px] text-slate-500 italic sm:hidden truncate">
                            💬 {item.FollowUpDetail}
                          </div>
                        )}
                      </a>
                    ))
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-450 italic">
                      ไม่พบรถยนต์ซ่อมค้างคงค้างในส่วนนี้
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Still Driveable Repairs (แจ้งซ่อมแต่ยังวิ่งใช้งานได้) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🚗</span> รถยนต์ที่แจ้งซ่อมแต่ยังวิ่งใช้งานได้อยู่ (Still Driveable)
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">เคสขัดข้อง (STILL_WORK) เพื่อติดตามเข้าศูนย์/อู่ซ่อมบำรุงภายหลัง</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={stillWorkSearchQuery}
                      onChange={(e) => setStillWorkSearchQuery(e.target.value)}
                      placeholder="ค้นหาทะเบียน / VIN..."
                      className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-transparent placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredStillWorkRepairs.length > 0 ? (
                    filteredStillWorkRepairs.map((item) => (
                      <a
                        key={item.MaintenanceItemID}
                        href={`/vehicle/${encodeURIComponent(item.RegisterNo || '')}`}
                        className="block bg-slate-50 border border-slate-150 hover:border-indigo-400 hover:shadow-xs rounded-xl p-2.5 transition no-underline text-inherit cursor-pointer"
                      >
                        <div className="flex flex-row items-center justify-between gap-2.5">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            <span className="text-xxs font-extrabold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-250 shadow-xxs shrink-0 font-mono">
                              {item.RegisterNo || 'ไม่มีทะเบียน'}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 bg-sky-50 border-sky-200 text-sky-700">
                              {item.CarStatusName || 'ยังวิ่งอยู่'}
                            </span>
                            <span className="text-xs font-bold text-slate-800 truncate max-w-[100px] sm:max-w-[200px]" title={item.IssueTitle}>
                              {item.IssueTitle}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">|</span>
                            <span className="text-[10px] text-slate-500 truncate">
                              ผู้รับผิดชอบ: <strong className="text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[9px]">EV7/ICI</strong>
                            </span>
                            {item.FollowUpDetail && (
                              <>
                                <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline">|</span>
                                <span className="text-[10px] text-slate-500 italic truncate max-w-[180px] lg:max-w-[250px] hidden sm:inline" title={item.FollowUpDetail}>
                                  💬 {item.FollowUpDetail}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 pl-2 sm:pl-3 border-l border-slate-200 text-right">
                            <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">ค้างเคส</span>
                            <span className={`text-xs sm:text-sm font-black font-mono shrink-0 ${
                              item.DaysActive >= 14 ? 'text-rose-600' : item.DaysActive >= 7 ? 'text-amber-600' : 'text-slate-800'
                            }`}>
                              {item.DaysActive} วัน
                            </span>
                          </div>
                        </div>
                        {item.FollowUpDetail && (
                          <div className="mt-1 text-[10px] text-slate-500 italic sm:hidden truncate">
                            💬 {item.FollowUpDetail}
                          </div>
                        )}
                      </a>
                    ))
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-450 italic">
                      ไม่พบรถยนต์ที่เข้าเงื่อนไขยังวิ่งใช้งานอยู่
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Right Column: Live Timeline Log Feed & Problem Types */}
            <div className="space-y-6">
              
              {/* Card: Live Follow-Up Timeline Feed */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span>📋</span> อัปเดตความคืบหน้าเรียลไทม์ (Live Follow-up Feed)
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">ประวัติการบันทึกงานซ่อมบำรุงล่าสุด</p>
                </div>

                <div className="space-y-4 pl-3.5 border-l border-slate-200 py-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {followUps.length > 0 ? (
                    followUps.map((log) => (
                      <div key={log.MaintenanceFollowUpID} className="relative text-[10px] group">
                        
                        {/* Dot indicator */}
                        <span className="absolute -left-[19.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white group-hover:bg-amber-400 transition" />
                        
                        <div className="flex justify-between text-slate-450">
                          <span className="font-mono">{formatThaiDate(log.CreateDate, true)}</span>
                          <span className="font-bold text-slate-600">{log.CreateUserName}</span>
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 mt-1.5 space-y-1 group-hover:border-slate-300 transition">
                          <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                            🚗 <span className="text-indigo-650 font-black">{log.RegisterNo}</span>
                            <span className="text-slate-400">({log.IssueTitle?.slice(0, 20)}...)</span>
                          </p>
                          <p className="text-xs font-semibold text-slate-700 leading-relaxed break-words whitespace-pre-line">
                            {log.FollowUpDetail}
                          </p>
                        </div>

                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-450 italic py-4 text-center">ยังไม่มีประวัติการอัปเดตติดตามล่าสุด</p>
                  )}
                </div>
              </div>

              {/* Card: Problem Types Ratio */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span>💡</span> สาเหตุและประเภทของปัญหา (Problem Types Ratio)
                  </h2>
                  <p className="text-[10px] text-slate-505 mt-0.5">สัดส่วนตามประเภทความเสียหายของรถยนต์ในตั๋วซ่อม</p>
                </div>

                <div className="space-y-3.5">
                  {problemTypes.map((t) => (
                    <div key={t.ProblemTypeCode} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-slate-600">{t.ProblemTypeName || t.ProblemTypeCode}</span>
                        <span className="font-black text-slate-800">{t.Count} เคส</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 h-full rounded-full"
                          style={{ width: stats.total ? `${(t.Count / stats.total) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* SLA Details & Export Modal */}
        {slaModalRange && (
          <div 
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
            onClick={() => setSlaModalRange(null)}
          >
            <div 
              className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-white">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-2xl">📋</span>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      รายการรถซ่อมคงค้าง: ช่วง {slaModalRange === '1-5' ? '1 - 5 วัน' : slaModalRange === '6-10' ? '6 - 10 วัน' : slaModalRange === '11-15' ? '11 - 15 วัน' : slaModalRange === '16-30' ? '16 - 30 วัน' : '> 30 วัน'}
                    </h3>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      slaModalRange === '1-5' ? 'bg-emerald-100 text-emerald-800' :
                      slaModalRange === '6-10' ? 'bg-sky-100 text-sky-800' :
                      slaModalRange === '11-15' ? 'bg-amber-100 text-amber-800' :
                      slaModalRange === '16-30' ? 'bg-orange-100 text-orange-800' :
                      'bg-rose-100 text-rose-800 animate-pulse'
                    }`}>
                      {modalRawItems.length} คัน
                    </span>
                    {selectedLocationFilter && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                        📍 {locationMap[selectedLocationFilter] || selectedLocationFilter}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    รายการรถยนต์ที่อยู่ระหว่างจอดซ่อมตามเกณฑ์ SLA สามารถค้นหา ตรวจสอบรายละเอียด และดาวน์โหลดไฟล์ Excel ได้
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleExportSla(modalRawItems, slaModalRange)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl transition-all shadow-sm hover:shadow active:scale-95 cursor-pointer"
                  >
                    <span>📥</span>
                    <span>Export Excel ({modalRawItems.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlaModalRange(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Search Bar */}
              <div className="px-5 sm:px-6 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs pointer-events-none">🔍</span>
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="ค้นหาทะเบียน, เลข VIN, รุ่น, อู่ หรือปัญหาในรายการนี้..."
                    className="w-full text-xs py-2 pl-8 pr-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400 shadow-xs"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  แสดง {modalItems.length} จาก {modalRawItems.length} คัน
                </span>
              </div>

              {/* Modal Table Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {modalItems.length > 0 ? (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                            <th className="py-3 px-3.5 text-center w-12">#</th>
                            <th className="py-3 px-3.5">ทะเบียน / รุ่น</th>
                            <th className="py-3 px-3.5">เลข VIN / โครงการ</th>
                            <th className="py-3 px-3.5">อาการที่แจ้งซ่อม</th>
                            <th className="py-3 px-3.5">สถานที่ซ่อม / อู่</th>
                            <th className="py-3 px-3.5 text-center">วันเริ่มซ่อม / แจ้งซ่อม</th>
                            <th className="py-3 px-3.5 text-center">ค้างซ่อม</th>
                            <th className="py-3 px-3.5 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {modalItems.map((item, idx) => (
                            <tr key={item.MaintenanceItemID} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3.5">
                                <a
                                  href={`/vehicle/${encodeURIComponent(item.RegisterNo || '')}`}
                                  className="font-mono font-extrabold text-slate-900 hover:text-indigo-600 transition"
                                >
                                  {item.RegisterNo || 'ไม่มีทะเบียน'}
                                </a>
                                <p className="text-[10.5px] text-slate-500 truncate max-w-[120px]">{item.Model || '-'}</p>
                              </td>
                              <td className="py-3 px-3.5">
                                <span className="font-mono text-[10.5px] text-slate-600 block truncate max-w-[140px]">{item.VinNo || '-'}</span>
                                <span className="text-[10px] text-slate-400">{item.Project || '-'}</span>
                              </td>
                              <td className="py-3 px-3.5 max-w-[200px]">
                                <p className="font-semibold text-slate-800 truncate" title={item.IssueTitle}>
                                  {item.IssueTitle}
                                </p>
                                {item.FollowUpDetail && (
                                  <p className="text-[10px] text-slate-500 italic truncate mt-0.5" title={item.FollowUpDetail}>
                                    💬 {item.FollowUpDetail}
                                  </p>
                                )}
                              </td>
                              <td className="py-3 px-3.5">
                                <span className="font-medium text-slate-700">
                                  {locationMap[item.ServiceLocationCode] || item.ServiceLocationCode || 'ไม่ระบุ'}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-center font-mono text-[11px] text-slate-600">
                                {item.SlaDateType === 'START_DATE' && item.MaintenanceStartDate ? (
                                  <div>
                                    <span className="font-bold text-slate-800">{formatThaiDate(item.MaintenanceStartDate)}</span>
                                    <span className="block text-[9.5px] text-emerald-700 font-sans font-medium">✓ ใช้วันเริ่มซ่อม</span>
                                    {item.ReportDate && (
                                      <span className="block text-[9px] text-slate-400 font-sans">แจ้ง: {formatThaiDate(item.ReportDate)}</span>
                                    )}
                                  </div>
                                ) : item.ReportDate ? (
                                  <div>
                                    <span className="font-bold text-slate-800">{formatThaiDate(item.ReportDate)}</span>
                                    <span className="inline-block mt-0.5 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      ใช้วันที่แจ้งซ่อม (รอระบุวันเริ่ม)
                                    </span>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="text-slate-600 font-sans text-[10px]">รอเปิดใบงานซ่อม</span>
                                    <span className="block text-[8.5px] text-slate-400 font-sans">คำนวณจากวันรับรถ</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg border ${
                                  item.DaysActive > 30 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  item.DaysActive >= 16 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  item.DaysActive >= 11 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  item.DaysActive >= 6 ? 'bg-sky-50 text-sky-700 border-sky-200' :
                                  'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {item.DaysActive} วัน
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                <a
                                  href={`/vehicle/${encodeURIComponent(item.RegisterNo || '')}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                                >
                                  <span>ดูรถ</span>
                                  <span>→</span>
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-3xl mb-2">🔍</p>
                    <p className="text-sm font-semibold text-slate-600">ไม่พบรายการรถที่ตรงกับคำค้นหา</p>
                    <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหา หรือล้างคำค้นหา</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-semibold text-slate-500">
                  รวมทั้งหมด {modalRawItems.length} คัน
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportSla(modalRawItems, slaModalRange)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-300 hover:border-emerald-600 px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                  >
                    <span>📥</span>
                    <span>Export Excel ({modalRawItems.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlaModalRange(null)}
                    className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function MaintenanceDashboardPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm">
          กำลังโหลดแดชบอร์ด...
        </div>
      }>
        <MaintenanceDashboardContent />
      </Suspense>
    </AuthGuard>
  )
}
