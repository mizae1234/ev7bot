'use client'

import React, { useMemo, useState } from 'react'

/**
 * StatusHierarchyChart — แสดง Org Chart สถานะรถ
 * 
 * === โครงสร้างสถานะ ===
 * 
 * Car Status
 * ├── รถใหม่ (New)
 * │   ├── Production       → VehicleStatus = PRODUCTION / NEW_PRODUCTION
 * │   ├── Defect           → VehicleStatusType = NEW_MAINTENANCE
 * │   └── Ready            → VehicleStatusType = AVAILABLE_NEW
 * │
 * ├── รถใช้งานแล้ว (Used)
 * │   ├── Ready            → VehicleStatusType = AVAILABLE_USE
 * │   ├── Recondition/Repair → VehicleStatusType = USE_MAINTENANCE
 * │   └── Replacement      → VehicleStatus = REPLACEMENT
 * │       ├── Ready          → StatusType = REPLACEMENT_AVAILABLE / REPLACEMENT_RESERVE
 * │       ├── ถูกใช้งาน      → StatusType = REPLACEMENT_CAR
 * │       └── เข้าซ่อม       → StatusType = REPLACEMENT_MAINTENANCE
 * │
 * └── ให้เช่า (On Rent)    → VehicleStatus = ON_RENT
 *     └── [แยกตาม ProjectType จาก EV_InventoryItem — dynamic]
 */

interface StatusHierarchyChartProps {
  items: {
    VehicleStatus?: string
    VehicleStatusType?: string
    StatusTypeName?: string
    ProjectType?: string
  }[]
}

// --- Color map (light + dark theme) ---
const C = {
  sky:     { bg: 'bg-sky-50 dark:bg-sky-500/10',       border: 'border-sky-200 dark:border-sky-500/20',       text: 'text-sky-700 dark:text-sky-300',       header: 'bg-sky-100 dark:bg-sky-500/20' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-500/10',  border: 'border-indigo-200 dark:border-indigo-500/20',  text: 'text-indigo-700 dark:text-indigo-300',  header: 'bg-indigo-100 dark:bg-indigo-500/20' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-500/10',  border: 'border-violet-200 dark:border-violet-500/20',  text: 'text-violet-700 dark:text-violet-300',  header: 'bg-violet-100 dark:bg-violet-500/20' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', header: 'bg-emerald-100 dark:bg-emerald-500/20' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',    border: 'border-amber-200 dark:border-amber-500/20',    text: 'text-amber-700 dark:text-amber-300',   header: 'bg-amber-100 dark:bg-amber-500/20' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-500/10',      border: 'border-cyan-200 dark:border-cyan-500/20',      text: 'text-cyan-700 dark:text-cyan-300',     header: 'bg-cyan-100 dark:bg-cyan-500/20' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-500/10',      border: 'border-rose-200 dark:border-rose-500/20',      text: 'text-rose-700 dark:text-rose-300',     header: 'bg-rose-100 dark:bg-rose-500/20' },
  teal:    { bg: 'bg-teal-50 dark:bg-teal-500/10',      border: 'border-teal-200 dark:border-teal-500/20',      text: 'text-teal-700 dark:text-teal-300',     header: 'bg-teal-100 dark:bg-teal-500/20' },
  slate:   { bg: 'bg-slate-50 dark:bg-slate-500/10',    border: 'border-slate-200 dark:border-slate-500/20',    text: 'text-slate-600 dark:text-slate-400',   header: 'bg-slate-100 dark:bg-slate-500/20' },
}

type ColorKey = keyof typeof C

// --- Helpers ---
function upper(v?: string) { return (v || '').toUpperCase().trim() }

// Normalize ProjectType display name
function normalizeProject(raw: string): string {
  const l = raw.toLowerCase().trim()
  if (l === 'taxi' || l === 'ev7') return 'EV7'
  if (l === 'line man' || l === 'lineman') return 'Lineman'
  if (l === 'grab') return 'Grab'
  if (l === 'fast wheel' || l === 'fastwheel') return 'Fast Wheel'
  if (l === 'aot') return 'AOT'
  if (l === 'lalamove') return 'Lalamove'
  return raw
}

// --- Classification ---
type TopGroup = 'NEW' | 'USED' | 'ON_RENT' | 'OTHER'

function classifyTop(s?: string, t?: string): TopGroup {
  const su = upper(s)
  const tu = upper(t)

  // ON_RENT first (including ON_RENT_MAINTENANCE)
  if (su === 'ON_RENT') return 'ON_RENT'
  if (tu === 'ON_RENT_MAINTENANCE') return 'ON_RENT'

  // Check StatusType first — it's more specific than Status
  // Used car by StatusType
  if (tu === 'AVAILABLE_USE' || tu === 'USE_MAINTENANCE' || tu.startsWith('USE')) return 'USED'
  // Replacement by StatusType
  if (tu.startsWith('REPLACEMENT')) return 'USED'
  // New car by StatusType
  if (tu === 'AVAILABLE_NEW' || tu === 'NEW_MAINTENANCE' || tu.startsWith('NEW')) return 'NEW'
  if (tu === 'AVAILABLE_SHOWROOM') return 'NEW'

  // Then check Status
  if (su === 'PRODUCTION' || su === 'NEW_PRODUCTION' || su === 'PENDING' || su.startsWith('NEW')) return 'NEW'
  if (su === 'REPLACEMENT' || su.startsWith('REPLACEMENT')) return 'USED'
  if (su.startsWith('USE') || su === 'AVAILABLE_USE') return 'USED'

  // Fallback: plain AVAILABLE / AVAILABLE_SHOWROOM → NEW (only if StatusType didn't route it)
  if (su === 'AVAILABLE' || su === 'AVAILABLE_SHOWROOM') return 'NEW'

  if (su) return 'OTHER'
  return 'OTHER'
}

// --- Tree node types ---
interface LeafNode { label: string; count: number; color: ColorKey }
interface SubGroup { label: string; count: number; color: ColorKey; children: LeafNode[] }
interface TopNode { label: string; count: number; color: ColorKey; children: (LeafNode | SubGroup)[] }

function isSubGroup(node: LeafNode | SubGroup): node is SubGroup {
  return 'children' in node && Array.isArray(node.children) && node.children.length > 0
}

const projectColors: ColorKey[] = ['violet', 'cyan', 'rose', 'teal', 'amber', 'emerald', 'sky']

export default function StatusHierarchyChart({ items }: StatusHierarchyChartProps) {
  const groups = useMemo<TopNode[]>(() => {
    const newItems = items.filter(i => classifyTop(i.VehicleStatus, i.VehicleStatusType) === 'NEW')
    const usedItems = items.filter(i => classifyTop(i.VehicleStatus, i.VehicleStatusType) === 'USED')
    const onRentItems = items.filter(i => classifyTop(i.VehicleStatus, i.VehicleStatusType) === 'ON_RENT')
    const otherItems = items.filter(i => classifyTop(i.VehicleStatus, i.VehicleStatusType) === 'OTHER')

    // ========== รถใหม่ (New) — 4 กล่อง ==========
    const newProduction = newItems.filter(i => {
      const su = upper(i.VehicleStatus)
      return su === 'PRODUCTION' || su === 'NEW_PRODUCTION'
    })
    const newPending = newItems.filter(i => upper(i.VehicleStatus) === 'PENDING')
    const newDefect = newItems.filter(i => upper(i.VehicleStatusType) === 'NEW_MAINTENANCE')
    const newReady = newItems.filter(i => {
      const su = upper(i.VehicleStatus)
      const tu = upper(i.VehicleStatusType)
      return tu === 'AVAILABLE_NEW' || su === 'AVAILABLE' || su === 'AVAILABLE_SHOWROOM' || tu === 'AVAILABLE_SHOWROOM'
    })
    const newOther = newItems.filter(i => {
      const su = upper(i.VehicleStatus)
      const tu = upper(i.VehicleStatusType)
      if (su === 'PRODUCTION' || su === 'NEW_PRODUCTION') return false
      if (su === 'PENDING') return false
      if (tu === 'NEW_MAINTENANCE') return false
      if (tu === 'AVAILABLE_NEW' || su === 'AVAILABLE' || su === 'AVAILABLE_SHOWROOM' || tu === 'AVAILABLE_SHOWROOM') return false
      return true
    })

    const newChildren: LeafNode[] = [
      { label: 'Production', count: newProduction.length, color: 'sky' },
      { label: 'Pending (รอเรียกรถลง)', count: newPending.length, color: 'cyan' },
      { label: 'Defect', count: newDefect.length, color: 'amber' },
      { label: 'Ready', count: newReady.length, color: 'emerald' },
    ]
    if (newOther.length > 0) newChildren.push({ label: 'อื่นๆ', count: newOther.length, color: 'slate' })

    // ========== รถใช้งานแล้ว (Used) ==========
    // Non-replacement used items
    const usedReady = usedItems.filter(i => upper(i.VehicleStatusType) === 'AVAILABLE_USE')
    const usedRecondition = usedItems.filter(i => upper(i.VehicleStatusType) === 'USE_MAINTENANCE')

    // Replacement items (sub-group under Used)
    const replacementItems = usedItems.filter(i => {
      const su = upper(i.VehicleStatus)
      const tu = upper(i.VehicleStatusType)
      return su === 'REPLACEMENT' || su.startsWith('REPLACEMENT') || tu.startsWith('REPLACEMENT')
    })

    const replAvailable = replacementItems.filter(i => upper(i.VehicleStatusType) === 'REPLACEMENT_AVAILABLE')
    const replReserved = replacementItems.filter(i => upper(i.VehicleStatusType) === 'REPLACEMENT_RESERVED')
    const replInUse = replacementItems.filter(i => upper(i.VehicleStatusType) === 'REPLACEMENT_CAR')
    const replMaint = replacementItems.filter(i => upper(i.VehicleStatusType) === 'REPLACEMENT_MAINTENANCE')
    const replOther = replacementItems.filter(i => {
      const tu = upper(i.VehicleStatusType)
      return tu !== 'REPLACEMENT_AVAILABLE' && tu !== 'REPLACEMENT_RESERVED'
        && tu !== 'REPLACEMENT_CAR' && tu !== 'REPLACEMENT_MAINTENANCE'
    })

    // Ready = Available + Reserved (collapsible)
    const replReadyTotal = replAvailable.length + replReserved.length

    const replacementChildren: LeafNode[] = [
      { label: 'Ready', count: replReadyTotal, color: 'emerald',
        _expandable: true, _subItems: [
          { label: 'พร้อมใช้', count: replAvailable.length, color: 'emerald' },
          { label: 'ถูกจอง', count: replReserved.length, color: 'violet' },
        ]
      } as any,
      { label: 'ถูกใช้งาน', count: replInUse.length, color: 'cyan' },
    ]
    if (replMaint.length > 0) replacementChildren.push({ label: 'เข้าซ่อม', count: replMaint.length, color: 'amber' })
    if (replOther.length > 0) replacementChildren.push({ label: 'อื่นๆ', count: replOther.length, color: 'slate' })

    const replacementNode: SubGroup = {
      label: 'Replacement',
      count: replacementItems.length,
      color: 'teal',
      children: replacementChildren,
    }

    // Used items that are NOT Ready, Recondition, or Replacement
    const usedOther = usedItems.filter(i => {
      const tu = upper(i.VehicleStatusType)
      const su = upper(i.VehicleStatus)
      if (tu === 'AVAILABLE_USE') return false
      if (tu === 'USE_MAINTENANCE') return false
      if (su === 'REPLACEMENT' || su.startsWith('REPLACEMENT') || tu.startsWith('REPLACEMENT')) return false
      return true
    })

    const usedChildren: (LeafNode | SubGroup)[] = [
      { label: 'Ready', count: usedReady.length, color: 'emerald' },
      { label: 'Recondition/Maintenance', count: usedRecondition.length, color: 'indigo' },
      replacementNode,
    ]
    if (usedOther.length > 0) usedChildren.push({ label: 'อื่นๆ', count: usedOther.length, color: 'slate' })

    // ========== ให้เช่า (On Rent) → แยก ปล่อยเช่า vs เข้าซ่อม ==========
    const onRoad = onRentItems.filter(i => upper(i.VehicleStatusType) !== 'ON_RENT_MAINTENANCE')
    const onRentMaint = onRentItems.filter(i => upper(i.VehicleStatusType) === 'ON_RENT_MAINTENANCE')

    // ปล่อยเช่า — แยกตาม ProjectType
    const roadMap: Record<string, number> = {}
    for (const item of onRoad) {
      const proj = item.ProjectType ? normalizeProject(item.ProjectType) : 'ไม่ระบุโครงการ'
      roadMap[proj] = (roadMap[proj] || 0) + 1
    }
    const onRoadChildren: LeafNode[] = Object.entries(roadMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], idx) => ({ label, count, color: projectColors[idx % projectColors.length] }))

    const onRoadNode: SubGroup = {
      label: 'ปล่อยเช่า', count: onRoad.length, color: 'violet', children: onRoadChildren,
    }

    // เข้าซ่อม — แยกตาม ProjectType
    const maintMap: Record<string, number> = {}
    for (const item of onRentMaint) {
      const proj = item.ProjectType ? normalizeProject(item.ProjectType) : 'ไม่ระบุโครงการ'
      maintMap[proj] = (maintMap[proj] || 0) + 1
    }
    const onMaintChildren: LeafNode[] = Object.entries(maintMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], idx) => ({ label, count, color: projectColors[idx % projectColors.length] }))

    const onMaintNode: SubGroup = {
      label: 'เข้าซ่อม', count: onRentMaint.length, color: 'amber', children: onMaintChildren,
    }

    const onRentChildren: (LeafNode | SubGroup)[] = [onRoadNode, onMaintNode]

    // ========== Build result ==========
    const result: TopNode[] = [
      { label: 'รถใหม่', color: 'sky', count: newItems.length, children: newChildren },
      { label: 'รถใช้งานแล้ว', color: 'indigo', count: usedItems.length, children: usedChildren },
      { label: 'ให้เช่า', color: 'violet', count: onRentItems.length, children: onRentChildren },
    ]

    if (otherItems.length > 0) {
      const otherMap: Record<string, number> = {}
      for (const item of otherItems) {
        let label = item.StatusTypeName || item.VehicleStatusType || item.VehicleStatus || 'ไม่ระบุ'
        if (label.toLowerCase() === 'display') label = 'Demo'
        otherMap[label] = (otherMap[label] || 0) + 1
      }
      result.push({
        label: 'อื่นๆ', color: 'slate', count: otherItems.length,
        children: Object.entries(otherMap).sort((a, b) => b[1] - a[1])
          .map(([label, count]) => ({ label, count, color: 'slate' as ColorKey }))
      })
    }

    return result
  }, [items])

  // Collapsible state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  // --- Render a leaf node (supports expandable) ---
  const renderLeaf = (node: any) => {
    const c = C[node.color as ColorKey]
    const isExpandable = node._expandable && node._subItems?.length > 0
    const isOpen = expanded[node.label]

    return (
      <div key={node.label} className="flex flex-col items-center">
        <div className="w-px h-2 bg-slate-300 dark:bg-slate-600/40" />
        <div
          className={`${c.bg} ${c.border} border rounded-lg px-1.5 py-1 text-center min-w-[48px] ${isExpandable ? 'cursor-pointer hover:brightness-110 transition' : ''}`}
          onClick={isExpandable ? () => toggle(node.label) : undefined}
        >
          <div className={`text-[8px] font-bold ${c.text} leading-tight`}>
            {node.label} {isExpandable && (isOpen ? '▾' : '▸')}
          </div>
          <div className={`text-xs font-black ${c.text}`}>{node.count}</div>
        </div>
        {/* Expandable sub-items */}
        {isExpandable && isOpen && (
          <div className="flex flex-col items-center">
            <div className="w-px h-1.5 bg-slate-200 dark:bg-slate-600/30" />
            <div className="flex gap-1">
              {node._subItems.map((sub: any) => {
                const sc = C[sub.color as ColorKey]
                return (
                  <div key={sub.label} className="flex flex-col items-center">
                    <div className="w-px h-1.5 bg-slate-200 dark:bg-slate-600/30" />
                    <div className={`${sc.bg} ${sc.border} border rounded px-1 py-0.5 text-center min-w-[36px]`}>
                      <div className={`text-[7px] font-bold ${sc.text} leading-tight`}>{sub.label}</div>
                      <div className={`text-[10px] font-black ${sc.text}`}>{sub.count}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50 pb-2">
        <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">🏗️ สถานะรถแยกตามประเภท</span>
        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
          ทั้งหมด {items.length} คัน
        </span>
      </div>

      {/* Tree */}
      <div className="overflow-x-auto">
      <div className="flex flex-col items-center w-full min-w-[600px]">
        {/* Root */}
        <div className="bg-slate-100 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600/30 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Car Status</div>
          <div className="text-base font-black text-slate-800 dark:text-slate-100">{items.length}</div>
        </div>
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600/50" />

        {/* Horizontal connector across groups */}
        <div className="relative w-full">
          <div className="absolute top-0 h-px bg-slate-300 dark:bg-slate-600/50" style={{ left: `${100 / (groups.length * 2)}%`, right: `${100 / (groups.length * 2)}%` }} />
        </div>

        {/* Level 1: Top groups */}
        <div className="grid gap-3 w-full" style={{ gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}>
          {groups.map(group => {
            const c = C[group.color]

            // Separate leaf nodes from sub-groups
            const leafNodes = group.children.filter(ch => !isSubGroup(ch)) as LeafNode[]
            const subGroups = group.children.filter(ch => isSubGroup(ch)) as SubGroup[]

            return (
              <div key={group.label} className="flex flex-col items-center gap-0">
                {/* Connector up */}
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-600/50" />

                {/* Group header */}
                <div className={`${c.header} ${c.border} border rounded-xl px-2 py-1.5 text-center w-full`}>
                  <div className={`text-[9px] font-bold ${c.text} uppercase`}>{group.label}</div>
                  <div className={`text-lg font-black ${c.text}`}>{group.count}</div>
                </div>

                {/* Level 2: Children */}
                {(leafNodes.length > 0 || subGroups.length > 0) && (
                  <>
                    <div className="w-px h-3 bg-slate-300 dark:bg-slate-600/50" />

                    {/* Horizontal connector for children */}
                    {(leafNodes.length + subGroups.length) > 1 && (
                      <div className="relative w-full">
                        <div className="absolute top-0 left-2 right-2 h-px bg-slate-300 dark:bg-slate-600/40" />
                      </div>
                    )}

                    {/* ALL children in one row */}
                    <div className="flex flex-nowrap items-start justify-center gap-1 w-full">
                      {leafNodes.map(child => renderLeaf(child))}
                      {subGroups.map(sg => {
                        const sc = C[sg.color]
                        const sgKey = `${group.label}-${sg.label}`
                        const sgOpen = !!expanded[sgKey] // default closed
                        return (
                          <div key={sg.label} className="flex flex-col items-center">
                            {/* Sub-group header (clickable to toggle) */}
                            <div className="w-px h-2 bg-slate-300 dark:bg-slate-600/40" />
                            <div
                              className={`${sc.header} ${sc.border} border rounded-lg px-1.5 py-1 text-center min-w-[48px] cursor-pointer hover:brightness-110 transition`}
                              onClick={() => setExpanded(prev => ({ ...prev, [sgKey]: !sgOpen }))}
                            >
                              <div className={`text-[8px] font-bold ${sc.text} leading-tight`}>
                                {sg.label} {sg.children.length > 0 && (sgOpen ? '▾' : '▸')}
                              </div>
                              <div className={`text-xs font-black ${sc.text}`}>{sg.count}</div>
                            </div>
                            {/* Sub-group children (collapsible) */}
                            {sg.children.length > 0 && sgOpen && (
                              <>
                                <div className="w-px h-2 bg-slate-200 dark:bg-slate-600/30" />
                                {sg.children.length > 1 && (
                                  <div className="relative w-full">
                                    <div className="absolute top-0 left-4 right-4 h-px bg-slate-200 dark:bg-slate-600/30" />
                                  </div>
                                )}
                                <div className="flex flex-nowrap justify-center gap-1">
                                  {sg.children.map(child => renderLeaf(child))}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </div>
  )
}

