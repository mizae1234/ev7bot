'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import * as XLSX from 'xlsx'

interface VehicleLocationMovementItem {
  movementId: string
  inventoryItemId: number | null
  vinNo: string
  registerNo: string | null
  model: string | null
  project: string | null
  currentLocation: string | null
  currentLocationName: string | null
  fromLocation: string | null
  toLocation: string | null
  movementDetail: string | null
  movementDate: string
  createDate: string
  createUserId: number | null
  createUserName: string | null
}

interface MovementStats {
  totalCount: number
  thisMonthCount: number
  todayCount: number
  uniqueVehicles: number
}

function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    return `${day} ${month} ${year}`
  } catch {
    return dateStr || '-'
  }
}

function formatThaiDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const mins = String(d.getUTCMinutes()).padStart(2, '0')
    return `${day} ${month} ${year} ${hours}:${mins} น.`
  } catch {
    return dateStr || '-'
  }
}

function VehicleMovementContent() {
  const [records, setRecords] = useState<VehicleLocationMovementItem[]>([])
  const [stats, setStats] = useState<MovementStats>({
    totalCount: 0,
    thisMonthCount: 0,
    todayCount: 0,
    uniqueVehicles: 0
  })
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [exportLoading, setExportLoading] = useState(false)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(handler)
  }, [search])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '50')
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/vehicle-movement?${params.toString()}`)
      if (!res.ok) throw new Error('ไม่สามารถโหลดข้อมูลประวัติการย้ายสถานที่รถได้')

      const data = await res.json()
      setRecords(data.records || [])
      setStats(data.stats || { totalCount: 0, thisMonthCount: 0, todayCount: 0, uniqueVehicles: 0 })
      setTotal(data.pagination?.total || 0)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err: unknown) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Export Excel
  const handleExportExcel = async () => {
    try {
      setExportLoading(true)
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '2000')
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/vehicle-movement?${params.toString()}`)
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูลส่งออก')
      const data = await res.json()

      const exportRows = (data.records || []).map((r: VehicleLocationMovementItem, idx: number) => ({
        'ลำดับ': idx + 1,
        'ทะเบียนรถ': r.registerNo || 'ไม่มีทะเบียน',
        'เลขตัวถัง (VIN)': r.vinNo,
        'รุ่นรถ': r.model || '-',
        'โครงการ': r.project || '-',
        'สถานที่ต้นทาง': r.fromLocation || '-',
        'สถานที่ปลายทาง': r.toLocation || '-',
        'สถานที่จอดปัจจุบัน': r.currentLocationName || r.currentLocation || '-',
        'วันที่ย้าย': formatThaiDate(r.movementDate),
        'เวลาที่ย้าย': formatThaiDateTime(r.movementDate),
        'ผู้ดำเนินการย้าย': r.createUserName || '-',
        'รายละเอียดบันทึก': r.movementDetail || '-',
        'วันที่บันทึกเข้าระบบ': formatThaiDateTime(r.createDate)
      }))

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Location_Movement_Log')
      XLSX.writeFile(wb, `รายงานประวัติการย้ายสถานที่รถ_EV7_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('Export Excel failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-16 text-zinc-900 dark:text-zinc-100">
      {/* 1. Header Section */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 sticky top-16 z-30 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl sm:text-3xl">📍</span>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex flex-wrap items-center gap-2">
                    ประวัติการเคลื่อนย้ายสถานที่
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                      Location Relocation Log
                    </span>
                    {total > 0 && (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {total.toLocaleString()} รายการ
                      </span>
                    )}
                  </h1>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    ตรวจสอบประวัติการย้ายสถานที่รถยนต์ พิกัดต้นทาง ➔ ปลายทาง และผู้ดำเนินการ
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>🔄</span>
                <span>{loading ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportLoading || records.length === 0}
                className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <span>📥</span>
                <span>{exportLoading ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-4">
        {/* Filters & Search Bar */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 ค้นหา ทะเบียนรถ, VIN, สถานที่ต้นทาง, สถานที่ปลายทาง, ผู้ย้าย..."
                className="w-full pl-3 pr-8 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1">
                <span className="text-zinc-400 text-[11px]">ตั้งแต่:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                  className="px-2 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-zinc-400 text-[11px]">ถึง:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                  className="px-2 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>

              {(startDate || endDate || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setStartDate('')
                    setEndDate('')
                    setPage(1)
                  }}
                  className="px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold cursor-pointer"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4. Table / Data List */}
        {loading ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
            <div className="animate-spin text-3xl mb-2">🔄</div>
            <p className="text-sm text-zinc-500">กำลังโหลดประวัติการย้ายสถานที่รถ...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl text-center">
            <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{error}</p>
            <button
              onClick={() => fetchData()}
              className="mt-3 px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
            <span className="text-4xl">📍✨</span>
            <h3 className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">ไม่พบรายการย้ายสถานที่</h3>
            <p className="text-xs text-zinc-400 mt-1">ลองปรับเงื่อนไขการค้นหา หรือช่วงเวลาใหม่</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">🚗 ข้อมูลตัวรถ & ทะเบียน</th>
                      <th className="py-3.5 px-4">📍 เส้นทางการย้าย (ต้นทาง ➔ ปลายทาง)</th>
                      <th className="py-3.5 px-4">📅 วันที่ & เวลาที่ย้าย</th>
                      <th className="py-3.5 px-4">👤 ผู้ดำเนินการย้าย</th>
                      <th className="py-3.5 px-4">📝 ข้อความบันทึกเต็ม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {records.map((r, idx) => {
                      const rowNum = (page - 1) * 50 + idx + 1

                      return (
                        <tr
                          key={r.movementId}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center font-mono text-zinc-400 text-[11px]">
                            {rowNum}
                          </td>

                          {/* Car Info */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/vehicle/${r.registerNo || r.vinNo}`}
                                  className="font-bold text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors hover:underline text-xs"
                                >
                                  {r.registerNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}
                                </Link>
                                {r.model && (
                                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                    {r.model}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-[10.5px] text-zinc-400 select-all">
                                {r.vinNo}
                              </div>
                            </div>
                          </td>

                          {/* Route Badge (From -> To) */}
                          <td className="py-3.5 px-4">
                            {r.fromLocation || r.toLocation ? (
                              <div className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800">
                                  {r.fromLocation || 'ไม่ระบุ'}
                                </span>
                                <span className="text-emerald-500 font-bold">➔</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                                  {r.toLocation || 'ไม่ระบุ'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">บันทึกย้ายสถานที่</span>
                            )}
                          </td>

                          {/* Date & Time */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {formatThaiDate(r.movementDate)}
                              </div>
                              <div className="font-mono text-[10.5px] text-zinc-400">
                                {formatThaiDateTime(r.movementDate).split(' ').slice(-2).join(' ')}
                              </div>
                            </div>
                          </td>

                          {/* Actor */}
                          <td className="py-3.5 px-4">
                            <div className="text-zinc-800 dark:text-zinc-200 font-medium text-[11px] flex items-center gap-1">
                              <span>👤</span>
                              <span>{r.createUserName || '-'}</span>
                            </div>
                          </td>

                          {/* Full Detail (Wrap Message) */}
                          <td className="py-3.5 px-4 min-w-[280px] max-w-[500px]">
                            <div className="text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap break-words">
                              {r.movementDetail || '-'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
              {records.map((r, idx) => {
                const rowNum = (page - 1) * 50 + idx + 1

                return (
                  <div
                    key={r.movementId}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-2.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">#{rowNum}</span>
                        <Link
                          href={`/vehicle/${r.registerNo || r.vinNo}`}
                          className="font-bold text-sm text-zinc-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400"
                        >
                          {r.registerNo || 'ไม่มีทะเบียน'}
                        </Link>
                        {r.model && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {r.model}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-zinc-400">
                        {formatThaiDate(r.movementDate)}
                      </span>
                    </div>

                    {/* Route Badge */}
                    {r.fromLocation || r.toLocation ? (
                      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {r.fromLocation || '-'}
                        </span>
                        <span className="text-emerald-500 font-bold">➔</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {r.toLocation || '-'}
                        </span>
                      </div>
                    ) : null}

                    {/* Message Detail Wrap */}
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                      {r.movementDetail || '-'}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
                      <span className="font-mono select-all">VIN: {r.vinNo}</span>
                      <span>โดย: {r.createUserName || '-'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 5. Pagination */}
            <div className="pt-2">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                itemsPerPage={50}
                onPageChange={(p) => {
                  setPage(p)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VehicleMovementPage() {
  return (
    <AuthGuard>
      <VehicleMovementContent />
    </AuthGuard>
  )
}
