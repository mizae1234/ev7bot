'use client'

import React, { memo } from 'react'
import { ExportButton } from '@/lib/exportExcel'
import {
  THAI_MONTHS_FULL,
  getBranchPalette,
  type BranchOption,
  type ProblemTypeOption,
  type CompletionScope,
  type DailyViewMode,
  type SubBreakdownMode,
} from './types'

interface KpiStats {
  totalTickets: number
  uniqueCars: number
  completeCount: number
  readyPickupCount: number
  activeDaysCount: number
  avgPerActiveDay: number
  avgRepairDays: number
  topBranch: { name: string; count: number } | null
}

interface DailyCompletedHeaderProps {
  selectedYear: number
  selectedMonth: number
  todayYear: number
  todayMonth: number
  onChangeYear: (y: number) => void
  onChangeMonth: (m: number) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onResetCurrentMonth: () => void
  completionScope: CompletionScope
  onChangeCompletionScope: (s: CompletionScope) => void
  viewMode: DailyViewMode
  onChangeViewMode: (v: DailyViewMode) => void
  subBreakdown: SubBreakdownMode
  onChangeSubBreakdown: (m: SubBreakdownMode) => void
  selectedProblemType: string
  onSelectProblemType: (code: string) => void
  problemTypeOptions: ProblemTypeOption[]
  totalBeforeProblemTypeFilter: number
  selectedBranch: string
  onSelectBranch: (code: string) => void
  branchOptions: BranchOption[]
  activeBranchPills: BranchOption[]
  totalBeforeBranchFilter: number
  hasActiveDateOrBranchFilter: boolean
  onClearFilters: () => void
  kpiStats: KpiStats
  onExport: () => void
}

function DailyCompletedHeaderComponent({
  selectedYear,
  selectedMonth,
  todayYear,
  todayMonth,
  onChangeYear,
  onChangeMonth,
  onPrevMonth,
  onNextMonth,
  onResetCurrentMonth,
  completionScope,
  onChangeCompletionScope,
  viewMode,
  onChangeViewMode,
  subBreakdown,
  onChangeSubBreakdown,
  selectedProblemType,
  onSelectProblemType,
  problemTypeOptions,
  totalBeforeProblemTypeFilter,
  selectedBranch,
  onSelectBranch,
  branchOptions,
  activeBranchPills,
  totalBeforeBranchFilter,
  hasActiveDateOrBranchFilter,
  onClearFilters,
  kpiStats,
  onExport,
}: DailyCompletedHeaderProps) {
  const selectedBranchName =
    selectedBranch === 'all'
      ? 'ทุกสาขา'
      : branchOptions.find(b => b.code === selectedBranch)?.name || selectedBranch

  const selectedProblemName =
    selectedProblemType === 'all'
      ? ''
      : problemTypeOptions.find(p => p.code === selectedProblemType)?.name || selectedProblemType

  return (
    <div className="space-y-4">
      {/* Row 1: Month/Year Selector + Scope + View Switcher + Export */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-zinc-100/90 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/70">
            <button
              type="button"
              onClick={onPrevMonth}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition shadow-sm text-xs font-bold"
              title="เดือนก่อนหน้า"
            >
              ◀
            </button>

            <div className="flex items-center gap-1 px-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(Number(e.target.value))}
                className="bg-transparent text-xs font-extrabold text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                {THAI_MONTHS_FULL.map((mName, i) => (
                  <option key={mName} value={i + 1} className="dark:bg-zinc-900">
                    {mName}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => onChangeYear(Number(e.target.value))}
                className="bg-transparent text-xs font-extrabold text-indigo-600 dark:text-indigo-400 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 5 }, (_, idx) => todayYear - 2 + idx).map(yr => (
                  <option key={yr} value={yr} className="dark:bg-zinc-900">
                    {yr + 543}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={onNextMonth}
              className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition shadow-sm text-xs font-bold"
              title="เดือนถัดไป"
            >
              ▶
            </button>
          </div>

          {(selectedYear !== todayYear || selectedMonth !== todayMonth) && (
            <button
              type="button"
              onClick={onResetCurrentMonth}
              className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 transition"
            >
              เดือนปัจจุบัน
            </button>
          )}

          {/* Completion Scope Filter */}
          <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-800/60 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-[11px]">
            <button
              type="button"
              onClick={() => onChangeCompletionScope('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                completionScope === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              ซ่อมเสร็จทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => onChangeCompletionScope('COMPLETE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                completionScope === 'COMPLETE'
                  ? 'bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              เฉพาะปิดเคส
            </button>
            <button
              type="button"
              onClick={() => onChangeCompletionScope('READY_PICKUP')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                completionScope === 'READY_PICKUP'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              รอลูกค้ารับ
            </button>
          </div>
        </div>

        {/* View Mode Switcher + Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => onChangeViewMode('calendar')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              <span>📅</span>
              <span>ปฏิทินรายเดือน</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode('matrix')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400'
              }`}
            >
              <span>📊</span>
              <span>ตารางเทียบสาขา</span>
            </button>
          </div>

          <ExportButton onClick={onExport} label="📥 Export สรุปรายสาขา" />
        </div>
      </div>

      {/* Row 2: Compact KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/50 p-3">
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block truncate">
            ✅ ซ่อมเสร็จรวม ({selectedBranchName}{selectedProblemName ? ` • ${selectedProblemName}` : ''})
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
              {kpiStats.totalTickets}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
              ใบงาน ({kpiStats.uniqueCars} คัน)
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            ปิดเคส <strong>{kpiStats.completeCount}</strong> • รอมารับ <strong>{kpiStats.readyPickupCount}</strong>
          </div>
        </div>

        <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-900/50 p-3">
          <span className="text-[11px] font-bold text-sky-700 dark:text-sky-400 block">
            📈 เฉลี่ยต่อวันที่มีงานปิด
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
              {kpiStats.avgPerActiveDay}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">ใบงาน/วัน</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            มีงานซ่อมเสร็จ {kpiStats.activeDaysCount} วันในเดือนนี้
          </div>
        </div>

        <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/70 dark:border-indigo-900/50 p-3">
          <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 block">
            🏆 สาขาที่ปิดงานสูงสุดเดือนนี้
          </span>
          <div className="mt-0.5 truncate">
            <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">
              {kpiStats.topBranch ? kpiStats.topBranch.name : '-'}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {kpiStats.topBranch ? `ซ่อมเสร็จรวม ${kpiStats.topBranch.count} ใบงาน` : 'ไม่มีข้อมูลในเดือนนี้'}
          </div>
        </div>

        <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 p-3">
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 block">
            ⏱️ ระยะเวลาซ่อมเฉลี่ย
          </span>
          <div className="flex items-baseline gap-1.5 mt-0.5">
            <span className="text-xl font-black text-zinc-900 dark:text-zinc-100 tabular-nums">
              {kpiStats.avgRepairDays}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">วัน/ใบงาน</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            คำนวณจากวันเริ่มซ่อมถึงวันซ่อมเสร็จ
          </div>
        </div>
      </div>

      {/* Row 3: Dynamic Problem Type Filter (from EV_MsSubStatus) */}
      {problemTypeOptions.length > 0 && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              🏷️ กรองแยกประเภทงานซ่อม:
            </span>
            <select
              value={selectedProblemType}
              onChange={(e) => onSelectProblemType(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-semibold"
            >
              <option value="all">ทุกประเภทงาน ({totalBeforeProblemTypeFilter} งาน)</option>
              {problemTypeOptions.map(pt => (
                <option key={pt.code} value={pt.code}>
                  {pt.name} ({pt.count} งาน)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSelectProblemType('all')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border ${
                selectedProblemType === 'all'
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
              }`}
            >
              ทุกประเภท ({totalBeforeProblemTypeFilter})
            </button>
            {problemTypeOptions.map(pt => {
              const isSelected = selectedProblemType === pt.code
              const palette = getBranchPalette(pt.code)
              return (
                <button
                  key={pt.code}
                  type="button"
                  onClick={() => onSelectProblemType(isSelected ? 'all' : pt.code)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-300 dark:ring-amber-800'
                      : pt.count === 0
                      ? 'bg-zinc-50/60 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500 border-zinc-200/70 dark:border-zinc-800 hover:border-zinc-300'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-amber-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : palette.dot}`} />
                  <span>{pt.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {pt.count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Row 4: Dynamic Branch Filter Pills & Dropdown */}
      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            📍 กรองรายสาขา/อู่:
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedBranch}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-semibold"
            >
              <option value="all">ทุกสาขา/อู่ ({totalBeforeBranchFilter} งาน)</option>
              {branchOptions.map(b => (
                <option key={b.code} value={b.code}>
                  {b.name} ({b.count} งาน)
                </option>
              ))}
            </select>

            {viewMode === 'calendar' && (
              <select
                value={subBreakdown}
                onChange={(e) => onChangeSubBreakdown(e.target.value as SubBreakdownMode)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300"
              >
                <option value="auto">✨ ข้อมูลย่อยในช่องวัน: อัตโนมัติ</option>
                <option value="case">💼 แยกตามเคสความเสียหาย</option>
                <option value="problem">🏷️ แยกตามประเภทปัญหา</option>
                <option value="model">🚗 แยกตามรุ่นรถ</option>
                <option value="none">➖ แสดงเฉพาะชื่อสาขา</option>
              </select>
            )}

            {hasActiveDateOrBranchFilter && (
              <button
                type="button"
                onClick={onClearFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800 transition"
              >
                ✕ ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {activeBranchPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSelectBranch('all')}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border ${
                selectedBranch === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-zinc-50 dark:bg-zinc-800/70 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
              }`}
            >
              ทุกสาขา ({totalBeforeBranchFilter})
            </button>
            {activeBranchPills.map(b => {
              const isSelected = selectedBranch === b.code
              const palette = getBranchPalette(b.code)
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => onSelectBranch(isSelected ? 'all' : b.code)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-800'
                      : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : palette.dot}`} />
                  <span>{b.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    {b.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export const DailyCompletedHeader = memo(DailyCompletedHeaderComponent)
