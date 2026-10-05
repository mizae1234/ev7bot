'use client'

import React, { useState, useEffect } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { LoginProfile } from '@/components/ui/LoginProfile'
import { exportToExcel } from '@/lib/exportExcel'

interface VehicleNote {
  VehicleNoteID: number
  InventoryItemID: number
  NoteDetail: string
  CreateDate: string
  CreateUserID: number | null
  CreateUserName: string
  RegisterNo: string | null
  VinNo: string
  Model: string
  ProjectType: string
  StatusName: string | null
  SubStatusName: string | null
  CurrentLocation: string | null
  IsActive: boolean
  attachments?: {
    FileAttachmentID: number
    fileName: string
    originalFileName: string
    s3Key: string
    fileSize: number
    contentType: string
    url: string
  }[]
}

interface GroupedVehicleNotes {
  InventoryItemID: number
  RegisterNo: string | null
  VinNo: string
  Model: string
  ProjectType: string
  StatusName: string | null
  SubStatusName: string | null
  CurrentLocation: string | null
  notes: {
    VehicleNoteID: number
    NoteDetail: string
    CreateDate: string
    CreateUserID: number | null
    CreateUserName: string
    attachments?: {
      FileAttachmentID: number
      fileName: string
      originalFileName: string
      s3Key: string
      fileSize: number
      contentType: string
      url: string
    }[]
  }[]
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    })
  } catch {
    return String(dateStr)
  }
}

function getTodayBkk(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())
}

function getOffsetDateBkk(daysOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d)
}

function getStartOfMonthBkk(): string {
  const today = getTodayBkk()
  const [y, m] = today.split('-')
  return `${y}-${m}-01`
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
  } catch {
    return dateStr
  }
}

function maskStaffName(name?: string | null): string {
  if (!name) return '-'
  const trimmed = name.trim()
  if (!trimmed) return '-'
  if (trimmed.includes('@')) return trimmed.split('@')[0].trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 0) return '-'
  if (parts[0] === 'คุณ' && parts.length > 1) return `คุณ${parts[1]}`
  return parts[0]
}

function VehicleNotesContent() {
  const [notes, setNotes] = useState<VehicleNote[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState(getTodayBkk)
  const [endDate, setEndDate] = useState(getTodayBkk)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    fetchNotes()
  }, [page, debouncedSearch, startDate, endDate])

  const fetchNotes = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/vehicle/notes?${params.toString()}`)
      if (!res.ok) {
        throw new Error('ไม่สามารถโหลดข้อมูลบันทึกตัวรถได้')
      }
      const data = await res.json()
      if (data.success) {
        setNotes(data.vehicleNotes || [])
        if (data.pagination) {
          setTotal(data.pagination.total)
          setTotalPages(data.pagination.totalPages)
        }
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch (err: any) {
      console.error('[Fetch Vehicle Notes Error]', err)
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  const handleStartDateChange = (val: string) => {
    setStartDate(val)
    setPage(1)
  }

  const handleEndDateChange = (val: string) => {
    setEndDate(val)
    setPage(1)
  }

  const handlePresetDate = (start: string, end: string) => {
    setStartDate(start)
    setEndDate(end)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    const today = getTodayBkk()
    setStartDate(today)
    setEndDate(today)
    setPage(1)
  }

  const todayStr = getTodayBkk()
  const yesterdayStr = getOffsetDateBkk(-1)
  const last7DaysStr = getOffsetDateBkk(-6)
  const startOfMonthStr = getStartOfMonthBkk()

  const isToday = startDate === todayStr && endDate === todayStr
  const isYesterday = startDate === yesterdayStr && endDate === yesterdayStr
  const isLast7Days = startDate === last7DaysStr && endDate === todayStr
  const isThisMonth = startDate === startOfMonthStr && endDate === todayStr
  const isAll = !startDate && !endDate
  const isFiltered = !isToday || Boolean(search)

  const handleExportExcel = async () => {
    try {
      setExporting(true)
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '5000') // ดึงข้อมูลสูงสุด 5,000 รายการสำหรับส่งออก
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)

      const res = await fetch(`/api/vehicle/notes?${params.toString()}`)
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลเพื่อส่งออกได้')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')

      const exportList: VehicleNote[] = data.vehicleNotes || []
      if (exportList.length === 0) {
        alert('ไม่มีข้อมูลที่ตรงกับเงื่อนไขตัวกรองสำหรับส่งออก')
        return
      }

      let periodLabel = 'ทั้งหมด'
      if (startDate && endDate) {
        periodLabel = startDate === endDate 
          ? `วันที่ ${formatDisplayDate(startDate)}`
          : `${formatDisplayDate(startDate)} ถึง ${formatDisplayDate(endDate)}`
      } else if (startDate) {
        periodLabel = `ตั้งแต่ ${formatDisplayDate(startDate)}`
      } else if (endDate) {
        periodLabel = `ถึง ${formatDisplayDate(endDate)}`
      }

      const rows = exportList.map((item, index) => {
        const attachmentStr = (item.attachments && item.attachments.length > 0)
          ? item.attachments.map(a => a.originalFileName || a.fileName).join(', ')
          : '-'

        return [
          index + 1,
          formatDateTh(item.CreateDate),
          item.RegisterNo || 'ยังไม่มีทะเบียน',
          item.VinNo || '-',
          item.ProjectType || '-',
          item.Model || '-',
          item.StatusName || '-',
          item.SubStatusName || '-',
          item.CurrentLocation || '-',
          maskStaffName(item.CreateUserName),
          item.NoteDetail || '-',
          attachmentStr
        ]
      })

      const headers = [
        'ลำดับ',
        'วันที่-เวลาบันทึก',
        'ทะเบียนรถ',
        'เลขตัวถัง (VIN)',
        'โครงการ',
        'รุ่นรถ',
        'สถานะรถ',
        'สถานะย่อย',
        'สถานที่ปัจจุบัน',
        'ผู้บันทึก',
        'ข้อความบันทึกโน้ต',
        'ไฟล์แนบ'
      ]

      const fileDateRange = startDate && endDate
        ? (startDate === endDate ? startDate : `${startDate}_to_${endDate}`)
        : (startDate || endDate || 'all')

      exportToExcel({
        reportName: 'ประวัติการบันทึกข้อมูลรถ (Vehicle Notes)',
        periodLabel,
        headers,
        rows,
        fileName: `Vehicle_Notes_${fileDateRange}`
      })
    } catch (err: any) {
      console.error('[Export Excel Error]', err)
      alert(err.message || 'เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExporting(false)
    }
  }

  // Group notes by InventoryItemID while maintaining chronological order of vehicles
  const getGroupedNotes = (): GroupedVehicleNotes[] => {
    const grouped: GroupedVehicleNotes[] = []
    const map = new Map<number, GroupedVehicleNotes>()

    for (const note of notes) {
      let group = map.get(note.InventoryItemID)
      if (!group) {
        group = {
          InventoryItemID: note.InventoryItemID,
          RegisterNo: note.RegisterNo,
          VinNo: note.VinNo,
          Model: note.Model,
          ProjectType: note.ProjectType,
          StatusName: note.StatusName,
          SubStatusName: note.SubStatusName,
          CurrentLocation: note.CurrentLocation,
          notes: []
        }
        map.set(note.InventoryItemID, group)
        grouped.push(group)
      }
      group.notes.push({
        VehicleNoteID: note.VehicleNoteID,
        NoteDetail: note.NoteDetail,
        CreateDate: note.CreateDate,
        CreateUserID: note.CreateUserID,
        CreateUserName: note.CreateUserName,
        attachments: note.attachments || []
      })
    }
    return grouped
  }

  const groupedVehicles = getGroupedNotes()

  return (
    <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-indigo-600 dark:from-zinc-100 dark:to-indigo-400 tracking-tight font-sans">
              📝 ประวัติการบันทึกข้อมูลรถ (Vehicle Notes)
            </h1>
            <p className="text-xs text-zinc-500 mt-1 dark:text-zinc-450">
              ประวัติข้อความโน้ตและสถานะล่าสุดของรถยนต์ในระบบ ค้นหาตามทะเบียน เลขตัวถัง หรือเนื้อหาโน้ตได้
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={() => fetchNotes()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition shadow-xs cursor-pointer disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span>
              <span>รีเฟรช</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={exporting || total === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="ส่งออกข้อมูลเป็นไฟล์ Excel"
            >
              <span>{exporting ? '⏳' : '📥'}</span>
              <span>{exporting ? 'กำลังส่งออก...' : 'ส่งออก Excel'}</span>
            </button>
          </div>
        </div>

        {/* Filters / Search & Date Range */}
        <div className="bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-md space-y-3.5">
          {/* Row 1: Search */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="ค้นหาตาม ทะเบียนรถ, VIN, หรือข้อความโน้ต..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-850 dark:text-zinc-250 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-zinc-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer p-0.5"
                title="ล้างข้อความค้นหา"
              >
                ✕
              </button>
            )}
          </div>

          {/* Row 2: Date Range Filter & Quick Presets */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1 border-t border-zinc-150 dark:border-zinc-800/60">
            {/* Date Pickers */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                <span className="text-[11px] font-medium text-zinc-400">จาก:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
                <span className="text-[11px] font-medium text-zinc-400">ถึง:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-transparent text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Quick Presets & Reset */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-400 font-medium mr-1 hidden sm:inline">ลัด:</span>
              <button
                type="button"
                onClick={() => handlePresetDate(todayStr, todayStr)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  isToday
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                วันนี้
              </button>

              <button
                type="button"
                onClick={() => handlePresetDate(yesterdayStr, yesterdayStr)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  isYesterday
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                เมื่อวาน
              </button>

              <button
                type="button"
                onClick={() => handlePresetDate(last7DaysStr, todayStr)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  isLast7Days
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                7 วันล่าสุด
              </button>

              <button
                type="button"
                onClick={() => handlePresetDate(startOfMonthStr, todayStr)}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  isThisMonth
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                เดือนนี้
              </button>

              <button
                type="button"
                onClick={() => handlePresetDate('', '')}
                className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition cursor-pointer ${
                  isAll
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-650 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300'
                }`}
              >
                ทั้งหมด
              </button>

              {isFiltered && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="ml-auto lg:ml-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200/60 dark:border-rose-800/60 px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="รีเซ็ตตัวกรองกลับเป็นวันนี้"
                >
                  <span>↺</span>
                  <span>รีเซ็ต (วันนี้)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && !notes.length && (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="text-center py-10 text-rose-500 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Data List (Grouped by Vehicle) */}
        {!loading && !error && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-600 dark:text-zinc-300 font-bold">
                  พบข้อความบันทึกทั้งหมด <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{total.toLocaleString()}</span> รายการ
                </p>
                <span className="text-[11px] px-2 py-0.5 rounded-md font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  {isToday ? '📅 วันนี้' : (startDate || endDate ? `📅 ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}` : '📅 ทั้งหมด')}
                </span>
              </div>

              {total > 0 && (
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>{exporting ? '⏳' : '📥'}</span>
                  <span>{exporting ? 'กำลังส่งออก Excel...' : 'ส่งออกเป็น Excel'}</span>
                </button>
              )}
            </div>

            {groupedVehicles.length > 0 ? (
              <div className="space-y-6">
                {groupedVehicles.map((group) => (
                  <div 
                    key={group.InventoryItemID} 
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-5"
                  >
                    {/* Main Vehicle Header Info (Only once per car) */}
                    <div className="pb-4 border-b border-zinc-150 dark:border-zinc-800/60">
                      <a
                        href={`/vehicle/${encodeURIComponent(group.RegisterNo || group.VinNo)}`}
                        className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-indigo-655 dark:hover:text-indigo-400 hover:underline transition-colors tracking-tight block"
                      >
                        {group.RegisterNo || 'ยังไม่มีทะเบียน'}
                      </a>
                      <div className="font-mono text-[11px] text-zinc-450 dark:text-zinc-550 mt-0.5">
                        VIN: {group.VinNo}
                      </div>

                      <div className="text-[11px] text-zinc-550 dark:text-zinc-450 mt-2 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          โครงการ: <span className="font-bold text-emerald-650 dark:text-emerald-450">{group.ProjectType || '-'}</span>
                          <span className="mx-2 text-zinc-300 dark:text-zinc-700">|</span>
                          รุ่น: <span className="font-bold text-zinc-800 dark:text-zinc-200">{group.Model || '-'}</span>
                        </span>

                        {/* Badges */}
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {group.StatusName && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-50 border border-rose-150 text-rose-700 dark:bg-rose-955/40 dark:border-rose-900/50 dark:text-rose-455">
                              {group.StatusName}
                            </span>
                          )}
                          {group.SubStatusName && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400">
                              {group.SubStatusName}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Location */}
                      {group.CurrentLocation && (
                        <div className="text-[11px] text-zinc-550 dark:text-zinc-455 mt-1.5 font-medium flex items-center gap-1">
                          <span>📍 สถานที่ปัจจุบัน:</span>
                          <span className="font-extrabold text-zinc-850 dark:text-zinc-150">
                            {group.CurrentLocation}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline Chat of Notes for this car */}
                    <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-3 md:ml-4 pl-5 md:pl-6 space-y-4 pt-1 pb-1">
                      {group.notes.map((n) => (
                        <div key={n.VehicleNoteID} className="relative space-y-1.5">
                          {/* Tiny timeline dot */}
                          <span className="absolute -left-[24.5px] md:-left-[28.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white dark:border-zinc-900 shadow-sm" />
                          
                          {/* Note Meta Info */}
                          <div className="flex flex-wrap items-center justify-between text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold">
                            <span className="font-mono">📅 {formatDateTh(n.CreateDate)}</span>
                            <span className="text-zinc-650 dark:text-zinc-400">👤 ผู้บันทึก: <span className="font-bold text-zinc-800 dark:text-zinc-300">{maskStaffName(n.CreateUserName)}</span></span>
                          </div>

                          {/* Message/Note Detail Content */}
                          <div className="bg-zinc-50/50 dark:bg-zinc-950/30 p-3.5 rounded-xl border border-zinc-150/60 dark:border-zinc-850/60 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans shadow-xxs">
                            {n.NoteDetail}
                          </div>

                          {/* Note Attachments list in timeline */}
                          {n.attachments && n.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {n.attachments.map((att: any) => {
                                const isImage = att.contentType?.startsWith('image/') || att.fileType?.startsWith('image/')
                                return (
                                  <a
                                    key={att.FileAttachmentID}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="border border-slate-200 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-xl p-2 bg-white dark:bg-zinc-900 flex items-center gap-2 max-w-xs transition shadow-sm"
                                  >
                                    {isImage ? (
                                      <img src={att.url} alt={att.originalFileName} className="w-12 h-12 rounded-lg object-cover" />
                                    ) : (
                                      <span className="text-2xl">📄</span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-bold truncate text-slate-700 dark:text-zinc-300 hover:underline">{att.originalFileName || att.fileName}</p>
                                      <p className="text-[8px] text-slate-400">{(att.fileSize / 1024).toFixed(1)} KB</p>
                                    </div>
                                  </a>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl py-20 text-center text-zinc-450 font-medium">
                ไม่พบข้อมูลบันทึกตัวรถตามช่วงเวลาหรือคำค้นหาที่ระบุ
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              totalItems={total}
              itemsPerPage={20}
            />
          </div>
        )}
      </div>
    </main>
  )
}

export default function VehicleNotesPage() {
  return (
    <AuthGuard>
      <VehicleNotesContent />
    </AuthGuard>
  )
}
