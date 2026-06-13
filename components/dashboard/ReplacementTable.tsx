'use client'
import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { ReplacementRecord } from '@/types'
import { exportToExcel, formatDateForExcel, ExportButton } from '@/lib/exportExcel'
import { Pagination } from '@/components/ui/Pagination'

interface ReplacementTableProps {
  records: ReplacementRecord[]
  periodLabel?: string
}

export function ReplacementTable({ records = [], periodLabel = '' }: ReplacementTableProps) {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredRecords = records.filter((rec) => {
    return (
      (rec.replacement_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.maintenance_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (rec.vin || '').toLowerCase().includes(search.toLowerCase())
    )
  })

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage)
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
    } catch {
      return dateStr
    }
  }

  const handleExport = () => {
    exportToExcel({
      reportName: 'รายการรถทดแทน',
      periodLabel: periodLabel || '-',
      headers: ['ID รถทดแทน', 'เลขใบสั่งซ่อม', 'เลขตัวถัง (VIN)', 'วันที่เริ่มใช้', 'วันที่ส่งคืน', 'สถานที่ปล่อยรถ', 'หมายเหตุ'],
      rows: filteredRecords.map(rec => [
        rec.replacement_id,
        rec.maintenance_id,
        rec.vin,
        formatDateForExcel(rec.start_date),
        rec.return_date ? formatDateForExcel(rec.return_date) : 'ยังไม่คืน',
        rec.location || '-',
        rec.remark || '-',
      ]),
      fileName: 'รายการรถทดแทน',
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">รายการรถทดแทนวันนี้</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">รายการปล่อยรถทดแทนให้ลูกค้าใช้งานระหว่างนำรถเข้าศูนย์ซ่อม</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="ค้นหา ID, VIN, ใบสั่งซ่อม..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-zinc-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
          />
          <ExportButton onClick={handleExport} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold">
              <th className="pb-3 pr-2">ID รถทดแทน</th>
              <th className="pb-3 pr-2">เลขใบสั่งซ่อม</th>
              <th className="pb-3 pr-2">เลขตัวถัง (VIN)</th>
              <th className="pb-3 pr-2">วันที่เริ่มใช้</th>
              <th className="pb-3 pr-2">วันที่ส่งคืน</th>
              <th className="pb-3 text-right">สถานที่ปล่อยรถ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
            {paginatedRecords.length > 0 ? (
              paginatedRecords.map((rec, i) => (
                <tr key={rec.replacement_id + '-' + i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150">
                  <td className="py-3.5 pr-2 font-mono font-medium">{rec.replacement_id}</td>
                  <td className="py-3.5 pr-2 font-mono text-zinc-500 dark:text-zinc-400">{rec.maintenance_id}</td>
                  <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{rec.vin}</td>
                  <td className="py-3.5 pr-2">{formatDate(rec.start_date)}</td>
                  <td className="py-3.5 pr-2">
                    {rec.return_date ? (
                      formatDate(rec.return_date)
                    ) : (
                      <Badge variant="warning">ยังไม่คืน</Badge>
                    )}
                  </td>
                  <td className="py-3.5 text-right font-medium text-zinc-900 dark:text-zinc-100">{rec.location || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-10 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                  ไม่พบข้อมูลรายการรถทดแทน
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
