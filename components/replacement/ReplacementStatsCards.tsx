import React from 'react'
import { ReplacementStatsSummary } from '@/lib/replacement/replacement-types'

interface ReplacementStatsCardsProps {
  stats: ReplacementStatsSummary
  activeTab: 'ACTIVE' | 'POOL' | 'HISTORY'
  activeFilter?: string
  onSelectFilter: (tab: 'ACTIVE' | 'POOL' | 'HISTORY', filterKey?: string) => void
}

export function ReplacementStatsCards({
  stats,
  activeTab,
  activeFilter = 'ALL',
  onSelectFilter
}: ReplacementStatsCardsProps) {
  const cards = [
    {
      id: 'ACTIVE_RUNNING',
      targetTab: 'ACTIVE' as const,
      filterKey: 'ACTIVE_ONLY',
      title: 'ใช้งานจริง (Active)',
      desc: 'รถวิ่งใช้งาน (ไม่รวมเข้าซ่อม)',
      count: stats.activeInUse,
      unit: 'คัน',
      badgeColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
      bg: 'from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/50',
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/10',
      icon: (
        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      id: 'REPLACEMENT_AVAILABLE',
      targetTab: 'POOL' as const,
      filterKey: 'READY',
      title: 'พร้อมใช้ทันที (Avail)',
      desc: 'รถทดแทนพร้อมจ่ายงาน',
      count: stats.readyToPick,
      unit: 'คัน',
      badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      bg: 'from-emerald-500/10 to-emerald-600/5 hover:border-emerald-500/50',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10',
      icon: (
        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'AVAILABLE_USE_STANDBY',
      targetTab: 'POOL' as const,
      filterKey: 'STANDBY',
      title: 'Standby พร้อมเปลี่ยน',
      desc: 'สามารถเปลี่ยนเป็นรถทดแทนได้',
      count: stats.availableUseStandby || 0,
      unit: 'คัน',
      badgeColor: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
      bg: 'from-sky-500/10 to-sky-600/5 hover:border-sky-500/50',
      activeBorder: 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-500/10',
      icon: (
        <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
    {
      id: 'RESERVED_LINEMAN',
      targetTab: 'POOL' as const,
      filterKey: 'RESERVED_LINEMAN',
      title: 'จอง Line Man',
      desc: 'โควตา Line Man',
      count: stats.reservedLineman,
      unit: 'คัน',
      badgeColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
      bg: 'from-teal-500/10 to-teal-600/5 hover:border-teal-500/50',
      activeBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-500/10',
      icon: (
        <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'REPLACEMENT_MAINTENANCE',
      targetTab: 'POOL' as const,
      filterKey: 'MAINTENANCE',
      title: 'รถทดแทนเข้าซ่อม',
      desc: 'รถสำรอง/ทดแทนที่อยู่ระหว่างซ่อม',
      count: stats.inMaintenance,
      unit: 'คัน',
      badgeColor: 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
      bg: 'from-orange-500/10 to-orange-600/5 hover:border-orange-500/50',
      activeBorder: 'border-orange-500 ring-2 ring-orange-500/20 bg-orange-500/10',
      icon: (
        <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      id: 'CRITICAL_ALERT',
      targetTab: 'ACTIVE' as const,
      filterKey: 'CRITICAL',
      title: 'ใช้งาน > 30 วัน (Alert)',
      desc: 'ต้องเร่งตามงานซ่อมอู่',
      count: stats.criticalDurationAlert,
      unit: 'คัน',
      badgeColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
      bg: 'from-rose-500/10 to-rose-600/5 hover:border-rose-500/50',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10',
      icon: (
        <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    }
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {cards.map(card => {
        const isSelected = activeTab === card.targetTab && activeFilter === card.filterKey

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(card.targetTab, card.filterKey)}
            className={`text-left relative p-3 rounded-xl border transition-all duration-200 bg-gradient-to-br backdrop-blur-sm ${card.bg} ${
              isSelected ? card.activeBorder : 'border-zinc-200/80 dark:border-zinc-800'
            } shadow-xs hover:shadow-sm cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 leading-tight truncate">
                {card.title}
              </span>
              <div className="p-1 rounded-lg bg-white dark:bg-zinc-800 shadow-xs border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                {card.icon}
              </div>
            </div>

            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                {card.count.toLocaleString()}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{card.unit}</span>
            </div>

            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate leading-tight">
              {card.desc}
            </div>
          </button>
        )
      })}
    </div>
  )
}
