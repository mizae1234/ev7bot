'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import { exportToExcel, ExportButton } from '@/lib/exportExcel'

interface GateLog {
  GateLogID: number
  VehicleRef: string | null
  VinNo: string | null
  CheckInTime: string | null
  CheckInCategory: string | null
  CheckInMessage: string | null
  CheckInByName: string | null
  CheckOutTime: string | null
  CheckOutCategory: string | null
  CheckOutMessage: string | null
  CheckOutByName: string | null
  QuantityIn: number
  QuantityOut: number
  Status: string
  Note: string | null
  CreateDate: string
  UpdateDate: string
}

interface GateStats {
  totalToday: number
  totalVehiclesInToday: number
  inYard: number
  inYardNewCars: number
  inYardPlateCars: number
  outPaired: number
  outOnly: number
  cancelled: number
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' }) + ' ' +
    d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function calcDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn && !checkOut) return '—'
  const start = checkIn ? new Date(checkIn) : null
  const end = checkOut ? new Date(checkOut) : new Date()

  if (!start) return '—'

  const diffMs = end.getTime() - start.getTime()
  if (diffMs < 0) return '—'

  const totalMins = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMins / 60)
  const mins = totalMins % 60

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `${days} วัน ${hours % 24} ชม.`
  }
  if (hours > 0) return `${hours} ชม. ${mins} นาที`
  return `${mins} นาที`
}

function maskName(name: string | null): string {
  if (!name) return '—'
  const parts = name.trim().split(/\s+/)
  return parts[0] || name
}

function isNewCarRecord(log: GateLog): boolean {
  return log.VehicleRef === 'รถใหม่' || (log.VehicleRef?.includes('รถใหม่') ?? false) || log.QuantityIn > 1 || log.QuantityOut > 1
}

function getStatusBadge(status: string, remaining: number = 0, isNewCar: boolean = false) {
  switch (status) {
    case 'IN':
      if (isNewCar && remaining > 0) {
        return { label: `🔵 ในลาน (${remaining} คัน)`, bg: 'bg-blue-50 text-blue-700 border-blue-200' }
      }
      return { label: '🔵 อยู่ในลาน', bg: 'bg-blue-50 text-blue-700 border-blue-200' }
    case 'OUT':
      return { label: '✅ ออกครบแล้ว', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    case 'OUT_ONLY':
      return { label: '🟡 ออก (ไม่มีเข้า)', bg: 'bg-amber-50 text-amber-700 border-amber-200' }
    case 'CANCELLED':
      return { label: '❌ ยกเลิก', bg: 'bg-red-50 text-red-600 border-red-200' }
    default:
      return { label: status, bg: 'bg-gray-50 text-gray-600 border-gray-200' }
  }
}

function GateMonitorContent() {
  const [logs, setLogs] = useState<GateLog[]>([])
  const [stats, setStats] = useState<GateStats>({
    totalToday: 0,
    totalVehiclesInToday: 0,
    inYard: 0,
    inYardNewCars: 0,
    inYardPlateCars: 0,
    outPaired: 0,
    outOnly: 0,
    cancelled: 0,
  })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('ALL') // 'ALL' | 'NEW_CAR' | 'PLATE'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Message modal
  const [selectedMessage, setSelectedMessage] = useState<{ title: string; text: string; sender: string; time: string } | null>(null)

  // Auto-refresh
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState(180) // 3 min
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Set default date to today (local time)
  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const today = `${year}-${month}-${day}`
    setStartDate(today)
    setEndDate(today)
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.append('search', search)
      if (statusFilter !== 'ALL') params.append('status', statusFilter)
      if (vehicleTypeFilter !== 'ALL') params.append('vehicleType', vehicleTypeFilter)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const res = await fetch(`/api/gate-logs?${params.toString()}`)
      const data = await res.json()

      if (res.ok) {
        setLogs(data.logs || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
        if (data.stats) setStats(data.stats)
        setLastUpdated(new Date())
        setNextRefreshIn(180)
      }
    } catch (err) {
      console.error('Failed to fetch gate logs:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, vehicleTypeFilter, startDate, endDate])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Auto-refresh every 3 minutes
  useEffect(() => {
    intervalRef.current = setInterval(fetchLogs, 3 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchLogs])

  // Countdown
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => (prev > 0 ? prev - 1 : 180))
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  const handleSearchChange = (val: string) => { setSearch(val); setPage(1) }
  const handleStatusFilterChange = (val: string) => { setStatusFilter(val); setPage(1) }
  const handleVehicleTypeFilterChange = (val: string) => { setVehicleTypeFilter(val); setPage(1) }

  // Export Excel
  const handleExportExcel = () => {
    const headers = [
      'ข้อมูลรถ / ทะเบียน', 'ประเภทรายการ', 'จำนวนเข้า', 'จำนวนออก', 'คงเหลือในลาน',
      'เหตุผล(เข้า)', 'เวลาเข้า', 'รปภ(เข้า)',
      'เหตุผล(ออก)', 'เวลาออก', 'รปภ(ออก)',
      'ระยะเวลา', 'สถานะ', 'วันที่บันทึก'
    ]

    const rows = logs.map(log => {
      const isNewCar = isNewCarRecord(log)
      const remaining = Math.max(0, log.QuantityIn - log.QuantityOut)
      return [
        log.VehicleRef || (isNewCar ? 'รถใหม่ (ไม่มีทะเบียน)' : '-'),
        isNewCar ? 'รถใหม่ไม่มีทะเบียน' : 'รถมีทะเบียน',
        log.QuantityIn,
        log.QuantityOut,
        log.Status === 'IN' ? remaining : 0,
        log.CheckInCategory || '-',
        log.CheckInTime ? formatDateTime(log.CheckInTime) : '-',
        log.CheckInByName ? maskName(log.CheckInByName) : '-',
        log.CheckOutCategory || '-',
        log.CheckOutTime ? formatDateTime(log.CheckOutTime) : '-',
        log.CheckOutByName ? maskName(log.CheckOutByName) : '-',
        calcDuration(log.CheckInTime, log.CheckOutTime),
        getStatusBadge(log.Status, remaining, isNewCar).label.replace(/[^\u0E00-\u0E7F\w\s()]/g, '').trim(),
        formatDateTime(log.CreateDate),
      ]
    })

    let periodLabel = 'ทั้งหมด'
    if (startDate && endDate) {
      periodLabel = `${startDate} - ${endDate}`
    } else if (startDate) {
      periodLabel = `ตั้งแต่ ${startDate}`
    } else if (endDate) {
      periodLabel = `ถึง ${endDate}`
    }

    exportToExcel({
      reportName: 'บันทึกรถเข้า-ออกลาน (Gate Log)',
      periodLabel,
      headers,
      rows,
      fileName: 'Gate_Log_Report',
    })
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2.5">
            <span className="text-2xl">🚧</span>
            Gate Log — บันทึกรถเข้า-ออกลาน
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            ติดตามสถานะรถเข้า-ออกลานและคลังรถใหม่แบบ Real-time จากรายงานของ รปภ ในกลุ่ม LINE
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-zinc-400">
              อัปเดตล่าสุด {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · รีเฟรชใน {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, '0')}
            </span>
          )}
          <ExportButton onClick={handleExportExcel} label="📥 Export Excel" />
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total in yard */}
        <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-blue-600 font-bold">🔵 รถอยู่ในลานทั้งหมด</span>
            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium border border-blue-200">Real-time</span>
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.inYard} <span className="text-xs font-medium text-blue-500">คัน</span></div>
          <div className="text-[10px] text-zinc-400 mt-1 flex items-center gap-2">
            <span>🚗 มีทะเบียน: <strong className="text-zinc-600">{stats.inYardPlateCars}</strong></span>
            <span>·</span>
            <span>✨ รถใหม่: <strong className="text-purple-600">{stats.inYardNewCars}</strong></span>
          </div>
        </div>

        {/* New cars remaining */}
        <div className="bg-white border border-purple-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-purple-600 font-bold">✨ รถใหม่ในลาน (ไม่มีทะเบียน)</span>
            <span className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium border border-purple-200">Batch FIFO</span>
          </div>
          <div className="text-2xl font-black text-purple-700">{stats.inYardNewCars} <span className="text-xs font-medium text-purple-500">คัน</span></div>
          <div className="text-[10px] text-zinc-400 mt-1">
            ตัดยอดอัตโนมัติเมื่อ รปภ บันทึกรถใหม่ออก
          </div>
        </div>

        {/* Out today */}
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-emerald-600 font-bold">✅ รถออกแล้ว (วันนี้)</span>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium border border-emerald-200">วันนี้</span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.outPaired} <span className="text-xs font-medium text-emerald-500">คัน</span></div>
          <div className="text-[10px] text-zinc-400 mt-1">
            {stats.outOnly > 0 ? `(มี ${stats.outOnly} รายการไม่พบบันทึกเข้า)` : 'จับคู่บันทึกเข้า-ออกครบถ้วน'}
          </div>
        </div>

        {/* Total Entered today */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-600 font-bold">📊 รถเข้าลานวันนี้รวม</span>
            <span className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-full font-medium">รวมทั้งหมด</span>
          </div>
          <div className="text-2xl font-black text-zinc-800">{stats.totalVehiclesInToday || stats.totalToday} <span className="text-xs font-medium text-zinc-500">คัน</span></div>
          <div className="text-[10px] text-zinc-400 mt-1">
            รวม {stats.totalToday} เรคคอร์ดที่บันทึกวันนี้
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">🔍 ค้นหา (ทะเบียน, VIN, รปภ, เหตุผล)</label>
            <input
              type="text"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="เช่น ทอ-4905, รถใหม่, ช่างเอ..."
              className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition"
            />
          </div>

          {/* Vehicle Type Filter */}
          <div className="min-w-[150px]">
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">🚗 ประเภทรถ</label>
            <select
              value={vehicleTypeFilter}
              onChange={e => handleVehicleTypeFilterChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition bg-white font-medium"
            >
              <option value="ALL">ทั้งหมด (ทุกประเภท)</option>
              <option value="NEW_CAR">✨ รถใหม่ (ไม่มีทะเบียน)</option>
              <option value="PLATE">🚗 รถมีทะเบียนปกติ</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="min-w-[140px]">
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">📌 สถานะ</label>
            <select
              value={statusFilter}
              onChange={e => handleStatusFilterChange(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition bg-white"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="IN">🔵 อยู่ในลาน</option>
              <option value="OUT">✅ ออกแล้ว</option>
              <option value="OUT_ONLY">🟡 ออก (ไม่มีเข้า)</option>
              <option value="CANCELLED">❌ ยกเลิก</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="min-w-[130px]">
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">📅 จากวันที่</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setPage(1) }}
              className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition"
            />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-[10px] font-medium text-zinc-500 mb-1">📅 ถึงวันที่</label>
            <input
              type="date"
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setPage(1) }}
              className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition"
            />
          </div>

          {/* Reset */}
          <button
            onClick={() => {
              setSearch('')
              setStatusFilter('ALL')
              setVehicleTypeFilter('ALL')
              const now = new Date()
              const year = now.getFullYear()
              const month = String(now.getMonth() + 1).padStart(2, '0')
              const day = String(now.getDate()).padStart(2, '0')
              const today = `${year}-${month}-${day}`
              setStartDate(today)
              setEndDate(today)
              setPage(1)
            }}
            className="px-3 py-1.5 text-xs font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-xl hover:bg-zinc-200 transition cursor-pointer"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">ข้อมูลรถ / ทะเบียน</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">จำนวน (เข้า / ออก / เหลือ)</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">เหตุผล (เข้า)</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">เวลาเข้า</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">รปภ (เข้า)</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">เหตุผล (ออก)</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">เวลาออก</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">รปภ (ออก)</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-600">ระยะเวลา</th>
                <th className="text-center px-4 py-3 font-semibold text-zinc-600">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-zinc-400 text-xs">กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-zinc-400">
                    ไม่พบข้อมูลรายการรถเข้า-ออกตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const isNewCar = isNewCarRecord(log)
                  const remaining = Math.max(0, log.QuantityIn - log.QuantityOut)
                  const badge = getStatusBadge(log.Status, remaining, isNewCar)
                  const isInYard = log.Status === 'IN'

                  return (
                    <tr key={log.GateLogID} className={`hover:bg-zinc-50/80 transition ${isInYard ? (isNewCar ? 'bg-purple-50/20' : 'bg-blue-50/30') : ''}`}>
                      {/* ข้อมูลรถ / ทะเบียน */}
                      <td className="px-4 py-3">
                        {isNewCar ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 text-[11px] font-bold rounded-lg border border-purple-200 shadow-2xs">
                              <span>✨</span>
                              รถใหม่ (ไม่มีทะเบียน)
                            </span>
                            {log.VinNo && (
                              <div className="text-[10px] text-zinc-500 font-mono mt-1">VIN: {log.VinNo}</div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-zinc-900 text-sm tracking-wide">{log.VehicleRef || '—'}</div>
                            {log.VinNo && (
                              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{log.VinNo}</div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* จำนวน (เข้า / ออก / เหลือ) */}
                      <td className="px-4 py-3 text-center">
                        {isNewCar || log.QuantityIn > 1 || log.QuantityOut > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-bold border border-blue-200" title="จำนวนเข้า">
                                📥 {log.QuantityIn}
                              </span>
                              <span className="text-zinc-300">/</span>
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold border border-emerald-200" title="จำนวนออก">
                                📤 {log.QuantityOut}
                              </span>
                            </div>
                            {isInYard && remaining > 0 && (
                              <div className="mt-1 px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200">
                                🟡 เหลือในลาน {remaining} คัน
                              </div>
                            )}
                            {log.Status === 'OUT' && (
                              <div className="mt-1 text-[10px] text-emerald-600 font-medium">
                                ครบทุกคันแล้ว
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-600 font-medium">1 คัน</span>
                        )}
                      </td>

                      {/* เหตุผล (เข้า) */}
                      <td className="px-4 py-3">
                        {log.CheckInCategory ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded-lg border border-blue-200">
                              {log.CheckInCategory}
                            </span>
                            {log.CheckInMessage && (
                              <button
                                onClick={() => setSelectedMessage({
                                  title: '💬 ข้อความรายงานตอนเข้า (รปภ)',
                                  text: log.CheckInMessage || '',
                                  sender: maskName(log.CheckInByName),
                                  time: formatDateTime(log.CheckInTime)
                                })}
                                className="text-zinc-400 hover:text-blue-600 transition cursor-pointer"
                                title="ดูข้อความต้นฉบับ LINE"
                              >
                                💬
                              </button>
                            )}
                          </div>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* เวลาเข้า */}
                      <td className="px-4 py-3 text-zinc-600">
                        {log.CheckInTime ? (
                          <div>
                            <div className="font-semibold text-zinc-800">{formatTime(log.CheckInTime)}</div>
                            <div className="text-[10px] text-zinc-400">{formatDate(log.CheckInTime)}</div>
                          </div>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* รปภ (เข้า) */}
                      <td className="px-4 py-3 text-zinc-600 font-medium">
                        {log.CheckInByName ? maskName(log.CheckInByName) : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* เหตุผล (ออก) */}
                      <td className="px-4 py-3">
                        {log.CheckOutCategory ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded-lg border border-emerald-200">
                              {log.CheckOutCategory}
                            </span>
                            {log.CheckOutMessage && (
                              <button
                                onClick={() => setSelectedMessage({
                                  title: '💬 ข้อความรายงานตอนออก (รปภ)',
                                  text: log.CheckOutMessage || '',
                                  sender: maskName(log.CheckOutByName),
                                  time: formatDateTime(log.CheckOutTime)
                                })}
                                className="text-zinc-400 hover:text-emerald-600 transition cursor-pointer"
                                title="ดูข้อความต้นฉบับ LINE"
                              >
                                💬
                              </button>
                            )}
                          </div>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* เวลาออก */}
                      <td className="px-4 py-3 text-zinc-600">
                        {log.CheckOutTime ? (
                          <div>
                            <div className="font-semibold text-zinc-800">{formatTime(log.CheckOutTime)}</div>
                            <div className="text-[10px] text-zinc-400">{formatDate(log.CheckOutTime)}</div>
                          </div>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* รปภ (ออก) */}
                      <td className="px-4 py-3 text-zinc-600 font-medium">
                        {log.CheckOutByName ? maskName(log.CheckOutByName) : <span className="text-zinc-300">—</span>}
                      </td>

                      {/* ระยะเวลา */}
                      <td className="px-4 py-3">
                        <span className={`font-medium ${isInYard ? 'text-blue-600 font-semibold' : 'text-zinc-600'}`}>
                          {calcDuration(log.CheckInTime, log.CheckOutTime)}
                          {isInYard && <span className="text-[10px] text-blue-500 block font-normal">กำลังจอดอยู่...</span>}
                        </span>
                      </td>

                      {/* สถานะ */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 text-[10px] font-bold rounded-full border shadow-2xs ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-500">
            แสดง {logs.length} จากทั้งหมด {total} รายการ
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={50}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* Original LINE Message Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                {selectedMessage.title}
              </h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-zinc-400 hover:text-zinc-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-xs text-zinc-800 whitespace-pre-wrap font-mono mb-4 leading-relaxed">
              {selectedMessage.text}
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-400 border-t border-zinc-100 pt-3">
              <span>👤 ผู้ส่ง: <strong className="text-zinc-600">{selectedMessage.sender}</strong></span>
              <span>🕐 เวลา: {selectedMessage.time}</span>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedMessage(null)}
                className="px-4 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-medium hover:bg-zinc-800 transition cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function GateMonitorPage() {
  return (
    <AuthGuard>
      <GateMonitorContent />
    </AuthGuard>
  )
}
