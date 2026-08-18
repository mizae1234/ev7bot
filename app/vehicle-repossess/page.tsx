'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import { VehicleRepossessItem, RepossessStats } from '@/app/api/vehicle-repossess/route'

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

function VehicleRepossessContent() {
  const [records, setRecords] = useState<VehicleRepossessItem[]>([])
  const [stats, setStats] = useState<RepossessStats>({
    totalCount: 0,
    thisMonthCount: 0,
    withContractCount: 0,
    topLocations: []
  })
  const [locations, setLocations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('ALL')

  // Selected Detail Modal
  const [selectedItem, setSelectedItem] = useState<VehicleRepossessItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '50'
      })
      if (search) query.append('search', search)
      if (startDate) query.append('startDate', startDate)
      if (endDate) query.append('endDate', endDate)
      if (selectedLocation && selectedLocation !== 'ALL') query.append('location', selectedLocation)

      const res = await fetch(`/api/vehicle-repossess?${query.toString()}`)
      if (!res.ok) {
        throw new Error('ไม่สามารถดึงข้อมูลประวัติการยึดรถได้')
      }
      const data = await res.json()
      setRecords(data.records || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.stats) setStats(data.stats)
      if (data.locations) setLocations(data.locations)
    } catch (err: unknown) {
      console.error('Fetch error:', err)
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [page, search, startDate, endDate, selectedLocation])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Search input debouncing
  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  // Export to Excel
  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      const query = new URLSearchParams({
        page: '1',
        limit: '3000'
      })
      if (search) query.append('search', search)
      if (startDate) query.append('startDate', startDate)
      if (endDate) query.append('endDate', endDate)
      if (selectedLocation && selectedLocation !== 'ALL') query.append('location', selectedLocation)

      const res = await fetch(`/api/vehicle-repossess?${query.toString()}`)
      const data = await res.json()
      const list: VehicleRepossessItem[] = data.records || []

      const exportRows = list.map((r, idx) => ({
        'ลำดับ': idx + 1,
        'ทะเบียนรถ': r.registerNo || 'ไม่มีทะเบียน',
        'เลขตัวถัง (VIN)': r.vinNo,
        'รุ่นรถ': r.model || '-',
        'เลขที่สัญญา': r.contractNo || '-',
        'ชื่อลูกค้า (ผู้เช่า)': r.customerName || '-',
        'เบอร์โทรลูกค้า': r.customerPhone || '-',
        'วันที่ไปยึดรถ': formatThaiDate(r.repossessDate),
        'สถานที่ไปยึดรถ': r.repossessLocation || '-',
        'หมายเหตุ / สาเหตุการยึด': r.remark || '-',
        'สถานที่จอดรถปัจจุบัน': r.currentLocationName || r.currentLocation || '-',
        'สถานะรถปัจจุบัน': r.carStatusName || r.carStatus || '-',
        'ผู้บันทึก': r.createUserName || '-',
        'วันที่บันทึกเข้าระบบ': formatThaiDateTime(r.createDate)
      }))

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Vehicle_Repossess_Log')
      XLSX.writeFile(wb, `รายงานประวัติการยึดรถ_EV7_${new Date().toISOString().slice(0, 10)}.xlsx`)
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
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">🚨</span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
                  ประวัติการยึดรถ (Repossession History)
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                ติดตามรายการยึดคืนรถยนต์ สถานที่ยึด วันที่ดำเนินการ และข้อมูลสัญญา
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => fetchData()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all shadow-xs cursor-pointer"
                title="รีเฟรชข้อมูล"
              >
                <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>รีเฟรช</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportLoading || total === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{exportLoading ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* 2. KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">รายการยึดรถทั้งหมด</span>
              <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-base">🚨</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white">
                {stats.totalCount.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400">คัน</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">ยึดคืนในเดือนนี้</span>
              <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-base">📅</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {stats.thisMonthCount.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400">คัน</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">มีข้อมูลสัญญาผูก</span>
              <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-base">📋</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {stats.withContractCount.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-400">คัน</span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">สถานที่ยึดยอดนิยม</span>
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-base">📍</span>
            </div>
            <div className="mt-2">
              {stats.topLocations.length > 0 ? (
                <div className="truncate text-xs font-semibold text-zinc-800 dark:text-zinc-200" title={stats.topLocations[0].name}>
                  {stats.topLocations[0].name} ({stats.topLocations[0].count} คัน)
                </div>
              ) : (
                <span className="text-xs text-zinc-400">-</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <svg className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="ค้นหา ทะเบียน, VIN, สัญญา, สถานที่..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 shrink-0">ตั้งแต่:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 shrink-0">ถึง:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Location Filter */}
            <div>
              <select
                value={selectedLocation}
                onChange={(e) => { setSelectedLocation(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              >
                <option value="ALL">📍 ทุกสถานที่ที่ไปยึด</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 4. Main Content: Table / List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
            <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-zinc-500">กำลังโหลดประวัติการยึดรถ...</p>
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
            <span className="text-4xl">🚨✨</span>
            <h3 className="mt-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">ไม่พบรายการยึดรถ</h3>
            <p className="text-xs text-zinc-400 mt-1">ลองปรับเงื่อนไขการค้นหา หรือช่วงเวลาใหม่</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4">🚗 ข้อมูลตัวรถ & ทะเบียน</th>
                      <th className="py-3.5 px-4">📋 สัญญา & ลูกค้า</th>
                      <th className="py-3.5 px-4">📅 วันที่ยึดรถ</th>
                      <th className="py-3.5 px-4">📍 สถานที่ไปยึดรถ</th>
                      <th className="py-3.5 px-4">📝 หมายเหตุ / รายละเอียด</th>
                      <th className="py-3.5 px-4">👤 ผู้บันทึก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {records.map((r, idx) => {
                      const rowNum = (page - 1) * 50 + idx + 1
                      return (
                        <tr
                          key={r.repossessId}
                          onClick={() => setSelectedItem(r)}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                        >
                          <td className="py-3.5 px-4 text-center font-mono text-zinc-400 text-[11px]">
                            {rowNum}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Link
                                  href={`/vehicle/${r.registerNo || r.vinNo}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-bold text-zinc-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 transition-colors hover:underline text-xs"
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
                          <td className="py-3.5 px-4">
                            {r.contractNo ? (
                              <div className="space-y-0.5">
                                <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                  {r.contractNo}
                                </div>
                                {r.customerName && (
                                  <div className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate max-w-[150px]">
                                    {r.customerName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {formatThaiDate(r.repossessDate)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-zinc-800 dark:text-zinc-200 font-medium max-w-[200px] line-clamp-2" title={r.repossessLocation || '-'}>
                              📍 {r.repossessLocation || <span className="text-zinc-400 italic">ไม่ระบุ</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-zinc-600 dark:text-zinc-400 text-xs max-w-[220px] line-clamp-2" title={r.remark || '-'}>
                              {r.remark || <span className="text-zinc-400 italic">-</span>}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="text-zinc-800 dark:text-zinc-200 font-medium text-[11px]">
                                {r.createUserName || '-'}
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                {formatThaiDateTime(r.createDate)}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card List View */}
            <div className="lg:hidden space-y-3">
              {records.map((r, idx) => {
                const rowNum = (page - 1) * 50 + idx + 1
                return (
                  <div
                    key={r.repossessId}
                    onClick={() => setSelectedItem(r)}
                    className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-2.5 active:bg-zinc-50 dark:active:bg-zinc-800/60 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400">#{rowNum}</span>
                        <Link
                          href={`/vehicle/${r.registerNo || r.vinNo}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-bold text-sm text-zinc-900 dark:text-white hover:text-rose-600 dark:hover:text-rose-400"
                        >
                          {r.registerNo || 'ไม่มีทะเบียน'}
                        </Link>
                        {r.model && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {r.model}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200/40">
                        {formatThaiDate(r.repossessDate)}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-zinc-400 select-all">
                      VIN: {r.vinNo}
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1 text-xs">
                      <div>
                        <span className="text-zinc-400">สถานที่ยึด:</span>{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">{r.repossessLocation || '-'}</strong>
                      </div>
                      {r.contractNo && (
                        <div>
                          <span className="text-zinc-400">สัญญา:</span>{' '}
                          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{r.contractNo}</span>
                          {r.customerName && <span className="text-zinc-600 dark:text-zinc-300 ml-1">({r.customerName})</span>}
                        </div>
                      )}
                      {r.remark && (
                        <div>
                          <span className="text-zinc-400">หมายเหตุ:</span>{' '}
                          <span className="text-zinc-700 dark:text-zinc-300">{r.remark}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end text-[11px] text-zinc-400 pt-1">
                      <span>บันทึกโดย: {r.createUserName || '-'}</span>
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
                onPageChange={(p) => setPage(p)}
              />
            </div>
          </div>
        )}
      </div>

      {/* 6. Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🚨</span>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    รายละเอียดการยึดรถ {selectedItem.registerNo || selectedItem.vinNo}
                  </h3>
                  <p className="text-xs text-zinc-400">รหัสบันทึก #{selectedItem.repossessId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-2xl">
                <div>
                  <span className="text-zinc-400 block mb-0.5">ทะเบียน</span>
                  <strong className="text-sm text-zinc-900 dark:text-white">{selectedItem.registerNo || '-'}</strong>
                </div>
                <div>
                  <span className="text-zinc-400 block mb-0.5">รุ่นรถ</span>
                  <strong className="text-sm text-zinc-900 dark:text-white">{selectedItem.model || '-'}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-400 block mb-0.5">เลขตัวถัง (VIN)</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200 select-all">{selectedItem.vinNo}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-400">วันที่ยึดรถ</span>
                  <strong className="text-zinc-900 dark:text-white">{formatThaiDate(selectedItem.repossessDate)}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-400">สถานที่ไปยึด</span>
                  <span className="text-zinc-900 dark:text-white font-medium">{selectedItem.repossessLocation || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-400">เลขที่สัญญา</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">{selectedItem.contractNo || '-'}</span>
                </div>
                {selectedItem.customerName && (
                  <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                    <span className="text-zinc-400">ผู้เช่า / ลูกค้า</span>
                    <span className="text-zinc-900 dark:text-white">{selectedItem.customerName} {selectedItem.customerPhone ? `(${selectedItem.customerPhone})` : ''}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-400">สถานที่จอดปัจจุบัน</span>
                  <span className="text-zinc-900 dark:text-white">{selectedItem.currentLocationName || selectedItem.currentLocation || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-400">ผู้บันทึก</span>
                  <span className="text-zinc-900 dark:text-white">{selectedItem.createUserName || '-'} ({formatThaiDateTime(selectedItem.createDate)})</span>
                </div>
              </div>

              {selectedItem.remark && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200">
                  <span className="font-bold block mb-1">📝 หมายเหตุ:</span>
                  <p className="leading-relaxed">{selectedItem.remark}</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <Link
                href={`/vehicle/${selectedItem.registerNo || selectedItem.vinNo}`}
                className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold hover:underline"
              >
                <span>เปิดดูประวัติคันรถเต็ม ↗</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VehicleRepossessPage() {
  return (
    <AuthGuard>
      <VehicleRepossessContent />
    </AuthGuard>
  )
}
