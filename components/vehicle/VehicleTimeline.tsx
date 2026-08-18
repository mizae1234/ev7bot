'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'

export interface VehicleTimelineEvent {
  id: string
  date: string
  category: 'RENT' | 'RETURN' | 'REPOSSESS' | 'MAINTENANCE' | 'FOLLOW_UP' | 'REPLACEMENT' | 'NOTE'
  title: string
  subtitle?: string | null
  description?: string | null
  badge: string
  badgeColor: 'blue' | 'emerald' | 'rose' | 'amber' | 'purple' | 'indigo' | 'zinc'
  icon: string
  location?: string | null
  user?: string | null
  relatedRegisterNo?: string | null
  relatedVin?: string | null
  meta?: Record<string, unknown>
}

interface VehicleTimelineProps {
  events: VehicleTimelineEvent[]
  registerNo?: string | null
  vinNo?: string | null
}

function formatThaiDateTime(dateStr?: string | null): { dateStr: string; timeStr: string } {
  if (!dateStr) return { dateStr: '-', timeStr: '' }
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return { dateStr: '-', timeStr: '' }
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const mins = String(d.getUTCMinutes()).padStart(2, '0')

    const hasTime = !(hours === '00' && mins === '00')
    return {
      dateStr: `${day} ${month} ${year}`,
      timeStr: hasTime ? `${hours}:${mins} น.` : ''
    }
  } catch {
    return { dateStr: dateStr || '-', timeStr: '' }
  }
}

const COLOR_MAP: Record<string, { badge: string; dot: string; ring: string }> = {
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20'
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/20'
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20'
  },
  blue: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/20'
  },
  purple: {
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
    dot: 'bg-purple-500',
    ring: 'ring-purple-500/20'
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-500/20'
  },
  zinc: {
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
    ring: 'ring-zinc-400/20'
  }
}

export function VehicleTimeline({ events = [], registerNo, vinNo }: VehicleTimelineProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC')

  // Categories count
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      ALL: events.length,
      RENT_RETURN: 0,
      REPOSSESS: 0,
      REPLACEMENT: 0,
      MAINTENANCE: 0,
      NOTE: 0
    }
    events.forEach(e => {
      if (e.category === 'RENT' || e.category === 'RETURN') map.RENT_RETURN++
      else if (e.category === 'REPOSSESS') map.REPOSSESS++
      else if (e.category === 'REPLACEMENT') map.REPLACEMENT++
      else if (e.category === 'MAINTENANCE' || e.category === 'FOLLOW_UP') map.MAINTENANCE++
      else if (e.category === 'NOTE') map.NOTE++
    })
    return map
  }, [events])

  // Filtered & Sorted events
  const filteredEvents = useMemo(() => {
    let list = [...events]

    // Category filter
    if (selectedCategory === 'RENT_RETURN') {
      list = list.filter(e => e.category === 'RENT' || e.category === 'RETURN')
    } else if (selectedCategory === 'REPOSSESS') {
      list = list.filter(e => e.category === 'REPOSSESS')
    } else if (selectedCategory === 'REPLACEMENT') {
      list = list.filter(e => e.category === 'REPLACEMENT')
    } else if (selectedCategory === 'MAINTENANCE') {
      list = list.filter(e => e.category === 'MAINTENANCE' || e.category === 'FOLLOW_UP')
    } else if (selectedCategory === 'NOTE') {
      list = list.filter(e => e.category === 'NOTE')
    }

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.subtitle && e.subtitle.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.user && e.user.toLowerCase().includes(q)) ||
        (e.badge && e.badge.toLowerCase().includes(q))
      )
    }

    // Sort
    list.sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime()
      return sortOrder === 'DESC' ? diff : -diff
    })

    return list
  }, [events, selectedCategory, searchTerm, sortOrder])

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
      {/* 1. Header Bar (Compact) */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🕒</span>
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
              ไทม์ไลน์ประวัติเหตุการณ์ ({filteredEvents.length} รายการ)
            </h3>
          </div>
        </div>

        {/* Sort Toggle */}
        <button
          type="button"
          onClick={() => setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
          className="text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer flex items-center gap-1 font-medium transition-colors"
          title="สลับลำดับเวลา"
        >
          <span>{sortOrder === 'DESC' ? 'ล่าสุดก่อน ⬇️' : 'เก่าสุดก่อน ⬆️'}</span>
        </button>
      </div>

      {/* 2. Filter Pills & Search (Compact) */}
      <div className="px-3.5 py-2 bg-zinc-50/70 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        {/* Pills */}
        <div className="flex items-center gap-1 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60'
            }`}
          >
            ทั้งหมด ({counts.ALL})
          </button>

          {counts.RENT_RETURN > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('RENT_RETURN')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedCategory === 'RENT_RETURN'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60'
              }`}
            >
              🚗 ปล่อย/คืน ({counts.RENT_RETURN})
            </button>
          )}

          {counts.REPOSSESS > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('REPOSSESS')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedCategory === 'REPOSSESS'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60'
              }`}
            >
              🚨 ยึดรถ ({counts.REPOSSESS})
            </button>
          )}

          {counts.REPLACEMENT > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('REPLACEMENT')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedCategory === 'REPLACEMENT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60'
              }`}
            >
              🔄 รถทดแทน ({counts.REPLACEMENT})
            </button>
          )}

          {counts.MAINTENANCE > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('MAINTENANCE')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedCategory === 'MAINTENANCE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60'
              }`}
            >
              🔧 ซ่อม ({counts.MAINTENANCE})
            </button>
          )}

          {counts.NOTE > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('NOTE')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                selectedCategory === 'NOTE'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200/60 dark:border-zinc-700/60'
              }`}
            >
              📌 โน้ต ({counts.NOTE})
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-44">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 ค้นหาในไทม์ไลน์..."
            className="w-full px-2.5 py-1 rounded-lg text-[11px] bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>
      </div>

      {/* 3. Compact Stream Timeline */}
      <div className="p-4 sm:p-4.5">
        {filteredEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-zinc-400">
            {events.length === 0 ? 'ยังไม่มีประวัติเหตุการณ์ที่บันทึกไว้' : 'ไม่พบเหตุการณ์ตามเงื่อนไขที่ค้นหา'}
          </div>
        ) : (
          <div className="relative pl-4 sm:pl-5 border-l-2 border-zinc-200 dark:border-zinc-750 space-y-3 ml-1.5 sm:ml-2">
            {filteredEvents.map((evt) => {
              const { dateStr, timeStr } = formatThaiDateTime(evt.date)
              const color = COLOR_MAP[evt.badgeColor] || COLOR_MAP.zinc

              return (
                <div key={evt.id} className="relative group">
                  {/* Node Dot */}
                  <div className={`absolute -left-[23px] sm:-left-[27px] top-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-zinc-900 ${color.dot} ring-2 ${color.ring}`} />

                  {/* Compact Event Card */}
                  <div className="p-2.5 sm:p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30 hover:bg-white dark:hover:bg-zinc-800/70 transition-all space-y-1 text-xs">
                    {/* Top Row: Date + Badge on Left | User on Right */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200 text-xs">
                          {dateStr}
                        </span>
                        {timeStr && (
                          <span className="font-mono text-[10.5px] text-zinc-400 bg-zinc-200/60 dark:bg-zinc-700/50 px-1.5 py-0.2 rounded">
                            {timeStr}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${color.badge}`}>
                          {evt.icon} {evt.badge}
                        </span>
                      </div>

                      {evt.user && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium shrink-0">
                          โดย {evt.user}
                        </span>
                      )}
                    </div>

                    {/* Title & Subtitle */}
                    <div className="text-xs text-zinc-800 dark:text-zinc-200 leading-snug">
                      <strong className="font-semibold text-zinc-900 dark:text-white">
                        {evt.title}
                      </strong>
                      {evt.subtitle && (
                        <span className="text-zinc-600 dark:text-zinc-400 ml-1">
                          — {evt.subtitle}
                        </span>
                      )}
                    </div>

                    {/* Description Details (Compact) */}
                    {evt.description && (
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed pt-0.5">
                        {evt.description}
                      </div>
                    )}

                    {/* Location & Related Link */}
                    {(evt.location || evt.relatedRegisterNo) && (
                      <div className="flex items-center justify-between text-[10.5px] text-zinc-400 pt-1 border-t border-zinc-200/40 dark:border-zinc-800/40">
                        {evt.location ? <span>📍 {evt.location}</span> : <span />}
                        {evt.relatedRegisterNo && (
                          <Link
                            href={`/vehicle/${evt.relatedRegisterNo}`}
                            className="font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            🚗 ดูรถคันหลัก ({evt.relatedRegisterNo}) ↗
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
