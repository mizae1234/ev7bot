'use client'
import React, { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { RepairRecord } from '@/types'
import { exportToExcel, formatDateForExcel, ExportButton } from '@/lib/exportExcel'

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
  'DAMAGE_LIGHT': 'ซ่อมเบา',
  'DAMAGE_HEAVY': 'ซ่อมหนัก',
}

const mapCode = (code: string | null, map: Record<string, string>): string => {
  if (!code) return '-'
  return map[code] || code.replace(/_/g, ' ')
}

const formatLocation = (code: string | null): string => {
  if (!code) return '-'
  return code.replace(/_/g, ' ')
}

interface RepairTableProps {
  records: RepairRecord[]
  periodLabel?: string
}

export function RepairTable({ records = [], periodLabel = '' }: RepairTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [locationFilter, setLocationFilter] = useState<string>('all')

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

  const getStatusBadge = (status: RepairRecord['status']) => {
    switch (status) {
      case 'closed':
        return <Badge variant="success">ซ่อมเสร็จ</Badge>
      case 'in_progress':
        return <Badge variant="info">กำลังซ่อม</Badge>
      case 'open':
        return <Badge variant="danger">รอเข้าซ่อม</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  const formatDateTh = (dateStr: string | null) => {
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
      headers: ['ทะเบียน', 'เลขตัวถัง (VIN)', 'รุ่น', 'อาการ', 'สถานที่ซ่อม', 'ประเภทปัญหา', 'เคส', 'วันที่แจ้ง', 'วันที่เสร็จ', 'สถานะ'],
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
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold">
              <th className="pb-3 pr-2">ทะเบียน</th>
              <th className="pb-3 pr-2">รุ่น</th>
              <th className="pb-3 pr-2">อาการ</th>
              <th className="pb-3 pr-2">📍 สถานที่ซ่อม</th>
              <th className="pb-3 pr-2">ประเภท</th>
              <th className="pb-3 pr-2">เคส</th>
              <th className="pb-3 pr-2">วันที่แจ้ง</th>
              <th className="pb-3 pr-2">วันที่เสร็จ</th>
              <th className="pb-3 text-right">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((rec, i) => (
                <tr key={rec.order_id + '-' + i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150">
                  <td className="py-3.5 pr-2 font-mono font-medium">{rec.vehicle_id}</td>
                  <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{rec.model || '-'}</td>
                  <td className="py-3.5 pr-2 max-w-[180px] truncate text-zinc-800 dark:text-zinc-200" title={rec.description}>
                    {rec.description || '-'}
                  </td>
                  <td className="py-3.5 pr-2 text-emerald-700 dark:text-emerald-400 font-medium">
                    {formatLocation(rec.service_location)}
                  </td>
                  <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">
                    {mapCode(rec.problem_type, problemTypeMap)}
                  </td>
                  <td className="py-3.5 pr-2">
                    {rec.car_case && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        rec.car_case === 'DAMAGE_HEAVY' 
                          ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                          : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}>
                        {mapCode(rec.car_case, carCaseMap)}
                      </span>
                    )}
                    {!rec.car_case && '-'}
                  </td>
                  <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{formatDateTh(rec.report_date)}</td>
                  <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{formatDateTh(rec.finish_date)}</td>
                  <td className="py-3.5 text-right">{getStatusBadge(rec.status)}</td>
                </tr>
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
    </div>
  )
}
