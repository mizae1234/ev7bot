'use client'

import React from 'react'

interface StatsCardsProps {
  stats: {
    total: number
    normal: number
    repair: number
    pending: number
  }
}

const STAT_ITEMS = [
  { key: 'total', label: 'คืนรถทั้งหมด', icon: '📦', unit: 'คัน', colorClass: '' },
  { key: 'normal', label: 'สภาพปกติ', icon: '✅', unit: 'คัน', colorClass: 'text-emerald-600' },
  { key: 'repair', label: 'ส่งเข้าซ่อม', icon: '⚠️', unit: 'คัน', colorClass: 'text-rose-600' },
  { key: 'pending', label: 'รอผลตรวจ', icon: '⏳', unit: 'คัน', colorClass: 'text-amber-600' },
] as const

const ICON_BG: Record<string, string> = {
  total: 'bg-indigo-50 border-indigo-100',
  normal: 'bg-emerald-50 border-emerald-100',
  repair: 'bg-rose-50 border-rose-100',
  pending: 'bg-amber-50 border-amber-100',
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {STAT_ITEMS.map((item) => (
        <div
          key={item.key}
          className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-sm"
        >
          <div className={`w-10 h-10 rounded-xl ${ICON_BG[item.key]} border flex items-center justify-center text-lg`}>
            {item.icon}
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${item.colorClass || 'text-slate-400'}`}>
              {item.label}
            </p>
            <h3 className={`text-xl font-black mt-0.5 ${item.colorClass || 'text-slate-800'}`}>
              {stats[item.key as keyof typeof stats]}{' '}
              <span className="text-xs font-medium text-slate-500">{item.unit}</span>
            </h3>
          </div>
        </div>
      ))}
    </div>
  )
}
