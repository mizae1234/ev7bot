'use client'

import React, { memo } from 'react'
import {
  THAI_MONTHS_FULL,
  THAI_WEEKDAYS,
  getBranchPalette,
  formatDateKeyShortTh,
} from './types'

export interface MatrixBranchRow {
  code: string
  name: string
  total: number
  activeDays: number
  countsByDay: Record<number, number>
}

interface DailyCompletedMatrixProps {
  selectedYear: number
  selectedMonth: number
  daysInMonth: number
  startDayOfWeek: number
  rows: MatrixBranchRow[]
  dailyTotals: Record<number, number>
  grandTotal: number
  selectedBranch: string
  selectedDate: string | null
  hideZeroBranches: boolean
  onToggleHideZeroBranches: (hide: boolean) => void
  onSelectBranch: (code: string) => void
  onSelectDate: (dateKey: string | null) => void
  onSelectCell: (branchCode: string, dateKey: string) => void
}

function DailyCompletedMatrixComponent({
  selectedYear,
  selectedMonth,
  daysInMonth,
  startDayOfWeek,
  rows,
  dailyTotals,
  grandTotal,
  selectedBranch,
  selectedDate,
  hideZeroBranches,
  onToggleHideZeroBranches,
  onSelectBranch,
  onSelectDate,
  onSelectCell,
}: DailyCompletedMatrixProps) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/80 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200">
          📊 ตารางเทียบยอดปิดงานรายวัน แยกตามสาขา/อู่ ({THAI_MONTHS_FULL[selectedMonth - 1]} {selectedYear + 543})
        </p>
        {selectedBranch === 'all' && (
          <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideZeroBranches}
              onChange={(e) => onToggleHideZeroBranches(e.target.checked)}
              className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            ซ่อนสาขาที่ไม่มีงานปิดในเดือนนี้ (0 งาน)
          </label>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
              <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 py-2.5 px-3 text-left font-bold min-w-[175px] border-r border-zinc-200/70 dark:border-zinc-800">
                สาขา / อู่ซ่อม
              </th>
              <th className="py-2.5 px-2.5 text-right font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-r border-zinc-200/70 dark:border-zinc-800 min-w-[68px]">
                รวมเดือน
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1
                const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                const dow = (startDayOfWeek + d - 1) % 7
                const isWeekend = dow === 0 || dow === 6
                const isSelectedCol = selectedDate === dateKey
                return (
                  <th
                    key={d}
                    onClick={() => onSelectDate(isSelectedCol ? null : dateKey)}
                    className={`py-2 px-1.5 text-center font-bold min-w-[34px] cursor-pointer transition hover:bg-indigo-50 dark:hover:bg-indigo-950/40 ${
                      isSelectedCol
                        ? 'bg-indigo-600 text-white'
                        : isWeekend
                        ? 'bg-rose-50/40 dark:bg-rose-950/10 text-rose-500'
                        : ''
                    }`}
                    title={`คลิกดูวันที่ ${formatDateKeyShortTh(dateKey)}`}
                  >
                    <div className="text-[10px] leading-none">{String(d).padStart(2, '0')}</div>
                    <div className={`text-[8.5px] font-normal mt-0.5 ${isSelectedCol ? 'text-indigo-100' : 'opacity-70'}`}>
                      {THAI_WEEKDAYS[dow]}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {rows.length > 0 ? (
              rows.map(row => {
                const isBranchActive = selectedBranch === row.code
                const palette = getBranchPalette(row.code)
                return (
                  <tr key={row.code} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td
                      onClick={() => onSelectBranch(isBranchActive ? 'all' : row.code)}
                      className="sticky left-0 z-10 bg-white dark:bg-zinc-900 py-2 px-3 font-bold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200/70 dark:border-zinc-800 cursor-pointer hover:text-indigo-600"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${palette.dot}`} />
                        <span className="truncate">{row.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-right font-black tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10 border-r border-zinc-200/70 dark:border-zinc-800">
                      {row.total}
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1
                      const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                      const val = row.countsByDay[d] || 0
                      const isSelectedCell = selectedDate === dateKey && (selectedBranch === 'all' || selectedBranch === row.code)

                      const cellBadgeClass =
                        val === 0
                          ? 'text-zinc-300 dark:text-zinc-700'
                          : val >= 6
                          ? 'bg-emerald-600 text-white font-extrabold shadow-sm'
                          : val >= 3
                          ? 'bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 font-extrabold'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'

                      return (
                        <td
                          key={d}
                          onClick={() => {
                            if (val > 0) onSelectCell(row.code, dateKey)
                          }}
                          className={`py-1.5 px-1 text-center tabular-nums ${
                            val > 0 ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                          } ${isSelectedCell && val > 0 ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
                        >
                          {val > 0 ? (
                            <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1 rounded-md text-[11px] ${cellBadgeClass}`}>
                              {val}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-300 dark:text-zinc-700">·</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={daysInMonth + 2} className="py-10 text-center text-zinc-400">
                  ไม่พบรายการซ่อมเสร็จในเดือนที่เลือก
                </td>
              </tr>
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-zinc-100/90 dark:bg-zinc-800/90 border-t-2 border-zinc-200 dark:border-zinc-700 font-extrabold text-zinc-900 dark:text-zinc-100">
                <td className="sticky left-0 z-10 bg-zinc-100 dark:bg-zinc-800 py-2 px-3 border-r border-zinc-200 dark:border-zinc-700">
                  รวมทุกสาขารายวัน
                </td>
                <td className="py-2 px-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-700">
                  {grandTotal}
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1
                  const sum = dailyTotals[d] || 0
                  return (
                    <td key={d} className="py-2 px-1 text-center tabular-nums text-[11px]">
                      {sum > 0 ? sum : <span className="text-zinc-400 font-normal">-</span>}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

export const DailyCompletedMatrix = memo(DailyCompletedMatrixComponent)
