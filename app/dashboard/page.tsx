'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { StatCard } from '@/components/dashboard/StatCard'
import { DailyChart } from '@/components/dashboard/DailyChart'
import { RepairTrendChart } from '@/components/dashboard/RepairTrendChart'
import { DeliveryCalendar } from '@/components/dashboard/DeliveryCalendar'
import { DeliveryTable } from '@/components/dashboard/DeliveryTable'
import { RepairTable } from '@/components/dashboard/RepairTable'
import { ReplacementTable } from '@/components/dashboard/ReplacementTable'
import { ReturnTable } from '@/components/dashboard/ReturnTable'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { LoginProfile } from '@/components/ui/LoginProfile'
import { AuthGuard } from '@/components/ui/AuthGuard'
import type { DashboardData } from '@/types'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

const thaiMonthsShort = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
]

function DashboardContent() {
  // Navigation calendar state (June 2026 matches user data)
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [selectedMonth, setSelectedMonth] = useState<number>(5) // 0-indexed, 5 = June
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  
  // Custom date range state
  const [filterMode, setFilterMode] = useState<'month' | 'range' | 'year'>('month')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  // Toggle between deliveries and repairs in the calendar
  const [calendarViewMode, setCalendarViewMode] = useState<'deliveries' | 'repairs'>('deliveries')
  
  // Tabs for the detail tables
  const [activeTab, setActiveTab] = useState<'deliveries' | 'repairs' | 'replacements' | 'returns'>('deliveries')

  // Calculate start/end dates
  const startDateStr = filterMode === 'month'
    ? new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0]
    : filterMode === 'year'
      ? `${selectedYear}-01-01`
      : (customStartDate || new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0])
  const endDateStr = filterMode === 'month'
    ? new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]
    : filterMode === 'year'
      ? `${selectedYear}-12-31`
      : (customEndDate || new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0])

  // Query database dynamically using SWR
  const { data, error, isLoading, mutate, isValidating } = useSWR<DashboardData>(
    `/api/dashboard?startDate=${startDateStr}&endDate=${endDateStr}&year=${selectedYear}`,
    fetcher,
    { refreshInterval: 60_000 }   // Auto-refresh every 60s
  )

  const handleManualRefresh = () => {
    mutate()
  }

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11)
      setSelectedYear(y => y - 1)
    } else {
      setSelectedMonth(m => m - 1)
    }
    setSelectedDate(null)
  }

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      setSelectedYear(y => y + 1)
    } else {
      setSelectedMonth(m => m + 1)
    }
    setSelectedDate(null)
  }

  const handleGoToToday = () => {
    const today = new Date()
    setSelectedMonth(today.getMonth())
    setSelectedYear(today.getFullYear())
    setSelectedDate(today.toISOString().split('T')[0])
  }

  // Filter lists based on selectedDate if set, otherwise show all of month
  const getFilteredDeliveries = () => {
    if (!data) return []
    if (!selectedDate || filterMode !== 'month') return data.deliveryList
    return data.deliveryList.filter(d => {
      const dt = d.release_date || d.expected_release_date
      return dt && dt.startsWith(selectedDate)
    })
  }

  const getFilteredRepairs = () => {
    if (!data) return []
    if (!selectedDate || filterMode !== 'month') return data.repairList
    return data.repairList.filter(r => {
      return (
        (r.report_date && r.report_date.startsWith(selectedDate)) ||
        (r.start_date && r.start_date.startsWith(selectedDate)) ||
        (r.finish_date && r.finish_date.startsWith(selectedDate))
      )
    })
  }

  const getFilteredReplacements = () => {
    if (!data) return []
    if (!selectedDate || filterMode !== 'month') return data.replacementList
    return data.replacementList.filter(r => {
      return (
        (r.start_date && r.start_date.startsWith(selectedDate)) ||
        (r.return_date && r.return_date.startsWith(selectedDate)) ||
        !r.return_date
      )
    })
  }

  const getFilteredReturns = () => {
    if (!data) return []
    if (!selectedDate || filterMode !== 'month') return data.returnList
    return data.returnList.filter(r => {
      return (
        (r.receive_date && r.receive_date.startsWith(selectedDate)) ||
        (r.return_date && r.return_date.startsWith(selectedDate))
      )
    })
  }

  // Helper percentage
  const getPercentage = (value: number, total: number) => {
    if (total === 0) return '0%'
    return `${Math.round((value / total) * 100)}%`
  }

  // KPI Icons
  const carIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-indigo-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177V3.75A2.25 2.25 0 0 0 12 1.5h-1.5a2.25 2.25 0 0 0-2.25 2.25v3.823M16.5 7.5V12m-9-4.5V12m-3.75 3h16.5M12 17.25V21" />
    </svg>
  )
  const repairIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-emerald-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.67 2.67 0 1 0 21 17.25l-5.83-5.83m-3.75 3.75-3.75-3.75m3.75 3.75H18M9 9V3M3 9h6M6 6h.008v.008H6V6Zm.008 3h.008v.008H6.008V9Zm.008 3h.008v.008H6.008V12Z" />
    </svg>
  )
  const verifyIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-sky-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
    </svg>
  )
  const alertIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5 text-rose-500">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )

  const filteredDeliveries = getFilteredDeliveries()
  const filteredRepairs = getFilteredRepairs()
  const filteredReplacements = getFilteredReplacements()
  const filteredReturns = getFilteredReturns()

  if (error) {
    return (
      <main className="min-h-screen bg-grid-pattern bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">โหลดข้อมูลไม่สำเร็จ</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อดึงข้อมูลจากระบบ กรุณาตรวจสอบการตั้งค่าฐานข้อมูล</p>
          <button
            onClick={handleManualRefresh}
            className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-650 dark:hover:bg-indigo-600 text-white text-sm font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-grid-pattern bg-zinc-50/50 pb-12 dark:bg-zinc-950/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-indigo-650 dark:from-zinc-100 dark:to-indigo-400 tracking-tight">
                EV7 Tracking Operations
              </h1>
              <div className="flex gap-1.5 items-center">
                <span className="text-[10px] tracking-wider px-2 py-0.5 rounded-md font-extrabold border border-indigo-500/25 bg-indigo-500/5 text-indigo-500 dark:text-indigo-400">AION</span>
                <span className="text-[10px] tracking-wider px-2 py-0.5 rounded-md font-extrabold border border-emerald-500/25 bg-emerald-500/5 text-emerald-500 dark:text-emerald-400">HYPTEC</span>
                <span className="text-[10px] tracking-wider px-2 py-0.5 rounded-md font-extrabold border border-zinc-500/25 bg-zinc-500/5 text-zinc-650 dark:text-zinc-300">GAC</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              ระบบแสดงผลปฏิทินส่งมอบรถ สถิติการแจ้งซ่อม และรายการทดแทน/รับคืนแบบเรียลไทม์
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <LoginProfile />
            {isLoading ? (
              <LoadingSkeleton className="h-6 w-36" />
            ) : data ? (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm border ${
                data.mockMode 
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
              }`}>
                <span className={`h-2 w-2 rounded-full ${data.mockMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                {data.mockMode ? 'ข้อมูลจำลอง (Mock Mode)' : 'เชื่อมต่อฐานข้อมูลตรง'}
              </span>
            ) : null}

            <a
              href="/chat"
              className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-zinc-900 text-xs font-bold py-1.5 px-3.5 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
            >
              🧈 Chat Butter
            </a>

            <button
              onClick={handleManualRefresh}
              disabled={isLoading || isValidating}
              className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold py-1.5 px-3 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={2} 
                stroke="currentColor" 
                className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-indigo-500' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Date Filter & Calendar View Controls (Matches screenshot layout) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/60 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm backdrop-blur-md">
          {/* Mode Selector & Main Date Controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Range vs Month vs Year Toggle */}
            <div className="bg-zinc-100 dark:bg-zinc-850 p-1 rounded-xl flex gap-1 shadow-inner border border-zinc-200/50 dark:border-zinc-800/50">
              <button
                onClick={() => {
                  setFilterMode('month')
                  setSelectedDate(null)
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-150 ${
                  filterMode === 'month'
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300'
                }`}
              >
                รายเดือน
              </button>
              <button
                onClick={() => {
                  setFilterMode('year')
                  setSelectedDate(null)
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-150 ${
                  filterMode === 'year'
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300'
                }`}
              >
                รายปี
              </button>
              <button
                onClick={() => {
                  setFilterMode('range')
                  setSelectedDate(null)
                  if (!customStartDate) {
                    const firstDay = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0]
                    setCustomStartDate(firstDay)
                  }
                  if (!customEndDate) {
                    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0]
                    setCustomEndDate(lastDay)
                  }
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-150 ${
                  filterMode === 'range'
                    ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                    : 'text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300'
                }`}
              >
                เลือกช่วงวันที่
              </button>
            </div>

            {filterMode === 'month' && (
              /* Month/Year toggle controls */
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-zinc-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-[120px] text-center">
                  {thaiMonths[selectedMonth]} {selectedYear + 543}
                </span>
                
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-zinc-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                
                <button
                  onClick={handleGoToToday}
                  className="text-xs font-semibold px-2.5 py-1.5 border border-zinc-200 hover:bg-zinc-50 rounded-lg dark:border-zinc-800 dark:hover:bg-zinc-850 text-zinc-700 dark:text-zinc-300"
                >
                  วันนี้
                </button>
              </div>
            )}
            
            {filterMode === 'year' && (
              /* Year-only toggle controls */
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedYear(y => y - 1)}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-zinc-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                
                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 min-w-[120px] text-center">
                  ปี {selectedYear + 543}
                </span>
                
                <button
                  onClick={() => setSelectedYear(y => y + 1)}
                  className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 text-zinc-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            )}

            {filterMode === 'range' && (
              /* Custom Date Range Pickers */
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">จาก:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white/50 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">ถึง:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white/50 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Calendar Mode Toggles and Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle (Only in Month Mode) */}
            {filterMode === 'month' && (
              <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex gap-1 shadow-inner">
                <button
                  onClick={() => setCalendarViewMode('deliveries')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 ${
                    calendarViewMode === 'deliveries'
                      ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  ปฏิทินส่งมอบรถ
                </button>
                <button
                  onClick={() => setCalendarViewMode('repairs')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150 ${
                    calendarViewMode === 'repairs'
                      ? 'bg-white dark:bg-zinc-700 shadow-sm text-indigo-600 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  ปฏิทินงานซ่อม
                </button>
              </div>
            )}

            {/* Quick dropdown selectors (Month and Year Mode) */}
            {(filterMode === 'month' || filterMode === 'year') && (
              <div className="flex gap-2">
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value))
                    setSelectedDate(null)
                  }}
                  className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 bg-white/50 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
                {filterMode === 'month' && (
                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(Number(e.target.value))
                      setSelectedDate(null)
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 bg-white/50 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
                  >
                    {thaiMonthsShort.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic KPI Cards Grid for filtered range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-32 w-full" />
            ))
          ) : data ? (
            <>
              <StatCard
                title={filterMode === 'month' ? "แผนเดือนนี้" : filterMode === 'year' ? "แผนปีนี้" : "แผนช่วงที่เลือก"}
                value={data.delivery.total}
                icon={carIcon}
                subValue={[
                  { label: 'เสร็จแล้ว', count: data.delivery.completed, color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20' },
                  { label: 'เตรียมการ', count: data.delivery.pending, color: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20' },
                ]}
              />
              <StatCard
                title={filterMode === 'month' ? "งานซ่อมแจ้งเดือนนี้" : filterMode === 'year' ? "งานซ่อมแจ้งปีนี้" : "งานซ่อมแจ้งช่วงที่เลือก"}
                value={data.repair.total}
                icon={repairIcon}
                subValue={[
                  { label: 'ปิดงาน', count: data.repair.closed, color: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20' },
                  { label: 'ค้างซ่อม', count: data.repair.open, color: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20' },
                ]}
              />
              <StatCard 
                title="อัตราปล่อยสำเร็จ" 
                value={data.delivery.completed} 
                icon={verifyIcon}
                subValue={[
                  { label: 'คิดเป็น', count: getPercentage(data.delivery.completed, data.delivery.total), color: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20' }
                ]}
              />
              <StatCard 
                title="ซ่อมค้างรวม" 
                value={data.repair.open} 
                icon={alertIcon}
                subValue={[
                  { label: 'คิดเป็น', count: getPercentage(data.repair.open, data.repair.total), color: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20' }
                ]}
              />
            </>
          ) : null}
        </div>

        {/* Master Calendar Section */}
        {filterMode === 'month' && (
          isLoading ? (
            <LoadingSkeleton className="h-[550px] w-full" />
          ) : data ? (
            <DeliveryCalendar
              deliveries={data.deliveryList}
              repairs={data.repairList}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              selectedDate={selectedDate}
              onDateClick={(dateStr) => {
                // Toggle selection: click same date again to clear filter
                setSelectedDate(prev => prev === dateStr ? null : dateStr)
              }}
              viewMode={calendarViewMode}
            />
          ) : null
        )}

        {/* Trend Charts Section */}
        {!isLoading && data && data.trend && data.trend.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyChart data={data.trend} />
            <RepairTrendChart data={data.trend} />
          </div>
        )}

        {/* Live Tables Details Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 gap-4">
            {/* Tabs for details */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <button
                onClick={() => setActiveTab('deliveries')}
                className={`pb-3 text-sm font-semibold border-b-2 px-4 whitespace-nowrap transition-all duration-200 ${
                  activeTab === 'deliveries'
                    ? 'border-indigo-550 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                รายการปล่อยรถ ({filteredDeliveries.length})
              </button>
              <button
                onClick={() => setActiveTab('repairs')}
                className={`pb-3 text-sm font-semibold border-b-2 px-4 whitespace-nowrap transition-all duration-200 ${
                  activeTab === 'repairs'
                    ? 'border-indigo-550 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                งานซ่อมบำรุง ({filteredRepairs.length})
              </button>
              <button
                onClick={() => setActiveTab('replacements')}
                className={`pb-3 text-sm font-semibold border-b-2 px-4 whitespace-nowrap transition-all duration-200 ${
                  activeTab === 'replacements'
                    ? 'border-indigo-550 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                รถทดแทน ({filteredReplacements.length})
              </button>
              <button
                onClick={() => setActiveTab('returns')}
                className={`pb-3 text-sm font-semibold border-b-2 px-4 whitespace-nowrap transition-all duration-200 ${
                  activeTab === 'returns'
                    ? 'border-indigo-550 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                รับคืนรถ ({filteredReturns.length})
              </button>
            </div>

            {/* Active Date Filter info */}
            {selectedDate && (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-bold border border-indigo-500/20">
                  กำลังแสดงผลข้อมูลเฉพาะวันที่: {new Date(selectedDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-xs text-rose-500 hover:underline font-semibold"
                >
                  แสดงทั้งเดือน
                </button>
              </div>
            )}
          </div>

          <div className="transition-all duration-300">
            {isLoading ? (
              <LoadingSkeleton className="h-96 w-full" />
            ) : data ? (() => {
              const periodLabel = filterMode === 'month'
                ? `${thaiMonths[selectedMonth]} ${selectedYear + 543}`
                : `${new Date(startDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} - ${new Date(endDateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
              return (
                <>
                  {activeTab === 'deliveries' && <DeliveryTable records={filteredDeliveries} periodLabel={periodLabel} />}
                  {activeTab === 'repairs' && (
                    <>
                      <div className="flex justify-end mb-3">
                        <a
                          href="/maintenance"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 px-3 py-1.5 rounded-xl transition-all border border-emerald-500/10"
                        >
                          🔧 ดูรายละเอียดงานซ่อมทั้งหมด →
                        </a>
                      </div>
                      <RepairTable records={filteredRepairs} periodLabel={periodLabel} />
                    </>
                  )}
                  {activeTab === 'replacements' && <ReplacementTable records={filteredReplacements} periodLabel={periodLabel} />}
                  {activeTab === 'returns' && <ReturnTable records={filteredReturns} periodLabel={periodLabel} />}
                </>
              )
            })() : null}
          </div>
        </div>

        {/* Footer info */}
        {data && (
          <div className="text-center pt-4">
            <span className="text-[10px] text-zinc-400 tracking-wide">
              อัปเดตล่าสุด ณ วันที่ {new Date(data.fetchedAt).toLocaleDateString('th-TH')} เวลา {new Date(data.fetchedAt).toLocaleTimeString('th-TH')} · ดึงข้อมูลปฏิทินย่านวันที่ {new Date(startDateStr).toLocaleDateString('th-TH')} ถึง {new Date(endDateStr).toLocaleDateString('th-TH')}
            </span>
          </div>
        )}

      </div>
    </main>
  )
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  )
}
