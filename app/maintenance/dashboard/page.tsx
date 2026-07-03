'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { LoginProfile } from '@/components/ui/LoginProfile'
import { AuthGuard } from '@/components/ui/AuthGuard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface DashboardStats {
  total: number
  in_maintenance: number
  waiting: number
  complete: number
  on_rent_maintenance?: number
  ready_pickup?: number
  replacement_maintenance?: number
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
  MaintenanceItemID: number
  RegisterNo: string
  Model: string
  Project: string
  IssueTitle: string
  CarStatusCode: string
  CarStatusName: string
  ServiceLocationCode: string
  ReportDate: string
  DaysActive: number
  FollowUpDetail: string | null
}

interface MaintenanceDashboardData {
  stats: DashboardStats
  locations: LocationStat[]
  problemTypes: ProblemTypeStat[]
  followUps: FollowUpItem[]
  longestRepairs: LongestRepairItem[]
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

function formatThaiDate(dateStr: string) {
  if (!dateStr) return '-'
  try {
    // SQL Server stores Bangkok time directly — use UTC methods to avoid double +7 offset
    const d = new Date(dateStr)
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
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

  // Filter longest repairs if location card is clicked
  const filteredLongestRepairs = selectedLocationFilter
    ? longestRepairs.filter(r => r.ServiceLocationCode === selectedLocationFilter || (selectedLocationFilter === 'ไม่ระบุ' && !r.ServiceLocationCode))
    : longestRepairs.slice(0, 30)

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
            <LoginProfile />
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
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
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
              <p className="text-xs text-orange-600 font-bold">🟠 รถซ่อมเสร็จ รอปล่อย</p>
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

              {/* Card: Stuck Repairs (ซ่อมนานที่สุด) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <span>⚠️</span> รถยนต์ที่อยู่ระหว่างซ่อมค้างนานที่สุด (Stuck Repairs)
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">เรียงลำดับตามวันที่เริ่มเกิดเหตุ/วันที่แจ้งซ่อมคงค้าง</p>
                  </div>
                  {selectedLocationFilter && (
                    <button
                      onClick={() => setSelectedLocationFilter(null)}
                      className="text-xs font-bold text-indigo-650 hover:underline"
                    >
                      ล้างตัวกรองอู่ (แสดงทั้งหมด)
                    </button>
                  )}
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
                              item.DaysActive >= 14
                                ? 'text-rose-600'
                                : item.DaysActive >= 7
                                ? 'text-amber-600'
                                : 'text-slate-800'
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

            </div>

            {/* Right Column: Live Timeline Log Feed & Problem Types */}
            <div className="space-y-6">
              
              {/* Card: Live Follow-Up Timeline Feed */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <span>📋</span> อัปเดตความคืบหน้าเรียลไทม์ (Live Follow-up Feed)
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">ประวัติการบันทึกงานซ่อมบำรุงล่าสุดจากมือถือคนขับ / อู่คู่สัญญา</p>
                </div>

                <div className="space-y-4 pl-3.5 border-l border-slate-200 py-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {followUps.length > 0 ? (
                    followUps.map((log) => (
                      <div key={log.MaintenanceFollowUpID} className="relative text-[10px] group">
                        
                        {/* Dot indicator */}
                        <span className="absolute -left-[19.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white group-hover:bg-amber-400 transition" />
                        
                        <div className="flex justify-between text-slate-450">
                          <span className="font-mono">{formatThaiDate(log.CreateDate)}</span>
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
