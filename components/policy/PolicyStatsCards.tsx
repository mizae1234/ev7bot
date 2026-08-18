import React from 'react'
import { PolicyStatsSummary } from '@/lib/policy/policy-types'

interface PolicyStatsCardsProps {
  stats: PolicyStatsSummary
  activeExpiryFilter?: string
  activeMissingFilter?: string
  onSelectFilter: (expiryFilter: string, missingFilter: string) => void
}

export function PolicyStatsCards({
  stats,
  activeExpiryFilter = 'ALL',
  activeMissingFilter = 'ALL',
  onSelectFilter
}: PolicyStatsCardsProps) {
  const cards = [
    {
      id: 'EXPIRING_30',
      type: 'EXPIRY',
      title: 'ใกล้หมดอายุ (≤ 30 วัน)',
      desc: 'ต้องรีบดำเนินการต่ออายุ',
      count: stats.insuranceExpiring30 + stats.actExpiring30 + stats.taxExpiring30 + stats.meterExpiring30,
      breakdown: [
        { label: 'ประกัน', val: stats.insuranceExpiring30 },
        { label: 'พ.ร.บ.', val: stats.actExpiring30 },
        { label: 'ภาษีรถ', val: stats.taxExpiring30 },
        { label: 'มิเตอร์', val: stats.meterExpiring30 }
      ],
      icon: (
        <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      bg: 'from-amber-500/10 to-amber-600/5 hover:border-amber-500/50',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10',
      badgeColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
    },
    {
      id: 'EXPIRED',
      type: 'EXPIRY',
      title: 'ขาดต่ออายุ / หมดอายุแล้ว',
      desc: 'เลยกำหนดวันคุ้มครอง',
      count: stats.insuranceExpired + stats.actExpired + stats.taxExpired + stats.meterExpired,
      breakdown: [
        { label: 'ประกัน', val: stats.insuranceExpired },
        { label: 'พ.ร.บ.', val: stats.actExpired },
        { label: 'ภาษีรถ', val: stats.taxExpired },
        { label: 'มิเตอร์', val: stats.meterExpired }
      ],
      icon: (
        <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-rose-500/10 to-rose-600/5 hover:border-rose-500/50',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10',
      badgeColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10'
    },
    {
      id: 'EXPIRING_60',
      type: 'EXPIRY',
      title: 'ใกล้หมดอายุ (31 - 60 วัน)',
      desc: 'เตรียมวางแผนต่ออายุล่วงหน้า',
      count: stats.insuranceExpiring60 + stats.actExpiring60 + stats.taxExpiring60 + stats.meterExpiring60,
      breakdown: [
        { label: 'ประกัน', val: stats.insuranceExpiring60 },
        { label: 'พ.ร.บ.', val: stats.actExpiring60 },
        { label: 'ภาษีรถ', val: stats.taxExpiring60 },
        { label: 'มิเตอร์', val: stats.meterExpiring60 }
      ],
      icon: (
        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-yellow-500/10 to-yellow-600/5 hover:border-yellow-500/50',
      activeBorder: 'border-yellow-500 ring-2 ring-yellow-500/20 bg-yellow-500/10',
      badgeColor: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10'
    },
    {
      id: 'MISSING_ANY',
      type: 'MISSING',
      title: 'ยังขาดข้อมูลเอกสาร',
      desc: `ไม่มีเอกสารอย่างน้อย 1 รายการ`,
      count: stats.totalMissingAny,
      breakdown: [
        { label: 'ขาดประกัน', val: stats.insuranceMissing },
        { label: 'ขาด พ.ร.บ.', val: stats.actMissing },
        { label: 'ขาดภาษีรถ', val: stats.taxMissing },
        { label: 'ขาดมิเตอร์', val: stats.meterMissing }
      ],
      icon: (
        <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bg: 'from-slate-500/10 to-slate-600/5 hover:border-slate-500/50',
      activeBorder: 'border-slate-500 ring-2 ring-slate-500/20 bg-slate-500/10',
      badgeColor: 'text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => {
        const isSelected = card.type === 'EXPIRY'
          ? (activeExpiryFilter === card.id && activeMissingFilter === 'ALL')
          : (activeMissingFilter === card.id)

        const handleClick = () => {
          if (card.type === 'EXPIRY') {
            if (activeExpiryFilter === card.id) {
              onSelectFilter('ALL', 'ALL')
            } else {
              onSelectFilter(card.id, 'ALL')
            }
          } else {
            if (activeMissingFilter === card.id) {
              onSelectFilter('ALL', 'ALL')
            } else {
              onSelectFilter('ALL', card.id)
            }
          }
        }

        return (
          <button
            key={card.id}
            type="button"
            onClick={handleClick}
            className={`text-left relative p-4.5 rounded-2xl border transition-all duration-200 bg-gradient-to-br backdrop-blur-sm ${card.bg} ${
              isSelected ? card.activeBorder : 'border-zinc-200/80 dark:border-zinc-800'
            } shadow-sm hover:shadow-md cursor-pointer`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                {card.title}
              </span>
              <div className="p-2 rounded-xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60">
                {card.icon}
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {card.count.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">คัน</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
              {card.breakdown.map((item, idx) => (
                <span
                  key={idx}
                  className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                    item.val > 0 ? card.badgeColor : 'text-zinc-400 bg-zinc-100 dark:bg-zinc-800'
                  }`}
                >
                  {item.label}: <strong className="font-semibold">{item.val}</strong>
                </span>
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
