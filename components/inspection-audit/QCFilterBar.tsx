import React from 'react'
import { QCDatePreset, QCStatusFilter, QCViewMode } from './types'
import { getBangkokTodayYMD, getYesterdayBangkokYMD } from './qc-helpers'

interface QCFilterBarProps {
  datePreset: QCDatePreset
  onDatePresetChange: (preset: QCDatePreset) => void
  filterDate: string
  onFilterDateChange: (date: string) => void
  filterPlate: string
  onFilterPlateChange: (plate: string) => void
  filterStatus: QCStatusFilter
  onFilterStatusChange: (status: QCStatusFilter) => void
  viewMode: QCViewMode
  onViewModeChange: (mode: QCViewMode) => void
  totalCount: number
  filteredCount: number
  loading: boolean
  onRefresh: () => void
  onResetFilters: () => void
}

export const QCFilterBar: React.FC<QCFilterBarProps> = ({
  datePreset,
  onDatePresetChange,
  filterDate,
  onFilterDateChange,
  filterPlate,
  onFilterPlateChange,
  filterStatus,
  onFilterStatusChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  loading,
  onRefresh,
  onResetFilters,
}) => {
  const isFiltered = filterPlate !== '' || datePreset !== 'today' || filterStatus !== 'ALL'

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-3 sm:p-4 shadow-2xs space-y-3">
      {/* Top Filter Controls: Date Presets & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Date Presets (Touch-friendly segmented chips) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              onDatePresetChange('today')
              onFilterDateChange(getBangkokTodayYMD())
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              datePreset === 'today'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>⚡</span> วันนี้
          </button>

          <button
            type="button"
            onClick={() => {
              onDatePresetChange('yesterday')
              onFilterDateChange(getYesterdayBangkokYMD())
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              datePreset === 'yesterday'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            เมื่อวาน
          </button>

          <button
            type="button"
            onClick={() => {
              onDatePresetChange('7days')
              onFilterDateChange('')
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              datePreset === '7days'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            7 วันล่าสุด
          </button>

          <button
            type="button"
            onClick={() => {
              onDatePresetChange('all')
              onFilterDateChange('')
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
              datePreset === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด
          </button>

          {/* Custom Date Picker */}
          <div className="relative shrink-0 flex items-center">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                const val = e.target.value
                onFilterDateChange(val)
                onDatePresetChange(val ? 'custom' : 'all')
              }}
              className="text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 transition cursor-pointer"
              title="เลือกวันที่ตรวจสภาพ"
            />
          </div>
        </div>

        {/* View Mode Switcher (Cards vs Table) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => onViewModeChange('cards')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="เปิดดูผลการตรวจ 9 ข้อแบบทันทีบนการ์ด"
          >
            <span>📇</span> การ์ด (ดูทันที)
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="มุมมองตารางสำหรับคอมพิวเตอร์"
          >
            <span>📋</span> ตาราง
          </button>
        </div>
      </div>

      {/* Search Input & Status Filter & Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
        
        {/* Search Plate / VIN */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="ค้นหาทะเบียนรถ หรือ VIN..."
            value={filterPlate}
            onChange={(e) => onFilterPlateChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
          />
          {filterPlate && (
            <button
              type="button"
              onClick={() => onFilterPlateChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs w-4 h-4 rounded-full flex items-center justify-center bg-slate-200 hover:bg-slate-300 transition cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onFilterStatusChange('ALL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] cursor-pointer ${
              filterStatus === 'ALL'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange('PASS')}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] cursor-pointer ${
              filterStatus === 'PASS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🟢 ผ่าน
          </button>
          <button
            type="button"
            onClick={() => onFilterStatusChange('FAIL')}
            className={`px-2.5 py-1 rounded-lg font-bold transition text-[11px] cursor-pointer ${
              filterStatus === 'FAIL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🔴 ไม่ผ่าน
          </button>
        </div>

        {/* Action Buttons: Reset & Refresh */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          {isFiltered && (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
            >
              ✕ ล้างตัวกรอง
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span> รีเฟรช
          </button>
        </div>
      </div>

      {/* Results Summary Counter */}
      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
        <span>
          แสดงผล <strong className="text-slate-800 font-semibold">{filteredCount}</strong> จากทั้งหมด {totalCount} คัน
          {datePreset === 'today' && (
            <span className="text-emerald-700 font-medium ml-1.5">(เฉพาะวันปัจจุบัน)</span>
          )}
          {datePreset === 'yesterday' && (
            <span className="text-indigo-700 font-medium ml-1.5">(เฉพาะเมื่อวาน)</span>
          )}
          {datePreset === '7days' && (
            <span className="text-indigo-700 font-medium ml-1.5">(7 วันล่าสุด)</span>
          )}
        </span>
      </div>
    </div>
  )
}
