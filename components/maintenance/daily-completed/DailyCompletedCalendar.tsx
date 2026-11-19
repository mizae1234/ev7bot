'use client'

import React, { memo } from 'react'
import {
  THAI_WEEKDAYS,
  getBranchPalette,
  formatDateKeyShortTh,
  buildSubBreakdownEntries,
  type CompletedMaintenanceItem,
  type SubBreakdownMode,
} from './types'

interface DailyCompletedCalendarProps {
  selectedYear: number
  selectedMonth: number
  todayDateKey: string
  daysInMonth: number
  startDayOfWeek: number
  itemsByDate: Record<string, CompletedMaintenanceItem[]>
  selectedBranch: string
  selectedDate: string | null
  onSelectDate: (dateKey: string | null) => void
  subBreakdown: SubBreakdownMode
}

function DailyCompletedCalendarComponent({
  selectedYear,
  selectedMonth,
  todayDateKey,
  daysInMonth,
  startDayOfWeek,
  itemsByDate,
  selectedBranch,
  selectedDate,
  onSelectDate,
  subBreakdown,
}: DailyCompletedCalendarProps) {
  const calendarCells: (number | null)[] = []
  for (let i = 0; i < startDayOfWeek; i++) calendarCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d)

  return (
    <div>
      {/* Weekdays Header */}
      <div className="grid grid-cols-7 gap-px text-center mb-1.5">
        {THAI_WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`text-xs font-bold py-1.5 ${
              idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-indigo-500' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 border border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl p-1">
        {calendarCells.map((dayNum, idx) => {
          if (dayNum === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="bg-zinc-50/60 dark:bg-zinc-900/30 min-h-[64px] md:min-h-[124px] rounded-xl"
              />
            )
          }

          const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
          const dayStr = String(dayNum).padStart(2, '0')
          const dayOfWeek = (startDayOfWeek + dayNum - 1) % 7
          const isToday = dateKey === todayDateKey
          const isSelected = selectedDate === dateKey
          const dayItems = itemsByDate[dateKey] || []

          // Group this day's items by branch
          const branchGroupsMap: Record<string, { code: string; name: string; items: CompletedMaintenanceItem[] }> = {}
          for (const item of dayItems) {
            if (!branchGroupsMap[item.service_location_code]) {
              branchGroupsMap[item.service_location_code] = {
                code: item.service_location_code,
                name: item.service_location_name,
                items: [],
              }
            }
            branchGroupsMap[item.service_location_code].items.push(item)
          }

          const sortedBranches = Object.values(branchGroupsMap).sort(
            (a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, 'th')
          )

          const MAX_VISIBLE = 4
          const visibleBranches = sortedBranches.slice(0, MAX_VISIBLE)
          const hiddenBranches = sortedBranches.slice(MAX_VISIBLE)
          const hiddenCount = hiddenBranches.reduce((sum, b) => sum + b.items.length, 0)

          const tooltipAlignClass =
            dayOfWeek === 0 || dayOfWeek === 1
              ? 'left-0 translate-x-0'
              : dayOfWeek === 5 || dayOfWeek === 6
              ? 'right-0 translate-x-0'
              : 'left-1/2 -translate-x-1/2'

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDate(isSelected ? null : dateKey)}
              className={`group relative rounded-xl bg-white dark:bg-zinc-900 min-h-[64px] md:min-h-[124px] p-1.5 md:p-2 flex flex-col justify-between cursor-pointer transition-all duration-150 ${
                isSelected
                  ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30 z-10'
                  : isToday
                  ? 'ring-1 ring-emerald-400 dark:ring-emerald-600 bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-indigo-50/30 dark:hover:bg-zinc-800/70'
                  : 'hover:bg-zinc-50/90 dark:hover:bg-zinc-800/60'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[11px] md:text-xs font-extrabold tabular-nums ${
                      dayOfWeek === 0
                        ? 'text-rose-500'
                        : dayOfWeek === 6
                        ? 'text-indigo-500'
                        : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {dayStr}
                  </span>
                  {isToday && (
                    <span className="hidden sm:inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white leading-none">
                      วันนี้
                    </span>
                  )}
                </div>

                {dayItems.length > 0 && selectedBranch === 'all' && (
                  <span className="hidden md:inline-flex items-center text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 tabular-nums">
                    รวม {dayItems.length}
                  </span>
                )}
              </div>

              {/* Desktop Pills */}
              <div className="hidden md:flex md:flex-col md:justify-end md:gap-1 md:mt-1.5">
                {visibleBranches.map(bGroup => {
                  const palette = getBranchPalette(bGroup.code)
                  const subLines = buildSubBreakdownEntries(
                    bGroup.items,
                    subBreakdown,
                    selectedBranch !== 'all' || sortedBranches.length <= 2
                  )
                  return (
                    <div key={bGroup.code} className="space-y-0.5">
                      <div className={`text-[10px] py-0.5 px-1.5 rounded-md font-bold flex justify-between items-center ${palette.pill}`}>
                        <span className="truncate mr-1">{bGroup.name}</span>
                        <span className="tabular-nums font-extrabold">{bGroup.items.length}</span>
                      </div>
                      {subLines.length > 0 && (
                        <div className="pl-2 space-y-0">
                          {subLines.map(([label, cnt]) => (
                            <div
                              key={label}
                              className="text-[8.5px] flex justify-between items-center text-zinc-400 dark:text-zinc-500 leading-tight"
                            >
                              <span className="truncate">· {label}</span>
                              <span className="tabular-nums ml-1 font-semibold">{cnt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {hiddenBranches.length > 0 && (
                  <div className="text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-md flex justify-between items-center">
                    <span>+ อีก {hiddenBranches.length} สาขา</span>
                    <span className="tabular-nums">{hiddenCount}</span>
                  </div>
                )}
              </div>

              {/* Mobile Compact Badge */}
              <div className="flex md:hidden flex-col items-center justify-center mt-1">
                {dayItems.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold tabular-nums">
                    ✅ {dayItems.length}
                  </span>
                )}
              </div>

              {/* Hover Tooltip */}
              {dayItems.length > 0 && (
                <div
                  className={`absolute bottom-full mb-2 hidden group-hover:block z-50 bg-zinc-900/95 text-zinc-100 p-3.5 rounded-2xl shadow-2xl border border-zinc-700/80 backdrop-blur-md min-w-[230px] max-w-[280px] pointer-events-none text-left ${tooltipAlignClass}`}
                >
                  <div className="border-b border-zinc-800 pb-1.5 mb-2 flex justify-between items-center gap-2">
                    <span className="text-xs font-bold">{formatDateKeyShortTh(dateKey)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                      ซ่อมเสร็จ {dayItems.length} ใบงาน
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[250px] overflow-hidden">
                    {sortedBranches.map(bGroup => {
                      const palette = getBranchPalette(bGroup.code)
                      const tipSubLines = buildSubBreakdownEntries(
                        bGroup.items,
                        subBreakdown === 'none' ? 'case' : subBreakdown,
                        true
                      )
                      return (
                        <div key={bGroup.code} className="space-y-0.5">
                          <div className="flex justify-between items-center text-[11px] font-bold text-white">
                            <span className="flex items-center gap-1.5 truncate mr-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${palette.dot}`} />
                              <span className="truncate">{bGroup.name}</span>
                            </span>
                            <span className="tabular-nums text-emerald-400">{bGroup.items.length} งาน</span>
                          </div>
                          {tipSubLines.length > 0 && (
                            <div className="pl-3.5 border-l border-zinc-800 space-y-0.5">
                              {tipSubLines.map(([label, cnt]) => (
                                <div key={label} className="flex justify-between items-center text-[10px] text-zinc-400">
                                  <span className="truncate">- {label}</span>
                                  <span className="tabular-nums">{cnt}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const DailyCompletedCalendar = memo(DailyCompletedCalendarComponent)
