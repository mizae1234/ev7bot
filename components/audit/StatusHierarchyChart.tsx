'use client'

import React, { useMemo } from 'react'

// --- Status Hierarchy Definition ---
// Maps raw VehicleStatus/VehicleStatusType codes to the tree structure

interface StatusNode {
  key: string
  label: string
  children?: StatusNode[]
  color: string       // tailwind color token e.g. 'teal'
  matchCodes: string[] // codes that map to this node
}

const STATUS_TREE: StatusNode[] = [
  {
    key: 'new_car',
    label: 'รถใหม่',
    color: 'sky',
    matchCodes: [],
    children: [
      { key: 'production',   label: 'Production',   color: 'sky',    matchCodes: ['NEW_PRODUCTION', 'PRODUCTION'] },
      { key: 'defect',       label: 'Defect',        color: 'amber',  matchCodes: ['NEW_MAINTENANCE', 'DEFECT', 'NEW_DEFECT'] },
      { key: 'new_ready',    label: 'Ready',         color: 'emerald',matchCodes: ['AVAILABLE_NEW', 'NEW_READY', 'NEW_AVAILABLE'] },
    ]
  },
  {
    key: 'used_car',
    label: 'รถใช้แล้ว',
    color: 'indigo',
    matchCodes: [],
    children: [
      { key: 'recondition',  label: 'Recondition',   color: 'indigo', matchCodes: ['USE_MAINTENANCE', 'RECONDITION', 'USED_MAINTENANCE'] },
      { key: 'used_ready',   label: 'Ready',         color: 'emerald',matchCodes: ['AVAILABLE_USE', 'USED_READY', 'USED_AVAILABLE'] },
    ]
  },
  {
    key: 'on_rent',
    label: 'ให้เช่า',
    color: 'violet',
    matchCodes: ['ON_RENT'],
    children: [
      { key: 'ev7',        label: 'EV7',        color: 'violet', matchCodes: ['ON_RENT_EV7', 'EV7'] },
      { key: 'lineman',    label: 'Lineman',    color: 'violet', matchCodes: ['ON_RENT_LINEMAN', 'LINEMAN'] },
      { key: 'grab',       label: 'Grab',       color: 'violet', matchCodes: ['ON_RENT_GRAB', 'GRAB'] },
      { key: 'fastwheel',  label: 'Fast Wheel', color: 'violet', matchCodes: ['ON_RENT_FASTWHEEL', 'FASTWHEEL', 'FAST_WHEEL'] },
      { key: 'aot',        label: 'AOT',        color: 'violet', matchCodes: ['ON_RENT_AOT', 'AOT'] },
    ]
  },
]

// Match items to a specific status code
function matchItem(status: string | undefined, statusType: string | undefined, codes: string[]): boolean {
  const s = (status || '').toUpperCase().trim()
  const t = (statusType || '').toUpperCase().trim()
  return codes.some(c => {
    const cu = c.toUpperCase()
    return s === cu || t === cu
  })
}

interface StatusHierarchyChartProps {
  items: {
    VehicleStatus?: string
    VehicleStatusType?: string
    StatusTypeName?: string
  }[]
}

// Color map for static tailwind classes
const colorMap: Record<string, { bg: string; border: string; text: string; headerBg: string }> = {
  sky:     { bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    text: 'text-sky-300',     headerBg: 'bg-sky-500/20' },
  indigo:  { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-300',  headerBg: 'bg-indigo-500/20' },
  violet:  { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-300',  headerBg: 'bg-violet-500/20' },
  emerald: { bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-300', headerBg: 'bg-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-300',  headerBg: 'bg-amber-500/20' },
  slate:   { bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  text: 'text-slate-400',  headerBg: 'bg-slate-500/20' },
}

export default function StatusHierarchyChart({ items }: StatusHierarchyChartProps) {
  // Calculate counts
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    let classified = 0

    for (const group of STATUS_TREE) {
      let groupTotal = 0

      // Count parent-level matches (e.g. ON_RENT with no sub-type)
      if (group.matchCodes.length > 0) {
        // Will count below after children
      }

      for (const child of group.children || []) {
        const count = items.filter(i => matchItem(i.VehicleStatus, i.VehicleStatusType, child.matchCodes)).length
        result[child.key] = count
        groupTotal += count
        classified += count
      }

      // Parent-level catch: items matching parent codes but not any child
      if (group.matchCodes.length > 0) {
        const parentOnly = items.filter(i => {
          if (!matchItem(i.VehicleStatus, i.VehicleStatusType, group.matchCodes)) return false
          // Exclude already matched children
          for (const child of group.children || []) {
            if (matchItem(i.VehicleStatus, i.VehicleStatusType, child.matchCodes)) return false
          }
          return true
        }).length
        result[`${group.key}_other`] = parentOnly
        groupTotal += parentOnly
        classified += parentOnly
      }

      result[group.key] = groupTotal
    }

    result['unclassified'] = items.length - classified
    result['total'] = items.length

    return result
  }, [items])

  return (
    <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">🏗️ สถานะรถแยกตามประเภท</span>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
          ทั้งหมด {counts.total} คัน
        </span>
      </div>

      {/* Tree Chart */}
      <div className="flex flex-col items-center gap-0">
        {/* Root */}
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Car Status</div>
          <div className="text-base font-black text-slate-100">{counts.total}</div>
        </div>

        {/* Connector line down */}
        <div className="w-px h-4 bg-slate-600/50" />

        {/* Horizontal connector */}
        <div className="relative w-full flex justify-center">
          <div className="absolute top-0 h-px bg-slate-600/50" style={{ left: '16.66%', right: '16.66%' }} />
        </div>

        {/* Level 1: Groups */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {STATUS_TREE.map(group => {
            const c = colorMap[group.color] || colorMap.slate
            const groupCount = counts[group.key] || 0
            const otherCount = counts[`${group.key}_other`] || 0

            return (
              <div key={group.key} className="flex flex-col items-center gap-0">
                {/* Connector up */}
                <div className="w-px h-3 bg-slate-600/50" />
                
                {/* Group header */}
                <div className={`${c.headerBg} ${c.border} border rounded-xl px-2 py-1.5 text-center w-full`}>
                  <div className={`text-[9px] font-bold ${c.text} uppercase`}>{group.label}</div>
                  <div className={`text-lg font-black ${c.text}`}>{groupCount}</div>
                </div>

                {/* Connector down */}
                <div className="w-px h-3 bg-slate-600/50" />

                {/* Sub-status horizontal line */}
                {(group.children || []).length > 1 && (
                  <div className="relative w-full">
                    <div className="absolute top-0 left-2 right-2 h-px bg-slate-600/40" />
                  </div>
                )}

                {/* Level 2: Sub-statuses */}
                <div className="flex flex-wrap justify-center gap-1 w-full">
                  {(group.children || []).map(child => {
                    const cc = colorMap[child.color] || colorMap.slate
                    const childCount = counts[child.key] || 0
                    return (
                      <div key={child.key} className="flex flex-col items-center">
                        <div className="w-px h-2 bg-slate-600/40" />
                        <div className={`${cc.bg} ${cc.border} border rounded-lg px-1.5 py-1 text-center min-w-[50px]`}>
                          <div className={`text-[8px] font-bold ${cc.text} leading-tight`}>{child.label}</div>
                          <div className={`text-xs font-black ${cc.text}`}>{childCount}</div>
                        </div>
                      </div>
                    )
                  })}
                  {otherCount > 0 && (
                    <div className="flex flex-col items-center">
                      <div className="w-px h-2 bg-slate-600/40" />
                      <div className={`${c.bg} ${c.border} border rounded-lg px-1.5 py-1 text-center min-w-[50px]`}>
                        <div className={`text-[8px] font-bold ${c.text} leading-tight`}>อื่นๆ</div>
                        <div className={`text-xs font-black ${c.text}`}>{otherCount}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Unclassified */}
        {counts.unclassified > 0 && (
          <div className="mt-3 w-full">
            <div className="bg-slate-700/20 border border-slate-700/30 rounded-lg px-3 py-1.5 text-center">
              <span className="text-[9px] font-bold text-slate-500">ไม่ระบุสถานะ </span>
              <span className="text-sm font-black text-slate-400">{counts.unclassified}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
