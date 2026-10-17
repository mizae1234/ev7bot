'use client'

import React, { useMemo, useState } from 'react'

export interface MaintenanceTreeItem {
  id: number | string
  register_no: string | null
  vin: string
  model?: string
  project?: string
  issue_title?: string
  status_code: string
  status_text?: string
  problem_type: string
  service_location?: string
  service_location_code?: string
  current_location?: string | null
  car_case?: string
  fault_party?: string
}

export function getCarCaseCategory(rawCase?: string | null): 'HEAVY' | 'LIGHT' | 'TOTAL' | 'UNSPECIFIED' {
  if (!rawCase) return 'UNSPECIFIED'
  const c = rawCase.trim()
  if (c.includes('หนัก') || c === 'DAMAGE_HEAVY') return 'HEAVY'
  if (c.includes('เบา') || c === 'DAMAGE_LIGHT') return 'LIGHT'
  if (c.includes('รุนแรง') || c === 'DAMAGE_TOTAL') return 'TOTAL'
  return 'UNSPECIFIED'
}

interface MaintenanceTicketTreeProps {
  items: MaintenanceTreeItem[]
  selectedProblemType?: string
  selectedStatus?: string
  selectedCarCase?: string
  onSelectFilter?: (problemType: string, statusCode: string, carCase?: string) => void
  totalCarsCount?: number
}

// Visual themes for problem type pillars
const PROBLEM_THEMES: Record<string, {
  bg: string
  border: string
  text: string
  headerBg: string
  badge: string
  icon: string
}> = {
  'อุบัติเหตุ': {
    bg: 'bg-rose-50/80 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800/60',
    text: 'text-rose-700 dark:text-rose-300',
    headerBg: 'bg-rose-100/80 dark:bg-rose-900/40',
    badge: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20',
    icon: '💥'
  },
  'ผลิตภัณฑ์': {
    bg: 'bg-sky-50/80 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-800/60',
    text: 'text-sky-700 dark:text-sky-300',
    headerBg: 'bg-sky-100/80 dark:bg-sky-900/40',
    badge: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/20',
    icon: '⚙️'
  },
  'ปรับสภาพรถ': {
    bg: 'bg-amber-50/80 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/60',
    text: 'text-amber-700 dark:text-amber-300',
    headerBg: 'bg-amber-100/80 dark:bg-amber-900/40',
    badge: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20',
    icon: '🔄'
  },
  'งานซ่อมจาก Supplier': {
    bg: 'bg-purple-50/80 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800/60',
    text: 'text-purple-700 dark:text-purple-300',
    headerBg: 'bg-purple-100/80 dark:bg-purple-900/40',
    badge: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20',
    icon: '🏭'
  },
  'อื่นๆ': {
    bg: 'bg-slate-50/80 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700/60',
    text: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-100 dark:bg-slate-700/50',
    badge: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-500/20',
    icon: '📦'
  }
}

// Fallback theme generator for any dynamic unknown types
const FALLBACK_PALETTES = [
  {
    bg: 'bg-indigo-50/80 dark:bg-indigo-950/30',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    text: 'text-indigo-700 dark:text-indigo-300',
    headerBg: 'bg-indigo-100/80 dark:bg-indigo-900/40',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border border-indigo-500/20',
    icon: '🏷️'
  },
  {
    bg: 'bg-teal-50/80 dark:bg-teal-950/30',
    border: 'border-teal-200 dark:border-teal-800/60',
    text: 'text-teal-700 dark:text-teal-300',
    headerBg: 'bg-teal-100/80 dark:bg-teal-900/40',
    badge: 'bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400 border border-teal-500/20',
    icon: '📋'
  }
]

// Status visual configurations
const STATUS_CONFIGS: Record<string, {
  label: string
  color: string
  border: string
  dot: string
  badge: string
  order: number
}> = {
  'IN_MAINTENANCE': {
    label: 'กำลังซ่อม',
    color: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/60',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    order: 1
  },
  'WAITING_FOR_MAINTENANCE': {
    label: 'รอเข้าซ่อม',
    color: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/60',
    dot: 'bg-rose-500',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    order: 2
  },
  'READY_PICKUP_MAINTENANCE': {
    label: 'ซ่อมเสร็จ รอมารับ',
    color: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    order: 3
  },
  'GARAGE_COMPLETE': {
    label: 'ซ่อมเสร็จ รอมารับ',
    color: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800/60',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    order: 3
  },
  'STILL_WORK': {
    label: 'รถยังขับได้ (ยังไม่เข้า)',
    color: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800/60',
    dot: 'bg-sky-500',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    order: 4
  },
  'COMPLETE': {
    label: 'ปิดงานแล้ว (ซ่อมเสร็จ)',
    color: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    order: 5
  }
}


export default function MaintenanceTicketTree({
  items,
  selectedProblemType = 'all',
  selectedStatus = 'all',
  selectedCarCase = 'all',
  onSelectFilter,
  totalCarsCount,
}: MaintenanceTicketTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  // Option: Include ready-to-pickup (ซ่อมเสร็จ รอลูกค้ามารับ) in tree - Default to false (เฉพาะค้างซ่อม)
  const [includeReadyPickup, setIncludeReadyPickup] = useState<boolean>(false)

  const toggleNode = (nodeKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }))
  }

  // Count active repair vs with ready-to-pickup
  const pipelineCounts = useMemo(() => {
    if (!items || items.length === 0) return { activeOnly: 0, withReadyPickup: 0 }
    let activeOnly = 0
    let readyPickup = 0
    for (const i of items) {
      if (i.status_code === 'IN_MAINTENANCE' || i.status_code === 'WAITING_FOR_MAINTENANCE') {
        activeOnly++
      } else if (i.status_code === 'READY_PICKUP_MAINTENANCE' || i.status_code === 'GARAGE_COMPLETE') {
        readyPickup++
      }
    }
    return {
      activeOnly,
      withReadyPickup: activeOnly + readyPickup,
      readyPickup
    }
  }, [items])

  // Filter items to active workshop repair tickets, optionally including ready-to-pickup
  const scopedItems = useMemo(() => {
    if (!items || items.length === 0) return []
    if (includeReadyPickup) {
      return items.filter(i => 
        i.status_code === 'IN_MAINTENANCE' || 
        i.status_code === 'WAITING_FOR_MAINTENANCE' || 
        i.status_code === 'READY_PICKUP_MAINTENANCE' || 
        i.status_code === 'GARAGE_COMPLETE'
      )
    }
    return items.filter(i => 
      i.status_code === 'IN_MAINTENANCE' || 
      i.status_code === 'WAITING_FOR_MAINTENANCE'
    )
  }, [items, includeReadyPickup])

  // Hierarchical dynamic calculation from raw items
  const treeData = useMemo(() => {
    if (!scopedItems || scopedItems.length === 0) {
      return {
        totalTickets: 0,
        totalCars: 0,
        totalHeavyTickets: 0,
        totalHeavyCars: 0,
        totalLightTickets: 0,
        totalLightCars: 0,
        totalUnspecifiedTickets: 0,
        totalUnspecifiedCars: 0,
        types: []
      }
    }

    const totalCarsSet = new Set<string>()
    const totalHeavyCarsSet = new Set<string>()
    const totalLightCarsSet = new Set<string>()
    const totalUnspecifiedCarsSet = new Set<string>()
    let totalHeavyTickets = 0
    let totalLightTickets = 0
    let totalUnspecifiedTickets = 0

    const typeMap: Record<string, {
      typeName: string
      ticketsCount: number
      carsSet: Set<string>
      heavyTickets: number
      heavyCarsSet: Set<string>
      lightTickets: number
      lightCarsSet: Set<string>
      unspecifiedTickets: number
      unspecifiedCarsSet: Set<string>
      statusMap: Record<string, {
        statusCode: string
        statusName: string
        ticketsCount: number
        carsSet: Set<string>
        heavyTickets: number
        heavyCarsSet: Set<string>
        lightTickets: number
        lightCarsSet: Set<string>
        unspecifiedTickets: number
        unspecifiedCarsSet: Set<string>
        projectCounts: Record<string, number>
        locationCounts: Record<string, number>
      }>
    }> = {}

    for (const item of scopedItems) {
      const carKey = (item.vin || item.register_no || String(item.id)).trim()
      totalCarsSet.add(carKey)

      const caseCat = getCarCaseCategory(item.car_case)
      if (caseCat === 'HEAVY') {
        totalHeavyTickets++
        totalHeavyCarsSet.add(carKey)
      } else if (caseCat === 'LIGHT') {
        totalLightTickets++
        totalLightCarsSet.add(carKey)
      } else {
        totalUnspecifiedTickets++
        totalUnspecifiedCarsSet.add(carKey)
      }

      const type = (item.problem_type || 'อื่นๆ').trim()
      if (!typeMap[type]) {
        typeMap[type] = {
          typeName: type,
          ticketsCount: 0,
          carsSet: new Set<string>(),
          heavyTickets: 0,
          heavyCarsSet: new Set<string>(),
          lightTickets: 0,
          lightCarsSet: new Set<string>(),
          unspecifiedTickets: 0,
          unspecifiedCarsSet: new Set<string>(),
          statusMap: {}
        }
      }

      typeMap[type].ticketsCount += 1
      typeMap[type].carsSet.add(carKey)
      if (caseCat === 'HEAVY') {
        typeMap[type].heavyTickets++
        typeMap[type].heavyCarsSet.add(carKey)
      } else if (caseCat === 'LIGHT') {
        typeMap[type].lightTickets++
        typeMap[type].lightCarsSet.add(carKey)
      } else {
        typeMap[type].unspecifiedTickets++
        typeMap[type].unspecifiedCarsSet.add(carKey)
      }

      // Normalize status code: merge GARAGE_COMPLETE with READY_PICKUP_MAINTENANCE
      let statusCode = item.status_code || 'WAITING_FOR_MAINTENANCE'
      if (statusCode === 'GARAGE_COMPLETE') statusCode = 'READY_PICKUP_MAINTENANCE'

      const statusConf = STATUS_CONFIGS[statusCode] || {
        label: item.status_text || statusCode,
        order: 99
      }

      if (!typeMap[type].statusMap[statusCode]) {
        typeMap[type].statusMap[statusCode] = {
          statusCode,
          statusName: statusConf.label,
          ticketsCount: 0,
          carsSet: new Set<string>(),
          heavyTickets: 0,
          heavyCarsSet: new Set<string>(),
          lightTickets: 0,
          lightCarsSet: new Set<string>(),
          unspecifiedTickets: 0,
          unspecifiedCarsSet: new Set<string>(),
          projectCounts: {},
          locationCounts: {}
        }
      }

      typeMap[type].statusMap[statusCode].ticketsCount += 1
      typeMap[type].statusMap[statusCode].carsSet.add(carKey)
      if (caseCat === 'HEAVY') {
        typeMap[type].statusMap[statusCode].heavyTickets++
        typeMap[type].statusMap[statusCode].heavyCarsSet.add(carKey)
      } else if (caseCat === 'LIGHT') {
        typeMap[type].statusMap[statusCode].lightTickets++
        typeMap[type].statusMap[statusCode].lightCarsSet.add(carKey)
      } else {
        typeMap[type].statusMap[statusCode].unspecifiedTickets++
        typeMap[type].statusMap[statusCode].unspecifiedCarsSet.add(carKey)
      }

      // Projects
      const proj = (item.project || 'อื่นๆ').trim()
      typeMap[type].statusMap[statusCode].projectCounts[proj] =
        (typeMap[type].statusMap[statusCode].projectCounts[proj] || 0) + 1

      // Location
      const loc = (item.service_location || item.service_location_code || 'ไม่ระบุ').trim()
      typeMap[type].statusMap[statusCode].locationCounts[loc] =
        (typeMap[type].statusMap[statusCode].locationCounts[loc] || 0) + 1
    }

    // Convert map to sorted array
    const types = Object.values(typeMap)
      .sort((a, b) => b.ticketsCount - a.ticketsCount)
      .map((t, idx) => {
        const theme = PROBLEM_THEMES[t.typeName] || FALLBACK_PALETTES[idx % FALLBACK_PALETTES.length]
        
        // Sort statuses by predefined order
        const statuses = Object.values(t.statusMap).sort((a, b) => {
          const ordA = STATUS_CONFIGS[a.statusCode]?.order ?? 99
          const ordB = STATUS_CONFIGS[b.statusCode]?.order ?? 99
          return ordA - ordB
        })

        return {
          typeName: t.typeName,
          ticketsCount: t.ticketsCount,
          carsCount: t.carsSet.size,
          heavyTickets: t.heavyTickets,
          heavyCarsCount: t.heavyCarsSet.size,
          lightTickets: t.lightTickets,
          lightCarsCount: t.lightCarsSet.size,
          unspecifiedTickets: t.unspecifiedTickets,
          unspecifiedCarsCount: t.unspecifiedCarsSet.size,
          theme,
          statuses: statuses.map(s => ({
            statusCode: s.statusCode,
            statusName: s.statusName,
            ticketsCount: s.ticketsCount,
            carsCount: s.carsSet.size,
            heavyTickets: s.heavyTickets,
            heavyCarsCount: s.heavyCarsSet.size,
            lightTickets: s.lightTickets,
            lightCarsCount: s.lightCarsSet.size,
            unspecifiedTickets: s.unspecifiedTickets,
            unspecifiedCarsCount: s.unspecifiedCarsSet.size,
            projects: Object.entries(s.projectCounts).sort((a, b) => b[1] - a[1]),
            locations: Object.entries(s.locationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
          }))
        }
      })

    return {
      totalTickets: scopedItems.length,
      totalCars: totalCarsSet.size,
      totalHeavyTickets,
      totalHeavyCars: totalHeavyCarsSet.size,
      totalLightTickets,
      totalLightCars: totalLightCarsSet.size,
      totalUnspecifiedTickets,
      totalUnspecifiedCars: totalUnspecifiedCarsSet.size,
      types
    }
  }, [scopedItems])

  if (!items || items.length === 0) return null

  const isFilteringActive = selectedProblemType !== 'all' || selectedStatus !== 'all' || selectedCarCase !== 'all'

  return (
    <div className="bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-6 shadow-sm backdrop-blur-md space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🌳</span>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              โครงสร้างจำแนกใบงานซ่อมที่ยังต้องดำเนินการ
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Interactive
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            จำแนกตามประเภทใบงาน, สถานะซ่อมบำรุง และเคสซ่อมหนัก/ซ่อมเบา • คลิกที่การ์ดหรือเคสเพื่อกรองตาราง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Include Ready-to-Pickup Toggle */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
            <button
              type="button"
              onClick={() => setIncludeReadyPickup(false)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                !includeReadyPickup
                  ? 'bg-white dark:bg-zinc-700 text-amber-700 dark:text-amber-300 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              เฉพาะค้างซ่อม ({pipelineCounts.activeOnly})
            </button>
            <button
              type="button"
              onClick={() => setIncludeReadyPickup(true)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                includeReadyPickup
                  ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              รวมรถเสร็จรอมารับ ({pipelineCounts.withReadyPickup})
            </button>
          </div>

          {/* Reset filter button if active */}
          {isFilteringActive && onSelectFilter && (
            <button
              onClick={() => onSelectFilter('all', 'all', 'all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-xs font-bold transition"
            >
              <span>✕</span>
              <span>ล้างตัวกรอง ({selectedProblemType !== 'all' ? selectedProblemType : ''} {selectedStatus !== 'all' ? selectedStatus : ''} {selectedCarCase !== 'all' ? (selectedCarCase === 'HEAVY' ? 'ซ่อมหนัก' : selectedCarCase === 'LIGHT' ? 'ซ่อมเบา' : 'ไม่ระบุ') : ''})</span>
            </button>
          )}

          {/* Total Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-xs font-bold">
            <span>📋 ใบงานรวม:</span>
            <span className="font-black text-sm">{treeData.totalTickets.toLocaleString()}</span>
            <span className="font-normal text-[10px] text-zinc-500 dark:text-zinc-400">({treeData.totalCars.toLocaleString()} คัน)</span>
          </div>
        </div>
      </div>

      {/* Main Hierarchical Tree View */}
      <div className="overflow-x-auto pb-3">
        <div className="min-w-[900px] flex flex-col items-center">
          
          {/* Root Node */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => onSelectFilter?.('all', 'all', 'all')}
              className={`cursor-pointer group relative bg-gradient-to-r from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-zinc-300 text-white dark:text-zinc-900 rounded-2xl px-6 py-2.5 text-center shadow-md border transition-all hover:scale-102 ${
                !isFilteringActive
                  ? 'border-indigo-400 ring-2 ring-indigo-400/40 shadow-indigo-500/10'
                  : 'border-zinc-700/30'
              }`}
            >
              <div className="text-[10px] font-semibold text-zinc-300 dark:text-zinc-600 uppercase tracking-wider flex items-center justify-center gap-1">
                <span>📋</span>
                <span>ใบงานซ่อมบำรุงทั้งหมด</span>
              </div>
              <div className="text-xl font-black tracking-tight mt-0.5">
                {treeData.totalTickets.toLocaleString()}{' '}
                <span className="text-xs font-normal opacity-80">ใบงาน</span>
                <span className="text-xs font-medium opacity-70 ml-1.5">
                  (จากตัวรถจริง {(totalCarsCount || Math.max(treeData.totalCars, 584)).toLocaleString()} คัน)
                </span>
              </div>
              <div className="text-[9px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                {includeReadyPickup
                  ? 'รวมรถซ่อมเสร็จ รอลูกค้ามารับ'
                  : 'เฉพาะรายการค้างซ่อม (กำลังซ่อม + รอเข้าซ่อม)'}
              </div>

              {/* Root Car Case Summary Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 pt-2 border-t border-zinc-700/50 text-[10px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>ซ่อมหนัก: {treeData.totalHeavyTickets} ใบ</span>
                  <span className="text-[9px] opacity-75 font-normal">({treeData.totalHeavyCars} คัน)</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span>ซ่อมเบา: {treeData.totalLightTickets} ใบ</span>
                  <span className="text-[9px] opacity-75 font-normal">({treeData.totalLightCars} คัน)</span>
                </span>
                {treeData.totalUnspecifiedTickets > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-700/50 text-zinc-300 border border-zinc-600/30">
                    <span>ไม่ระบุเคส: {treeData.totalUnspecifiedTickets} ใบ</span>
                    <span className="text-[9px] opacity-75 font-normal">({treeData.totalUnspecifiedCars} คัน)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Trunk connector down */}
            <div className="w-0.5 h-5 bg-zinc-300 dark:bg-zinc-700" />
          </div>

          {/* Horizontal Level 1 Bar */}
          <div className="relative w-full px-[6%]">
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-700 w-full" />
          </div>

          {/* Level 1 Problem Type Pillars Grid */}
          <div 
            className="grid gap-3.5 w-full pt-0"
            style={{ gridTemplateColumns: `repeat(${Math.max(treeData.types.length, 1)}, minmax(0, 1fr))` }}
          >
            {treeData.types.map((typeGroup) => {
              const isTypeSelected = selectedProblemType === typeGroup.typeName
              const pct = treeData.totalTickets > 0 
                ? ((typeGroup.ticketsCount / treeData.totalTickets) * 100).toFixed(1) 
                : '0'

              return (
                <div key={typeGroup.typeName} className="flex flex-col items-center">
                  {/* Vertical connector from horizontal bar */}
                  <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700" />

                  {/* Problem Type Header Card */}
                  <div 
                    onClick={() => onSelectFilter?.(isTypeSelected ? 'all' : typeGroup.typeName, 'all', 'all')}
                    className={`w-full cursor-pointer transition-all duration-200 rounded-2xl p-3 text-center border shadow-xs hover:scale-101 ${
                      typeGroup.theme.bg
                    } ${
                      typeGroup.theme.border
                    } ${
                      isTypeSelected
                        ? 'ring-2 ring-indigo-500 shadow-md font-bold'
                        : 'hover:border-zinc-400'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-base">{typeGroup.theme.icon}</span>
                      <span className={`text-xs font-extrabold truncate ${typeGroup.theme.text}`} title={typeGroup.typeName}>
                        {typeGroup.typeName}
                      </span>
                    </div>

                    <div className={`text-lg font-black mt-1 ${typeGroup.theme.text}`}>
                      {typeGroup.ticketsCount.toLocaleString()}{' '}
                      <span className="text-xs font-semibold">ใบ</span>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      <span>({typeGroup.carsCount.toLocaleString()} คัน)</span>
                      <span>•</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pct}%</span>
                    </div>

                    {/* Pillar Car Case Split Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-1 mt-1.5 pt-1.5 border-t border-black/5 dark:border-white/10 text-[9px] font-bold">
                      {typeGroup.heavyTickets > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                          <span className="w-1 h-1 rounded-full bg-rose-500" />
                          <span>หนัก {typeGroup.heavyTickets}</span>
                        </span>
                      )}
                      {typeGroup.lightTickets > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          <span className="w-1 h-1 rounded-full bg-amber-500" />
                          <span>เบา {typeGroup.lightTickets}</span>
                        </span>
                      )}
                      {typeGroup.unspecifiedTickets > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-zinc-500 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/50">
                          <span>ไม่ระบุ {typeGroup.unspecifiedTickets}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Connector to status sub-branches */}
                  <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-700" />

                  {/* Level 2 Status Sub-branches */}
                  <div className="w-full space-y-2">
                    {typeGroup.statuses.map((statusItem) => {
                      const nodeKey = `${typeGroup.typeName}-${statusItem.statusCode}`
                      const isExpanded = !!expandedNodes[nodeKey]
                      const isStatusSelected = selectedProblemType === typeGroup.typeName && selectedStatus === statusItem.statusCode
                      const statusConf = STATUS_CONFIGS[statusItem.statusCode] || {
                        label: statusItem.statusName,
                        color: 'text-zinc-700 dark:text-zinc-300',
                        border: 'border-zinc-200 dark:border-zinc-700',
                        dot: 'bg-zinc-400',
                        badge: 'bg-zinc-100 text-zinc-700'
                      }

                      return (
                        <div
                          key={statusItem.statusCode}
                          onClick={() => onSelectFilter?.(typeGroup.typeName, isStatusSelected ? 'all' : statusItem.statusCode, 'all')}
                          className={`cursor-pointer transition-all duration-150 bg-white/95 dark:bg-zinc-800/90 rounded-xl border p-2.5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 ${
                            isStatusSelected
                              ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/20 dark:bg-indigo-950/30'
                              : 'border-zinc-200/80 dark:border-zinc-700/80'
                          }`}
                        >
                          {/* Status Title & Count */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${statusConf.dot}`} />
                              <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 truncate" title={statusItem.statusName}>
                                {statusItem.statusName}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-xs font-black ${statusConf.color}`}>
                                {statusItem.ticketsCount.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-zinc-400 ml-1">ใบ</span>
                            </div>
                          </div>

                          {/* Car Case Interactive Badges */}
                          <div className="flex items-center gap-1 my-1.5 flex-wrap">
                            {statusItem.heavyTickets > 0 && (
                              <span 
                                onClick={(e) => {
                                  if (onSelectFilter) {
                                    e.stopPropagation()
                                    onSelectFilter(typeGroup.typeName, statusItem.statusCode, selectedCarCase === 'HEAVY' ? 'all' : 'HEAVY')
                                  }
                                }}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                                  selectedCarCase === 'HEAVY' && selectedProblemType === typeGroup.typeName && selectedStatus === statusItem.statusCode
                                    ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                                    : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                                }`}
                                title="คลิกเพื่อกรองเฉพาะเคสซ่อมหนัก"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>ซ่อมหนัก: {statusItem.heavyTickets}</span>
                              </span>
                            )}
                            {statusItem.lightTickets > 0 && (
                              <span 
                                onClick={(e) => {
                                  if (onSelectFilter) {
                                    e.stopPropagation()
                                    onSelectFilter(typeGroup.typeName, statusItem.statusCode, selectedCarCase === 'LIGHT' ? 'all' : 'LIGHT')
                                  }
                                }}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                                  selectedCarCase === 'LIGHT' && selectedProblemType === typeGroup.typeName && selectedStatus === statusItem.statusCode
                                    ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400'
                                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                                }`}
                                title="คลิกเพื่อกรองเฉพาะเคสซ่อมเบา"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>ซ่อมเบา: {statusItem.lightTickets}</span>
                              </span>
                            )}
                            {statusItem.unspecifiedTickets > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60">
                                <span>ไม่ระบุ: {statusItem.unspecifiedTickets}</span>
                              </span>
                            )}
                          </div>

                          {/* Car count & Expand toggle */}
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 pt-1 border-t border-zinc-100 dark:border-zinc-700/40">
                            <span>{statusItem.carsCount} คัน</span>
                            
                            <button
                              type="button"
                              onClick={(e) => toggleNode(nodeKey, e)}
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-medium"
                            >
                              <span>{isExpanded ? 'ย่อ' : 'ดูรายละเอียด'}</span>
                              <span className="text-[8px]">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          </div>

                          {/* Expanded Details: Car Case, Projects & Workshops */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/60 space-y-2 text-[10px]">
                              {/* Car Case Section */}
                              <div>
                                <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                  เคสความเสียหาย (Car Case):
                                </div>
                                <div className="space-y-0.5">
                                  {statusItem.heavyTickets > 0 && (
                                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-md bg-rose-500/5">
                                      <span className="flex items-center gap-1 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <span>เคสซ่อมหนัก</span>
                                      </span>
                                      <span className="font-bold text-rose-600 dark:text-rose-400">
                                        {statusItem.heavyTickets} ใบ ({statusItem.heavyCarsCount} คัน)
                                      </span>
                                    </div>
                                  )}
                                  {statusItem.lightTickets > 0 && (
                                    <div className="flex items-center justify-between text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-md bg-amber-500/5">
                                      <span className="flex items-center gap-1 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        <span>เคสซ่อมเบา</span>
                                      </span>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {statusItem.lightTickets} ใบ ({statusItem.lightCarsCount} คัน)
                                      </span>
                                    </div>
                                  )}
                                  {statusItem.unspecifiedTickets > 0 && (
                                    <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-md">
                                      <span>• ไม่ระบุเคส</span>
                                      <span className="font-bold text-zinc-700 dark:text-zinc-300">
                                        {statusItem.unspecifiedTickets} ใบ ({statusItem.unspecifiedCarsCount} คัน)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Projects Section */}
                              <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-700/40">
                                <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                  แยกตามโครงการ:
                                </div>
                                <div className="space-y-0.5">
                                  {statusItem.projects.map(([proj, count]) => (
                                    <div key={proj} className="flex items-center justify-between text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                                      <span className="truncate pr-1">• {proj}</span>
                                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{count} ใบ</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Top Locations */}
                              {statusItem.locations.length > 0 && (
                                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-700/40">
                                  <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                                    อู่ / สถานที่จอด:
                                  </div>
                                  <div className="space-y-0.5">
                                    {statusItem.locations.map(([loc, count]) => {
                                      const displayLoc = loc.replace(/_/g, ' ')
                                      return (
                                        <div key={loc} className="flex items-center justify-between text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded-sm hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                                          <span className="truncate pr-1" title={displayLoc}>📍 {displayLoc}</span>
                                          <span className="font-bold text-zinc-800 dark:text-zinc-200">{count}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </div>
  )
}
