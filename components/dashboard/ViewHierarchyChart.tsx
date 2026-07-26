'use client'

import React, { useMemo, useState } from 'react'

interface ViewHierarchyChartProps {
  items: {
    VinNo: string
    RegisterNo?: string
    TopGroup: string
    SubGroup: string
    LeafNode?: string
    ReplacementReadyDetails?: string
  }[]
}

const C = {
  sky:     { bg: 'bg-sky-50 dark:bg-sky-500/10',       border: 'border-sky-200 dark:border-sky-500/20',       text: 'text-sky-700 dark:text-sky-300',       header: 'bg-sky-100 dark:bg-sky-500/20' },
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-500/10',  border: 'border-indigo-200 dark:border-indigo-500/20',  text: 'text-indigo-700 dark:text-indigo-300',  header: 'bg-indigo-100 dark:bg-indigo-500/20' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-500/10',  border: 'border-violet-200 dark:border-violet-500/20',  text: 'text-violet-700 dark:text-violet-300',  header: 'bg-violet-100 dark:bg-violet-500/20' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', header: 'bg-emerald-100 dark:bg-emerald-500/20' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-500/10',    border: 'border-amber-200 dark:border-amber-500/20',    text: 'text-amber-700 dark:text-amber-300',   header: 'bg-amber-100 dark:bg-amber-500/20' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-500/10',      border: 'border-cyan-200 dark:border-cyan-500/20',      text: 'text-cyan-700 dark:text-cyan-300',     header: 'bg-cyan-100 dark:bg-cyan-500/20' },
  teal:    { bg: 'bg-teal-50 dark:bg-teal-500/10',      border: 'border-teal-200 dark:border-teal-500/20',      text: 'text-teal-700 dark:text-teal-300',     header: 'bg-teal-100 dark:bg-teal-500/20' },
  slate:   { bg: 'bg-slate-50 dark:bg-slate-500/10',    border: 'border-slate-200 dark:border-slate-500/20',    text: 'text-slate-600 dark:text-slate-400',   header: 'bg-slate-100 dark:bg-slate-500/20' },
}
type ColorKey = keyof typeof C

const projectColors: ColorKey[] = ['emerald', 'cyan', 'sky', 'indigo', 'violet', 'teal', 'amber']

interface LeafNode { label: string; count: number; color: ColorKey; _expandable?: boolean; _subItems?: LeafNode[] }
interface SubGroup { label: string; count: number; color: ColorKey; children: LeafNode[] }
interface TopNode { label: string; count: number; color: ColorKey; children: (LeafNode | SubGroup)[] }

function isSubGroup(node: LeafNode | SubGroup): node is SubGroup {
  return 'children' in node
}

export default function ViewHierarchyChart({ items }: ViewHierarchyChartProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const groups = useMemo(() => {
    // 1. แบ่งกลุ่มตาม TopGroup
    const newItems = items.filter(i => i.TopGroup === 'รถใหม่')
    const usedItems = items.filter(i => i.TopGroup === 'รถใช้งานแล้ว')
    const onRentItems = items.filter(i => i.TopGroup === 'ให้เช่า')
    const otherItems = items.filter(i => i.TopGroup === 'อื่นๆ')

    // ========== รถใหม่ ==========
    const newChildren: LeafNode[] = []
    const newMap: Record<string, number> = {}
    newItems.forEach(i => newMap[i.SubGroup] = (newMap[i.SubGroup] || 0) + 1)
    
    if (newMap['Production']) newChildren.push({ label: 'Production', count: newMap['Production'], color: 'sky' })
    if (newMap['Pending (รอเรียกรถลง)']) newChildren.push({ label: 'Pending (รอเรียกรถลง)', count: newMap['Pending (รอเรียกรถลง)'], color: 'cyan' })
    if (newMap['Defect']) newChildren.push({ label: 'Defect', count: newMap['Defect'], color: 'amber' })
    if (newMap['Ready']) newChildren.push({ label: 'Ready', count: newMap['Ready'], color: 'emerald' })
    if (newMap['อื่นๆ']) newChildren.push({ label: 'อื่นๆ', count: newMap['อื่นๆ'], color: 'slate' })

    // ========== รถใช้งานแล้ว ==========
    const usedChildren: (LeafNode | SubGroup)[] = []
    const usedMap: Record<string, number> = {}
    usedItems.forEach(i => usedMap[i.SubGroup] = (usedMap[i.SubGroup] || 0) + 1)

    if (usedMap['Ready']) usedChildren.push({ label: 'Ready', count: usedMap['Ready'], color: 'emerald' })
    if (usedMap['Recondition/Maintenance']) usedChildren.push({ label: 'Recondition/Maintenance', count: usedMap['Recondition/Maintenance'], color: 'amber' })

    if (usedMap['Replacement']) {
      const replItems = usedItems.filter(i => i.SubGroup === 'Replacement')
      const replMap: Record<string, number> = {}
      replItems.forEach(i => replMap[i.LeafNode || 'อื่นๆ'] = (replMap[i.LeafNode || 'อื่นๆ'] || 0) + 1)

      const replReadyItems = replItems.filter(i => i.LeafNode === 'Ready')
      const readyAvail = replReadyItems.filter(i => i.ReplacementReadyDetails === 'พร้อมใช้').length
      const readyRsvLM = replReadyItems.filter(i => i.ReplacementReadyDetails === 'ถูกจอง (LM)').length
      const readyRsvEV7 = replReadyItems.filter(i => i.ReplacementReadyDetails === 'ถูกจอง (EV7)').length

      const replacementChildren: LeafNode[] = []
      if (replMap['Ready']) {
        replacementChildren.push({
          label: 'Ready', count: replMap['Ready'], color: 'emerald', _expandable: true,
          _subItems: [
            { label: 'พร้อมใช้', count: readyAvail, color: 'emerald' },
            { label: 'ถูกจอง (LM)', count: readyRsvLM, color: 'violet' },
            { label: 'ถูกจอง (EV7)', count: readyRsvEV7, color: 'sky' }
          ]
        })
      }
      if (replMap['ถูกใช้งาน']) replacementChildren.push({ label: 'ถูกใช้งาน', count: replMap['ถูกใช้งาน'], color: 'cyan' })
      if (replMap['เข้าซ่อม']) replacementChildren.push({ label: 'เข้าซ่อม', count: replMap['เข้าซ่อม'], color: 'amber' })
      if (replMap['อื่นๆ']) replacementChildren.push({ label: 'อื่นๆ', count: replMap['อื่นๆ'], color: 'slate' })

      usedChildren.push({
        label: 'Replacement', count: usedMap['Replacement'], color: 'teal', children: replacementChildren
      })
    }
    if (usedMap['อื่นๆ']) usedChildren.push({ label: 'อื่นๆ', count: usedMap['อื่นๆ'], color: 'slate' })

    // ========== ให้เช่า ==========
    const onRentChildren: (LeafNode | SubGroup)[] = []
    
    // ปล่อยเช่า
    const onRoad = onRentItems.filter(i => i.SubGroup === 'ปล่อยเช่า')
    if (onRoad.length > 0) {
      const roadMap: Record<string, number> = {}
      onRoad.forEach(i => roadMap[i.LeafNode || 'ไม่ระบุโครงการ'] = (roadMap[i.LeafNode || 'ไม่ระบุโครงการ'] || 0) + 1)
      const roadChildren = Object.entries(roadMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count], idx) => ({ label, count, color: projectColors[idx % projectColors.length] }))
      onRentChildren.push({ label: 'ปล่อยเช่า', count: onRoad.length, color: 'violet', children: roadChildren })
    }

    // เข้าซ่อม
    const onMaint = onRentItems.filter(i => i.SubGroup === 'เข้าซ่อม')
    if (onMaint.length > 0) {
      const maintMap: Record<string, number> = {}
      onMaint.forEach(i => maintMap[i.LeafNode || 'ไม่ระบุโครงการ'] = (maintMap[i.LeafNode || 'ไม่ระบุโครงการ'] || 0) + 1)
      const maintChildren = Object.entries(maintMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count], idx) => ({ label, count, color: projectColors[idx % projectColors.length] }))
      onRentChildren.push({ label: 'เข้าซ่อม', count: onMaint.length, color: 'amber', children: maintChildren })
    }

    const result: TopNode[] = [
      { label: 'รถใหม่', color: 'sky', count: newItems.length, children: newChildren },
      { label: 'รถใช้งานแล้ว', color: 'indigo', count: usedItems.length, children: usedChildren },
      { label: 'ให้เช่า', color: 'violet', count: onRentItems.length, children: onRentChildren },
    ]

    // ========== อื่นๆ ==========
    if (otherItems.length > 0) {
      const otherMap: Record<string, number> = {}
      otherItems.forEach(i => otherMap[i.SubGroup] = (otherMap[i.SubGroup] || 0) + 1)
      const otherChildren = Object.entries(otherMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count, color: 'slate' as ColorKey }))
      
      result.push({ label: 'อื่นๆ', color: 'slate', count: otherItems.length, children: otherChildren })
    }

    return result
  }, [items])

  if (!items || items.length === 0) return null

  // --- Render Leaf ---
  const renderLeaf = (node: LeafNode, contextKey: string = '') => {
    const c = C[node.color]
    const key = `${contextKey}-${node.label}`
    const isExpanded = !!expanded[key]

    if (node._expandable) {
      return (
        <div key={key} className="flex flex-col items-center">
          <div className="w-px h-2 bg-slate-200 dark:bg-slate-600/30" />
          <div 
            className={`${c.bg} ${c.border} border rounded-lg px-2 py-1 text-center min-w-[56px] shadow-sm hover:brightness-105 cursor-pointer transition`}
            onClick={() => setExpanded(prev => ({ ...prev, [key]: !isExpanded }))}
          >
            <div className={`text-[9px] font-bold ${c.text} whitespace-nowrap`}>{node.label} {isExpanded ? '▾' : '▸'}</div>
            <div className={`text-sm font-black ${c.text}`}>{node.count}</div>
          </div>
          
          {isExpanded && node._subItems && (
            <div className="flex flex-col items-center mt-1 min-w-max w-[110%] bg-slate-50/50 dark:bg-slate-800/50 rounded-lg border border-slate-200/50 dark:border-slate-700/50 p-1">
              {node._subItems.map(sub => {
                const sc = C[sub.color]
                return (
                  <div key={sub.label} className="flex items-center justify-between w-full px-1.5 py-0.5 border-b border-slate-200/50 dark:border-slate-700/50 last:border-0 gap-2 min-w-[80px]">
                    <span className={`text-[8px] font-bold ${sc.text} whitespace-nowrap flex-shrink-0`}>{sub.label}</span>
                    <span className={`text-[9px] font-black ${sc.text} ml-auto`}>{sub.count}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={key} className="flex flex-col items-center">
        <div className="w-px h-2 bg-slate-200 dark:bg-slate-600/30" />
        <div className={`${c.bg} ${c.border} border rounded-lg px-2 py-1 text-center min-w-[56px] shadow-sm`}>
          <div className={`text-[9px] font-bold ${c.text} whitespace-nowrap`}>{node.label}</div>
          <div className={`text-sm font-black ${c.text}`}>{node.count}</div>
        </div>
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

      <div className="overflow-x-auto">
        <div className="flex flex-col items-center w-full min-w-[600px]">
          <div className="bg-slate-100 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600/30 rounded-xl px-4 py-2 text-center">
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Car Status</div>
            <div className="text-base font-black text-slate-800 dark:text-slate-100">{items.length}</div>
          </div>
          <div className="w-px h-4 bg-slate-300 dark:bg-slate-600/50" />

          <div className="relative w-full">
            <div className="absolute top-0 h-px bg-slate-300 dark:bg-slate-600/50" style={{ left: `${100 / (groups.length * 2)}%`, right: `${100 / (groups.length * 2)}%` }} />
          </div>

          <div className="grid gap-3 w-full" style={{ gridTemplateColumns: `repeat(${groups.length}, 1fr)` }}>
            {groups.map(group => {
              const c = C[group.color]
              const leafNodes = group.children.filter(ch => !isSubGroup(ch)) as LeafNode[]
              const subGroups = group.children.filter(ch => isSubGroup(ch)) as SubGroup[]

              return (
                <div key={group.label} className="flex flex-col items-center relative">
                  <div className="w-px h-3 bg-slate-300 dark:bg-slate-600/50" />
                  <div className={`${c.bg} ${c.border} border rounded-xl px-4 py-1.5 text-center min-w-[90px] shadow-md`}>
                    <div className={`text-[10px] font-bold ${c.text} uppercase tracking-wide`}>{group.label}</div>
                    <div className={`text-lg font-black ${c.text}`}>{group.count}</div>
                  </div>

                  {group.children.length > 0 && (
                    <>
                      <div className="w-px h-3 bg-slate-300 dark:bg-slate-600/40" />
                      
                      {(leafNodes.length + subGroups.length) > 1 && (
                        <div className="relative w-full">
                          <div className="absolute top-0 left-2 right-2 h-px bg-slate-300 dark:bg-slate-600/40" />
                        </div>
                      )}

                      <div className="flex flex-nowrap items-start justify-center gap-1 w-full">
                        {leafNodes.map(child => renderLeaf(child, group.label))}
                        {subGroups.map(sg => {
                          const sc = C[sg.color]
                          const sgKey = `${group.label}-${sg.label}`
                          const sgOpen = !!expanded[sgKey] 
                          return (
                            <div key={sg.label} className="flex flex-col items-center">
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
                              {sg.children.length > 0 && sgOpen && (
                                <>
                                  <div className="w-px h-2 bg-slate-200 dark:bg-slate-600/30" />
                                  {sg.children.length > 1 && (
                                    <div className="relative w-full">
                                      <div className="absolute top-0 left-4 right-4 h-px bg-slate-200 dark:bg-slate-600/30" />
                                    </div>
                                  )}
                                  <div className="flex flex-nowrap justify-center gap-1">
                                    {sg.children.map(child => renderLeaf(child, sgKey))}
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
