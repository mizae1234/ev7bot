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

  // Get selected date details for the bottom card
  const selectedDateDeliveries = selectedDate
    ? deliveries.filter(d => {
        const dateVal = d.release_date || d.expected_release_date
        return dateVal && dateVal.startsWith(selectedDate)
      })
    : []

  const selectedDateDeliveryByProject: Record<string, typeof deliveries> = {}
  selectedDateDeliveries.forEach(d => {
    const projName = d.project || 'อื่นๆ'
    if (!selectedDateDeliveryByProject[projName]) {
      selectedDateDeliveryByProject[projName] = []
    }
    selectedDateDeliveryByProject[projName].push(d)
  })

  const selectedDateRepairsReported = selectedDate
    ? repairs.filter(r => r.report_date && r.report_date.startsWith(selectedDate))
    : []
  const selectedDateRepairsFinished = selectedDate
    ? repairs.filter(r => r.finish_date && r.finish_date.startsWith(selectedDate))
    : []

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
              <div className="flex md:hidden flex-col gap-0.5 mt-1 items-center justify-center w-full">
                {viewMode === 'deliveries' ? (
                  dayDeliveries.length > 0 && (
                    <span className="text-[9px] px-1 py-0.5 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-md font-bold scale-90">
                      🚚 {dayDeliveries.length}
                    </span>
                  )
                ) : (
                  (dayRepairsReported.length > 0 || dayRepairsFinished.length > 0) && (
                    <span className="text-[9px] px-1 py-0.5 bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 rounded-md font-bold scale-90">
                      🛠️ {dayRepairsReported.length + dayRepairsFinished.length}
                    </span>
                  )
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

      {/* Mobile & Desktop Inline Date Detail Card (Saves mobile UX from scrolling down) */}
      {selectedDate && (
        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 text-xs animate-in fade-in slide-in-from-bottom-2 duration-250">
          <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-2.5 mb-3">
            <h4 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <span>📅 สรุปข้อมูลวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </h4>
            <button
              onClick={() => onDateClick(selectedDate)} // Click again to clear
              className="text-rose-500 hover:text-rose-600 font-semibold transition-colors text-xs"
            >
              แสดงทั้งเดือน ✕
            </button>
          </div>

          {viewMode === 'deliveries' ? (
            // --- DELIVERIES BREAKDOWN ---
            selectedDateDeliveries.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 py-2">ไม่มีแผนงานส่งมอบในวันนี้</p>
            ) : (
              <div className="space-y-3">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  🚛 แผนส่งมอบทั้งหมด <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedDateDeliveries.length}</span> คัน
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(selectedDateDeliveryByProject).map(([proj, list]) => {
                    const modelCounts: Record<string, number> = {}
                    list.forEach(item => {
                      const m = cleanModelName(item.model)
                      modelCounts[m] = (modelCounts[m] || 0) + 1
                    })
                    return (
                      <div key={proj} className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-800/80 shadow-sm">
                        <div className="flex justify-between items-center font-bold text-zinc-800 dark:text-zinc-200 mb-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-1">
                          <span>{proj}</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{list.length} คัน</span>
                        </div>
                        <ul className="space-y-1 text-zinc-500 dark:text-zinc-400">
                          {Object.entries(modelCounts).map(([model, count]) => (
                            <li key={model} className="flex justify-between items-center">
                              <span>• {model}</span>
                              <span className="font-medium">{count}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          ) : (
            // --- REPAIRS BREAKDOWN ---
            selectedDateRepairsReported.length === 0 && selectedDateRepairsFinished.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-400 py-2">ไม่มีความเคลื่อนไหวด้านงานซ่อมในวันนี้</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Reported Repairs */}
                {selectedDateRepairsReported.length > 0 && (
                  <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-800/80 shadow-sm">
                    <p className="font-bold text-amber-600 dark:text-amber-400 mb-2 pb-1 border-b border-zinc-100 dark:border-zinc-800 flex justify-between">
                      <span>🔧 แจ้งซ่อมใหม่</span>
                      <span>{selectedDateRepairsReported.length} คัน</span>
                    </p>
                    <ul className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                      {selectedDateRepairsReported.map((r, i) => (
                        <li key={i} className="text-zinc-650 dark:text-zinc-450 text-[11px] leading-tight flex gap-1.5 items-start">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">• {r.vehicle_id}</span>
                          <span className="text-zinc-500 dark:text-zinc-455 truncate" title={r.description}>{r.description || '-'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Finished Repairs */}
                {selectedDateRepairsFinished.length > 0 && (
                  <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-800/80 shadow-sm">
                    <p className="font-bold text-emerald-600 dark:text-emerald-450 mb-2 pb-1 border-b border-zinc-100 dark:border-zinc-800 flex justify-between">
                      <span>✅ ซ่อมเสร็จสิ้น</span>
                      <span>{selectedDateRepairsFinished.length} คัน</span>
                    </p>
                    <ul className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                      {selectedDateRepairsFinished.map((r, i) => (
                        <li key={i} className="text-zinc-650 dark:text-zinc-455 text-[11px] leading-tight flex gap-1.5 items-start">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 shrink-0">• {r.vehicle_id}</span>
                          <span className="text-zinc-500 dark:text-zinc-400 truncate" title={r.description}>{r.description || '-'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
