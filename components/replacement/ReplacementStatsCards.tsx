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
      id: 'ACTIVE_ALL',
      targetTab: 'ACTIVE' as const,
      filterKey: 'ALL',
      title: 'กำลังใช้งานทดแทน (Active in Use)',
      desc: 'รถคันหลักยังซ่อมไม่เสร็จ',
      count: stats.activeInUse,
      unit: 'คัน',
      badgeColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
      bg: 'from-indigo-500/10 to-indigo-600/5 hover:border-indigo-500/50',
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-500/10',
      icon: (
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      id: 'READY_TO_PICK',
      targetTab: 'POOL' as const,
      filterKey: 'READY',
      title: 'พร้อมใช้งาน / ว่าง (Ready to Pick)',
      desc: 'หยิบกุญแจไปใช้งานได้ทันที',
      count: stats.readyToPick,
      unit: 'คัน',
      badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      bg: 'from-emerald-500/10 to-emerald-600/5 hover:border-emerald-500/50',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10',
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'RESERVED_LINEMAN',
      targetTab: 'POOL' as const,
      filterKey: 'RESERVED_LINEMAN',
      title: 'จองให้ Line Man (Reserved)',
      desc: 'ล็อกโควตาสำหรับโครงการ Line Man',
      count: stats.reservedLineman,
      unit: 'คัน',
      badgeColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
      bg: 'from-teal-500/10 to-teal-600/5 hover:border-teal-500/50',
      activeBorder: 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-500/10',
      icon: (
        <svg className="w-5 h-5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'RESERVED_OTHERS',
      targetTab: 'POOL' as const,
      filterKey: 'RESERVED_OTHERS',
      title: 'จองสำรองอื่นๆ / ไม่ระบุทะเบียน',
      desc: `ไม่ระบุทะเบียน ${stats.reservedUnassigned} คัน`,
      count: stats.reservedOthers,
      unit: 'คัน',
      badgeColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      bg: 'from-amber-500/10 to-amber-600/5 hover:border-amber-500/50',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10',
      icon: (
        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      )
    },
    {
      id: 'CRITICAL_ALERT',
      targetTab: 'ACTIVE' as const,
      filterKey: 'CRITICAL',
      title: 'ใช้งานนานผิดปกติ (> 30 วัน)',
      desc: 'ต้องเร่งติดตามงานซ่อมอู่',
      count: stats.criticalDurationAlert,
      unit: 'คัน',
      badgeColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
      bg: 'from-rose-500/10 to-rose-600/5 hover:border-rose-500/50',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10',
      icon: (
        <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {cards.map(card => {
        const isSelected = activeTab === card.targetTab && activeFilter === card.filterKey

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(card.targetTab, card.filterKey)}
            className={`text-left relative p-4 rounded-2xl border transition-all duration-200 bg-gradient-to-br backdrop-blur-sm ${card.bg} ${
              isSelected ? card.activeBorder : 'border-zinc-200/80 dark:border-zinc-800'
            } shadow-sm hover:shadow-md cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 leading-tight">
                {card.title}
              </span>
              <div className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60">
                {card.icon}
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {card.count.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{card.unit}</span>
            </div>

            <div className="text-[10.5px] text-zinc-500 dark:text-zinc-400 truncate">
              {card.desc}
            </div>
          </button>
        )
      })}
    </div>
  )
}
