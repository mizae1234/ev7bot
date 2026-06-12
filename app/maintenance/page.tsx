'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { exportToExcel, formatDateForExcel, ExportButton } from '@/lib/exportExcel'

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
}

interface MaintenanceData {
  items: MaintenanceItem[]
  summary: { total: number; in_maintenance: number; complete: number; waiting: number }
  locations: string[]
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

const formatLocation = (code: string) => code.replace(/_/g, ' ')

export default function MaintenancePage() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [search, setSearch] = useState('')
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
      headers: ['ทะเบียน', 'เลขตัวถัง (VIN)', 'รุ่น', 'โครงการ', 'อาการ', 'สถานที่ซ่อม', 'ประเภทปัญหา', 'เคส', 'ผู้รับผิดชอบ', 'ประกัน', 'วันแจ้ง', 'วันเกิดเหตุ', 'วันเริ่มซ่อม', 'วันซ่อมเสร็จ', 'วันรับคืน', 'สถานะ', 'รถทดแทน', 'หมายเหตุ'],
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
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              รายละเอียดงานซ่อมทั้งหมด สถานที่ซ่อม สถานะ และรถทดแทน
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button onClick={() => setStatusFilter('all')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'all' ? 'border-indigo-500/40 bg-indigo-500/5 ring-1 ring-indigo-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">ทั้งหมด</p>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-white mt-1">{data.summary.total}</p>
            </button>
            <button onClick={() => setStatusFilter('IN_MAINTENANCE')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'IN_MAINTENANCE' ? 'border-amber-500/40 bg-amber-500/5 ring-1 ring-amber-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">🔧 กำลังซ่อม</p>
              <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">{data.summary.in_maintenance}</p>
            </button>
            <button onClick={() => setStatusFilter('WAITING_FOR_MAINTENANCE')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'WAITING_FOR_MAINTENANCE' ? 'border-rose-500/40 bg-rose-500/5 ring-1 ring-rose-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">⏳ รอเข้าซ่อม</p>
              <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">{data.summary.waiting}</p>
            </button>
            <button onClick={() => setStatusFilter('COMPLETE')}
              className={`rounded-2xl border p-4 text-left transition-all duration-200 ${statusFilter === 'COMPLETE' ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20' : 'border-zinc-200/80 bg-white/70 dark:border-zinc-800/80 dark:bg-zinc-900/60 hover:border-zinc-300'}`}>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">✅ ซ่อมเสร็จ</p>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">{data.summary.complete}</p>
            </button>
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
                    <th className="py-3 pr-2">ทะเบียน / VIN</th>
                    <th className="py-3 pr-2">รุ่น</th>
                    <th className="py-3 pr-2">อาการ</th>
                    <th className="py-3 pr-2">📍 สถานที่ซ่อม</th>
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
                          <td className="py-3.5 pr-2">
                            <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{item.register_no || '-'}</div>
                            <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{item.vin}</div>
                          </td>
                          <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{item.model || '-'}</td>
                          <td className="py-3.5 pr-2 max-w-[200px] truncate" title={item.issue_title}>{item.issue_title || '-'}</td>
                          <td className="py-3.5 pr-2 text-emerald-700 dark:text-emerald-400 font-medium">{item.service_location}</td>
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
                            <td colSpan={9} className="px-6 py-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-zinc-400 font-bold">โครงการ:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{item.project || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold">ผู้รับผิดชอบ:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{item.fault_party}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold">ประกัน:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{item.insurance}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold">วันเกิดเหตุ:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{formatDateTh(item.incident_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold">วันเริ่มซ่อม:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{formatDateTh(item.start_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold">วันซ่อมเสร็จ:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{formatDateTh(item.finish_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold">วันรับคืน:</span>
                                  <span className="ml-2 text-zinc-800 dark:text-zinc-200">{formatDateTh(item.return_date)}</span>
                                </div>
                                {item.follow_up && (
                                  <div className="sm:col-span-2 lg:col-span-4">
                                    <span className="text-zinc-400 font-bold">หมายเหตุ:</span>
                                    <span className="ml-2 text-zinc-800 dark:text-zinc-200">{item.follow_up}</span>
                                  </div>
                                )}

                                {/* Replacement cars */}
                                {item.replacements.length > 0 && (
                                  <div className="sm:col-span-2 lg:col-span-4 mt-2 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">🚙 รถทดแทน:</span>
                                    <div className="mt-2 space-y-1">
                                      {item.replacements.map((r, i) => (
                                        <div key={i} className="flex items-center gap-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5">
                                          <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{r.register_no || r.vin}</span>
                                          {r.register_no && <span className="text-zinc-400 text-[10px] font-mono">{r.vin}</span>}
                                          <span className="text-zinc-500">{formatDateTh(r.start_date)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Link to vehicle detail */}
                              <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                <a
                                  href={`/vehicle/${encodeURIComponent(item.register_no || item.vin)}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                                >
                                  🔗 ดูข้อมูลรถคันนี้
                                </a>
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
