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
  // Tracking fields from View_AccumarateReleaseCar
  TrackingStatus?: 'MATCHED' | 'NOT_FOUND' | 'TRACKING_ONLY'
  TrackingContractNo?: string
  TrackingReleaseDate?: string | null
  TrackingRentType?: string
  TrackingIsActive?: boolean
  TrackingRegisterNo?: string
  TrackingContractType?: string
  TrackingCustomerName?: string
  // Data source indicator
  DataSource?: 'BOTH' | 'CORE_ONLY' | 'TRACKING_ONLY'
}

const ITEMS_PER_PAGE = 50

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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  MATCHED: { label: '✅ ตรงกัน', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NOT_FOUND: { label: '⏳ Core อย่างเดียว', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  TRACKING_ONLY: { label: '⚠️ Tracking อย่างเดียว', className: 'bg-rose-50 text-rose-700 border-rose-200' },
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
      // 1. Fetch from ev7core API directly (browser bypasses Cloudflare)
      const apiRes = await fetch('https://api-aion.com7tracking.com/api/icare/getCaseTaxi', {
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
      let coreList: CaseDeliveryItem[] = apiData?.message?.list || []

      // 2. Client-side date filtering
      if (dateStart || dateEnd) {
        coreList = coreList.filter((item) => {
          if (!item.ExpectedReleaseDate) return false
          const parts = item.ExpectedReleaseDate.split(' ')[0].split('/')
          if (parts.length !== 3) return false
          const itemDate = `${parts[2]}-${parts[1]}-${parts[0]}`
          if (dateStart && itemDate < dateStart) return false
          if (dateEnd && itemDate > dateEnd) return false
          return true
        })
      }

      // 3. Client-side project type filtering
      if (projectType) {
        coreList = coreList.filter((item) => item.ProjectType === projectType)
      }

      // 4. Fetch ALL tracking records for this date range
      const coreVinSet = new Set(coreList.map((item) => item.VinNo).filter(Boolean))
      try {
        const trackRes = await fetch('/api/case-delivery/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fetchAll: true, dateStart, dateEnd }),
        })

        if (trackRes.ok) {
          const trackData = await trackRes.json()
          const trackingMap = trackData.tracking || {}

          // Match core items with tracking
          for (const item of coreList) {
            const tracking = trackingMap[item.VinNo]
            if (tracking) {
              item.TrackingContractNo = tracking.ContractNo
              item.TrackingReleaseDate = tracking.ReleaseDate
              item.TrackingRentType = tracking.RentType
              item.TrackingIsActive = tracking.IsActive
              item.TrackingRegisterNo = tracking.RegisterNo
              item.TrackingContractType = tracking.ContractType
              item.TrackingStatus = 'MATCHED'
              item.DataSource = 'BOTH'
            } else {
              item.TrackingStatus = 'NOT_FOUND'
              item.DataSource = 'CORE_ONLY'
            }
          }

          // Find tracking-only VINs (in tracking but not in core)
          for (const [vin, tracking] of Object.entries(trackingMap)) {
            if (!coreVinSet.has(vin)) {
              const t = tracking as Record<string, unknown>
              coreList.push({
                VinNo: vin,
                MotorNo: '',
                RegisterNo: '',
                ContractNo: '',
                FirstName: (t.CustomerName as string) || '',
                LastName: '',
                ExpectedReleaseDate: '',
                ProjectType: (t.ContractType as string) || '',
                TrackingContractNo: t.ContractNo as string,
                TrackingReleaseDate: t.ReleaseDate as string | null,
                TrackingRentType: t.RentType as string,
                TrackingIsActive: t.IsActive as boolean,
                TrackingRegisterNo: t.RegisterNo as string,
                TrackingContractType: t.ContractType as string,
                TrackingCustomerName: t.CustomerName as string,
                TrackingStatus: 'TRACKING_ONLY',
                DataSource: 'TRACKING_ONLY',
              })
            }
          }
        }
      } catch (trackErr) {
        console.error('Tracking fetch error:', trackErr)
        for (const item of coreList) {
          item.TrackingStatus = 'NOT_FOUND'
          item.DataSource = 'CORE_ONLY'
        }
      }

      setData(coreList)
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
      item.MotorNo?.toLowerCase().includes(q) ||
      item.TrackingContractNo?.toLowerCase().includes(q) ||
      item.TrackingRegisterNo?.toLowerCase().includes(q) ||
      item.TrackingCustomerName?.toLowerCase().includes(q)
    )
  })
  // Sort by date descending (latest first)
  const sorted = [...filtered].sort((a, b) => {
    const getDate = (item: CaseDeliveryItem) => {
      if (item.ExpectedReleaseDate) {
        const parts = item.ExpectedReleaseDate.split(' ')[0].split('/')
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]} ${item.ExpectedReleaseDate.split(' ')[1] || '00:00:00'}`
      }
      if (item.TrackingReleaseDate) return item.TrackingReleaseDate
      return ''
    }
    return getDate(b).localeCompare(getDate(a))
  })

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE)
  const paginated = sorted.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  // Summary counts
  const coreItems = filtered.filter((i) => i.DataSource !== 'TRACKING_ONLY')
  const summary = {
    total: filtered.length,
    coreTotal: coreItems.length,
    ev: coreItems.filter((i) => i.ProjectType === 'EV').length,
    grab: coreItems.filter((i) => i.ProjectType === 'GRAB').length,
    lineman: coreItems.filter((i) => i.ProjectType === 'LINEMAN').length,
    matched: filtered.filter((i) => i.TrackingStatus === 'MATCHED').length,
    coreOnly: filtered.filter((i) => i.TrackingStatus === 'NOT_FOUND').length,
    trackingOnly: filtered.filter((i) => i.TrackingStatus === 'TRACKING_ONLY').length,
    trackingTotal: filtered.filter((i) => i.TrackingStatus === 'MATCHED' || i.TrackingStatus === 'TRACKING_ONLY').length,
    trackingNew: filtered.filter((i) => i.TrackingRentType === 'ONRENT_NEW').length,
    trackingUse: filtered.filter((i) => i.TrackingRentType === 'ONRENT_USE').length,
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
        'ทะเบียน (Core)',
        'เลขสัญญา (Core)',
        'ชื่อ',
        'นามสกุล',
        'วันที่นัดปล่อย',
        'โครงการ',
        'สถานะ Tracking',
        'เลขสัญญา (Tracking)',
        'ทะเบียน (Tracking)',
        'RentType',
        'วันที่ปล่อยจริง',
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
        item.TrackingStatus === 'MATCHED' ? 'ปล่อยแล้ว' : 'ยังไม่ปล่อย',
        item.TrackingContractNo || '-',
        item.TrackingRegisterNo || '-',
        item.TrackingRentType || '-',
        item.TrackingReleaseDate ? getThaiDateTime(new Date(item.TrackingReleaseDate).toLocaleDateString('en-GB') + ' 00:00:00') : '-',
      ]),
      fileName: 'CaseDelivery',
    })
  }

  const handleExportCore = () => {
    const periodLabel =
      dateStart === dateEnd
        ? getThaiDate(`${dateStart.split('-')[2]}/${dateStart.split('-')[1]}/${dateStart.split('-')[0]}`)
        : `${getThaiDate(`${dateStart.split('-')[2]}/${dateStart.split('-')[1]}/${dateStart.split('-')[0]}`)} - ${getThaiDate(`${dateEnd.split('-')[2]}/${dateEnd.split('-')[1]}/${dateEnd.split('-')[0]}`)}`

    exportToExcel({
      reportName: 'รายงาน Case Delivery (EV7 Core)',
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
      fileName: 'CaseDelivery_EVCore',
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
            <div className="flex items-center gap-2">
              <ExportButton onClick={handleExportCore} label="📥 Export EV7 Core" />
              <ExportButton onClick={handleExport} label="📥 Export เทียบ" />
            </div>
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

        {/* Summary Cards — EV Core vs Tracking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* EV7 Core */}
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
            <div className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              EV7 Core (นัดปล่อย)
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800">{summary.coreTotal}</div>
                <div className="text-[10px] font-medium text-slate-500 mt-0.5">ทั้งหมด</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.ev}</div>
                <div className="text-[10px] font-medium text-blue-500 mt-0.5">EV</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{summary.grab}</div>
                <div className="text-[10px] font-medium text-emerald-500 mt-0.5">Grab</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-lime-600">{summary.lineman}</div>
                <div className="text-[10px] font-medium text-lime-500 mt-0.5">Line Man</div>
              </div>
            </div>
          </div>

          {/* Tracking */}
          <div className="bg-white rounded-2xl border border-indigo-200/70 shadow-sm p-4">
            <div className="text-xs font-bold text-indigo-500 mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              Tracking (ปล่อยจริง)
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-800">{summary.trackingTotal}</div>
                <div className="text-[10px] font-medium text-slate-500 mt-0.5">ทั้งหมด</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{summary.matched}</div>
                <div className="text-[10px] font-medium text-emerald-500 mt-0.5">✅ ตรงกัน</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-rose-600">{summary.trackingOnly}</div>
                <div className="text-[10px] font-medium text-rose-500 mt-0.5">⚠️ Tracking อย่างเดียว</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">{summary.trackingNew}</div>
                <div className="text-[10px] font-medium text-indigo-500 mt-0.5">ONRENT_NEW</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.trackingUse}</div>
                <div className="text-[10px] font-medium text-purple-500 mt-0.5">ONRENT_USE</div>
              </div>
            </div>
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
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">ทะเบียน</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">เลขสัญญา</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">ชื่อ-นามสกุล</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">วันที่นัดปล่อย</th>
                  <th className="text-left py-3 px-4 font-bold text-slate-600 text-xs">โครงการ</th>
                  <th className="text-center py-3 px-4 font-bold text-indigo-600 text-xs border-l-2 border-indigo-200">สถานะ</th>
                  <th className="text-left py-3 px-4 font-bold text-indigo-600 text-xs">เลขสัญญา (Tracking)</th>
                  <th className="text-left py-3 px-4 font-bold text-indigo-600 text-xs">ทะเบียน (Tracking)</th>
                  <th className="text-left py-3 px-4 font-bold text-indigo-600 text-xs">RentType</th>
                  <th className="text-left py-3 px-4 font-bold text-indigo-600 text-xs">วันปล่อยจริง</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={13} className="text-center py-16 text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-medium">กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-16 text-slate-400 font-medium">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, idx) => {
                    const rowNum = (page - 1) * ITEMS_PER_PAGE + idx + 1
                    const badgeColor = PROJECT_BADGE_COLORS[item.ProjectType] || 'bg-slate-50 text-slate-600 border-slate-200'
                    const rowBg = item.DataSource === 'TRACKING_ONLY'
                      ? 'bg-rose-50/50 border-b border-rose-100 hover:bg-rose-100/50'
                      : item.DataSource === 'CORE_ONLY'
                        ? 'bg-amber-50/30 border-b border-amber-100 hover:bg-amber-100/30'
                        : 'border-b border-slate-100 hover:bg-indigo-50/30'
                    return (
                      <tr
                        key={`${item.VinNo}-${item.ContractNo}-${idx}`}
                        className={`${rowBg} transition-colors`}
                      >
                        <td className="py-3 px-4 text-slate-400 font-medium">{rowNum}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{item.VinNo || '-'}</td>
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
                        <td className="py-3 px-4">
                          {(() => {
                            const st = STATUS_BADGE[item.TrackingStatus || ''] || { label: '-', className: 'bg-slate-50 text-slate-500 border-slate-200' }
                            return (
                              <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg border ${st.className}`}>
                                {st.label}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.TrackingContractNo || '-'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.TrackingRegisterNo || '-'}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-600">
                          {item.TrackingRentType || '-'}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.TrackingReleaseDate ? getThaiDateTime(
                            new Date(item.TrackingReleaseDate).toLocaleDateString('en-GB', { timeZone: 'UTC' }).split('/').join('/') + ' ' +
                            new Date(item.TrackingReleaseDate).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          ) : '-'}
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
            <div className="px-4 pb-4">
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

export default function CaseDeliveryPage() {
  return (
    <AuthGuard>
      <CaseDeliveryContent />
    </AuthGuard>
  )
}
