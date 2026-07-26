'use client'

import React, { useMemo } from 'react'

/**
 * StatusHierarchyChart — แสดง Org Chart สถานะรถ
 * 
 * === วิธีจัดกลุ่มสถานะ ===
 * 
 * Level 0: Car Status (ทั้งหมด)
 * 
 * Level 1 (VehicleStatus — จาก EV_AuditItem.VehicleStatus):
 *   ├── รถใหม่ (NEW)         → VehicleStatus ที่ขึ้นต้นด้วย NEW หรือ AVAILABLE_NEW
 *   ├── รถใช้แล้ว (USED)     → VehicleStatus ที่ขึ้นต้นด้วย USE หรือ AVAILABLE_USE
 *   └── ให้เช่า (ON_RENT)    → VehicleStatus = 'ON_RENT'
 * 
 * Level 2 (Sub-status):
 *   สำหรับ รถใหม่/รถใช้แล้ว → แยกตาม VehicleStatusType (เช่น AVAILABLE_NEW, NEW_MAINTENANCE, ...)
 *   สำหรับ ให้เช่า          → แยกตาม ProjectType จาก EV_InventoryItem (เช่น Taxi→EV7, Line Man, Grab, ...)
 * 
 * ไม่ hardcode sub-status ของ ON_RENT — ดึง ProjectType มาจาก DB แบบ dynamic
 */

interface StatusHierarchyChartProps {
  items: {
    VehicleStatus?: string
    VehicleStatusType?: string
    StatusTypeName?: string
    ProjectType?: string
  }[]
}

// Color map for static tailwind classes
const colorMap: Record<string, { bg: string; border: string; text: string; headerBg: string }> = {
  sky:     { bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    text: 'text-sky-300',     headerBg: 'bg-sky-500/20' },
  indigo:  { bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', text: 'text-indigo-300',  headerBg: 'bg-indigo-500/20' },
  violet:  { bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-300',  headerBg: 'bg-violet-500/20' },
  emerald: { bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',text: 'text-emerald-300', headerBg: 'bg-emerald-500/20' },
  amber:   { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-300',  headerBg: 'bg-amber-500/20' },
  cyan:    { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   text: 'text-cyan-300',   headerBg: 'bg-cyan-500/20' },
  rose:    { bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   text: 'text-rose-300',   headerBg: 'bg-rose-500/20' },
  slate:   { bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  text: 'text-slate-400',  headerBg: 'bg-slate-500/20' },
}

// Assign colors for ON_RENT projects dynamically
const projectColors = ['violet', 'cyan', 'rose', 'indigo', 'amber', 'emerald', 'sky']

// Normalize ProjectType display name
function normalizeProjectDisplay(raw: string): string {
  const lower = raw.toLowerCase().trim()
  if (lower === 'taxi' || lower === 'ev7') return 'EV7'
  if (lower === 'line man' || lower === 'lineman') return 'Lineman'
  if (lower === 'grab') return 'Grab'
  if (lower === 'fast wheel' || lower === 'fastwheel') return 'Fast Wheel'
  if (lower === 'aot') return 'AOT'
  if (lower === 'lalamove') return 'Lalamove'
  return raw
}

// Classify a vehicle into a top-level group
function classifyGroup(status?: string, statusType?: string): 'NEW' | 'USED' | 'ON_RENT' | 'OTHER' {
  const s = (status || '').toUpperCase().trim()
  const t = (statusType || '').toUpperCase().trim()

  if (s === 'ON_RENT') return 'ON_RENT'
  
  // New car: status starts with NEW or AVAILABLE_NEW, or statusType contains NEW
  if (s.startsWith('NEW') || s === 'AVAILABLE_NEW' || t.includes('NEW')) return 'NEW'
  
  // Used car: status starts with USE or AVAILABLE_USE, or statusType contains USE
  if (s.startsWith('USE') || s === 'AVAILABLE_USE' || s.startsWith('AVAILABLE_USE') || t.includes('USE')) return 'USED'
  
  // Maintenance without clear NEW/USED prefix
  if (s.includes('MAINTENANCE') || s.includes('REPLACEMENT')) return 'OTHER'

  // If there's any status at all but doesn't match above
  if (s) return 'OTHER'
  
  return 'OTHER'
}

// Sub-status label for NEW/USED items
function getSubStatusLabel(status?: string, statusType?: string, statusTypeName?: string): string {
  // Prefer Thai name from StatusTypeName
  if (statusTypeName && /[\u0E00-\u0E7F]/.test(statusTypeName)) return statusTypeName
  
  const t = (statusType || status || '').toUpperCase().trim()
  
  // New car sub-statuses
  if (t.includes('PRODUCTION')) return 'Production'
  if (t.includes('DEFECT') || (t.includes('MAINTENANCE') && t.includes('NEW'))) return 'Defect'
  if (t.includes('AVAILABLE') || t.includes('READY')) return 'Ready'
  
  // Used car sub-statuses
  if (t.includes('RECONDITION') || (t.includes('MAINTENANCE') && t.includes('USE'))) return 'Recondition'
  if (t.includes('REPLACEMENT')) return 'Replacement'

  return statusType || status || 'ไม่ระบุ'
}

interface GroupData {
  label: string
  color: string
  total: number
  children: { label: string; count: number; color: string }[]
}

export default function StatusHierarchyChart({ items }: StatusHierarchyChartProps) {
  const groups = useMemo(() => {
    // Classify items into top-level groups
    const newItems = items.filter(i => classifyGroup(i.VehicleStatus, i.VehicleStatusType) === 'NEW')
    const usedItems = items.filter(i => classifyGroup(i.VehicleStatus, i.VehicleStatusType) === 'USED')
    const onRentItems = items.filter(i => classifyGroup(i.VehicleStatus, i.VehicleStatusType) === 'ON_RENT')
    const otherItems = items.filter(i => classifyGroup(i.VehicleStatus, i.VehicleStatusType) === 'OTHER')

    // --- New Car sub-statuses ---
    const newSubMap: Record<string, number> = {}
    for (const item of newItems) {
      const label = getSubStatusLabel(item.VehicleStatus, item.VehicleStatusType, item.StatusTypeName)
      newSubMap[label] = (newSubMap[label] || 0) + 1
    }
    const newChildren = Object.entries(newSubMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        color: label === 'Defect' ? 'amber' : label === 'Ready' ? 'emerald' : 'sky'
      }))

    // --- Used Car sub-statuses ---
    const usedSubMap: Record<string, number> = {}
    for (const item of usedItems) {
      const label = getSubStatusLabel(item.VehicleStatus, item.VehicleStatusType, item.StatusTypeName)
      usedSubMap[label] = (usedSubMap[label] || 0) + 1
    }
    const usedChildren = Object.entries(usedSubMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({
        label,
        count,
        color: label === 'Ready' ? 'emerald' : 'indigo'
      }))

    // --- On Rent: group by ProjectType dynamically ---
    const projectMap: Record<string, number> = {}
    for (const item of onRentItems) {
      const proj = item.ProjectType ? normalizeProjectDisplay(item.ProjectType) : 'ไม่ระบุโครงการ'
      projectMap[proj] = (projectMap[proj] || 0) + 1
    }
    const onRentChildren = Object.entries(projectMap)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], idx) => ({
        label,
        count,
        color: projectColors[idx % projectColors.length]
      }))

    const result: GroupData[] = [
      { label: 'รถใหม่', color: 'sky', total: newItems.length, children: newChildren },
      { label: 'รถใช้แล้ว', color: 'indigo', total: usedItems.length, children: usedChildren },
      { label: 'ให้เช่า', color: 'violet', total: onRentItems.length, children: onRentChildren },
    ]

    if (otherItems.length > 0) {
      const otherSubMap: Record<string, number> = {}
      for (const item of otherItems) {
        const label = item.StatusTypeName || item.VehicleStatusType || item.VehicleStatus || 'ไม่ระบุ'
        otherSubMap[label] = (otherSubMap[label] || 0) + 1
      }
      result.push({
        label: 'อื่นๆ',
        color: 'slate',
        total: otherItems.length,
        children: Object.entries(otherSubMap).sort((a, b) => b[1] - a[1]).map(([label, count], idx) => ({
          label, count, color: ['slate', 'amber', 'rose'][idx % 3]
        }))
      })
    }

    return result
  }, [items])

  return (
    <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
        <span className="text-xs font-black text-slate-300 uppercase tracking-wider">🏗️ สถานะรถแยกตามประเภท</span>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
          ทั้งหมด {items.length} คัน
        </span>
      </div>

      {/* Tree Chart */}
      <div className="flex flex-col items-center gap-0">
        {/* Root */}
        <div className="bg-slate-700/40 border border-slate-600/30 rounded-xl px-4 py-2 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Car Status</div>
          <div className="text-base font-black text-slate-100">{items.length}</div>
        </div>

        {/* Connector line down */}
        <div className="w-px h-4 bg-slate-600/50" />

        {/* Horizontal connector */}
        <div className="relative w-full flex justify-center">
          <div className="absolute top-0 h-px bg-slate-600/50" style={{ left: `${100 / (groups.length * 2)}%`, right: `${100 / (groups.length * 2)}%` }} />
        </div>

        {/* Level 1: Groups */}
        <div className={`grid gap-3 w-full`} style={{ gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}>
          {groups.map(group => {
            const c = colorMap[group.color] || colorMap.slate

            return (
              <div key={group.label} className="flex flex-col items-center gap-0">
                {/* Connector up */}
                <div className="w-px h-3 bg-slate-600/50" />
                
                {/* Group header */}
                <div className={`${c.headerBg} ${c.border} border rounded-xl px-2 py-1.5 text-center w-full`}>
                  <div className={`text-[9px] font-bold ${c.text} uppercase`}>{group.label}</div>
                  <div className={`text-lg font-black ${c.text}`}>{group.total}</div>
                </div>

                {/* Connector down */}
                {group.children.length > 0 && (
                  <>
                    <div className="w-px h-3 bg-slate-600/50" />

                    {/* Sub-status horizontal line */}
                    {group.children.length > 1 && (
                      <div className="relative w-full">
                        <div className="absolute top-0 left-2 right-2 h-px bg-slate-600/40" />
                      </div>
                    )}

                    {/* Level 2: Sub-statuses */}
                    <div className="flex flex-wrap justify-center gap-1 w-full">
                      {group.children.map(child => {
                        const cc = colorMap[child.color] || colorMap.slate
                        return (
                          <div key={child.label} className="flex flex-col items-center">
                            <div className="w-px h-2 bg-slate-600/40" />
                            <div className={`${cc.bg} ${cc.border} border rounded-lg px-1.5 py-1 text-center min-w-[50px]`}>
                              <div className={`text-[8px] font-bold ${cc.text} leading-tight`}>{child.label}</div>
                              <div className={`text-xs font-black ${cc.text}`}>{child.count}</div>
                            </div>
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
  )
}
