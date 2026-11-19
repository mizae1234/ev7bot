'use client'

import React, { useState, useMemo, memo } from 'react'
import {
  THAI_MONTHS_FULL,
  THAI_WEEKDAYS,
  getBranchPalette,
  formatDateKeyShortTh,
} from './types'

export interface MatrixProblemSubRow {
  problemCode: string
  problemName: string
  pendingCount: number
  completedTotal: number
  countsByDay: Record<number, number>
}

export interface MatrixBranchRow {
  code: string
  name: string
  pendingTotal: number
  total: number
  activeDays: number
  countsByDay: Record<number, number>
  subRows: MatrixProblemSubRow[]
}

const PROBLEM_DOT_PALETTE = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-emerald-500',
]

interface DailyCompletedMatrixProps {
  selectedYear: number
  selectedMonth: number
  daysInMonth: number
  startDayOfWeek: number
  rows: MatrixBranchRow[]
  dailyTotals: Record<number, number>
  grandPendingTotal: number
  grandTotal: number
  grandSubRows: MatrixProblemSubRow[]
  selectedBranch: string
  selectedProblemType: string
  selectedDate: string | null
  hideZeroBranches: boolean
  onToggleHideZeroBranches: (hide: boolean) => void
  onSelectBranch: (code: string) => void
  onSelectDate: (dateKey: string | null) => void
  onSelectCell: (branchCode: string, dateKey: string, problemCode?: string) => void
}

function DailyCompletedMatrixComponent({
  selectedYear,
  selectedMonth,
  daysInMonth,
  startDayOfWeek,
  rows,
  dailyTotals,
  grandPendingTotal,
  grandTotal,
  grandSubRows,
  selectedBranch,
  selectedProblemType,
  selectedDate,
  hideZeroBranches,
  onToggleHideZeroBranches,
  onSelectBranch,
  onSelectDate,
  onSelectCell,
}: DailyCompletedMatrixProps) {
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({})
  const [isFooterExpanded, setIsFooterExpanded] = useState(false)

  // Assign each unique problemCode a distinct dot color (no hash collisions!)
  const problemColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    let idx = 0
    for (const sr of grandSubRows) {
      if (!map[sr.problemCode]) {
        map[sr.problemCode] =
          sr.problemCode === 'UNSPECIFIED'
            ? 'bg-zinc-400'
            : PROBLEM_DOT_PALETTE[idx++ % PROBLEM_DOT_PALETTE.length]
      }
    }
    for (const r of rows) {
      for (const sr of r.subRows) {
        if (!map[sr.problemCode]) {
          map[sr.problemCode] =
            sr.problemCode === 'UNSPECIFIED'
              ? 'bg-zinc-400'
              : PROBLEM_DOT_PALETTE[idx++ % PROBLEM_DOT_PALETTE.length]
        }
      }
    }
    return map
  }, [grandSubRows, rows])

  const expandableCodes = rows.filter(r => r.subRows.length > 0).map(r => r.code)
  const isAllExpanded =
    expandableCodes.length > 0 && expandableCodes.every(code => expandedBranches[code])

  const toggleBranchExpand = (code: string) => {
    setExpandedBranches(prev => ({ ...prev, [code]: !prev[code] }))
  }

  const handleToggleExpandAll = () => {
    if (isAllExpanded) {
      setExpandedBranches({})
      setIsFooterExpanded(false)
    } else {
      const next: Record<string, boolean> = {}
      for (const code of expandableCodes) next[code] = true
      setExpandedBranches(next)
      setIsFooterExpanded(true)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/80 overflow-hidden">
      {/* Top Bar */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
            📊 ตารางเทียบยอดค้าง &amp; ยอดปิดงานรายวัน แยกตามสาขา/อู่ ({THAI_MONTHS_FULL[selectedMonth - 1]} {selectedYear + 543})
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            คลิก ▶ ที่แถวสาขาเพื่อกางดูแยกตามประเภทงาน • คลิกตัวเลขรายวันเพื่อดูรายชื่อรถด้านล่าง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {expandableCodes.length > 0 && (
            <button
              type="button"
              onClick={handleToggleExpandAll}
              className="px-2.5 py-1 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 transition"
            >
              {isAllExpanded ? '▲ ย่อแถวย่อยทั้งหมด' : '▼ กางแยกประเภททุกสาขา'}
            </button>
          )}

          {selectedBranch === 'all' && (
            <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideZeroBranches}
                onChange={(e) => onToggleHideZeroBranches(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              ซ่อนสาขาที่ไม่มีงานค้างและไม่มีงานปิด (0 งาน)
            </label>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">
              <th className="sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-900 py-2.5 px-3 text-left font-bold min-w-[205px] border-r border-zinc-200/70 dark:border-zinc-800">
                สาขา / อู่ซ่อม
              </th>
              <th className="py-2.5 px-3 text-right font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 border-r border-zinc-200/70 dark:border-zinc-800 min-w-[92px]">
                ยอดค้าง
              </th>
              <th className="py-2.5 px-3 text-right font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-r border-zinc-200/70 dark:border-zinc-800 min-w-[92px]">
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
                const isBranchFiltered = selectedBranch === row.code
                const isExpanded = Boolean(expandedBranches[row.code])
                const hasSubRows = row.subRows.length > 0
                const palette = getBranchPalette(row.code)

                return (
                  <React.Fragment key={row.code}>
                    {/* Main Branch Row (Clean single-line totals!) */}
                    <tr className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td
                        onClick={() => hasSubRows && toggleBranchExpand(row.code)}
                        className={`sticky left-0 z-10 bg-white dark:bg-zinc-900 py-2.5 px-3 font-bold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200/70 dark:border-zinc-800 ${
                          hasSubRows ? 'cursor-pointer select-none' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {hasSubRows ? (
                              <span
                                className={`text-[10px] text-zinc-400 transition-transform duration-150 inline-block shrink-0 ${
                                  isExpanded ? 'rotate-90 text-indigo-600 dark:text-indigo-400' : ''
                                }`}
                              >
                                ▶
                              </span>
                            ) : (
                              <span className="w-2.5 shrink-0" />
                            )}
                            <span className={`w-2 h-2 rounded-full shrink-0 ${palette.dot}`} />
                            <span className="truncate" title={row.name}>
                              {row.name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectBranch(isBranchFiltered ? 'all' : row.code)
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded-md border transition shrink-0 ${
                              isBranchFiltered
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'text-zinc-400 hover:text-indigo-600 border-transparent hover:border-indigo-200 dark:hover:border-indigo-800'
                            }`}
                            title={isBranchFiltered ? 'แสดงทุกสาขา' : `กรองเฉพาะ ${row.name}`}
                          >
                            {isBranchFiltered ? '✓ กรองอยู่' : 'กรอง'}
                          </button>
                        </div>
                      </td>

                      {/* Column: ยอดค้าง (Single clean number) */}
                      <td
                        onClick={() => hasSubRows && toggleBranchExpand(row.code)}
                        className={`py-2 px-3 text-right tabular-nums bg-rose-50/25 dark:bg-rose-950/10 border-r border-zinc-200/70 dark:border-zinc-800 ${
                          hasSubRows ? 'cursor-pointer' : ''
                        }`}
                      >
                        <span
                          className={
                            row.pendingTotal > 0
                              ? 'font-black text-rose-600 dark:text-rose-400'
                              : 'text-zinc-300 dark:text-zinc-600'
                          }
                        >
                          {row.pendingTotal > 0 ? row.pendingTotal : '-'}
                        </span>
                      </td>

                      {/* Column: รวมเดือน (Single clean number) */}
                      <td
                        onClick={() => hasSubRows && toggleBranchExpand(row.code)}
                        className={`py-2 px-3 text-right tabular-nums bg-emerald-50/30 dark:bg-emerald-950/10 border-r border-zinc-200/70 dark:border-zinc-800 ${
                          hasSubRows ? 'cursor-pointer' : ''
                        }`}
                      >
                        <span
                          className={
                            row.total > 0
                              ? 'font-black text-emerald-700 dark:text-emerald-400'
                              : 'text-zinc-300 dark:text-zinc-600'
                          }
                        >
                          {row.total}
                        </span>
                      </td>

                      {/* Daily Columns 01..31 */}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const d = i + 1
                        const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        const val = row.countsByDay[d] || 0
                        const isSelectedCell =
                          selectedDate === dateKey &&
                          (selectedBranch === 'all' || selectedBranch === row.code) &&
                          selectedProblemType === 'all'

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

                    {/* Expanded Problem-Type Sub-Rows */}
                    {isExpanded &&
                      row.subRows.map(sub => {
                        const subDot = problemColorMap[sub.problemCode] || 'bg-zinc-400'
                        return (
                          <tr
                            key={`${row.code}-${sub.problemCode}`}
                            className="bg-zinc-50/80 dark:bg-zinc-950/60 text-[11px] border-t border-dashed border-zinc-200/70 dark:border-zinc-800/70"
                          >
                            <td className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950 py-1.5 pl-8 pr-3 font-medium text-zinc-600 dark:text-zinc-300 border-r border-zinc-200/70 dark:border-zinc-800">
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-300 dark:text-zinc-600">└</span>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${subDot}`} />
                                <span className="truncate">{sub.problemName}</span>
                              </div>
                            </td>

                            <td className="py-1.5 px-3 text-right tabular-nums font-semibold bg-rose-50/15 dark:bg-rose-950/5 border-r border-zinc-200/70 dark:border-zinc-800">
                              {sub.pendingCount > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400">{sub.pendingCount}</span>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-700 font-normal">-</span>
                              )}
                            </td>

                            <td className="py-1.5 px-3 text-right tabular-nums font-semibold bg-emerald-50/15 dark:bg-emerald-950/5 border-r border-zinc-200/70 dark:border-zinc-800">
                              {sub.completedTotal > 0 ? (
                                <span className="text-emerald-700 dark:text-emerald-400">{sub.completedTotal}</span>
                              ) : (
                                <span className="text-zinc-300 dark:text-zinc-700 font-normal">-</span>
                              )}
                            </td>

                            {Array.from({ length: daysInMonth }, (_, i) => {
                              const d = i + 1
                              const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                              const val = sub.countsByDay[d] || 0
                              const isSubCellSelected =
                                selectedDate === dateKey &&
                                selectedBranch === row.code &&
                                selectedProblemType === sub.problemCode

                              return (
                                <td
                                  key={d}
                                  onClick={() => {
                                    if (val > 0) onSelectCell(row.code, dateKey, sub.problemCode)
                                  }}
                                  className={`py-1.5 px-1 text-center tabular-nums ${
                                    val > 0 ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                                  } ${isSubCellSelected && val > 0 ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
                                >
                                  {val > 0 ? (
                                    <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                                      {val}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-zinc-200 dark:text-zinc-800">·</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                  </React.Fragment>
                )
              })
            ) : (
              <tr>
                <td colSpan={daysInMonth + 3} className="py-10 text-center text-zinc-400">
                  ไม่พบรายการงานค้างหรือซ่อมเสร็จในเงื่อนไขที่เลือก
                </td>
              </tr>
            )}
          </tbody>

          {rows.length > 0 && (
            <tfoot>
              {/* Main Grand Total Row */}
              <tr
                onClick={() => grandSubRows.length > 0 && setIsFooterExpanded(prev => !prev)}
                className={`bg-zinc-100/95 dark:bg-zinc-800/95 border-t-2 border-zinc-200 dark:border-zinc-700 font-extrabold text-zinc-900 dark:text-zinc-100 ${
                  grandSubRows.length > 0 ? 'cursor-pointer select-none' : ''
                }`}
              >
                <td className="sticky left-0 z-10 bg-zinc-100 dark:bg-zinc-800 py-2.5 px-3 border-r border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-1.5">
                    {grandSubRows.length > 0 && (
                      <span
                        className={`text-[10px] text-zinc-500 transition-transform duration-150 inline-block ${
                          isFooterExpanded ? 'rotate-90 text-indigo-600 dark:text-indigo-400' : ''
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    <span>รวมทุกสาขา</span>
                  </div>
                </td>

                <td className="py-2.5 px-3 text-right tabular-nums font-black text-rose-600 dark:text-rose-400 border-r border-zinc-200 dark:border-zinc-700">
                  {grandPendingTotal}
                </td>

                <td className="py-2.5 px-3 text-right tabular-nums font-black text-emerald-700 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-700">
                  {grandTotal}
                </td>

                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1
                  const sum = dailyTotals[d] || 0
                  return (
                    <td key={d} className="py-2.5 px-1 text-center tabular-nums text-[11px]">
                      {sum > 0 ? sum : <span className="text-zinc-400 font-normal">-</span>}
                    </td>
                  )
                })}
              </tr>

              {/* Optional Expandable Grand Total Sub-Rows by Problem Type */}
              {isFooterExpanded &&
                grandSubRows.map(sub => {
                  const subDot = problemColorMap[sub.problemCode] || 'bg-zinc-400'
                  return (
                    <tr
                      key={`grand-${sub.problemCode}`}
                      className="bg-zinc-50 dark:bg-zinc-900 text-[11px] border-t border-dashed border-zinc-200 dark:border-zinc-800"
                    >
                      <td className="sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-900 py-1.5 pl-8 pr-3 font-semibold text-zinc-600 dark:text-zinc-300 border-r border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-400">└</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${subDot}`} />
                          <span className="truncate">{sub.problemName}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-bold text-rose-600 dark:text-rose-400 border-r border-zinc-200 dark:border-zinc-800">
                        {sub.pendingCount > 0 ? sub.pendingCount : <span className="text-zinc-300 font-normal">-</span>}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums font-bold text-emerald-700 dark:text-emerald-400 border-r border-zinc-200 dark:border-zinc-800">
                        {sub.completedTotal > 0 ? sub.completedTotal : <span className="text-zinc-300 font-normal">-</span>}
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const d = i + 1
                        const val = sub.countsByDay[d] || 0
                        return (
                          <td key={d} className="py-1.5 px-1 text-center tabular-nums text-[10.5px] font-semibold text-zinc-600 dark:text-zinc-300">
                            {val > 0 ? val : <span className="text-zinc-300 dark:text-zinc-700 font-normal">·</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

export const DailyCompletedMatrix = memo(DailyCompletedMatrixComponent)
