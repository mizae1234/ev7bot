'use client'
import React from 'react'
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
}: KanbanColumnProps) {
  return (
    <div className="flex flex-col rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/40 min-h-[500px]">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
        <span className={`text-sm font-bold ${headerColorClass}`}>{title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColorClass}`}>
          {cards.length}
        </span>
      </div>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-1">
        {cards.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 text-xs">ไม่มีเคสค้างในขั้นตอนนี้</div>
        ) : (
          cards.map((card) => (
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
