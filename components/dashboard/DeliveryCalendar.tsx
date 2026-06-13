'use client'
import React, { useState, useEffect } from 'react'
import type { DeliveryRecord, RepairRecord } from '@/types'

interface DeliveryCalendarProps {
  deliveries: DeliveryRecord[]
  repairs: RepairRecord[]
  selectedYear: number
  selectedMonth: number // 0-11
  selectedDate: string | null
  onDateClick: (dateStr: string) => void
  viewMode: 'deliveries' | 'repairs'
}

// Clean model names for uniform display matching screenshot
function cleanModelName(model: string | null): string {
  if (!model) return 'รุ่นอื่นๆ'
  const name = model.toUpperCase()
  if (name.includes('ES')) return 'ES'
  if (name.includes('410')) return 'Y Plus 410'
  if (name.includes('490')) return 'Y Plus 490'
  if (name.includes('510')) return 'Y Plus 510'
  if (name.includes('HT') || name.includes('HYPTEC HT')) return 'HYPTEC HT'
  if (name.includes('SSR') || name.includes('HYPTEC SSR')) return 'HYPTEC SSR'
  return model.replace(/Premium|Classic|Sport/gi, '').trim()
}

export function DeliveryCalendar({
  deliveries = [],
  repairs = [],
  selectedYear,
  selectedMonth,
  selectedDate,
  onDateClick,
  viewMode
}: DeliveryCalendarProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <div className="h-96 w-full rounded-2xl bg-white dark:bg-zinc-900 animate-pulse border border-zinc-200 dark:border-zinc-800" />
  }

  // Days of week header (Thai)
  const thaiWeekdays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

  // Calendar dates math
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const startDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay()

  // Build calendar dates array
  const calendarCells: (Date | null)[] = []
  
  // Padding cells from previous month
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarCells.push(null)
  }

  // Month days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(new Date(selectedYear, selectedMonth, day))
  }

  // Project colors
  const getProjectStyle = (proj: string) => {
    const p = proj.toUpperCase()
    if (p.includes('EV7') || p.includes('TAXI')) {
      return 'border-l-[3px] border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 dark:bg-cyan-950/20'
    }
    if (p.includes('LINE') || p.includes('MAN')) {
      return 'border-l-[3px] border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 dark:bg-orange-950/20'
    }
    if (p.includes('GRAB')) {
      return 'border-l-[3px] border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-950/20'
    }
    return 'border-l-[3px] border-zinc-500 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 dark:bg-zinc-850/40'
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900/60 rounded-2xl md:rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-3 md:p-6 shadow-sm backdrop-blur-md">
      
      {/* Weekdays header */}
      <div className="grid grid-cols-7 gap-px text-center mb-2">
        {thaiWeekdays.map((day, idx) => (
          <div 
            key={day} 
            className={`text-xs font-semibold py-2 ${
              idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-indigo-500' : 'text-zinc-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 border border-zinc-100 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl overflow-hidden shadow-inner">
        {calendarCells.map((cell, idx) => {
          if (!cell) {
            return (
              <div 
                key={`empty-${idx}`} 
                className="bg-zinc-50/50 dark:bg-zinc-900/20 min-h-[100px] p-2 transition-all duration-200" 
              />
            )
          }

          const cellDateStr = cell.toISOString().split('T')[0]
          const dayNum = String(cell.getDate()).padStart(2, '0')
          const isSelected = selectedDate === cellDateStr
          const dayOfWeek = cell.getDay()

          // Tooltip position alignment to prevent clipping on boundaries
          const tooltipAlignClass = 
            dayOfWeek === 0 || dayOfWeek === 1
              ? 'left-0 translate-x-0'
              : dayOfWeek === 5 || dayOfWeek === 6
              ? 'right-0 translate-x-0'
              : 'left-1/2 -translate-x-1/2'

          // Get day deliveries data
          const dayDeliveries = deliveries.filter(d => {
            const dateVal = d.release_date || d.expected_release_date
            return dateVal && dateVal.startsWith(cellDateStr)
          })

          // Group deliveries by project
          const deliveryByProject: Record<string, DeliveryRecord[]> = {}
          dayDeliveries.forEach(d => {
            const projName = d.project || 'อื่นๆ'
            if (!deliveryByProject[projName]) {
              deliveryByProject[projName] = []
            }
            deliveryByProject[projName].push(d)
          })

          // Get day repairs data
          const dayRepairsReported = repairs.filter(r => r.report_date && r.report_date.startsWith(cellDateStr))
          const dayRepairsFinished = repairs.filter(r => r.finish_date && r.finish_date.startsWith(cellDateStr))

          return (
            <div
              key={cellDateStr}
              onClick={() => onDateClick(cellDateStr)}
              className={`group relative bg-white dark:bg-zinc-900 min-h-[55px] md:min-h-[120px] p-1 md:p-2 flex flex-col justify-between cursor-pointer hover:bg-indigo-500/5 dark:hover:bg-indigo-500/5 transition-all duration-150 ${
                isSelected ? 'ring-2 ring-indigo-550 dark:ring-indigo-400 bg-indigo-500/5 dark:bg-indigo-550/10' : ''
              }`}
            >
              
              {/* Day Number and Actions */}
              <div className="flex justify-between items-start">
                <span className={`text-[10px] md:text-xs font-semibold ${
                  dayOfWeek === 0 ? 'text-rose-500' : dayOfWeek === 6 ? 'text-indigo-500' : 'text-zinc-500'
                }`}>
                  {dayNum}
                </span>
                
                {/* Visual indicator dot if selected */}
                {isSelected && (
                  <span className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-indigo-500" />
                )}
              </div>

              {/* Desktop detailed view (hidden on mobile) */}
              <div className="hidden md:flex md:flex-col md:flex-1 md:justify-end md:gap-0.5 md:overflow-hidden md:mt-1">
                {viewMode === 'deliveries' ? (
                  // --- DELIVERIES CALENDAR VIEW (with model breakdown) ---
                  Object.entries(deliveryByProject).map(([proj, list]) => {
                    // Group by cleaned model name
                    const modelCounts: Record<string, number> = {}
                    list.forEach(item => {
                      const m = cleanModelName(item.model)
                      modelCounts[m] = (modelCounts[m] || 0) + 1
                    })
                    return (
                      <div key={proj} className="space-y-0">
                        <div className={`text-[10px] py-0.5 px-1.5 rounded-md font-bold flex justify-between items-center ${getProjectStyle(proj)}`}>
                          <span className="truncate mr-1">{proj}</span>
                          <span>{list.length}</span>
                        </div>
                        <div className="pl-2 space-y-0">
                          {Object.entries(modelCounts).map(([model, count]) => (
                            <div key={model} className="text-[8px] flex justify-between items-center text-zinc-400 dark:text-zinc-500 leading-tight">
                              <span className="truncate">· {model}</span>
                              <span className="tabular-nums ml-1 font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  // --- REPAIRS CALENDAR VIEW ---
                  <>
                    {dayRepairsReported.length > 0 && (
                      <div className="text-[9px] py-0.5 px-1 bg-amber-500/10 border-l-2 border-amber-500 text-amber-700 dark:text-amber-300 rounded font-semibold flex justify-between">
                        <span>แจ้งซ่อม:</span>
                        <span>{dayRepairsReported.length} คัน</span>
                      </div>
                    )}
                    {dayRepairsFinished.length > 0 && (
                      <div className="text-[9px] py-0.5 px-1 bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-700 dark:text-emerald-300 rounded font-semibold flex justify-between">
                        <span>ซ่อมเสร็จ:</span>
                        <span>{dayRepairsFinished.length} คัน</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Mobile simple indicators view (hidden on desktop) */}
              <div className="flex md:hidden flex-wrap gap-0.5 mt-0.5 justify-center items-center">
                {viewMode === 'deliveries' ? (
                  Object.keys(deliveryByProject).map((proj) => {
                    const p = proj.toUpperCase()
                    let dotColor = 'bg-zinc-400'
                    if (p.includes('EV7') || p.includes('TAXI')) dotColor = 'bg-cyan-500'
                    else if (p.includes('LINE') || p.includes('MAN')) dotColor = 'bg-orange-500'
                    else if (p.includes('GRAB')) dotColor = 'bg-emerald-500'
                    return (
                      <span
                        key={proj}
                        className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                        title={`${proj}: ${deliveryByProject[proj].length}`}
                      />
                    )
                  })
                ) : (
                  <>
                    {dayRepairsReported.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title={`แจ้งซ่อม: ${dayRepairsReported.length}`} />
                    )}
                    {dayRepairsFinished.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title={`ซ่อมเสร็จ: ${dayRepairsFinished.length}`} />
                    )}
                  </>
                )}
              </div>

              {/* === HOVER TOOLTIP POPUP (Matches Screenshot) === */}
              {viewMode === 'deliveries' && dayDeliveries.length > 0 && (
                <div className={`absolute bottom-full mb-2 hidden group-hover:block z-50 bg-zinc-900/95 text-zinc-100 p-4 rounded-2xl shadow-xl border border-zinc-800 backdrop-blur-md min-w-[220px] pointer-events-none text-left transition-all duration-200 ${tooltipAlignClass}`}>
                  
                  {/* Tooltip Header */}
                  <div className="border-b border-zinc-800 pb-1.5 mb-2 flex justify-between items-center gap-2">
                    <span className="text-xs font-bold tracking-wide">
                      {new Date(cellDateStr).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      รวม {dayDeliveries.length} คัน
                    </span>
                  </div>

                  {/* Group summaries */}
                  <div className="space-y-3">
                    {Object.entries(deliveryByProject).map(([proj, list]) => {
                      // Sub-group by cleaned model
                      const modelCounts: Record<string, number> = {}
                      list.forEach(item => {
                        const cleanedModel = cleanModelName(item.model)
                        modelCounts[cleanedModel] = (modelCounts[cleanedModel] || 0) + 1
                      })

                      return (
                        <div key={proj} className="space-y-0.5">
                          <div className="flex justify-between items-center text-xs font-bold text-white">
                            <span>{proj}</span>
                            <span>{list.length}</span>
                          </div>
                          <div className="space-y-0.5 pl-2 border-l border-zinc-800">
                            {Object.entries(modelCounts).map(([model, count]) => (
                              <div key={model} className="flex justify-between items-center text-[10px] text-zinc-400">
                                <span>- {model}</span>
                                <span>{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Mini-pointer arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95" />
                </div>
              )}

              {/* Tooltip for repairs */}
              {viewMode === 'repairs' && (dayRepairsReported.length > 0 || dayRepairsFinished.length > 0) && (
                <div className={`absolute bottom-full mb-2 hidden group-hover:block z-50 bg-zinc-900/95 text-zinc-100 p-4 rounded-2xl shadow-xl border border-zinc-800 backdrop-blur-md min-w-[220px] pointer-events-none text-left transition-all duration-200 ${tooltipAlignClass}`}>
                  
                  <div className="border-b border-zinc-800 pb-1.5 mb-2">
                    <span className="text-xs font-bold tracking-wide">
                      {new Date(cellDateStr).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>

                  <div className="space-y-2 text-[10px]">
                    {dayRepairsReported.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-bold text-amber-400">แจ้งซ่อมใหม่ ({dayRepairsReported.length} คัน)</p>
                        <ul className="list-disc pl-3 text-zinc-400 space-y-0.5">
                          {dayRepairsReported.slice(0, 3).map((r, i) => (
                            <li key={i} className="truncate">
                              {r.vehicle_id}: {r.description}
                            </li>
                          ))}
                          {dayRepairsReported.length > 3 && <li>... และอีก {dayRepairsReported.length - 3} คัน</li>}
                        </ul>
                      </div>
                    )}
                    {dayRepairsFinished.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-bold text-emerald-400">ซ่อมเสร็จแล้ว ({dayRepairsFinished.length} คัน)</p>
                        <ul className="list-disc pl-3 text-zinc-400 space-y-0.5">
                          {dayRepairsFinished.slice(0, 3).map((r, i) => (
                            <li key={i} className="truncate">
                              {r.vehicle_id}: {r.description}
                            </li>
                          ))}
                          {dayRepairsFinished.length > 3 && <li>... และอีก {dayRepairsFinished.length - 3} คัน</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900/95" />
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}
