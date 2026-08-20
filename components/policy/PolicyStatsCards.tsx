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
        <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      bg: 'from-amber-500/10 via-amber-500/5 to-transparent hover:border-amber-500/50',
      borderDefault: 'border-amber-200/70 dark:border-amber-900/40',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/10',
      chipActive: 'text-amber-700 dark:text-amber-300 bg-amber-500/15 border-amber-500/20',
      chipMuted: 'text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/60 border-transparent'
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
        <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-rose-500/10 via-rose-500/5 to-transparent hover:border-rose-500/50',
      borderDefault: 'border-rose-200/70 dark:border-rose-900/40',
      activeBorder: 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/10',
      chipActive: 'text-rose-700 dark:text-rose-300 bg-rose-500/15 border-rose-500/20',
      chipMuted: 'text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/60 border-transparent'
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
        <svg className="w-3.5 h-3.5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-yellow-500/10 via-yellow-500/5 to-transparent hover:border-yellow-500/50',
      borderDefault: 'border-yellow-200/70 dark:border-yellow-900/40',
      activeBorder: 'border-yellow-500 ring-2 ring-yellow-500/20 bg-yellow-500/10',
      chipActive: 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/15 border-yellow-500/20',
      chipMuted: 'text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/60 border-transparent'
    },
    {
      id: 'MISSING_ANY',
      type: 'MISSING',
      title: 'ยังขาดข้อมูลเอกสาร',
      desc: 'ไม่มีเอกสารอย่างน้อย 1 รายการ',
      count: stats.totalMissingAny,
      breakdown: [
        { label: 'ขาดประกัน', val: stats.insuranceMissing },
        { label: 'ขาด พ.ร.บ.', val: stats.actMissing },
        { label: 'ขาดภาษีรถ', val: stats.taxMissing },
        { label: 'ขาดมิเตอร์', val: stats.meterMissing }
      ],
      icon: (
        <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      bg: 'from-slate-500/10 via-slate-500/5 to-transparent hover:border-slate-500/50',
      borderDefault: 'border-zinc-200/80 dark:border-zinc-800',
      activeBorder: 'border-slate-500 ring-2 ring-slate-500/20 bg-slate-500/10',
      chipActive: 'text-slate-700 dark:text-slate-300 bg-slate-200/80 dark:bg-slate-800 border-slate-300/40 dark:border-slate-700/40',
      chipMuted: 'text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/60 border-transparent'
    }
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
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
            className={`text-left relative p-3 rounded-xl border transition-all duration-200 bg-white dark:bg-zinc-900 bg-gradient-to-br ${card.bg} ${
              isSelected ? card.activeBorder : `${card.borderDefault} hover:border-zinc-300 dark:hover:border-zinc-700`
            } shadow-xs hover:shadow-sm cursor-pointer flex flex-col justify-between`}
          >
            <div>
              {/* Header Title + Icon */}
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 leading-tight">
                  {card.title}
                </span>
                <div className="w-6 h-6 rounded-lg bg-white dark:bg-zinc-800 shadow-xs border border-zinc-200/70 dark:border-zinc-700/70 flex items-center justify-center shrink-0">
                  {card.icon}
                </div>
              </div>

              {/* Counter */}
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-white font-mono">
                  {card.count.toLocaleString()}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">คัน</span>
              </div>
            </div>

            {/* Sub Breakdown Badges */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
              {card.breakdown.map((item, idx) => {
                const hasValue = item.val > 0
                return (
                  <span
                    key={idx}
                    className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium transition-colors inline-flex items-center gap-0.5 ${
                      hasValue ? card.chipActive : card.chipMuted
                    }`}
                  >
                    <span>{item.label}:</span>
                    <strong className="font-bold">{item.val.toLocaleString()}</strong>
                  </span>
                )
              })}
            </div>
          </button>
        )
      })}
    </div>
  )
}
