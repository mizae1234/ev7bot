'use client'
import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { DeliveryRecord } from '@/types'
import { exportToExcel, formatDateForExcel, ExportButton } from '@/lib/exportExcel'
import { Pagination } from '@/components/ui/Pagination'

interface DeliveryTableProps {
  records: DeliveryRecord[]
  periodLabel?: string
}

export function DeliveryTable({ records = [], periodLabel = '' }: DeliveryTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredRecords = records.filter((rec) => {
    const matchesSearch = 
      (rec.vehicle_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.vin || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.model || '').toLowerCase().includes(search.toLowerCase())
      
    const matchesStatus = 
      statusFilter === 'all' || 
      rec.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage)
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getStatusBadge = (status: DeliveryRecord['status']) => {
    switch (status) {
      case 'complete':
      case 'delivered':
        return <Badge variant="success">เสร็จสิ้น</Badge>
      case 'in_progress':
        return <Badge variant="info">กำลังเตรียมการ</Badge>
      case 'pending':
        return <Badge variant="warning">รอดำเนินการ</Badge>
      default:
        return <Badge variant="default">{status}</Badge>
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'complete': case 'delivered': return 'เสร็จสิ้น'
      case 'in_progress': return 'กำลังเตรียมการ'
      case 'pending': return 'รอดำเนินการ'
      default: return status
    }
  }

  const formatDateTimeTh = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const date = new Date(dateStr)
      const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0
      
      const dateFormatted = date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok'
      })
      
      if (hasTime) {
        const timeFormatted = date.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Bangkok'
        }) + ' น.'
        return `${dateFormatted} ${timeFormatted}`
      }
      
      return dateFormatted
    } catch {
      return dateStr
    }
  }

  const handleExport = () => {
    exportToExcel({
      reportName: 'รายการปล่อยรถ',
      periodLabel: periodLabel || '-',
      headers: ['ทะเบียน', 'เลขตัวถัง (VIN)', 'รุ่น', 'โครงการ', 'วันที่คาดว่าจะปล่อย', 'วันที่ปล่อยจริง', 'สถานะ', 'วันที่สร้าง', 'ผู้สร้าง', 'วันที่แก้ไข', 'ผู้แก้ไข'],
      rows: filteredRecords.map(rec => [
        rec.vehicle_id,
        rec.vin,
        rec.model,
        rec.project || '-',
        formatDateForExcel(rec.expected_release_date),
        formatDateForExcel(rec.release_date || rec.delivered_at),
        getStatusText(rec.status),
        formatDateForExcel(rec.create_date),
        rec.create_user_name || '-',
        formatDateForExcel(rec.update_date),
        rec.update_user_name || '-',
      ]),
      fileName: 'รายการปล่อยรถ',
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">รายการปล่อยรถ</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">รายการรถและ PDI เตรียมส่งมอบ</p>
        </div>
        
        {/* Search & Filters & Export */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="ค้นหา รุ่น, VIN..."
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
            <option value="complete">เสร็จสิ้น</option>
            <option value="in_progress">กำลังเตรียมการ</option>
            <option value="pending">รอดำเนินการ</option>
          </select>
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold">
              <th className="pb-3 pr-2">ID รถ</th>
              <th className="pb-3 pr-2">เลขตัวถัง (VIN)</th>
              <th className="pb-3 pr-2">รุ่น</th>
              <th className="pb-3 pr-2">วันที่คาดว่าจะปล่อย</th>
              <th className="pb-3 pr-2">วันที่ปล่อยจริง</th>
              <th className="pb-3 text-right">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((rec, i) => (
                <tr key={rec.vehicle_id + '-' + i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150">
                  <td className="py-3.5 pr-2 font-mono font-medium">{rec.vehicle_id}</td>
                  <td className="py-3.5 pr-2 font-mono text-zinc-500 dark:text-zinc-400">{rec.vin}</td>
                  <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{rec.model}</td>
                  <td className="py-3.5 pr-2 text-zinc-600 dark:text-zinc-400">{formatDateTimeTh(rec.expected_release_date)}</td>
                  <td className="py-3.5 pr-2 text-zinc-650 dark:text-zinc-350">{formatDateTimeTh(rec.release_date || rec.delivered_at)}</td>
                  <td className="py-3.5 text-right">{getStatusBadge(rec.status)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-10 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                  ไม่พบข้อมูลรายการส่งมอบ
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
