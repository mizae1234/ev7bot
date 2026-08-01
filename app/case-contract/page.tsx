'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import { exportToExcel, ExportButton } from '@/lib/exportExcel'

interface CaseContractItem {
  VinNo: string
  MotorNo: string
  RegisterNo: string
  ContractNo: string
  FirstName: string
  LastName: string
  ExpectedReleaseDate: string
  ProjectType: string
  Status: string
}

const ITEMS_PER_PAGE = 50

const PROJECT_TYPE_OPTIONS = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'EV', label: 'EV' },
  { value: 'GRAB', label: 'Grab' },
  { value: 'LINEMAN', label: 'Line Man' },
]

const PROJECT_BADGE_COLORS: Record<string, string> = {
  EV: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/40',
  GRAB: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
  LINEMAN: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300 dark:border-lime-800/40',
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  'ส่งมอบรถเรียบร้อย': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800/40',
  'เตรียมการปล่อยรถ': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
  'ยกเลิก': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40',
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

function CaseContractContent() {
  const [data, setData] = useState<CaseContractItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Date filters: default to empty (show all)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [projectType, setProjectType] = useState('')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const apiRes = await fetch('https://api-aion.com7tracking.com/api/icare/getAllCase', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer a28dbe832c007c1d99b90e9d422815315dfc6f43a0814de8b4c3b753da5edc5d',
        },
      })

      if (!apiRes.ok) {
        throw new Error(`API error: ${apiRes.status}`)
      }

      const apiData = await apiRes.json()
      const list: CaseContractItem[] = apiData?.message?.list || []
      setData(list)
      setPage(1)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์'
      setError(msg)
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Get distinct statuses for filter dropdown
  const statusOptions = Array.from(new Set(data.map((item) => item.Status).filter(Boolean)))

  // Client-side filtering
  const filtered = data.filter((item) => {
    // 1. Project Type Filter
    if (projectType && item.ProjectType !== projectType) return false

    // 2. Status Filter
    if (statusFilter && item.Status !== statusFilter) return false

    // 3. Date Range Filter
    if (dateStart || dateEnd) {
      if (!item.ExpectedReleaseDate) return false
      const parts = item.ExpectedReleaseDate.split(' ')[0].split('/')
      if (parts.length !== 3) return false
      const itemDate = `${parts[2]}-${parts[1]}-${parts[0]}` // Format: YYYY-MM-DD
      if (dateStart && itemDate < dateStart) return false
      if (dateEnd && itemDate > dateEnd) return false
    }

    // 4. Search text filter
    if (searchText) {
      const q = searchText.toLowerCase()
      const fullName = `${item.FirstName || ''} ${item.LastName || ''}`.toLowerCase()
      return (
        item.VinNo?.toLowerCase().includes(q) ||
        item.MotorNo?.toLowerCase().includes(q) ||
        item.RegisterNo?.toLowerCase().includes(q) ||
        item.ContractNo?.toLowerCase().includes(q) ||
        fullName.includes(q) ||
        item.ProjectType?.toLowerCase().includes(q) ||
        item.Status?.toLowerCase().includes(q)
      )
    }

    return true
  })

  // Sort: ExpectedReleaseDate Descending
  const sorted = [...filtered].sort((a, b) => {
    const getDate = (item: CaseContractItem) => {
      if (item.ExpectedReleaseDate) {
        const parts = item.ExpectedReleaseDate.split(' ')[0].split('/')
        if (parts.length === 3) {
          const time = item.ExpectedReleaseDate.split(' ')[1] || '00:00:00'
          return `${parts[2]}-${parts[1]}-${parts[0]} ${time}`
        }
      }
      return ''
    }
    return getDate(b).localeCompare(getDate(a))
  })

  // Pagination calculations
  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE)
  const paginated = sorted.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  // Summary counts based on overall current filtered list
  const summary = {
    total: filtered.length,
    ev: filtered.filter((i) => i.ProjectType === 'EV').length,
    grab: filtered.filter((i) => i.ProjectType === 'GRAB').length,
    lineman: filtered.filter((i) => i.ProjectType === 'LINEMAN').length,
    delivered: filtered.filter((i) => i.Status === 'ส่งมอบรถเรียบร้อย').length,
  }

  // Handle Excel Export
  const handleExport = () => {
    let periodLabel = 'ทั้งหมด'
    if (dateStart && dateEnd) {
      const startLabel = getThaiDate(`${dateStart.split('-')[2]}/${dateStart.split('-')[1]}/${dateStart.split('-')[0]}`)
      const endLabel = getThaiDate(`${dateEnd.split('-')[2]}/${dateEnd.split('-')[1]}/${dateEnd.split('-')[0]}`)
      periodLabel = `${startLabel} - ${endLabel}`
    } else if (dateStart) {
      periodLabel = `ตั้งแต่ ${getThaiDate(`${dateStart.split('-')[2]}/${dateStart.split('-')[1]}/${dateStart.split('-')[0]}`)}`
    } else if (dateEnd) {
      periodLabel = `จนถึง ${getThaiDate(`${dateEnd.split('-')[2]}/${dateEnd.split('-')[1]}/${dateEnd.split('-')[0]}`)}`
    }

    exportToExcel({
      reportName: 'รายงานข้อมูลสัญญา (EV Core)',
      periodLabel,
      headers: [
        '#',
        'VIN No',
        'Motor No',
        'ทะเบียน (Register No)',
        'เลขสัญญา (Contract No)',
        'ชื่อ',
        'นามสกุล',
        'วันที่นัดปล่อยรถ (Expected Release Date)',
        'โครงการ (Project Type)',
        'สถานะ (Status)',
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
        item.Status || '-',
      ]),
      fileName: 'EVCore_Contracts',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-zinc-950 dark:via-zinc-900/40 dark:to-zinc-950">
      {/* Header Sticky */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-zinc-800/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                📄 รายการสัญญา (EV Core)
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                ประวัติและข้อมูลสัญญาจากระบบ EV Core
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/dashboard"
                className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 text-xs font-semibold py-1.5 px-3.5 rounded-xl shadow-sm transition-all"
              >
                🏠 แดชบอร์ด
              </a>
              <a
                href="/case-delivery"
                className="inline-flex items-center gap-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700/50 text-xs font-semibold py-1.5 px-3.5 rounded-xl shadow-sm transition-all"
              >
                🚗 ส่งมอบรถ
              </a>
              <ExportButton onClick={handleExport} label="📥 Export Excel" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">วันที่เริ่มต้น (นัดปล่อย)</label>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => { setDateStart(e.target.value); setPage(1) }}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">วันที่สิ้นสุด (นัดปล่อย)</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => { setDateEnd(e.target.value); setPage(1) }}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">โครงการ</label>
              <select
                value={projectType}
                onChange={(e) => { setProjectType(e.target.value); setPage(1) }}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition font-medium dark:text-zinc-200"
              >
                {PROJECT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">สถานะ</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition font-medium dark:text-zinc-200"
              >
                <option value="">ทั้งหมด</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 block mb-1">ค้นหาด่วน</label>
              <input
                type="text"
                placeholder="VIN / เลขสัญญา / ทะเบียน / ชื่อ..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 transition placeholder-slate-400 dark:placeholder-zinc-650 dark:text-zinc-200"
              />
            </div>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm text-center">
            <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">{loading ? '...' : summary.total}</div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 mt-1">สัญญาที่พบทั้งหมด</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm text-center">
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{loading ? '...' : summary.ev}</div>
            <div className="text-[10px] font-bold text-blue-500 dark:text-blue-400 mt-1">โครงการ EV</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm text-center">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{loading ? '...' : summary.grab}</div>
            <div className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 mt-1">โครงการ Grab</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm text-center">
            <div className="text-2xl font-black text-lime-600 dark:text-lime-400">{loading ? '...' : summary.lineman}</div>
            <div className="text-[10px] font-bold text-lime-500 dark:text-lime-400 mt-1">โครงการ Line Man</div>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm text-center col-span-2 md:col-span-1">
            <div className="text-2xl font-black text-teal-600 dark:text-teal-400">{loading ? '...' : summary.delivered}</div>
            <div className="text-[10px] font-bold text-teal-500 dark:text-teal-400 mt-1">ส่งมอบรถเรียบร้อยแล้ว</div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 text-sm text-rose-700 dark:text-rose-400 font-medium">
            ❌ {error}
          </div>
        )}

        {/* Table Container */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/70 dark:border-zinc-800/70 shadow-sm overflow-hidden">
          <div className="bg-slate-50/90 dark:bg-zinc-950/40 border-b border-slate-200/80 dark:border-zinc-800/80 px-4 py-2.5 text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-between flex-wrap gap-2">
            <div className="font-bold text-slate-700 dark:text-zinc-300">
              📊 รายการสัญญาทั้งหมด (ระบบ EV Core)
            </div>
            <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold">
              แสดง {paginated.length} จาก {filtered.length} รายการ
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50/90 dark:bg-zinc-950/20 border-b border-slate-200/80 dark:border-zinc-800/80 text-xs font-bold text-slate-600 dark:text-zinc-400 text-left">
                  <th className="py-3 px-3 text-center w-12 border-r border-slate-100 dark:border-zinc-800 font-bold">#</th>
                  <th className="py-3 px-3">เลข VIN</th>
                  <th className="py-3 px-3">เลขมอเตอร์</th>
                  <th className="py-3 px-3">ทะเบียนรถ</th>
                  <th className="py-3 px-3">เลขสัญญา</th>
                  <th className="py-3 px-3">ชื่อ-นามสกุล ลูกค้า</th>
                  <th className="py-3 px-3">วันที่นัดปล่อยรถ</th>
                  <th className="py-3 px-3">โครงการ</th>
                  <th className="py-3 px-3 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-20 text-slate-400 dark:text-zinc-500">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium">กำลังโหลดข้อมูลสัญญาจากเซิร์ฟเวอร์...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-20 text-slate-400 dark:text-zinc-500 font-medium">
                      ไม่พบข้อมูลสัญญาตามตัวเลือกตัวกรอง
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, idx) => {
                    const rowNum = (page - 1) * ITEMS_PER_PAGE + idx + 1
                    const projectBadge = PROJECT_BADGE_COLORS[item.ProjectType] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                    const statusBadge = STATUS_BADGE_COLORS[item.Status] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'

                    return (
                      <tr
                        key={`${item.VinNo}-${item.ContractNo}-${idx}`}
                        className="border-b border-slate-100 dark:border-zinc-800/60 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors text-xs text-slate-700 dark:text-zinc-300"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 dark:text-zinc-500 border-r border-slate-100 dark:border-zinc-800 font-medium">{rowNum}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-800 dark:text-zinc-200">{item.VinNo || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-zinc-400">{item.MotorNo || '-'}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-zinc-200">{item.RegisterNo || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-zinc-400">{item.ContractNo || '-'}</td>
                        <td className="py-2.5 px-3 font-medium">
                          {item.FirstName || ''} {item.LastName || ''}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400 font-medium">
                          {getThaiDateTime(item.ExpectedReleaseDate)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${projectBadge}`}>
                            {item.ProjectType || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${statusBadge}`}>
                            {item.Status || '-'}
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
          {!loading && sorted.length > 0 && (
            <div className="px-4 pb-4 mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={sorted.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CaseContractPage() {
  return (
    <AuthGuard>
      <CaseContractContent />
    </AuthGuard>
  )
}
