'use client'
import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { exportToExcel, formatDateForExcel, ExportButton } from '@/lib/exportExcel'
import { LoginProfile } from '@/components/ui/LoginProfile'
import { AuthGuard } from '@/components/ui/AuthGuard'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface MaintenanceItem {
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
  insurance: string
  report_date: string | null
  incident_date: string | null
  start_date: string | null
  finish_date: string | null
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

interface MaintenanceData {
  items: MaintenanceItem[]
  summary: { total: number; in_maintenance: number; complete: number; waiting: number }
  locations: string[]
  locationSummary: { Location: string; Count: number }[]
  fetchedAt: string
}

const formatDateTh = (dateStr: string | null) => {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok'
    })
  } catch { return dateStr }
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

const formatLocation = (code: string | null | undefined): string => {
  if (!code) return '-'
  return locationMap[code] || code.replace(/_/g, ' ')
}

function MaintenanceContent() {
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const loc = searchParams.get('location')
    if (loc) {
      setLocationFilter(loc)
    }
  }, [searchParams])
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const params = new URLSearchParams()
  if (statusFilter !== 'all') params.set('status', statusFilter)
  if (locationFilter !== 'all') params.set('location', locationFilter)

  const { data, isLoading, error } = useSWR<MaintenanceData>(
    `/api/maintenance?${params.toString()}`,
    fetcher,
    { refreshInterval: 60_000 }
  )

  const filteredItems = (data?.items || []).filter(item => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      (item.register_no || '').toLowerCase().includes(s) ||
      (item.vin || '').toLowerCase().includes(s) ||
      (item.model || '').toLowerCase().includes(s) ||
      (item.issue_title || '').toLowerCase().includes(s) ||
      (item.service_location || '').toLowerCase().includes(s)
    )
  })

  const getStatusColor = (code: string) => {
    switch (code) {
      case 'IN_MAINTENANCE': return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400'
      case 'COMPLETE': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400'
      case 'WAITING_FOR_MAINTENANCE': return 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400'
      case 'STILL_WORK': return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400'
      case 'READY_PICKUP_MAINTENANCE': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400'
      default: return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400'
    }
  }

  const getCaseColor = (code: string) => {
    if (code === 'ซ่อมหนัก') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    if (code === 'ซ่อมเบา') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    return ''
  }

  const handleExport = () => {
    const statusLabel = statusFilter === 'all' ? 'ทั้งหมด' : statusFilter
    const locLabel = locationFilter === 'all' ? 'ทุกอู่' : formatLocation(locationFilter)
    exportToExcel({
      reportName: 'รายการงานซ่อมทั้งหมด',
      periodLabel: `สถานะ: ${statusLabel} | อู่: ${locLabel}`,
      headers: ['ทะเบียน', 'เลขตัวถัง (VIN)', 'รุ่น', 'โครงการ', 'อาการ', 'สถานที่ซ่อม', 'ประเภทปัญหา', 'เคส', 'ผู้รับผิดชอบ', 'ประกัน', 'วันแจ้ง', 'วันเกิดเหตุ', 'วันเริ่มซ่อม', 'วันซ่อมเสร็จ', 'วันรับคืน', 'สถานะ', 'รถทดแทน', 'หมายเหตุ', 'ผู้สร้าง', 'ผู้แก้ไข'],
      rows: filteredItems.map(item => [
        item.register_no || '-',
        item.vin,
        item.model || '-',
        item.project || '-',
        item.issue_title || '-',
        item.service_location,
        item.problem_type,
        item.car_case,
        item.fault_party,
        item.insurance,
        formatDateForExcel(item.report_date),
        formatDateForExcel(item.incident_date),
        formatDateForExcel(item.start_date),
        formatDateForExcel(item.finish_date),
        formatDateForExcel(item.return_date),
        item.status_text,
        item.replacements.map(r => r.register_no || r.vin).join(', ') || '-',
        item.follow_up || '-',
        item.create_user_name || '-',
        item.update_user_name || '-',
      ]),
      fileName: 'รายการงานซ่อม',
    })
  }

  return (
    <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-emerald-600 dark:from-zinc-100 dark:to-emerald-400 tracking-tight">
                🔧 รายการงานซ่อม
              </h1>
              <a href="/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850 text-zinc-500 dark:text-zinc-400 transition-all">
                ← กลับ Dashboard
              </a>
              <a href="/maintenance/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition-all flex items-center gap-1.5">
                📊 แดชบอร์ดวิเคราะห์งานซ่อม
              </a>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              รายละเอียดงานซ่อมทั้งหมด สถานที่ซ่อม สถานะ และรถทดแทน
            </p>
          </div>
          <div className="flex items-center justify-end">
            <LoginProfile />
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => setStatusFilter('all')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'all' ? 'border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">ทั้งหมด</p>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">
                {data.summary.total} <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-0.5">คัน</span>
              </p>
            </button>
            <button onClick={() => setStatusFilter('IN_MAINTENANCE')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'IN_MAINTENANCE' ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">🔧 กำลังซ่อม</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {data.summary.in_maintenance} <span className="text-xs font-normal text-amber-500 dark:text-amber-450 ml-0.5">คัน</span>
              </p>
            </button>
            <button onClick={() => setStatusFilter('WAITING_FOR_MAINTENANCE')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'WAITING_FOR_MAINTENANCE' ? 'border-rose-500/40 bg-rose-500/5 ring-1 ring-rose-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">⏳ รอเข้าซ่อม</p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {data.summary.waiting} <span className="text-xs font-normal text-rose-500 dark:text-rose-450 ml-0.5">คัน</span>
              </p>
            </button>
          </div>
        )}

        {/* Repairs by Location */}
        {data?.locationSummary && data.locationSummary.length > 0 && (
          <div className="bg-white/70 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm backdrop-blur-md">
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-4">
              📍 รถค้างซ่อมแยกตามอู่/พื้นที่
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {data.locationSummary.map((item: any, idx: number) => {
                const displayLoc = item.Location === 'ไม่ระบุ' ? 'ไม่ระบุพื้นที่/อู่' : item.Location.replace(/_/g, ' ')
                const isSelected = locationFilter === item.Location

                return (
                  <button
                    key={idx}
                    onClick={() => setLocationFilter(isSelected ? 'all' : item.Location)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-[11px] text-left ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-950/20 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="truncate pr-2" title={displayLoc}>
                      {displayLoc}
                    </span>
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 shrink-0">
                      {item.Count} <span className="text-[9px] font-normal text-zinc-400">คัน</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center bg-white/60 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80">
          <input
            type="text"
            placeholder="🔍 ค้นหา ทะเบียน, VIN, อาการ, อู่..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
          />
          {data?.locations && data.locations.length > 0 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
            >
              <option value="all">📍 อู่ทั้งหมด</option>
              {data.locations.map(loc => (
                <option key={loc} value={loc}>{formatLocation(loc)}</option>
              ))}
              <option value="ไม่ระบุ">📍 ไม่ระบุพื้นที่/อู่</option>
            </select>
          )}
          <ExportButton onClick={handleExport} />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center py-10 text-rose-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
        )}

        {/* Table */}
        {data && !isLoading && (
          <div className="rounded-2xl border border-zinc-200/80 bg-white/70 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                แสดง {filteredItems.length} รายการ {statusFilter !== 'all' ? `(สถานะ: ${statusFilter})` : ''} {locationFilter !== 'all' ? `(อู่: ${formatLocation(locationFilter)})` : ''}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-3 px-4"></th>
                    <th className="py-3 pr-2">📍 สถานที่ซ่อม</th>
                    <th className="py-3 pr-2">👤 ผู้รับผิดชอบตามงาน</th>
                    <th className="py-3 pr-2">ทะเบียน / VIN</th>
                    <th className="py-3 pr-2">รุ่น</th>
                    <th className="py-3 pr-2">อาการ</th>
                    <th className="py-3 pr-2">ประเภท</th>
                    <th className="py-3 pr-2">เคส</th>
                    <th className="py-3 pr-2">วันที่แจ้ง</th>
                    <th className="py-3 pr-4 text-right">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr
                          className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150 cursor-pointer"
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        >
                          <td className="py-3.5 px-4 text-zinc-400">
                            <span className={`inline-block transition-transform duration-200 ${expandedId === item.id ? 'rotate-90' : ''}`}>▶</span>
                          </td>
                          <td className="py-3.5 pr-2 text-emerald-700 dark:text-emerald-400 font-medium">{formatLocation(item.service_location_code || item.service_location)}</td>
                          <td className="py-3.5 pr-2 font-semibold">
                            {(() => {
                              const code = item.status_code || ''
                              if (code === 'READY_PICKUP_MAINTENANCE') {
                                return (
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
                                    EV7
                                  </span>
                                )
                              } else if (code === 'COMPLETE') {
                                return <span className="text-zinc-400 font-normal">-</span>
                              } else {
                                return (
                                  <span className="text-zinc-700 dark:text-zinc-300">
                                    {formatLocation(item.service_location_code || item.service_location) || '-'}
                                  </span>
                                )
                              }
                            })()}
                          </td>
                          <td className="py-3.5 pr-2" onClick={(e) => e.stopPropagation()}>
                            <a
                              href={`/vehicle/${encodeURIComponent(item.register_no || item.vin)}`}
                              className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                            >
                              {item.register_no || '-'}
                            </a>
                            <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{item.vin}</div>
                          </td>
                          <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{item.model || '-'}</td>
                          <td className="py-3.5 pr-2 max-w-[200px] truncate" title={item.issue_title}>{item.issue_title || '-'}</td>
                          <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{item.problem_type}</td>
                          <td className="py-3.5 pr-2">
                            {item.car_case !== '-' && (
                              <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${getCaseColor(item.car_case)}`}>
                                {item.car_case}
                              </span>
                            )}
                            {item.car_case === '-' && <span className="text-zinc-400">-</span>}
                          </td>
                          <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{formatDateTh(item.report_date)}</td>
                          <td className="py-3.5 pr-4 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.status_code)}`}>
                              {item.status_text}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {expandedId === item.id && (
                          <tr className="bg-zinc-50/80 dark:bg-zinc-800/40">
                            <td colSpan={10} className="px-6 py-5">
                              <div className="space-y-4">
                                {/* Title / ID info */}
                                <div className="flex items-center gap-3 text-xs font-bold text-zinc-500 dark:text-zinc-450 pb-2 border-b border-zinc-250/60 dark:border-zinc-700/60">
                                  <span>🆔 ใบสั่งซ่อม ID: <span className="text-zinc-800 dark:text-zinc-200 font-mono">{item.id}</span></span>
                                  <span>•</span>
                                  <span>🚗 ทะเบียน/VIN: <span className="text-zinc-800 dark:text-zinc-200 font-mono">{item.register_no || '-'} / {item.vin}</span></span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3.5 text-xs">
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🏢 โครงการ:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.project || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🚗 รุ่นรถ:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.model || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🔧 อาการที่แจ้ง:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">{item.issue_title || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">⚠️ ประเภทปัญหา:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.problem_type || '-'}</span>
                                  </div>

                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">💼 เคสการซ่อม:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.car_case || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🛡️ ประกันภัย:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.insurance || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">👤 ฝ่ายที่ผิด (ผู้รับผิดชอบ):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.fault_party || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📍 สถานที่ซ่อม (อู่):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">
                                      {formatLocation(item.service_location_code || item.service_location)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-455 font-bold block mb-1">📞 ผู้รับผิดชอบตามงาน:</span>
                                    <span className="text-indigo-650 dark:text-indigo-400 font-bold">
                                      {(() => {
                                        const code = item.status_code || ''
                                        if (code === 'READY_PICKUP_MAINTENANCE') return 'EV7'
                                        if (code === 'COMPLETE') return '-'
                                        return formatLocation(item.service_location_code || item.service_location) || '-'
                                      })()}
                                    </span>
                                  </div>

                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">⚙️ สถานะการซ่อม:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                                      {item.status_text || '-'} {item.status_code ? `(${item.status_code})` : ''}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันแจ้งซ่อม (Report):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.report_date)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันเกิดเหตุ (Incident):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.incident_date)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันเริ่มเข้าซ่อม (Start):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.start_date)}</span>
                                  </div>

                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันซ่อมเสร็จ (Finish):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.finish_date)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันรับรถคืน (Return):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.return_date)}</span>
                                  </div>

                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">👤 คนขับ (Driver):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.driver_name || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🔍 สาเหตุที่พบ (Root Cause):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.root_cause || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🛠️ การแก้ไข (Fix Action):</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{item.fix_action || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันติดตามล่าสุด:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.last_follow_up_date)}</span>
                                  </div>

                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">🔗 ใบสั่งซ่อมหลัก ID:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200 font-mono">{item.parent_maintenance_id || '-'}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันที่สร้างใบสั่งซ่อม:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.create_date)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">📅 วันที่อัปเดตล่าสุด:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.update_date)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-450 font-bold block mb-1">👤 ID ผู้สร้าง / ผู้แก้ไข:</span>
                                    <span className="text-zinc-800 dark:text-zinc-200">
                                      {item.create_user_id || '-'} / {item.update_user_id || '-'}
                                    </span>
                                  </div>
                                </div>

                                {/* Follow up notes */}
                                <div className="pt-2">
                                  <span className="text-zinc-450 font-bold block mb-1">📝 บันทึกติดตาม/หมายเหตุ (Follow Up):</span>
                                  <p className="text-zinc-800 dark:text-zinc-200 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200/40 dark:border-zinc-700/40">
                                    {item.follow_up || '-'}
                                  </p>
                                </div>

                                {/* Replacement cars */}
                                {item.replacements.length > 0 && (
                                  <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold block mb-2">🚙 รถทดแทน:</span>
                                    <div className="space-y-1">
                                      {item.replacements.map((r, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5 w-fit">
                                          <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{r.register_no || r.vin}</span>
                                          {r.register_no && <span className="text-zinc-400 text-[10px] font-mono">{r.vin}</span>}
                                          <span className="text-zinc-500">{formatDateTh(r.start_date)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Link to vehicle detail */}
                                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                  <a
                                    href={`/vehicle/${encodeURIComponent(item.register_no || item.vin)}`}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                                  >
                                    🔗 ดูข้อมูลรถคันนี้
                                  </a>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-20 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                        ไม่พบข้อมูลรายการงานซ่อม
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function MaintenancePage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
            <div className="flex justify-center py-20">
              <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          </div>
        </main>
      }>
        <MaintenanceContent />
      </Suspense>
    </AuthGuard>
  )
}
