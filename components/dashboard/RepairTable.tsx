'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { RepairRecord } from '@/types'
import { exportToExcel, formatDateForExcel, ExportButton } from '@/lib/exportExcel'
import { Pagination } from '@/components/ui/Pagination'

// ─── Code → Thai Description Maps ──────────────────────────────────
const problemTypeMap: Record<string, string> = {
  'PRODUCT': 'ผลิตภัณฑ์',
  'ACCIDENT': 'อุบัติเหตุ',
  'USAGE': 'การใช้งาน',
  'WEAR': 'สึกหรอ',
}
const faultPartyMap: Record<string, string> = {
  'FAULT_DRIVER': 'คนขับ',
  'FAULT_COUNTERPARTY': 'คู่กรณี',
  'FAULT_OTHER': 'อื่นๆ',
  'FAULT_MANUFACTURER': 'ผู้ผลิต',
  'DRIVER': 'คนขับ',
  'COUNTERPART': 'คู่กรณี',
  'OTHER': 'อื่นๆ',
  'MANUFACTURER': 'ผู้ผลิต',
}
const carCaseMap: Record<string, string> = {
  'DAMAGE_LIGHT': 'เคสซ่อมเบา',
  'DAMAGE_HEAVY': 'เคสซ่อมหนัก',
}
const insuranceMap: Record<string, string> = {
  'ICARE_INSURANCE': 'ไอแคร์ประกันภัย',
  'MUANGTHAI_INSURANCE': 'เมืองไทยประกันภัย',
  'NO_INSURANCE': 'ไม่มีประกัน',
}
const carStatusMap: Record<string, string> = {
  'COMPLETE': 'ซ่อมเสร็จ',
  'IN_MAINTENANCE': 'อยู่ระหว่างการซ่อม',
  'WAITING_FOR_MAINTENANCE': 'รอเข้าซ่อม',
  'STILL_WORK': 'ยังวิ่งอยู่',
  'READY_PICKUP_MAINTENANCE': 'รถซ่อมเสร็จ รอลูกค้ามารับ',
}
const mapCode = (code: string | null | undefined, map: Record<string, string>): string => {
  if (!code) return '-'
  return map[code] || code.replace(/_/g, ' ')
}

const locationMap: Record<string, string> = {
  'AION_GI_KANCHANAPISEK': 'Aion กาญจนาฯ',
  'AION_GI_RAMINTRA_EXPRESSWAY': 'Aion เลียบด่วนฯ',
  'AION_GI_PIBULSONGKRAM': 'Aion พิบูลฯ',
  'AION_GI_MINBURI': 'Aion มีนบุรี',
  'AION_GI_MAHACHAI': 'Aion มหาชัย',
  'AION_GI_SALAYA': 'Aion ศาลายา',
  'EV7_YARD_PRAPADAENG': 'EV7 Yard พระประแดง',
  'SMART_TAXI': 'สมาร์ทเแท็กซี่',
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
  'BRANCH_AYUTTHAYA': 'สาขา อยุธยา',
  'BB_CARPAINT': 'อู่ บีบี คาร์เพ้นท์',
  'AUTOHAUS': 'อู่ Autohaus'
}

const formatLocation = (code: string | null | undefined): string => {
  if (!code) return '-'
  return locationMap[code] || code.replace(/_/g, ' ')
}

interface RepairTableProps {
  records: RepairRecord[]
  periodLabel?: string
}

export function RepairTable({ records = [], periodLabel = '' }: RepairTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const itemsPerPage = 10

  // Extract unique locations for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>()
    records.forEach(r => {
      if (r.service_location) locs.add(r.service_location)
    })
    return Array.from(locs).sort()
  }, [records])

  const filteredRecords = records.filter((rec) => {
    const matchesSearch = 
      (rec.order_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.vehicle_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.vin || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.model || '').toLowerCase().includes(search.toLowerCase())
      
    const matchesStatus = 
      statusFilter === 'all' || 
      rec.status === statusFilter

    const matchesLocation = 
      locationFilter === 'all' ||
      rec.service_location === locationFilter

    return matchesSearch && matchesStatus && matchesLocation
  })

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
    setExpandedId(null)
  }, [search, statusFilter, locationFilter])

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage)
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getStatusColor = (code: string | null | undefined) => {
    if (!code) return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400'
    switch (code.toUpperCase()) {
      case 'IN_MAINTENANCE': return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400'
      case 'COMPLETE': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400'
      case 'WAITING_FOR_MAINTENANCE': return 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400'
      case 'STILL_WORK': return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400'
      case 'READY_PICKUP_MAINTENANCE': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400'
      default: return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400'
    }
  }

  const getCaseColor = (code: string | null | undefined) => {
    if (!code) return ''
    const upper = code.toUpperCase()
    if (upper === 'ซ่อมหนัก' || upper === 'เคสซ่อมหนัก' || upper === 'DAMAGE_HEAVY') return 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
    if (upper === 'ซ่อมเบา' || upper === 'เคสซ่อมเบา' || upper === 'DAMAGE_LIGHT') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    return ''
  }

  const formatDateTh = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok'
      })
    } catch {
      return dateStr
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'closed': return 'ซ่อมเสร็จ'
      case 'in_progress': return 'กำลังซ่อม'
      case 'open': return 'รอเข้าซ่อม'
      default: return status
    }
  }

  const handleExport = () => {
    exportToExcel({
      reportName: 'รายการงานซ่อม',
      periodLabel: periodLabel || '-',
      headers: ['ทะเบียน', 'เลขตัวถัง (VIN)', 'รุ่น', 'อาการ', 'สถานที่ซ่อม', 'ประเภทปัญหา', 'เคส', 'วันที่แจ้ง', 'วันที่เสร็จ', 'สถานะ', 'ผู้สร้าง', 'ผู้แก้ไข'],
      rows: filteredRecords.map(rec => [
        rec.vehicle_id,
        rec.vin || '-',
        rec.model || '-',
        rec.description || '-',
        formatLocation(rec.service_location),
        mapCode(rec.problem_type, problemTypeMap),
        mapCode(rec.car_case, carCaseMap),
        formatDateForExcel(rec.report_date),
        formatDateForExcel(rec.finish_date),
        getStatusText(rec.status),
        rec.create_user_name || '-',
        rec.update_user_name || '-',
      ]),
      fileName: 'รายการงานซ่อม',
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">รายการงานซ่อม</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">รายการรับซ่อม ตรวจสภาพ และบริการเทคนิค</p>
        </div>
        
        {/* Search & Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="ค้นหา ทะเบียน, VIN, อาการ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="closed">ซ่อมเสร็จ</option>
            <option value="in_progress">กำลังซ่อม</option>
            <option value="open">รอเข้าซ่อม</option>
          </select>
          {uniqueLocations.length > 0 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
            >
              <option value="all">อู่ทั้งหมด</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{formatLocation(loc)}</option>
              ))}
            </select>
          )}
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold bg-zinc-50/50 dark:bg-zinc-900/50">
              <th className="py-3 px-4 w-6"></th>
              <th className="py-3 pr-2">📍 สถานที่ซ่อม</th>
              <th className="py-3 pr-2">👤 ผู้รับผิดชอบตามงาน</th>
              <th className="py-3 pr-2">ทะเบียน / VIN</th>
              <th className="py-3 pr-2">รุ่น</th>
              <th className="py-3 pr-2">อาการ</th>
              <th className="py-3 pr-2">ประเภท</th>
              <th className="py-3 pr-2">เคส</th>
              <th className="py-3 pr-2">วันที่แจ้ง</th>
              <th className="py-3 pr-4 text-right">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((rec, i) => (
                <React.Fragment key={rec.order_id + '-' + i}>
                  <tr 
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === rec.order_id ? null : rec.order_id)}
                  >
                    <td className="py-3.5 px-4 text-zinc-400">
                      <span className={`inline-block transition-transform duration-200 ${expandedId === rec.order_id ? 'rotate-90' : ''}`}>▶</span>
                    </td>
                    <td className="py-3.5 pr-2 text-emerald-700 dark:text-emerald-400 font-medium">
                      {formatLocation(rec.service_location)}
                    </td>
                    <td className="py-3.5 pr-2 font-semibold">
                      {(() => {
                        const statusCode = (rec.status_code || (rec.status === 'closed' ? 'COMPLETE' : rec.status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE')).toUpperCase()
                        if (statusCode === 'READY_PICKUP_MAINTENANCE' || statusCode === 'STILL_WORK') {
                          return (
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-750 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
                              EV7/ICI
                            </span>
                          )
                        } else if (statusCode === 'COMPLETE') {
                          return <span className="text-zinc-400 font-normal">-</span>
                        } else {
                          return (
                            <span className="text-zinc-700 dark:text-zinc-350">
                              {formatLocation(rec.service_location) || '-'}
                            </span>
                          )
                        }
                      })()}
                    </td>
                    <td className="py-3.5 pr-2" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`/vehicle/${encodeURIComponent(rec.vehicle_id || rec.vin || '')}`}
                        className="font-mono font-bold text-indigo-650 hover:text-indigo-855 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                      >
                        {rec.vehicle_id || '-'}
                      </a>
                      <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{rec.vin}</div>
                    </td>
                    <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{rec.model || '-'}</td>
                    <td className="py-3.5 pr-2 max-w-[180px] truncate text-zinc-800 dark:text-zinc-200" title={rec.description}>
                      {rec.description || '-'}
                    </td>
                    <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">
                      {mapCode(rec.problem_type, problemTypeMap)}
                    </td>
                    <td className="py-3.5 pr-2">
                      {rec.car_case && (
                        <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${getCaseColor(rec.car_case)}`}>
                          {mapCode(rec.car_case, carCaseMap)}
                        </span>
                      )}
                      {!rec.car_case && '-'}
                    </td>
                    <td className="py-3.5 pr-2 text-zinc-650 dark:text-zinc-450">{formatDateTh(rec.report_date)}</td>
                    <td className="py-3.5 pr-4 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(rec.status_code || (rec.status === 'closed' ? 'COMPLETE' : rec.status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE'))}`}>
                        {mapCode(rec.status_code || (rec.status === 'closed' ? 'COMPLETE' : rec.status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE'), carStatusMap)}
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {expandedId === rec.order_id && (
                    <tr className="bg-zinc-50/85 dark:bg-zinc-800/40">
                      <td colSpan={9} className="px-6 py-5">
                        <div className="space-y-4">
                          {/* Title / ID info */}
                          <div className="flex items-center gap-3 text-xs font-bold text-zinc-500 dark:text-zinc-450 pb-2 border-b border-zinc-250/60 dark:border-zinc-700/60">
                            <span>🆔 ใบสั่งซ่อม ID: <span className="text-zinc-800 dark:text-zinc-200 font-mono">{rec.order_id}</span></span>
                            <span>•</span>
                            <span>🚗 ทะเบียน/VIN: <span className="text-zinc-800 dark:text-zinc-200 font-mono">{rec.vehicle_id || '-'} / {rec.vin}</span></span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3.5 text-xs">
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🏢 โครงการ:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{rec.project || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🚗 รุ่นรถ:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{rec.model || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🔧 อาการที่แจ้ง:</span>
                              <span className="text-zinc-800 dark:text-zinc-200 font-medium">{rec.description || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">⚠️ ประเภทปัญหา:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{mapCode(rec.problem_type, problemTypeMap)}</span>
                            </div>

                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">💼 เคสการซ่อม:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{mapCode(rec.car_case, carCaseMap)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🛡️ ประกันภัย:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{mapCode(rec.insurance, insuranceMap)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">👤 ฝ่ายที่ผิด (ผู้รับผิดชอบ):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{mapCode(rec.fault_party, faultPartyMap)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📍 สถานที่ซ่อม (อู่):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">
                                {formatLocation(rec.service_location)}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-455 font-bold block mb-1">📞 ผู้รับผิดชอบตามงาน:</span>
                              <span className="text-indigo-650 dark:text-indigo-400 font-bold">
                                {(() => {
                                  const statusCode = (rec.status_code || (rec.status === 'closed' ? 'COMPLETE' : rec.status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE')).toUpperCase()
                                  if (statusCode === 'READY_PICKUP_MAINTENANCE' || statusCode === 'STILL_WORK') return 'EV7/ICI'
                                  if (statusCode === 'COMPLETE') return '-'
                                  return formatLocation(rec.service_location) || '-'
                                })()}
                              </span>
                            </div>

                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">⚙️ สถานะการซ่อม:</span>
                              <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                                {mapCode(rec.status_code || (rec.status === 'closed' ? 'COMPLETE' : rec.status === 'in_progress' ? 'IN_MAINTENANCE' : 'WAITING_FOR_MAINTENANCE'), carStatusMap)}
                              </span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันแจ้งซ่อม (Report):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.report_date)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันเกิดเหตุ (Incident):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.incident_date)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันเริ่มเข้าซ่อม (Start):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.start_date)}</span>
                            </div>

                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันซ่อมเสร็จ (Finish):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.finish_date)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">👤 คนขับ (Driver):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{rec.driver_name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🔍 สาเหตุที่พบ (Root Cause):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{rec.root_cause || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🛠️ การแก้ไข (Fix Action):</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{rec.fix_action || '-'}</span>
                            </div>

                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันติดตามล่าสุด:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.last_follow_up_date)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">🔗 ใบสั่งซ่อมหลัก ID:</span>
                              <span className="text-zinc-800 dark:text-zinc-200 font-mono">{rec.parent_maintenance_id || '-'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันที่สร้างใบสั่งซ่อม:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.create_date)}</span>
                            </div>
                            <div>
                              <span className="text-zinc-450 font-bold block mb-1">📅 วันที่อัปเดตล่าสุด:</span>
                              <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(rec.update_date)}</span>
                            </div>
                          </div>

                          {/* Follow up notes */}
                          <div className="pt-2">
                            <span className="text-zinc-450 font-bold block mb-1">📝 บันทึกติดตาม/หมายเหตุ (Follow Up):</span>
                            <p className="text-zinc-800 dark:text-zinc-200 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200/40 dark:border-zinc-700/40">
                              {rec.follow_up || '-'}
                            </p>
                          </div>

                          {/* Replacement cars */}
                          {rec.replacements && rec.replacements.length > 0 && (
                            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                              <span className="text-emerald-650 dark:text-emerald-400 font-bold block mb-2">🚙 รถทดแทน:</span>
                              <div className="space-y-1.5">
                                {rec.replacements.map((r, idx) => (
                                  <div key={idx} className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5 w-fit text-xs">
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                      ทะเบียน: {r.register_no || '-'}
                                    </span>
                                    <span className="text-zinc-350 dark:text-zinc-600">|</span>
                                    <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
                                      เลขตัวถัง (VIN): {r.vin || '-'}
                                    </span>
                                    <span className="text-zinc-350 dark:text-zinc-600">|</span>
                                    <span className="text-zinc-500 dark:text-zinc-450">
                                      เริ่มใช้: {formatDateTh(r.start_date)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Link to vehicle detail */}
                          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                            <a
                              href={`/vehicle/${encodeURIComponent(rec.vehicle_id || rec.vin || '')}`}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                            >
                              🔗 ดูข้อมูลรถคันนี้
                            </a>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-10 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                  ไม่พบข้อมูลรายการงานซ่อม
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={filteredRecords.length}
        itemsPerPage={itemsPerPage}
      />
    </div>
  )
}
