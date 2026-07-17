'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import { exportToExcel, ExportButton } from '@/lib/exportExcel'

interface CaseDeliveryItem {
  VinNo: string
  MotorNo: string
  RegisterNo: string
  ContractNo: string
  FirstName: string
  LastName: string
  ExpectedReleaseDate: string
  ProjectType: string
}

const ITEMS_PER_PAGE = 20

const PROJECT_TYPE_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'EV', label: 'EV' },
  { value: 'GRAB', label: 'Grab' },
  { value: 'LINEMAN', label: 'Line Man' },
]

const PROJECT_BADGE_COLORS: Record<string, string> = {
  EV: 'bg-blue-50 text-blue-700 border-blue-200',
  GRAB: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  LINEMAN: 'bg-lime-50 text-lime-700 border-lime-200',
}

function getThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    // ExpectedReleaseDate format: "DD/MM/YYYY HH:mm:ss"
    const parts = dateStr.split(' ')
    const dateParts = parts[0].split('/')
    if (dateParts.length === 3) {
      const d = parseInt(dateParts[0], 10)
      const m = parseInt(dateParts[1], 10) - 1
      const y = parseInt(dateParts[2], 10)
      const date = new Date(y, m, d)
      return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    }
    return dateStr
  } catch {
    return dateStr
  }
}

function getThaiDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.split(' ')
    const dateParts = parts[0].split('/')
    const timeParts = parts[1] ? parts[1].split(':') : []
    if (dateParts.length === 3) {
      const d = parseInt(dateParts[0], 10)
      const m = parseInt(dateParts[1], 10) - 1
      const y = parseInt(dateParts[2], 10)
      const h = timeParts[0] ? parseInt(timeParts[0], 10) : 0
      const min = timeParts[1] ? parseInt(timeParts[1], 10) : 0
      const date = new Date(y, m, d, h, min)
      return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }) + ' ' + date.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return dateStr
  } catch {
    return dateStr
  }
}

function getTodayStr(): string {
  const now = new Date()
  return now.toISOString().slice(0, 10)
}

function CaseDeliveryContent() {
  const [data, setData] = useState<CaseDeliveryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateStart, setDateStart] = useState(getTodayStr())
  const [dateEnd, setDateEnd] = useState(getTodayStr())
  const [projectType, setProjectType] = useState('')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (dateStart) params.set('date_start', dateStart)
      if (dateEnd) params.set('date_end', dateEnd)
      if (projectType) params.set('project_type', projectType)

      const res = await fetch(`/api/case-delivery?${params.toString()}`)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const json = await res.json()
      if (json.statusCode === 200 && json.message?.list) {
        setData(json.message.list)
      } else {
        setData([])
      }
      setPage(1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      setError(msg)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [dateStart, dateEnd, projectType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Client-side filtering by search text
  const filtered = data.filter((item) => {
    if (!searchText) return true
    const q = searchText.toLowerCase()
    return (
      item.VinNo?.toLowerCase().includes(q) ||
      item.RegisterNo?.toLowerCase().includes(q) ||
      item.ContractNo?.toLowerCase().includes(q) ||
      item.FirstName?.toLowerCase().includes(q) ||
      item.LastName?.toLowerCase().includes(q) ||
      item.MotorNo?.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  // Summary counts
  const summary = {
    total: filtered.length,
    ev: filtered.filter((i) => i.ProjectType === 'EV').length,
    grab: filtered.filter((i) => i.ProjectType === 'GRAB').length,
    lineman: filtered.filter((i) => i.ProjectType === 'LINEMAN').length,
  }

  const handleExport = () => {
    const periodLabel =
      dateStart === dateEnd
        ? getThaiDate(`${dateStart.split('-')[2]}/${dateStart.split('-')[1]}/${dateStart.split('-')[0]}`)
        : `${getThaiDate(`${dateStart.split('-')[2]}/${dateStart.split('-')[1]}/${dateStart.split('-')[0]}`)} - ${getThaiDate(`${dateEnd.split('-')[2]}/${dateEnd.split('-')[1]}/${dateEnd.split('-')[0]}`)}`

    exportToExcel({
      reportName: 'รายงาน Case Delivery',
      periodLabel,
      headers: [
        '#',
        'VIN No',
        'Motor No',
        'ทะเบียน',
        'เลขสัญญา',
        'ชื่อ',
        'นามสกุล',
        'วันที่นัดปล่อย',
        'โครงการ',
      ],
      rows: filtered.map((item, idx) => [
        idx + 1,
        item.VinNo || '-',
        item.MotorNo || '-',
        item.RegisterNo || '-',
        item.ContractNo || '-',
        item.FirstName || '-',
        item.LastName || '-',
        item.ExpectedReleaseDate || '-',
        item.ProjectType || '-',
      ]),
      fileName: 'CaseDelivery',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                🚗 Case Delivery (EV7 Core)
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                ข้อมูลการปล่อยรถจากระบบ EV7 Core
              </p>
            </div>
            <ExportButton onClick={handleExport} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">โครงการ</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition font-medium"
              >
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">ค้นหา</label>
              <input
                type="text"
                placeholder="VIN / ทะเบียน / สัญญา / ชื่อ..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition placeholder-slate-400"
              />
            </div>
            <div>
              <button
                onClick={fetchData}
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-sm rounded-xl px-4 py-2.5 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {loading ? '⏳ กำลังโหลด...' : '🔍 ค้นหา'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-slate-800">{summary.total}</div>
            <div className="text-xs font-medium text-slate-500 mt-1">ทั้งหมด</div>
          </div>
          <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.ev}</div>
            <div className="text-xs font-medium text-blue-500 mt-1">EV</div>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{summary.grab}</div>
            <div className="text-xs font-medium text-emerald-500 mt-1">Grab</div>
          </div>
          <div className="bg-white rounded-2xl border border-lime-100 shadow-sm p-4 text-center">
            <div className="text-2xl font-bold text-lime-600">{summary.lineman}</div>
            <div className="text-xs font-medium text-lime-500 mt-1">Line Man</div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm text-rose-700 font-medium">
            ❌ {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/60">
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">#</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">VIN No</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">Motor No</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">ทะเบียน</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">เลขสัญญา</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">ชื่อ-นามสกุล</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">วันที่นัดปล่อย</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">โครงการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium">กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400 font-medium">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, idx) => {
                    const rowNum = (page - 1) * ITEMS_PER_PAGE + idx + 1
                    const badgeColor = PROJECT_BADGE_COLORS[item.ProjectType] || 'bg-slate-50 text-slate-600 border-slate-200'
                    return (
                      <tr
                        key={`${item.VinNo}-${item.ContractNo}-${idx}`}
                        className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors"
                      >
                        <td className="py-3 px-4 text-slate-400 font-medium">{rowNum}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{item.VinNo || '-'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{item.MotorNo || '-'}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{item.RegisterNo || '-'}</td>
                        <td className="py-3 px-4 text-slate-600">{item.ContractNo || '-'}</td>
                        <td className="py-3 px-4 text-slate-700">
                          {item.FirstName || ''} {item.LastName || ''}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {getThaiDateTime(item.ExpectedReleaseDate)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg border ${badgeColor}`}>
                            {item.ProjectType || '-'}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 pb-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CaseDeliveryPage() {
  return (
    <AuthGuard>
      <CaseDeliveryContent />
    </AuthGuard>
  )
}
