'use client'

import React, { memo } from 'react'
import type { LocationSummaryItem } from './types'

interface MaintenanceLocationGridProps {
  locationSummary: LocationSummaryItem[]
  selectedLocation: string
  onSelectLocation: (loc: string) => void
  formatLocation: (code: string | null | undefined) => string
}

function MaintenanceLocationGridComponent({
  locationSummary,
  selectedLocation,
  onSelectLocation,
  formatLocation,
}: MaintenanceLocationGridProps) {
  if (!locationSummary || locationSummary.length === 0) return null

  return (
    <div className="bg-white/70 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
        <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          📍 งานค้างซ่อมแยกตามอู่/พื้นที่
        </h2>
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          • นับตามจำนวนใบงาน (และจำนวนคันรถจริงที่จอดอยู่ในอู่ ไม่รวมรถที่ยังขับได้)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {locationSummary.map((item) => {
          const displayLoc =
            item.Location === 'ไม่ระบุ'
              ? 'ไม่ระบุพื้นที่/อู่'
              : formatLocation(item.Location)
          const isSelected = selectedLocation === item.Location

          return (
            <button
              key={item.Location}
              type="button"
              onClick={() => onSelectLocation(isSelected ? 'all' : item.Location)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-[11px] text-left ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'border-zinc-200 hover:border-zinc-300 bg-white/50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:bg-zinc-950/20 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              <span className="truncate pr-2" title={displayLoc}>
                {displayLoc}
              </span>
              <div className="text-right shrink-0">
                <span className="font-extrabold text-rose-600 dark:text-rose-400 block leading-tight">
                  {item.Count} <span className="text-[9px] font-normal text-zinc-400">ใบงาน</span>
                </span>
                {item.VehicleCount !== undefined && (
                  <span className="text-[9px] text-zinc-400 block leading-none mt-0.5">
                    ({item.VehicleCount} คัน)
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const MaintenanceLocationGrid = memo(MaintenanceLocationGridComponent)
