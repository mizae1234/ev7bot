'use client'

import React, { useMemo, useState } from 'react'

interface VehicleItem {
  VinNo: string
  RegisterNo?: string
  VehicleStatus?: string
  VehicleStatusType?: string
  ProjectType?: string
  StatusTypeName?: string
  TopGroup: string
  SubGroup: string
  LeafNode?: string
  ReplacementReadyDetails?: string
  LatestCarStatusCode?: string
}

interface PortfolioStatusTreeProps {
  items: VehicleItem[]
}

// Color styles map
const THEMES = {
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    text: 'text-emerald-700 dark:text-emerald-300',
    headerBg: 'bg-emerald-100/80 dark:bg-emerald-900/40',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20'
  },
  sky: {
    bg: 'bg-sky-50 dark:bg-sky-950/30',
    border: 'border-sky-200 dark:border-sky-800/50',
    text: 'text-sky-700 dark:text-sky-300',
    headerBg: 'bg-sky-100/80 dark:bg-sky-900/40',
    badge: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/20'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800/50',
    text: 'text-purple-700 dark:text-purple-300',
    headerBg: 'bg-purple-100/80 dark:bg-purple-900/40',
    badge: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border border-purple-500/20'
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    text: 'text-amber-700 dark:text-amber-300',
    headerBg: 'bg-amber-100/80 dark:bg-amber-900/40',
    badge: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20'
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-950/30',
    border: 'border-rose-200 dark:border-rose-800/50',
    text: 'text-rose-700 dark:text-rose-300',
    headerBg: 'bg-rose-100/80 dark:bg-rose-900/40',
    badge: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/20'
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700/50',
    text: 'text-slate-700 dark:text-slate-300',
    headerBg: 'bg-slate-100 dark:bg-slate-700/50',
    badge: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 border border-slate-500/20'
  }
}

type ThemeKey = keyof typeof THEMES

export default function PortfolioStatusTree({ items }: PortfolioStatusTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'onrent-onroad': true,
    'available-used': true,
    'repl-ready': true,
    'maint-rent': false,
    'maint-pickup': false,
  })

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeKey]: !prev[nodeKey] }))
  }

  // Dynamically compute the tree data from items (No hardcoding)
  const treeData = useMemo(() => {
    // 1. On Rent
    const onRentItems = items.filter(i => i.TopGroup === 'ให้เช่า')
    const onRoadItems = onRentItems.filter(i => i.SubGroup === 'ปล่อยเช่า')
    const onMaintItems = onRentItems.filter(i => i.SubGroup === 'เข้าซ่อม')

    const roadByProject: Record<string, number> = {}
    onRoadItems.forEach(i => {
      const p = (i.ProjectType || 'อื่นๆ').trim()
      roadByProject[p] = (roadByProject[p] || 0) + 1
    })

    const maintByProject: Record<string, number> = {}
    onMaintItems.forEach(i => {
      const p = (i.ProjectType || 'อื่นๆ').trim()
      maintByProject[p] = (maintByProject[p] || 0) + 1
    })

    // 2. Available
    const availNewItems = items.filter(i => i.TopGroup === 'รถใหม่' && i.SubGroup === 'Ready')
    const availUsedItems = items.filter(i => i.TopGroup === 'รถใช้งานแล้ว' && i.SubGroup === 'Ready')
    const availUsedByProject: Record<string, number> = {}
    availUsedItems.forEach(i => {
      const p = (i.ProjectType || 'อื่นๆ').trim()
      availUsedByProject[p] = (availUsedByProject[p] || 0) + 1
    })

    // 3. Production & Pending
    const pendingItems = items.filter(i => i.TopGroup === 'รถใหม่' && i.SubGroup === 'Pending (รอเรียกรถลง)')
    const productionItems = items.filter(i => i.TopGroup === 'รถใหม่' && i.SubGroup === 'Production')
    const waitingGrItems = items.filter(i => i.TopGroup === 'อื่นๆ' && i.SubGroup === 'WAITING_FOR_GR')

    // 4. Replacement
    const replItems = items.filter(i => i.TopGroup === 'รถใช้งานแล้ว' && i.SubGroup === 'Replacement')
    const replMaintItems = replItems.filter(i => 
      i.LeafNode === 'เข้าซ่อม' || 
      i.VehicleStatus === 'MAINTENANCE' || 
      (i.VehicleStatusType && i.VehicleStatusType.includes('MAINTENANCE'))
    )
    const replCarItems = replItems.filter(i => 
      i.LeafNode === 'ถูกใช้งาน' && 
      i.VehicleStatus !== 'MAINTENANCE' && 
      !(i.VehicleStatusType && i.VehicleStatusType.includes('MAINTENANCE'))
    )
    const replReadyItems = replItems.filter(i => 
      i.LeafNode === 'Ready' && 
      i.VehicleStatus !== 'MAINTENANCE' && 
      !(i.VehicleStatusType && i.VehicleStatusType.includes('MAINTENANCE'))
    )

    const replReadyDetails: Record<string, number> = {}
    replReadyItems.forEach(i => {
      const d = (i.ReplacementReadyDetails || 'พร้อมใช้').trim()
      replReadyDetails[d] = (replReadyDetails[d] || 0) + 1
    })

    // 5. Maintenance (จำแนกแบบหน้า Dashboard ซ่อมบำรุง 5 หมวดหลัก)
    // 5.1 รถเช่าเข้าซ่อม (344) & 5.2 รถซ่อมเสร็จ รอลูกค้ามารับ (17)
    const onRentActiveMaintItems = onMaintItems.filter(i => i.LatestCarStatusCode !== 'READY_PICKUP_MAINTENANCE')
    const onRentReadyPickupItems = onMaintItems.filter(i => i.LatestCarStatusCode === 'READY_PICKUP_MAINTENANCE')

    const rentActiveByProject: Record<string, number> = {}
    onRentActiveMaintItems.forEach(i => {
      const p = (i.ProjectType || 'อื่นๆ').trim()
      rentActiveByProject[p] = (rentActiveByProject[p] || 0) + 1
    })

    const rentReadyPickupByProject: Record<string, number> = {}
    onRentReadyPickupItems.forEach(i => {
      const p = (i.ProjectType || 'อื่นๆ').trim()
      rentReadyPickupByProject[p] = (rentReadyPickupByProject[p] || 0) + 1
    })

    // 5.3 รถใช้แล้วเข้าซ่อม (143)
    const maintRecondItems = items.filter(i => i.TopGroup === 'รถใช้งานแล้ว' && i.SubGroup === 'Recondition/Maintenance')

    // 5.4 รถสำรองเข้าซ่อม (68)
    const maintReplCount = replMaintItems.length

    // 5.5 รถใหม่เข้าซ่อม (12)
    const maintNewDefectItems = items.filter(i => i.TopGroup === 'รถใหม่' && i.SubGroup === 'Defect')

    // Active on Road
    const activeRoadCount = onRoadItems.length + replCarItems.length

    return {
      totalVehicles: items.length,
      activeRoadCount,
      onRent: {
        total: onRentItems.length,
        onRoadCount: onRoadItems.length,
        roadProjects: Object.entries(roadByProject).sort((a, b) => b[1] - a[1]),
        onMaintCount: onMaintItems.length,
        maintProjects: Object.entries(maintByProject).sort((a, b) => b[1] - a[1]),
      },
      available: {
        total: availNewItems.length + availUsedItems.length,
        newCount: availNewItems.length,
        usedCount: availUsedItems.length,
        usedProjects: Object.entries(availUsedByProject).sort((a, b) => b[1] - a[1]),
      },
      production: {
        total: pendingItems.length + productionItems.length + waitingGrItems.length,
        pendingCount: pendingItems.length,
        productionCount: productionItems.length,
        waitingGrCount: waitingGrItems.length,
      },
      replacement: {
        total: replItems.length,
        carCount: replCarItems.length,
        readyCount: replReadyItems.length,
        readyDetails: Object.entries(replReadyDetails).sort((a, b) => b[1] - a[1]),
        maintCount: replMaintItems.length,
      },
      maintenance: {
        total: onRentActiveMaintItems.length + onRentReadyPickupItems.length + maintRecondItems.length + maintReplCount + maintNewDefectItems.length,
        newCount: maintNewDefectItems.length, // 🟡 รถใหม่เข้าซ่อม
        usedCount: maintRecondItems.length, // 🔴 รถใช้แล้วเข้าซ่อม
        rentActiveCount: onRentActiveMaintItems.length, // 🔵 รถเช่าเข้าซ่อม
        rentActiveProjects: Object.entries(rentActiveByProject).sort((a, b) => b[1] - a[1]),
        readyPickupCount: onRentReadyPickupItems.length, // 🟠 รถซ่อมเสร็จ รอลูกค้ามารับ
        readyPickupProjects: Object.entries(rentReadyPickupByProject).sort((a, b) => b[1] - a[1]),
        replCount: maintReplCount, // 🟣 รถสำรองเข้าซ่อม
      }
    }
  }, [items])

  if (!items || items.length === 0) return null

  return (
    <div className="bg-white/80 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl p-5 sm:p-6 shadow-sm backdrop-blur-md space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🌳</span> โครงสร้างสถานะรถตามมุมมองหลัก (Portfolio Status Tree)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            จำแนกสถานะรถทั้งพอร์ตโฟลิโอ 5 มุมมองหลัก (สัญญาเช่า, พร้อมใช้, ผลิต/รอลง, ทดแทน, ซ่อมบำรุง)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
            <span>🚗</span>
            <span>วิ่งบนถนนจริง:</span>
            <span className="font-black text-sm">{treeData.activeRoadCount.toLocaleString()}</span>
            <span className="font-normal text-[10px] text-zinc-500 dark:text-zinc-400">คัน (เช่า {treeData.onRent.onRoadCount} + รถแทน {treeData.replacement.carCount})</span>
          </div>

          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold">
            <span>รวมทั้งหมด:</span>
            <span className="font-black text-indigo-600 dark:text-indigo-400">{treeData.totalVehicles.toLocaleString()}</span>
            <span>คัน</span>
          </div>
        </div>
      </div>

      {/* Main Hierarchical Tree View */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[980px] flex flex-col items-center">
          {/* Root Node */}
          <div className="flex flex-col items-center">
            <div className="bg-gradient-to-r from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-zinc-300 text-white dark:text-zinc-900 rounded-2xl px-5 py-2.5 text-center shadow-md border border-zinc-700/30">
              <div className="text-[10px] font-semibold text-zinc-300 dark:text-zinc-600 uppercase tracking-wider">
                Fleet Portfolio
              </div>
              <div className="text-lg font-black tracking-tight">
                {treeData.totalVehicles.toLocaleString()} <span className="text-xs font-normal opacity-80">คัน</span>
              </div>
            </div>
            {/* Trunk connector */}
            <div className="w-0.5 h-5 bg-zinc-300 dark:bg-zinc-700" />
          </div>

          {/* Horizontal Top Level Bar */}
          <div className="relative w-full px-[10%]">
            <div className="h-0.5 bg-zinc-300 dark:bg-zinc-700 w-full" />
          </div>

          {/* 5 Main Pillars Grid */}
          <div className="grid grid-cols-5 gap-3 w-full pt-0">
            {/* 1. On Rent */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className={`w-full ${THEMES.emerald.bg} ${THEMES.emerald.border} border rounded-2xl p-3 text-center shadow-sm`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className={`text-xs font-extrabold ${THEMES.emerald.text}`}>On Rent (สัญญาเช่า)</span>
                </div>
                <div className={`text-xl font-black mt-1 ${THEMES.emerald.text}`}>
                  {treeData.onRent.total.toLocaleString()} <span className="text-xs font-normal">คัน</span>
                </div>
              </div>

              {/* Connector to children */}
              <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-700" />

              {/* Sub branches */}
              <div className="w-full space-y-2">
                {/* On Road */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs">
                  <div 
                    onClick={() => toggleNode('onrent-onroad')}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                  >
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1">
                      <span>• ปล่อยเช่า (On Road)</span>
                      <span className="text-[9px] text-zinc-400">{expandedNodes['onrent-onroad'] ? '▾' : '▸'}</span>
                    </span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {treeData.onRent.onRoadCount.toLocaleString()}
                    </span>
                  </div>

                  {expandedNodes['onrent-onroad'] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 space-y-1">
                      {treeData.onRent.roadProjects.map(([proj, count]) => (
                        <div key={proj} className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                          <span className="truncate pr-1">{proj}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* On Rent Maint */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs">
                  <div 
                    onClick={() => toggleNode('onrent-maint')}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                  >
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1">
                      <span>• เข้าซ่อม (เช่าติดซ่อม)</span>
                      <span className="text-[9px] text-zinc-400">{expandedNodes['onrent-maint'] ? '▾' : '▸'}</span>
                    </span>
                    <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                      {treeData.onRent.onMaintCount.toLocaleString()}
                    </span>
                  </div>

                  {expandedNodes['onrent-maint'] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 space-y-1">
                      {treeData.onRent.maintProjects.map(([proj, count]) => (
                        <div key={proj} className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                          <span className="truncate pr-1">{proj}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Available */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className={`w-full ${THEMES.sky.bg} ${THEMES.sky.border} border rounded-2xl p-3 text-center shadow-sm`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span className={`text-xs font-extrabold ${THEMES.sky.text}`}>Available (พร้อมใช้)</span>
                </div>
                <div className={`text-xl font-black mt-1 ${THEMES.sky.text}`}>
                  {treeData.available.total.toLocaleString()} <span className="text-xs font-normal">คัน</span>
                </div>
              </div>

              {/* Connector */}
              <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-700" />

              {/* Sub branches */}
              <div className="w-full space-y-2">
                {/* รถใหม่ */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">• รถใหม่ พร้อมใช้</span>
                  <span className="text-xs font-black text-sky-600 dark:text-sky-400">
                    {treeData.available.newCount.toLocaleString()}
                  </span>
                </div>

                {/* รถมือสอง */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs">
                  <div 
                    onClick={() => toggleNode('available-used')}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                  >
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1">
                      <span>• มือสอง พร้อมใช้</span>
                      <span className="text-[9px] text-zinc-400">{expandedNodes['available-used'] ? '▾' : '▸'}</span>
                    </span>
                    <span className="text-xs font-black text-sky-600 dark:text-sky-400">
                      {treeData.available.usedCount.toLocaleString()}
                    </span>
                  </div>

                  {expandedNodes['available-used'] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 space-y-1">
                      {treeData.available.usedProjects.map(([proj, count]) => (
                        <div key={proj} className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                          <span className="truncate pr-1">{proj}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Production & Pending */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className={`w-full ${THEMES.purple.bg} ${THEMES.purple.border} border rounded-2xl p-3 text-center shadow-sm`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  <span className={`text-xs font-extrabold ${THEMES.purple.text}`}>Production & Pending</span>
                </div>
                <div className={`text-xl font-black mt-1 ${THEMES.purple.text}`}>
                  {treeData.production.total.toLocaleString()} <span className="text-xs font-normal">คัน</span>
                </div>
              </div>

              {/* Connector */}
              <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-700" />

              {/* Sub branches */}
              <div className="w-full space-y-2">
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">• รอเรียกรถลง (Pending)</span>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                    {treeData.production.pendingCount.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">• กำลังผลิต (Production)</span>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                    {treeData.production.productionCount.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">• รอรับมอบ (Waiting GR)</span>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                    {treeData.production.waitingGrCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Replacement */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className={`w-full ${THEMES.amber.bg} ${THEMES.amber.border} border rounded-2xl p-3 text-center shadow-sm`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className={`text-xs font-extrabold ${THEMES.amber.text}`}>Replacement (ทดแทน)</span>
                </div>
                <div className={`text-xl font-black mt-1 ${THEMES.amber.text}`}>
                  {treeData.replacement.total.toLocaleString()} <span className="text-xs font-normal">คัน</span>
                </div>
              </div>

              {/* Connector */}
              <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-700" />

              {/* Sub branches */}
              <div className="w-full space-y-2">
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">• ถูกใช้งาน</span>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    {treeData.replacement.carCount.toLocaleString()}
                  </span>
                </div>

                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs">
                  <div 
                    onClick={() => toggleNode('repl-ready')}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                  >
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1">
                      <span>• พร้อม/จอง (Ready)</span>
                      <span className="text-[9px] text-zinc-400">{expandedNodes['repl-ready'] ? '▾' : '▸'}</span>
                    </span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      {treeData.replacement.readyCount.toLocaleString()}
                    </span>
                  </div>

                  {expandedNodes['repl-ready'] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 space-y-1">
                      {treeData.replacement.readyDetails.map(([detail, count]) => (
                        <div key={detail} className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                          <span className="truncate pr-1">{detail}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">• เข้าซ่อม</span>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                    {treeData.replacement.maintCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Maintenance */}
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700" />
              <div className={`w-full ${THEMES.rose.bg} ${THEMES.rose.border} border rounded-2xl p-3 text-center shadow-sm`}>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className={`text-xs font-extrabold ${THEMES.rose.text}`}>Maintenance (ซ่อมบำรุง)</span>
                </div>
                <div className={`text-xl font-black mt-1 ${THEMES.rose.text}`}>
                  {treeData.maintenance.total.toLocaleString()} <span className="text-xs font-normal">คัน</span>
                </div>
              </div>

              {/* Connector */}
              <div className="w-0.5 h-3 bg-zinc-300 dark:bg-zinc-700" />

              {/* Sub branches (แยก 5 กลุ่มตามหน้าซ่อมบำรุง) */}
              <div className="w-full space-y-2">
                {/* 1. รถใหม่เข้าซ่อม */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🟡</span>
                    <span>รถใหม่เข้าซ่อม</span>
                  </span>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                    {treeData.maintenance.newCount.toLocaleString()}
                  </span>
                </div>

                {/* 2. รถใช้แล้วเข้าซ่อม */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🔴</span>
                    <span>รถใช้แล้วเข้าซ่อม</span>
                  </span>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                    {treeData.maintenance.usedCount.toLocaleString()}
                  </span>
                </div>

                {/* 3. รถเช่าเข้าซ่อม */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs">
                  <div 
                    onClick={() => toggleNode('maint-rent')}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                  >
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                      <span>🔵</span>
                      <span>รถเช่าเข้าซ่อม</span>
                      <span className="text-[9px] text-zinc-400">{expandedNodes['maint-rent'] ? '▾' : '▸'}</span>
                    </span>
                    <span className="text-xs font-black text-indigo-650 dark:text-indigo-400">
                      {treeData.maintenance.rentActiveCount.toLocaleString()}
                    </span>
                  </div>

                  {expandedNodes['maint-rent'] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 space-y-1">
                      {treeData.maintenance.rentActiveProjects.map(([proj, count]) => (
                        <div key={proj} className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                          <span className="truncate pr-1">{proj}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. รถซ่อมเสร็จ รอลูกค้ามารับ */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs">
                  <div 
                    onClick={() => toggleNode('maint-pickup')}
                    className="flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                  >
                    <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                      <span>🟠</span>
                      <span>รถซ่อมเสร็จ รอลูกค้ามารับ</span>
                      <span className="text-[9px] text-zinc-400">{expandedNodes['maint-pickup'] ? '▾' : '▸'}</span>
                    </span>
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400">
                      {treeData.maintenance.readyPickupCount.toLocaleString()}
                    </span>
                  </div>

                  {expandedNodes['maint-pickup'] && (
                    <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50 space-y-1">
                      {treeData.maintenance.readyPickupProjects.map(([proj, count]) => (
                        <div key={proj} className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 px-1">
                          <span className="truncate pr-1">{proj}</span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 shrink-0">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. รถสำรองเข้าซ่อม */}
                <div className="bg-white/90 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-2.5 shadow-xs flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🟣</span>
                    <span>รถสำรองเข้าซ่อม</span>
                  </span>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                    {treeData.maintenance.replCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
