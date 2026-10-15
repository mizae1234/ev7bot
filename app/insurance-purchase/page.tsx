'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import * as XLSX from 'xlsx'
import { ExportButton } from '@/lib/exportExcel'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import {
  fetchAllService,
  formatDisplayDate,
  getServiceStatusDetail,
  InsuranceServiceItem,
  ServiceStatusDetail,
} from '@/lib/insurance-purchase'

const ITEMS_PER_PAGE = 50

type StatusFilter = 'ALL' | ServiceStatusDetail

const STATUS_BADGE: Record<ServiceStatusDetail, { bg: string; dot: string }> = {
  SUCCESS: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  WAIT_CREATE: {
    bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  WAIT_UPLOAD: {
    bg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-500',
  },
  OTHER: {
    bg: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
  },
}

const BANNER_STYLE: Record<ServiceStatusDetail, { bg: string; border: string }> = {
  SUCCESS: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800' },
  WAIT_CREATE: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800' },
  WAIT_UPLOAD: { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800' },
  OTHER: { bg: 'bg-zinc-50 dark:bg-zinc-800/40', border: 'border-zinc-200 dark:border-zinc-700' },
}

const fullName = (d: InsuranceServiceItem) =>
  `${d.Prefix || ''}${d.FirstName || ''} ${d.LastName || ''}`.trim()

// API may send amounts as number or numeric string ("1,500.00"), and key casing may vary
function moneyOf(d: InsuranceServiceItem, key: string): number | null {
  const rec = d as unknown as Record<string, unknown>
  let raw = rec[key]
  if (raw === undefined) {
    const norm = key.toLowerCase()
    const found = Object.keys(rec).find((k) => k.toLowerCase().replace(/_/g, '') === norm)
    raw = found ? rec[found] : undefined
  }
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const baht = (n?: number | null) =>
  typeof n === 'number' ? n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-zinc-500">{label}:</span>
      <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5 break-words">{children || '-'}</div>
    </div>
  )
}

function ServiceDetailModal({ item, onClose }: { item: InsuranceServiceItem | null; onClose: () => void }) {
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  useEffect(() => {
    if (!item) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [item])

  if (!item || typeof document === 'undefined') return null
  const d = item
  const statusKind = getServiceStatusDetail(d.ServiceStatus)
  const statusBadge = STATUS_BADGE[statusKind]
  const banner = BANNER_STYLE[statusKind]
  const dt = (v?: string | null) => {
    if (!v) return '-'
    const time = v.match(/(\d{1,2}:\d{2})(?::\d{2})?/)
    return `${formatDisplayDate(v)}${time ? ` ${time[1].padStart(5, '0')} น.` : ''}`
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🧾</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">รายละเอียดการซื้อประกัน</h2>
              <p className="text-xs text-zinc-500">เลขที่สัญญาประกัน: {d.ServiceContractNo || '-'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="ปิด (Esc)"
            className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Insurance Summary Banner */}
          <div className={`p-4 rounded-2xl border space-y-3 ${banner.bg} ${banner.border}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">ชื่อแผนประกัน</div>
                <div className="text-base font-extrabold text-zinc-900 dark:text-white mt-0.5 break-words">
                  🛡️ {d.InsuranceName || '-'}
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs bg-white dark:bg-zinc-800 border shadow-sm whitespace-nowrap ${statusBadge.bg}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                <span>{d.ServiceStatus || '-'}</span>
              </span>
            </div>
            <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${banner.border}`}>
              <div>
                <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">วันที่เริ่มคุ้มครอง</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">{formatDisplayDate(d.InsuranceStartDate)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">วันที่สิ้นสุดความคุ้มครอง</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">{formatDisplayDate(d.InsuranceEndDate)}</div>
              </div>
            </div>
          </div>

          {/* 2-Column: Vehicle vs Customer */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Vehicle */}
            <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-indigo-200/60 dark:border-indigo-800/40">
                <span className="text-base">🚗</span>
                <span className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">ข้อมูลรถ</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500">เลขทะเบียน:</span>
                  <div className="font-bold text-zinc-900 dark:text-white text-sm">{d.RegisterNo || 'ไม่มีทะเบียน'}</div>
                </div>
                <div>
                  <span className="text-zinc-500">เลขตัวถัง (VIN):</span>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200 break-all">{d.VinNo || '-'}</div>
                </div>
                <Field label="โมเดลรถ">{d.CarModel}</Field>
                <Field label="รุ่นรถ (Series)">{d.CarSeries}</Field>
                <Field label="วันที่ส่งมอบรถ">{dt(d.GetCarDate)}</Field>
              </div>
            </div>

            {/* Right: Customer */}
            <div className="p-4 rounded-2xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-800/60 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-sky-200/60 dark:border-sky-800/40">
                <span className="text-base">👤</span>
                <span className="font-bold text-sky-900 dark:text-sky-300 text-sm">ข้อมูลลูกค้า</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500">ชื่อ-นามสกุล:</span>
                  <div className="font-bold text-zinc-900 dark:text-white text-sm">{fullName(d) || '-'}</div>
                </div>
                <div>
                  <span className="text-zinc-500">เบอร์โทรศัพท์:</span>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">📞 {d.Tel || '-'}</div>
                </div>
                <Field label="จังหวัด">{d.Province}</Field>
                <div>
                  <span className="text-zinc-500">เลขที่สัญญาเช่ารถ:</span>
                  <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{d.ContractNo || '-'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Insurance Details Section */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2.5">
            <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>📋</span> รายละเอียดประกันและสัญญา
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Field label="ราคาประกัน">{`${baht(moneyOf(d, 'InsurancePrice'))} บาท`}</Field>
              <Field label="ค่าประกันรายวัน">{`${baht(moneyOf(d, 'InsurancePriceDay'))} บาท`}</Field>
              <Field label="ค่าเช่ารถรายวัน">{`${baht(moneyOf(d, 'CarRentPerDay'))} บาท`}</Field>
              <Field label="ค่าเช่า + ค่าประกันรายวัน">{`${baht(moneyOf(d, 'totalRentPerDay'))} บาท`}</Field>
              <div>
                <span className="text-zinc-500">เลขที่สัญญาประกัน:</span>
                <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">{d.ServiceContractNo || '-'}</div>
              </div>
              <Field label="วันที่ทำสัญญาประกัน">{dt(d.ServiceContractDate)}</Field>
            </div>
          </div>

          {/* Meta */}
          <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div>วันที่สร้างรายการ: <strong>{dt(d.ServiceCreateDate)}</strong></div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function InsurancePurchaseContent() {
  const [data, setData] = useState<InsuranceServiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Server-side filters (sent to API)
  const [startDate, setStartDate] = useState('')
  const [createDate, setCreateDate] = useState('')
  // Client-side filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [detailItem, setDetailItem] = useState<InsuranceServiceItem | null>(null)

  const requestId = useRef(0)

  const fetchData = useCallback(async () => {
    const myId = ++requestId.current // ignore responses from superseded requests
    setLoading(true)
    setError(null)
    try {
      const list = await fetchAllService({
        insurance_start_date: startDate,
        create_date: createDate,
      })
      if (myId !== requestId.current) return
      setData(list)
      setPage(1)
    } catch (err: unknown) {
      if (myId !== requestId.current) return
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
      setData([])
    } finally {
      if (myId === requestId.current) setLoading(false)
    }
  }, [startDate, createDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const stats = useMemo(() => {
    const s = { total: data.length, SUCCESS: 0, WAIT_CREATE: 0, WAIT_UPLOAD: 0 }
    for (const d of data) {
      const k = getServiceStatusDetail(d.ServiceStatus)
      if (k !== 'OTHER') s[k]++
    }
    return s
  }, [data])

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return data.filter((item) => {
      if (statusFilter !== 'ALL' && getServiceStatusDetail(item.ServiceStatus) !== statusFilter) return false
      if (!q) return true
      return [
        item.RegisterNo,
        item.VinNo,
        item.ContractNo,
        item.ServiceContractNo,
        item.FirstName,
        item.LastName,
        fullName(item),
      ].some((v) => (v || '').toLowerCase().includes(q))
    })
  }, [data, statusFilter, searchText])

  const hasActiveFilter = !!(searchText || startDate || createDate || statusFilter !== 'ALL')

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const pageItems = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  const handleExport = () => {
    // Export operational fields only (sensitive PII such as ID card, birthday, address, email is excluded)
    const rows = filtered.map((d, idx) => ({
      'ลำดับ': idx + 1,
      'เลขที่สัญญาประกัน': d.ServiceContractNo,
      'วันที่ทำสัญญาประกัน': d.ServiceContractDate,
      'สถานะบริการเสริม': d.ServiceStatus,
      'วันที่สร้างรายการ': d.ServiceCreateDate,
      'ชื่อแผนประกัน': d.InsuranceName,
      'ราคาประกัน (บาท)': moneyOf(d, 'InsurancePrice'),
      'ค่าประกันรายวัน (บาท)': moneyOf(d, 'InsurancePriceDay'),
      'วันที่เริ่มคุ้มครอง': d.InsuranceStartDate,
      'วันที่สิ้นสุดความคุ้มครอง': d.InsuranceEndDate,
      'เลขที่สัญญาเช่ารถ': d.ContractNo,
      'เลขตัวถัง (VIN)': d.VinNo,
      'เลขเครื่อง/มอเตอร์': d.MotorNo,
      'เลขทะเบียน': d.RegisterNo,
      'โมเดลรถ': d.CarModel,
      'รุ่นรถ (Series)': d.CarSeries,
      'ค่าเช่ารถรายวัน (บาท)': moneyOf(d, 'CarRentPerDay'),
      'ค่าเช่า + ค่าประกันรายวัน (บาท)': moneyOf(d, 'totalRentPerDay'),
      'วันที่ส่งมอบรถ': d.GetCarDate,
      'คำนำหน้า': d.Prefix,
      'ชื่อ': d.FirstName,
      'นามสกุล': d.LastName,
      'เบอร์โทรศัพท์': d.Tel,
      'จังหวัด': d.Province,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Insurance_Purchase')
    XLSX.writeFile(wb, `ข้อมูลการซื้อประกัน_EV7_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const statCards: {
    id: StatusFilter
    title: string
    desc: string
    count: number
    icon: React.ReactNode
    bg: string
    borderDefault: string
    activeBorder: string
    iconBg: string
  }[] = [
    {
      id: 'ALL',
      title: 'รายการทั้งหมด',
      desc: 'ข้อมูลการซื้อประกันทั้งหมดจาก API',
      count: stats.total,
      icon: (
        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bg: 'from-indigo-500/10 via-indigo-500/5 to-transparent hover:border-indigo-500/50',
      borderDefault: 'border-indigo-200/70 dark:border-indigo-900/40',
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/10',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      id: 'WAIT_CREATE',
      title: 'รอสร้างสัญญาประกัน',
      desc: 'ยังซื้อไม่สำเร็จ (ยกเลิกได้)',
      count: stats.WAIT_CREATE,
      icon: (
        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/50',
      borderDefault: 'border-amber-200/70 dark:border-amber-900/40',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10',
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      id: 'WAIT_UPLOAD',
      title: 'รออัปโหลดสัญญาลูกค้า',
      desc: 'ยังซื้อไม่สำเร็จ (ยกเลิกได้)',
      count: stats.WAIT_UPLOAD,
      icon: (
        <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
      bg: 'from-sky-500/10 via-sky-500/5 to-transparent hover:border-sky-500/50',
      borderDefault: 'border-sky-200/70 dark:border-sky-900/40',
      activeBorder: 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-500/10',
      iconBg: 'bg-sky-50 dark:bg-sky-950/40',
    },
    {
      id: 'SUCCESS',
      title: 'ซื้อประกันสำเร็จ',
      desc: 'สร้างสัญญาและอัปโหลดครบแล้ว',
      count: stats.SUCCESS,
      icon: (
        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent hover:border-emerald-500/50',
      borderDefault: 'border-emerald-200/70 dark:border-emerald-900/40',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
  ]

  const fieldCls =
    'w-full px-3 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
  const labelCls = 'block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl sm:text-3xl">🧾</span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">ข้อมูลการซื้อประกัน</h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              EV7 Core
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            ข้อมูลบริการเสริมประกันรถ Taxi จากระบบ EV7 Core — เปรียบเทียบกับประกันในระบบได้ที่หน้า “ประกันภัย &amp; ภาษีรถยนต์”
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <ExportButton onClick={handleExport} />
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={loading}
            title="รีเฟรชข้อมูล"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-all shadow-xs cursor-pointer disabled:opacity-60"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>รีเฟรช</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (click to filter by status) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {statCards.map((card) => {
          const isSelected = statusFilter === card.id
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                setStatusFilter(isSelected && card.id !== 'ALL' ? 'ALL' : card.id)
                setPage(1)
              }}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 bg-white dark:bg-zinc-900 bg-gradient-to-br ${card.bg} ${
                isSelected ? card.activeBorder : `${card.borderDefault} hover:border-zinc-300 dark:hover:border-zinc-700`
              } shadow-xs hover:shadow-sm cursor-pointer`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 leading-tight">{card.title}</span>
                <div className={`w-8 h-8 rounded-lg ${card.iconBg} border border-zinc-200/70 dark:border-zinc-700/70 flex items-center justify-center shrink-0`}>
                  {card.icon}
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white font-mono">
                  {card.count.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">รายการ</span>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{card.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Search & Filters (single row) */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="flex-1 min-w-0 lg:min-w-[260px]">
          <label className={labelCls}>🔍 ค้นหา</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1) }}
              placeholder="ทะเบียน, VIN, เลขสัญญา, ชื่อลูกค้า..."
              className={`${fieldCls} pl-10 pr-9`}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="lg:w-44">
          <label className={labelCls}>📅 วันที่เริ่มคุ้มครอง</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldCls} />
        </div>
        <div className="lg:w-44">
          <label className={labelCls}>🗓️ วันที่สร้างรายการ</label>
          <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} className={fieldCls} />
        </div>
        <div className="lg:w-48">
          <label className={labelCls}>📌 สถานะ</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1) }}
            className={fieldCls}
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value="WAIT_CREATE">รอสร้างสัญญาประกัน</option>
            <option value="WAIT_UPLOAD">รออัปโหลดสัญญาลูกค้า</option>
            <option value="SUCCESS">ซื้อประกันสำเร็จ</option>
          </select>
        </div>
        <div className="flex flex-col">
          <span className={`${labelCls} invisible select-none`} aria-hidden="true">📌</span>
          <button
            type="button"
            disabled={!hasActiveFilter}
            onClick={() => {
              setSearchText('')
              setStartDate('')
              setCreateDate('')
              setStatusFilter('ALL')
              setPage(1)
            }}
            title="ล้างค่าตัวกรองทั้งหมด"
            className="flex-1 px-3 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            ✕ ล้างค่า
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-zinc-500">กำลังโหลดข้อมูลการซื้อประกัน...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
          <p className="text-xs text-zinc-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่อีกครั้ง</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-semibold">
                <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
                <th className="py-3 px-4">🚗 ข้อมูลรถ</th>
                <th className="py-3 px-4">👤 ข้อมูลลูกค้า</th>
                <th className="py-3 px-4">🛡️ แผนประกัน</th>
                <th className="py-3 px-4 whitespace-nowrap">📅 ความคุ้มครอง</th>
                <th className="py-3 px-4">📄 เลขที่สัญญาประกัน</th>
                <th className="py-3 px-4 whitespace-nowrap">สถานะ</th>
                <th className="py-3 px-4 text-center">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
              {pageItems.map((d, idx) => {
                const detail = getServiceStatusDetail(d.ServiceStatus)
                const badge = STATUS_BADGE[detail]
                const name = fullName(d)
                const rowNumber = (page - 1) * ITEMS_PER_PAGE + idx + 1
                return (
                  <tr
                    key={`${d.ServiceContractNo}-${d.VinNo}-${idx}`}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors align-middle"
                  >
                    <td className="py-3 px-4 text-center font-mono text-zinc-400 dark:text-zinc-500 font-medium">{rowNumber}</td>

                    {/* ข้อมูลรถ */}
                    <td className="py-3 px-4">
                      <Link
                        href={`/vehicle/${encodeURIComponent(d.RegisterNo || d.VinNo)}`}
                        target="_blank"
                        className="group/link block"
                        title="คลิกเพื่อดูข้อมูลรถและประวัติ (เปิดแท็บใหม่)"
                      >
                        <div className="font-semibold text-sm text-zinc-900 dark:text-white group-hover/link:text-emerald-600 dark:group-hover/link:text-emerald-400 transition-colors flex items-center gap-1 underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-2 group-hover/link:decoration-emerald-400">
                          <span>{d.RegisterNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}</span>
                          <span className="opacity-0 group-hover/link:opacity-100 text-[10px] text-emerald-500 transition-opacity">↗</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5 group-hover/link:text-emerald-700 dark:group-hover/link:text-emerald-300 underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-2 group-hover/link:decoration-emerald-400">
                          {d.VinNo}
                        </div>
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {d.CarModel && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium border border-purple-200/50 dark:border-purple-800/40">
                            {d.CarModel}
                          </span>
                        )}
                        {d.CarSeries && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                            {d.CarSeries}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* ข้อมูลลูกค้า */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-zinc-900 dark:text-white">{name || '-'}</div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <span>📞</span>
                          <span className="font-mono">{d.Tel || '-'}</span>
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <span>📝</span>
                          <span>สัญญาเช่า:</span>
                          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{d.ContractNo || '-'}</span>
                        </div>
                      </div>
                    </td>

                    {/* แผนประกัน */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        {d.InsuranceName ? (
                          <span className="inline-flex px-2 py-0.5 text-[11px] rounded font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
                            {d.InsuranceName}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">ไม่ระบุแผน</span>
                        )}
                        <div className="text-[11px] text-zinc-500">
                          ราคาประกัน: <strong className="text-zinc-800 dark:text-zinc-200">{baht(moneyOf(d, 'InsurancePrice'))}</strong> บาท
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          ค่าประกันรายวัน: <strong className="text-zinc-800 dark:text-zinc-200">{baht(moneyOf(d, 'InsurancePriceDay'))}</strong> บาท
                        </div>
                      </div>
                    </td>

                    {/* ความคุ้มครอง */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="space-y-1 text-[11px] text-zinc-500">
                        <div>เริ่ม: <strong className="text-zinc-800 dark:text-zinc-200">{formatDisplayDate(d.InsuranceStartDate)}</strong></div>
                        <div>สิ้นสุด: <strong className="text-zinc-800 dark:text-zinc-200">{formatDisplayDate(d.InsuranceEndDate)}</strong></div>
                      </div>
                    </td>

                    {/* เลขที่สัญญาประกัน */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{d.ServiceContractNo || '-'}</div>
                        <div className="text-[11px] text-zinc-500">
                          ทำสัญญา: <strong className="text-zinc-700 dark:text-zinc-300">{formatDisplayDate(d.ServiceContractDate)}</strong>
                        </div>
                      </div>
                    </td>

                    {/* สถานะ */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${badge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {d.ServiceStatus || '-'}
                        </span>
                        <div className="text-[10px] text-zinc-400">สร้าง {formatDisplayDate(d.ServiceCreateDate)}</div>
                      </div>
                    </td>

                    {/* รายละเอียด */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setDetailItem(d)}
                        title="ดูข้อมูลทั้งหมดที่ API ส่งมา"
                        className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-500">
            แสดง {pageItems.length} จากทั้งหมด {filtered.length} รายการ
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filtered.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </div>
      )}

      <ServiceDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
    </div>
  )
}

export default function InsurancePurchasePage() {
  return (
    <AuthGuard>
      <InsurancePurchaseContent />
    </AuthGuard>
  )
}
