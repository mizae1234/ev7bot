'use client'

import React, { useState, useEffect, useMemo, useDeferredValue, memo } from 'react'
import { exportToExcel, formatDateForExcelRaw, ExportButton } from '@/lib/exportExcel'
import { Pagination } from '@/components/ui/Pagination'
import { downloadImportTemplate } from '@/lib/maintenance-import/template'
import { getCarCaseCategory } from '@/components/maintenance/MaintenanceTicketTree'
import {
  formatDateTh,
  type CarCaseFilterType,
  type MaintenanceItem,
} from './types'

interface StatusCounts {
  total: number
  activeRepair: number
  inMaint: number
  waiting: number
  readyPickup: number
  complete: number
  stillWork: number
}

interface MaintenanceTicketsTableProps {
  items: MaintenanceItem[]
  isLoading: boolean
  error: unknown
  statusFilter: string
  onChangeStatusFilter: (s: string) => void
  locationFilter: string
  onChangeLocationFilter: (loc: string) => void
  problemTypeFilter: string
  onChangeProblemTypeFilter: (pt: string) => void
  carCaseFilter: CarCaseFilterType
  locations: string[]
  problemTypes: { code: string; name: string }[]
  statusCounts: StatusCounts
  externalSearch: string
  onExternalSearchConsumed?: () => void
  formatLocation: (code: string | null | undefined) => string
  onOpenImport: () => void
}

function getStatusColor(code: string): string {
  switch (code) {
    case 'IN_MAINTENANCE':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400'
    case 'COMPLETE':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400'
    case 'WAITING_FOR_MAINTENANCE':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400'
    case 'STILL_WORK':
      return 'bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400'
    case 'READY_PICKUP_MAINTENANCE':
    case 'GARAGE_COMPLETE':
      return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400'
    default:
      return 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:bg-zinc-500/20 dark:text-zinc-400'
  }
}

function getCaseColor(carCase: string): string {
  if (carCase.includes('หนัก')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  if (carCase.includes('เบา')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400'
}

function getStatusFilterLabel(statusFilter: string): string {
  switch (statusFilter) {
    case 'READY_PICKUP_MAINTENANCE': return 'ซ่อมเสร็จ รอลูกค้ามารับ'
    case 'ACTIVE_REPAIR': return 'เฉพาะค้างซ่อม'
    case 'COMPLETE': return 'ปิดงานแล้ว (ซ่อมเสร็จ)'
    case 'PENDING_ALL': return 'งานค้างทั้งหมด'
    case 'IN_MAINTENANCE': return 'กำลังซ่อม'
    case 'WAITING_FOR_MAINTENANCE': return 'รอเข้าซ่อม'
    case 'STILL_WORK': return 'รถยังขับได้'
    default: return statusFilter
  }
}

function MaintenanceTicketsTableComponent({
  items,
  isLoading,
  error,
  statusFilter,
  onChangeStatusFilter,
  locationFilter,
  onChangeLocationFilter,
  problemTypeFilter,
  onChangeProblemTypeFilter,
  carCaseFilter,
  locations,
  problemTypes,
  statusCounts,
  externalSearch,
  onExternalSearchConsumed,
  formatLocation,
  onOpenImport,
}: MaintenanceTicketsTableProps) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Accept search jump from MultiLocationTicketsBlock without keeping search state in parent
  useEffect(() => {
    if (externalSearch) {
      setSearch(externalSearch)
      onExternalSearchConsumed?.()
    }
  }, [externalSearch, onExternalSearchConsumed])

  useEffect(() => {
    setCurrentPage(1)
    setExpandedId(null)
  }, [statusFilter, locationFilter, problemTypeFilter, carCaseFilter, deferredSearch, itemsPerPage])

  const filteredItems = useMemo(() => {
    const s = deferredSearch.trim().toLowerCase()
    return items.filter(item => {
      if (problemTypeFilter !== 'all' && item.problem_type !== problemTypeFilter) return false
      if (carCaseFilter !== 'all') {
        const itemCase = getCarCaseCategory(item.car_case)
        if (itemCase !== carCaseFilter) return false
      }
      if (!s) return true
      return (
        (item.register_no || '').toLowerCase().includes(s) ||
        (item.vin || '').toLowerCase().includes(s) ||
        (item.model || '').toLowerCase().includes(s) ||
        (item.issue_title || '').toLowerCase().includes(s) ||
        (item.service_location || '').toLowerCase().includes(s)
      )
    })
  }, [items, problemTypeFilter, carCaseFilter, deferredSearch])

  const uniqueFilteredCarsCount = useMemo(() => {
    const set = new Set(filteredItems.map(item => item.vin || item.register_no).filter(Boolean))
    return set.size
  }, [filteredItems])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage
    return filteredItems.slice(start, start + itemsPerPage)
  }, [filteredItems, safeCurrentPage, itemsPerPage])

  const handleExport = () => {
    const statusLabel = statusFilter === 'all' ? 'ทั้งหมด' : getStatusFilterLabel(statusFilter)
    const locLabel = locationFilter === 'all' ? 'ทุกอู่' : formatLocation(locationFilter)
    const typeLabel = problemTypeFilter === 'all' ? 'ทุกประเภท' : problemTypeFilter
    exportToExcel({
      reportName: 'รายการงานซ่อมทั้งหมด',
      periodLabel: `สถานะ: ${statusLabel} | อู่: ${locLabel} | ประเภท: ${typeLabel}`,
      headers: [
        'ทะเบียน', 'เลขตัวถัง (VIN)', 'รุ่น', 'โครงการ', 'อาการ', 'สถานที่ซ่อม',
        'ผู้รับผิดชอบตามงาน', 'ตำแหน่งปัจจุบันของรถ', 'ประเภทปัญหา', 'เคส',
        'ผู้รับผิดชอบ', 'ประกัน', 'วันแจ้ง', 'วันเกิดเหตุ', 'วันเริ่มซ่อม',
        'วันที่คาดว่าจะซ่อมเสร็จ', 'วันซ่อมเสร็จ', 'วันรับคืน', 'สถานะ',
        'รถทดแทน', 'หมายเหตุ', 'ผู้สร้าง', 'ผู้แก้ไข', 'วันที่อัปเดตล่าสุด'
      ],
      rows: filteredItems.map(item => [
        item.register_no || '-',
        item.vin,
        item.model || '-',
        item.project || '-',
        item.issue_title || '-',
        formatLocation(item.service_location_code || item.service_location),
        (() => {
          const code = item.status_code || ''
          if (code === 'READY_PICKUP_MAINTENANCE') return 'EV7'
          if (code === 'COMPLETE') return '-'
          return formatLocation(item.service_location_code || item.service_location) || '-'
        })(),
        item.current_location || '-',
        item.problem_type,
        item.car_case,
        item.fault_party,
        item.insurance,
        formatDateForExcelRaw(item.report_date),
        formatDateForExcelRaw(item.incident_date),
        formatDateForExcelRaw(item.start_date),
        formatDateForExcelRaw(item.expected_finish_date),
        formatDateForExcelRaw(item.finish_date),
        formatDateForExcelRaw(item.return_date),
        item.status_text,
        item.replacements.map(r => r.register_no || r.vin).join(', ') || '-',
        item.follow_up || '-',
        item.create_user_name || '-',
        item.update_user_name || '-',
        formatDateForExcelRaw(item.update_date),
      ]),
      fileName: 'รายการงานซ่อม',
    })
  }

  return (
    <div className="space-y-4">
      {/* Section Header & Quick Status Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight">
              ข้อมูลใบงานซ่อมทั้งหมด
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800">
              {filteredItems.length} ใบงาน ({uniqueFilteredCarsCount} คัน)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            รายการใบงานซ่อมทั้งหมดในระบบ • ค้นหาและกรองตามสถานะ อู่ และประเภทงาน
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => onChangeStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                : 'bg-white/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="text-[10px] opacity-75">({statusCounts.total})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeStatusFilter('ACTIVE_REPAIR')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
              statusFilter === 'ACTIVE_REPAIR'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                : 'bg-white/80 dark:bg-zinc-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-50'
            }`}
          >
            <span>🟠 เฉพาะค้างซ่อม</span>
            <span className="text-[10px] opacity-75">({statusCounts.activeRepair})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeStatusFilter('READY_PICKUP_MAINTENANCE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
              statusFilter === 'READY_PICKUP_MAINTENANCE'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                : 'bg-white/80 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50'
            }`}
          >
            <span>🔵 รวมซ่อมเสร็จรอลูกค้ามารับ</span>
            <span className="text-[10px] opacity-75">({statusCounts.readyPickup})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeStatusFilter('COMPLETE')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
              statusFilter === 'COMPLETE'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                : 'bg-white/80 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <span>🟢 ปิดงานแล้ว (ซ่อมเสร็จ)</span>
            <span className="text-[10px] opacity-75">({statusCounts.complete})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeStatusFilter('STILL_WORK')}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs flex items-center gap-1.5 ${
              statusFilter === 'STILL_WORK'
                ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-400'
                : 'bg-white/80 dark:bg-zinc-800 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-50'
            }`}
          >
            <span>🚗 รถยังขับได้</span>
            <span className="text-[10px] opacity-75">({statusCounts.stillWork})</span>
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap gap-3 items-center bg-white/60 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80">
        <input
          id="maintenance-search-input"
          type="text"
          placeholder="🔍 ค้นหา ทะเบียน, VIN, อาการ, อู่..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
        />

        <select
          value={statusFilter}
          onChange={(e) => onChangeStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200 font-medium"
        >
          <option value="all">🔄 สถานะทั้งหมด (รวมซ่อมเสร็จแล้ว - {statusCounts.total})</option>
          <option value="ACTIVE_REPAIR">🟠 เฉพาะค้างซ่อม ({statusCounts.activeRepair})</option>
          <option value="IN_MAINTENANCE">🟡 กำลังซ่อม ({statusCounts.inMaint})</option>
          <option value="WAITING_FOR_MAINTENANCE">🔴 รอเข้าซ่อม ({statusCounts.waiting})</option>
          <option value="READY_PICKUP_MAINTENANCE">🔵 รวมซ่อมเสร็จรอลูกค้ามารับ ({statusCounts.readyPickup})</option>
          <option value="COMPLETE">🟢 ปิดงานแล้ว (ซ่อมเสร็จ) ({statusCounts.complete})</option>
          <option value="STILL_WORK">🚗 รถยังขับได้ ({statusCounts.stillWork})</option>
        </select>

        {locations.length > 0 && (
          <select
            value={locationFilter}
            onChange={(e) => onChangeLocationFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
          >
            <option value="all">📍 อู่ทั้งหมด</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{formatLocation(loc)}</option>
            ))}
            <option value="ไม่ระบุ">📍 ไม่ระบุพื้นที่/อู่</option>
          </select>
        )}

        <select
          value={problemTypeFilter}
          onChange={(e) => onChangeProblemTypeFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-white/50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
        >
          <option value="all">🏷️ ประเภททั้งหมด</option>
          {problemTypes.map(pt => (
            <option key={pt.code} value={pt.name}>{pt.name}</option>
          ))}
        </select>

        <ExportButton onClick={handleExport} />

        <button
          type="button"
          onClick={onOpenImport}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 px-3 py-1.5 rounded-xl transition-all duration-200 border border-indigo-500/20 hover:border-indigo-600 shadow-sm hover:shadow-md"
        >
          📤 Import Excel
        </button>

        <button
          type="button"
          onClick={() => downloadImportTemplate().catch(() => alert('ดาวน์โหลด Template ไม่สำเร็จ'))}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-white bg-zinc-500/10 hover:bg-zinc-600 px-3 py-1.5 rounded-xl transition-all duration-200 border border-zinc-500/20 hover:border-zinc-600 shadow-sm hover:shadow-md dark:text-zinc-300"
        >
          📄 Template Import
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )}

      {Boolean(error) && (
        <div className="text-center py-10 text-rose-500">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>
      )}

      {!isLoading && !error && (
        <div className="rounded-2xl border border-zinc-200/80 bg-white/70 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 overflow-hidden">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">
                พบทั้งหมด {filteredItems.length} ใบงาน (จากตัวรถจริง {uniqueFilteredCarsCount} คัน)
                {statusFilter !== 'all' ? ` • สถานะ: ${getStatusFilterLabel(statusFilter)}` : ''}
                {locationFilter !== 'all' ? ` • อู่: ${formatLocation(locationFilter)}` : ''}
                {problemTypeFilter !== 'all' ? ` • ประเภท: ${problemTypeFilter}` : ''}
              </p>
              {filteredItems.length > uniqueFilteredCarsCount && (
                <span className="text-[11px] text-zinc-400">
                  *บางคันมีมากกว่า 1 ใบงาน (เช่น ซ่อมต่อเนื่อง หรือแจ้งหลายอาการ)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className="text-zinc-500 dark:text-zinc-400">แสดงหน้าละ:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-semibold text-xs"
              >
                <option value={25}>25 รายการ</option>
                <option value={50}>50 รายการ</option>
                <option value={100}>100 รายการ</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold bg-zinc-50/50 dark:bg-zinc-900/50">
                  <th className="py-3 px-4"></th>
                  <th className="py-3 pr-2">📍 สถานที่ซ่อม</th>
                  <th className="py-3 pr-2">👤 ผู้รับผิดชอบตามงาน</th>
                  <th className="py-3 pr-2">ทะเบียน / VIN</th>
                  <th className="py-3 pr-2">รุ่น</th>
                  <th className="py-3 pr-2">อาการ</th>
                  <th className="py-3 pr-2">ประเภท</th>
                  <th className="py-3 pr-2">เคส</th>
                  <th className="py-3 pr-2">วันที่แจ้ง</th>
                  <th className="py-3 pr-2">อัปเดตล่าสุด</th>
                  <th className="py-3 pr-2 text-right">สถานะ</th>
                  <th className="py-3 pr-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {paginatedItems.length > 0 ? (
                  paginatedItems.map((item) => (
                    <React.Fragment key={item.id}>
                      <tr
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150 cursor-pointer"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        <td className="py-3.5 px-4 text-zinc-400">
                          <span className={`inline-block transition-transform duration-200 ${expandedId === item.id ? 'rotate-90' : ''}`}>▶</span>
                        </td>
                        <td className="py-3.5 pr-2 text-emerald-700 dark:text-emerald-400 font-medium">
                          {formatLocation(item.service_location_code || item.service_location)}
                        </td>
                        <td className="py-3.5 pr-2 font-semibold">
                          {(() => {
                            const code = item.status_code || ''
                            if (code === 'READY_PICKUP_MAINTENANCE') {
                              return (
                                <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400">
                                  EV7
                                </span>
                              )
                            }
                            if (code === 'COMPLETE') {
                              return <span className="text-zinc-400 font-normal">-</span>
                            }
                            return (
                              <span className="text-zinc-700 dark:text-zinc-300">
                                {formatLocation(item.service_location_code || item.service_location) || '-'}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="py-3.5 pr-2" onClick={(e) => e.stopPropagation()}>
                          <a
                            href={`/vehicle/${encodeURIComponent(item.register_no || item.vin)}`}
                            className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                          >
                            {item.register_no || '-'}
                          </a>
                          <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{item.vin}</div>
                        </td>
                        <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{item.model || '-'}</td>
                        <td className="py-3.5 pr-2 max-w-[200px] truncate" title={item.issue_title}>{item.issue_title || '-'}</td>
                        <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{item.problem_type}</td>
                        <td className="py-3.5 pr-2">
                          {item.car_case !== '-' ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${getCaseColor(item.car_case)}`}>
                              {item.car_case}
                            </span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{formatDateTh(item.report_date)}</td>
                        <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{formatDateTh(item.update_date)}</td>
                        <td className="py-3.5 pr-4 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(item.status_code)}`}>
                            {item.status_text}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {item.status_code === 'STILL_WORK' && (item.register_no || item.vin) && (
                            <a
                              href={`/liff/quick-report?tab=report&registerNo=${encodeURIComponent(item.register_no || item.vin)}&maintId=${item.id}&action=park`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-colors dark:text-amber-400"
                            >
                              🛠️ เข้าซ่อม
                            </a>
                          )}
                        </td>
                      </tr>

                      {expandedId === item.id && (
                        <tr className="bg-zinc-50/80 dark:bg-zinc-800/40">
                          <td colSpan={12} className="px-6 py-5">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 text-xs font-bold text-zinc-500 dark:text-zinc-400 pb-2 border-b border-zinc-200/60 dark:border-zinc-700/60">
                                <span>🆔 ใบสั่งซ่อม ID: <span className="text-zinc-800 dark:text-zinc-200 font-mono">{item.id}</span></span>
                                <span>•</span>
                                <span>🚗 ทะเบียน/VIN: <span className="text-zinc-800 dark:text-zinc-200 font-mono">{item.register_no || '-'} / {item.vin}</span></span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3.5 text-xs">
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🏢 โครงการ:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.project || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🚗 รุ่นรถ:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.model || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🔧 อาการที่แจ้ง:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">{item.issue_title || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">⚠️ ประเภทปัญหา:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.problem_type || '-'}</span>
                                </div>

                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">💼 เคสการซ่อม:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.car_case || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🛡️ ประกันภัย:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.insurance || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">👤 ฝ่ายที่ผิด (ผู้รับผิดชอบ):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.fault_party || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📍 สถานที่ซ่อม (อู่):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">
                                    {formatLocation(item.service_location_code || item.service_location)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📍 ตำแหน่งปัจจุบันของรถ:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.current_location || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📞 ผู้รับผิดชอบตามงาน:</span>
                                  <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                    {(() => {
                                      const code = item.status_code || ''
                                      if (code === 'READY_PICKUP_MAINTENANCE') return 'EV7'
                                      if (code === 'COMPLETE') return '-'
                                      return formatLocation(item.service_location_code || item.service_location) || '-'
                                    })()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">⚙️ สถานะการซ่อม:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                                    {item.status_text || '-'} {item.status_code ? `(${item.status_code})` : ''}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันแจ้งซ่อม (Report):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.report_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันเกิดเหตุ (Incident):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.incident_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันเริ่มเข้าซ่อม (Start):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.start_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🏁 วันที่คาดว่าจะซ่อมเสร็จ (Expected):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.expected_finish_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันซ่อมเสร็จ (Finish):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.finish_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันรับรถคืน (Return):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.return_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">👤 คนขับ (Driver):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.driver_name || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🔍 สาเหตุที่พบ (Root Cause):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.root_cause || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🛠️ การแก้ไข (Fix Action):</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{item.fix_action || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันติดตามล่าสุด:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.last_follow_up_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">🔗 ใบสั่งซ่อมหลัก ID:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200 font-mono">{item.parent_maintenance_id || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันที่สร้างใบสั่งซ่อม:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.create_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">📅 วันที่อัปเดตล่าสุด:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{formatDateTh(item.update_date)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-400 font-bold block mb-1">👤 ID ผู้สร้าง / ผู้แก้ไข:</span>
                                  <span className="text-zinc-800 dark:text-zinc-200">
                                    {item.create_user_id || '-'} / {item.update_user_id || '-'}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2">
                                <span className="text-zinc-400 font-bold block mb-1">📝 บันทึกติดตาม/หมายเหตุ (Follow Up):</span>
                                <p className="text-zinc-800 dark:text-zinc-200 bg-zinc-100/60 dark:bg-zinc-800/40 rounded-xl p-3 border border-zinc-200/40 dark:border-zinc-700/40">
                                  {item.follow_up || '-'}
                                </p>
                              </div>

                              {item.replacements.length > 0 && (
                                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block mb-2">🚙 รถทดแทน:</span>
                                  <div className="space-y-1">
                                    {item.replacements.map((r, i) => (
                                      <div key={i} className="flex items-center gap-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-lg px-3 py-1.5 w-fit">
                                        <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold">{r.register_no || r.vin}</span>
                                        {r.register_no && <span className="text-zinc-400 text-[10px] font-mono">{r.vin}</span>}
                                        <span className="text-zinc-500">{formatDateTh(r.start_date)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
                                <a
                                  href={`/vehicle/${encodeURIComponent(item.register_no || item.vin)}`}
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
                    <td colSpan={12} className="py-20 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                      ไม่พบข้อมูลรายการงานซ่อม
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 pb-4">
              <Pagination
                currentPage={safeCurrentPage}
                totalPages={totalPages}
                onPageChange={(p) => {
                  setCurrentPage(p)
                  setExpandedId(null)
                }}
                totalItems={filteredItems.length}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const MaintenanceTicketsTable = memo(MaintenanceTicketsTableComponent)
