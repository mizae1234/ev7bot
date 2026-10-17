'use client'

import React, { useMemo, useState } from 'react'

export interface MaintenanceItemForConflict {
  id: number | string
  register_no: string | null
  vin: string
  model?: string
  project?: string
  issue_title?: string
  status_code: string
  status_text?: string
  service_location?: string
  service_location_code?: string
  current_location?: string | null
  report_date?: string | null
  update_date?: string | null
}

interface MultiLocationTicketsBlockProps {
  items: MaintenanceItemForConflict[]
  onSelectCar?: (registerNo: string) => void
  formatLocation?: (code: string | null | undefined) => string
}

const defaultFormatLocation = (code: string | null | undefined): string => {
  if (!code || code === 'ไม่ระบุ') return 'ไม่ระบุพื้นที่/อู่'
  const locMap: Record<string, string> = {
    'AION_GI_KANCHANAPISEK': 'Aion กาญจนาฯ',
    'AION_GI_RAMINTRA_EXPRESSWAY': 'Aion เลียบด่วนฯ',
    'AION_GI_PIBULSONGKRAM': 'Aion พิบูลฯ',
    'AION_GI_MINBURI': 'Aion มีนบุรี',
    'AION_GI_MAHACHAI': 'Aion มหาชัย',
    'AION_GI_SALAYA': 'Aion ศาลายา',
    'EV7_YARD_PRAPADAENG': 'EV7 Yard พระประแดง',
    'SMART_TAXI': 'สมาร์ทแท็กซี่',
    'GARAGE_BUNGKHWANG': 'อู่ บึงขวาง',
    'GARAGE_TS': 'อู่ TS',
    'GARAGE_88_CAR': 'อู่ 88 คาร์',
    'GARAGE_CRN_PAKKRET': 'อู่ CRN ปากเกร็ด',
    'GARAGE_56_COLOR': 'อู่ 56 Color',
    'GARAGE_PRICHA': 'อู่ ปรีชา',
    'GARAGE_PERFECTCAR': 'อู่ เพอร์เฟคคาร์',
    'GARAGE_SAHACAR': 'อู่ สหาคาร์',
    'GARAGE_PREMIUMCAR': 'อู่ พรีเมี่ยมคาร์',
    'GARAGE_BESTCARPAINT': 'อู่ เบสท์คาร์เพ้นท์',
    'GARAGE_T_CHAROEN': 'อู่ ทีเจริญ',
    'GARAGE_NJO_MINBURI': 'อู่ NJO มีนบุรี',
    'GARAGE_CHOBKANCHANG': 'อู่ ชอบการช่าง',
    'GARAGE_WARAWON': 'อู่ วรวงศ์',
    'BRANCH_AYUTTHAYA': 'สาขา อยุธยา',
    'BB_CARPAINT': 'อู่ บีบี คาร์เพ้นท์',
    'AUTOHAUS': 'อู่ Autohaus',
    'NIKHOM_SINSAKORN': 'นิคมสินสาคร',
    'PENDING_REVIEW': 'รอดำเนินการตรวจสอบ',
  }
  return locMap[code] || code.replace(/_/g, ' ')
}

const formatDateShort = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    return `${day} ${month}`
  } catch {
    return dateStr
  }
}

const getStatusBadge = (statusCode: string) => {
  switch (statusCode) {
    case 'IN_MAINTENANCE':
      return { label: 'กำลังซ่อม', cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' }
    case 'WAITING_FOR_MAINTENANCE':
      return { label: 'รอเข้าซ่อม', cls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' }
    case 'READY_PICKUP_MAINTENANCE':
    case 'GARAGE_COMPLETE':
      return { label: 'ซ่อมเสร็จ รอมารับ', cls: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' }
    default:
      return { label: statusCode, cls: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' }
  }
}

const LOCATION_COLORS = [
  'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300',
  'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300',
  'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
]

export default function MultiLocationTicketsBlock({
  items,
  onSelectCar,
  formatLocation = defaultFormatLocation,
}: MultiLocationTicketsBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  // Analyze items to find cars with active tickets across multiple locations
  const conflictData = useMemo(() => {
    const carMap = new Map<string, MaintenanceItemForConflict[]>()
    
    items.forEach(item => {
      // Exclude completed tickets and STILL_WORK (only check cars physically in repair flow)
      if (item.status_code === 'COMPLETE' || item.status_code === 'STILL_WORK') return
      
      const key = (item.register_no && item.register_no.trim() !== '' && item.register_no !== '-') 
        ? item.register_no.trim() 
        : item.vin
      if (!key) return

      const list = carMap.get(key) || []
      list.push(item)
      carMap.set(key, list)
    })

    const carsList: Array<{
      carKey: string
      registerNo: string
      vin: string
      model: string
      project: string
      currentLocation: string | null
      distinctLocations: string[]
      tickets: MaintenanceItemForConflict[]
    }> = []

    carMap.forEach((tickets, key) => {
      if (tickets.length <= 1) return

      const locCodes = tickets.map(t => (t.service_location_code || t.service_location || '').trim())
      const distinctLocSet = new Set(locCodes.map(l => l || 'UNSPECIFIED'))

      if (distinctLocSet.size <= 1) return // all tickets specify the same location

      const first = tickets[0]
      const regNo = (first.register_no && first.register_no.trim() !== '' && first.register_no !== '-') 
        ? first.register_no.trim() 
        : first.vin

      carsList.push({
        carKey: key,
        registerNo: regNo,
        vin: first.vin,
        model: first.model || '-',
        project: first.project || '-',
        currentLocation: first.current_location || null,
        distinctLocations: Array.from(distinctLocSet),
        tickets: [...tickets].sort((a, b) => {
          const order: Record<string, number> = {
            IN_MAINTENANCE: 1,
            WAITING_FOR_MAINTENANCE: 2,
            READY_PICKUP_MAINTENANCE: 3,
            GARAGE_COMPLETE: 4,
          }
          return (order[a.status_code] || 9) - (order[b.status_code] || 9)
        })
      })
    })

    carsList.sort((a, b) => b.tickets.length - a.tickets.length)

    return {
      cars: carsList,
      totalTickets: carsList.reduce((sum, c) => sum + c.tickets.length, 0),
    }
  }, [items])

  const toggleRow = (carKey: string) => {
    setExpandedRows(prev => ({ ...prev, [carKey]: !prev[carKey] }))
  }

  // If no discrepancies found
  if (conflictData.cars.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-white dark:from-amber-950/20 dark:via-zinc-900/60 dark:to-zinc-900/40 rounded-2xl border border-amber-300/80 dark:border-amber-800/60 p-3.5 sm:p-4 shadow-xs transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-amber-200/60 dark:border-amber-800/40 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">📍⚡</span>
            <span className="text-sm sm:text-base font-black px-2.5 py-0.5 rounded-lg bg-amber-600 text-white shadow-xs tracking-tight">
              ข้อสังเกต
            </span>
            <h2 className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-200 tracking-tight">
              รถ 1 คันมีหลายใบงานระบุหลาย Location (ต้องตรวจสอบตำแหน่งจริง)
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs">
              {conflictData.cars.length} คัน ({conflictData.totalTickets} ใบงาน)
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-amber-900/80 dark:text-amber-300">
            <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <span>⚠️</span>
              <span>เพื่อให้ข้อมูลถูกต้องกรุณาตรวจสอบ หากมีข้อมูลไม่ถูกต้องให้รีบดำเนินการแก้ไข</span>
            </span>
            <span className="text-amber-700/40 dark:text-amber-500/40">•</span>
            <span className="text-[10px] text-amber-800/70 dark:text-amber-400/70">
              ไม่รวมรถที่ยังขับได้
            </span>
          </div>
        </div>

        {/* Controls - Collapse Button Only */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-[10px] px-2.5 py-1 rounded-xl bg-white/80 dark:bg-zinc-800 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-white transition-all font-semibold flex items-center gap-1 shadow-2xs"
          >
            <span>{isCollapsed ? 'แสดงตาราง' : 'ย่อ'}</span>
            <span className="text-[8px]">{isCollapsed ? '▼' : '▲'}</span>
          </button>
        </div>
      </div>

      {/* Compact Table View */}
      {!isCollapsed && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-amber-100/50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 border-b border-amber-200/80 dark:border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider">
                <th className="py-2 px-2.5 w-10 text-center">#</th>
                <th className="py-2 px-2.5 min-w-[140px]">ทะเบียน / รถ</th>
                <th className="py-2 px-2.5 min-w-[200px]">สถานที่ที่ขัดแย้ง</th>
                <th className="py-2 px-2.5 min-w-[260px]">ใบงานค้างซ่อม ({conflictData.totalTickets} ใบ)</th>
                <th className="py-2 px-2.5 min-w-[120px]">ตำแหน่งในระบบ</th>
                <th className="py-2 px-2.5 text-right w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-[11px]">
              {conflictData.cars.map((car, idx) => {
                const isExpanded = expandedRows[car.carKey] === true

                // Map locations to color badges
                const locColorMap: Record<string, string> = {}
                car.distinctLocations.forEach((loc, lIdx) => {
                  locColorMap[loc] = LOCATION_COLORS[lIdx % LOCATION_COLORS.length]
                })

                return (
                  <React.Fragment key={car.carKey}>
                    <tr className="hover:bg-amber-50/40 dark:hover:bg-zinc-800/50 transition-colors">
                      {/* # Index */}
                      <td className="py-2 px-2.5 text-center font-bold text-zinc-400 text-[10px]">
                        {idx + 1}
                      </td>

                      {/* Plate / Vehicle Info */}
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-zinc-900 dark:text-zinc-100">
                            {car.registerNo}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {car.project}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate max-w-[150px]" title={`${car.model} • VIN: ${car.vin}`}>
                          {car.model} • <span className="font-mono text-[9px]">{car.vin.slice(-8)}</span>
                        </div>
                      </td>

                      {/* Conflict Locations */}
                      <td className="py-2 px-2.5">
                        <div className="flex flex-wrap gap-1">
                          {car.distinctLocations.map((loc) => {
                            const display = loc === 'UNSPECIFIED' || loc === 'ไม่ระบุ' || !loc 
                              ? 'ไม่ระบุพื้นที่/อู่' 
                              : formatLocation(loc)
                            const colorCls = locColorMap[loc] || LOCATION_COLORS[0]
                            return (
                              <span
                                key={loc}
                                className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold border flex items-center gap-0.5 ${colorCls}`}
                              >
                                <span>📍</span>
                                <span className="truncate max-w-[130px]" title={display}>
                                  {display}
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      </td>

                      {/* Tickets Summary Pills */}
                      <td className="py-2 px-2.5">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {car.tickets.slice(0, 3).map((t) => {
                            const rawLoc = t.service_location_code || t.service_location || 'UNSPECIFIED'
                            const displayLoc = rawLoc === 'UNSPECIFIED' || rawLoc === 'ไม่ระบุ' || !rawLoc 
                              ? 'ไม่ระบุ' 
                              : formatLocation(rawLoc)
                            const statusInfo = getStatusBadge(t.status_code)

                            return (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px]"
                                title={t.issue_title ? `#${t.id}: ${t.issue_title}` : `#${t.id}`}
                              >
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                  #{t.id}
                                </span>
                                <span className={`px-1 py-0.2 rounded text-[8px] font-bold border ${statusInfo.cls}`}>
                                  {statusInfo.label}
                                </span>
                                <span className="text-zinc-500 dark:text-zinc-400 font-medium truncate max-w-[90px]">
                                  📍{displayLoc}
                                </span>
                              </span>
                            )
                          })}
                          {car.tickets.length > 3 && (
                            <button
                              type="button"
                              onClick={() => toggleRow(car.carKey)}
                              className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 underline"
                            >
                              +{car.tickets.length - 3} ใบ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleRow(car.carKey)}
                            className="text-[9px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 ml-0.5"
                            title={isExpanded ? 'ย่อรายละเอียด' : 'ดูรายละเอียดปัญหา'}
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                      </td>

                      {/* Current Location in System */}
                      <td className="py-2 px-2.5 text-zinc-600 dark:text-zinc-400 text-[10px]">
                        <span className="truncate block max-w-[120px]" title={car.currentLocation ? formatLocation(car.currentLocation) : 'ไม่ระบุ'}>
                          📌 {car.currentLocation ? formatLocation(car.currentLocation) : 'ไม่ระบุ'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2.5 text-right space-x-1 shrink-0">
                        {onSelectCar && (
                          <button
                            type="button"
                            onClick={() => onSelectCar(car.registerNo)}
                            title="กรองดูใบงานคันนี้ในตารางด้านล่าง"
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300 transition-all"
                          >
                            🔍 กรอง
                          </button>
                        )}
                        <a
                          href={`/vehicle/${encodeURIComponent(car.registerNo)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                          title="ดูประวัติรถคันนี้"
                        >
                          ประวัติ ↗
                        </a>
                      </td>
                    </tr>

                    {/* Expandable detail row for issues */}
                    {isExpanded && (
                      <tr className="bg-amber-50/30 dark:bg-zinc-800/30">
                        <td colSpan={6} className="py-2 px-4 border-b border-zinc-100 dark:border-zinc-800">
                          <div className="text-[10px] space-y-1">
                            <span className="font-bold text-amber-900 dark:text-amber-300">
                              📋 รายละเอียดใบงานค้างของรถ {car.registerNo}:
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 mt-1">
                              {car.tickets.map((t) => {
                                const rawLoc = t.service_location_code || t.service_location || 'UNSPECIFIED'
                                const displayLoc = rawLoc === 'UNSPECIFIED' || rawLoc === 'ไม่ระบุ' || !rawLoc 
                                  ? 'ไม่ระบุ' 
                                  : formatLocation(rawLoc)
                                const statusInfo = getStatusBadge(t.status_code)
                                return (
                                  <div key={t.id} className="bg-white dark:bg-zinc-800 p-1.5 rounded border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <span className="font-bold">#{t.id}</span>
                                      <span className={`px-1 py-0.2 rounded text-[8px] font-bold border ${statusInfo.cls}`}>
                                        {statusInfo.label}
                                      </span>
                                      <span className="font-medium text-indigo-700 dark:text-indigo-300 truncate max-w-[120px]">
                                        📍 {displayLoc}
                                      </span>
                                      <span className="text-zinc-500 dark:text-zinc-400 italic truncate max-w-[200px]" title={t.issue_title || ''}>
                                        &ldquo;{t.issue_title?.trim() || '-'}&rdquo;
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-zinc-400 shrink-0">
                                      {formatDateShort(t.report_date || t.update_date)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
