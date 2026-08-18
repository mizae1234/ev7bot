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

const COLOR_MAP: Record<string, { badge: string; dot: string; ring: string; border: string }> = {
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
    border: 'border-emerald-500/30'
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/20',
    border: 'border-rose-500/30'
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    border: 'border-amber-500/30'
  },
  blue: {
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
    dot: 'bg-blue-500',
    ring: 'ring-blue-500/20',
    border: 'border-blue-500/30'
  },
  purple: {
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60',
    dot: 'bg-purple-500',
    ring: 'ring-purple-500/20',
    border: 'border-purple-500/30'
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-500/20',
    border: 'border-indigo-500/30'
  },
  zinc: {
    badge: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    dot: 'bg-zinc-400',
    ring: 'ring-zinc-400/20',
    border: 'border-zinc-400/30'
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
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
      {/* 1. Header Bar */}
      <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🕒</span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                ไทม์ไลน์ประวัติเหตุการณ์ของรถ (Vehicle Activity Timeline)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                รวมประวัติการปล่อยเช่า, คืนรถ, ยึดรถ, งานซ่อม, ประวัติรถทดแทน และบันทึกโน้ต เรียงตามลำดับเวลา
              </p>
            </div>
          </div>
        </div>

        {/* Sort Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOrder(prev => prev === 'DESC' ? 'ASC' : 'DESC')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            title="สลับลำดับเวลา"
          >
            <span>{sortOrder === 'DESC' ? '⬇️ ล่าสุดก่อน (ใหม่ ➔ เก่า)' : '⬆️ เก่าสุดก่อน (เก่า ➔ ใหม่)'}</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Pills & Search */}
      <div className="px-5 py-3.5 bg-zinc-50/70 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            🌟 ทั้งหมด ({counts.ALL})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('RENT_RETURN')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'RENT_RETURN'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            🚗 ปล่อย/คืนรถ ({counts.RENT_RETURN})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('REPOSSESS')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'REPOSSESS'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            🚨 ยึดรถ ({counts.REPOSSESS})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('REPLACEMENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'REPLACEMENT'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            🚗🔄 รถทดแทน ({counts.REPLACEMENT})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('MAINTENANCE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'MAINTENANCE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            🔧 งานซ่อม ({counts.MAINTENANCE})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('NOTE')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedCategory === 'NOTE'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
            }`}
          >
            📌 โน้ต & สถานที่ ({counts.NOTE})
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full md:w-56">
          <svg className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาในไทม์ไลน์..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
      </div>

      {/* 3. Timeline Stream */}
      <div className="p-5 sm:p-7">
        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center">
            <span className="text-3xl">📭</span>
            <p className="mt-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {events.length === 0 ? 'ยังไม่มีประวัติเหตุการณ์ที่บันทึกไว้สำหรับคันนี้' : 'ไม่พบเหตุการณ์ที่ตรงตามเงื่อนไขการค้นหา'}
            </p>
          </div>
        ) : (
          <div className="relative pl-6 sm:pl-8 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-6 sm:space-y-7 ml-3 sm:ml-4">
            {filteredEvents.map((evt) => {
              const { dateStr, timeStr } = formatThaiDateTime(evt.date)
              const color = COLOR_MAP[evt.badgeColor] || COLOR_MAP.zinc

              return (
                <div key={evt.id} className="relative group">
                  {/* Node Dot */}
                  <div className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 ${color.dot} ring-4 ${color.ring} transition-transform group-hover:scale-125`} />

                  {/* Event Card */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-white dark:hover:bg-zinc-800/80 hover:shadow-md transition-all space-y-2.5">
                    {/* Top Row: Timestamp & Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                          📅 {dateStr}
                        </span>
                        {timeStr && (
                          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-700/50 px-2 py-0.5 rounded-md">
                            ⏰ {timeStr}
                          </span>
                        )}
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold border ${color.badge}`}>
                        {evt.icon} {evt.badge}
                      </span>
                    </div>

                    {/* Title & Subtitle */}
                    <div>
                      <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                        {evt.title}
                      </h3>
                      {evt.subtitle && (
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-0.5">
                          {evt.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Description Details */}
                    {evt.description && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap bg-white/80 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50">
                        {evt.description}
                      </p>
                    )}

                    {/* Bottom Metadata: Location, User, Related Link */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/40 dark:border-zinc-800/40">
                      <div className="flex items-center gap-3 flex-wrap">
                        {evt.location && (
                          <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                            <span>📍</span>
                            <span>{evt.location}</span>
                          </span>
                        )}
                        {evt.user && (
                          <span className="flex items-center gap-1">
                            <span>👤</span>
                            <span>โดย: {evt.user}</span>
                          </span>
                        )}
                      </div>

                      {evt.relatedRegisterNo && (
                        <Link
                          href={`/vehicle/${evt.relatedRegisterNo}`}
                          className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          <span>🚗 ดูรถคันหลัก ({evt.relatedRegisterNo}) ↗</span>
                        </Link>
                      )}
                    </div>
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
