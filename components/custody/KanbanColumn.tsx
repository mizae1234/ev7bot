'use client'
import React, { useState } from 'react'
import { KanbanCard, CardData } from './KanbanCard'

interface KanbanColumnProps {
  title: string
  cards: CardData[]
  headerColorClass: string
  badgeColorClass: string
  accentColorClass: string
  hoverBorderClass: string
  icon: string
  onRefresh?: () => Promise<void>
  isExpandable?: boolean
  showReplacementFilter?: boolean
}

export function KanbanColumn({
  title,
  cards,
  headerColorClass,
  badgeColorClass,
  accentColorClass,
  hoverBorderClass,
  icon,
  onRefresh,
  isExpandable = true,
  showReplacementFilter = false,
}: KanbanColumnProps) {
  const [replacementFilter, setReplacementFilter] = useState<'all' | 'has' | 'none'>('all')

  const filteredCards = showReplacementFilter && replacementFilter !== 'all'
    ? cards.filter(c => replacementFilter === 'has' ? !!c.replacementVin : !c.replacementVin)
    : cards

  return (
    <div className="flex flex-col rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/40 min-h-[500px]">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className={`text-sm font-bold ${headerColorClass}`}>{title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColorClass}`}>
          {filteredCards.length}
        </span>
      </div>
      {showReplacementFilter && (
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button
            onClick={() => setReplacementFilter('all')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              replacementFilter === 'all'
                ? 'bg-zinc-800 text-white border-zinc-800 dark:bg-zinc-200 dark:text-zinc-900 dark:border-zinc-200'
                : 'bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setReplacementFilter('has')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              replacementFilter === 'has'
                ? 'bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500'
                : 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-400 dark:bg-zinc-900 dark:text-emerald-400 dark:border-emerald-800'
            }`}
          >
            🟢 มีรถทดแทน
          </button>
          <button
            onClick={() => setReplacementFilter('none')}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all ${
              replacementFilter === 'none'
                ? 'bg-rose-600 text-white border-rose-600 dark:bg-rose-500 dark:border-rose-500'
                : 'bg-white text-rose-600 border-rose-200 hover:border-rose-400 dark:bg-zinc-900 dark:text-rose-400 dark:border-rose-800'
            }`}
          >
            ⚠️ ไม่มีรถทดแทน
          </button>
        </div>
      )}
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-1">
        {filteredCards.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-xs">ไม่มีเคสค้างในขั้นตอนนี้</div>
        ) : (
          filteredCards.map((card) => (
            <KanbanCard
              key={card.maintenanceId}
              card={card}
              accentColorClass={accentColorClass}
              hoverBorderClass={hoverBorderClass}
              icon={icon}
              onRefresh={onRefresh}
              isExpandable={isExpandable}
            />
          ))
        )}
      </div>
    </div>
  )
}
