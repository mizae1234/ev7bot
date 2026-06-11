'use client'
import React, { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { DeliveryRecord } from '@/types'

interface DeliveryTableProps {
  records: DeliveryRecord[]
}

export function DeliveryTable({ records = [] }: DeliveryTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
    } catch {
      return dateStr
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white/70 p-6 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">รายการปล่อยรถวันนี้</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">รายการรถและ PDI เตรียมส่งมอบประจำวัน</p>
        </div>
        
        {/* Search & Filters */}
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold">
              <th className="pb-3 pr-2">ID รถ</th>
              <th className="pb-3 pr-2">เลขตัวถัง (VIN)</th>
              <th className="pb-3 pr-2">รุ่น</th>
              <th className="pb-3 pr-2 text-center">สถานะ</th>
              <th className="pb-3 text-right">เวลาส่งมอบ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((rec, i) => (
                <tr key={rec.vehicle_id + '-' + i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150">
                  <td className="py-3.5 pr-2 font-mono font-medium">{rec.vehicle_id}</td>
                  <td className="py-3.5 pr-2 font-mono text-zinc-500 dark:text-zinc-400">{rec.vin}</td>
                  <td className="py-3.5 pr-2 font-semibold text-zinc-900 dark:text-zinc-100">{rec.model}</td>
                  <td className="py-3.5 pr-2 text-center">{getStatusBadge(rec.status)}</td>
                  <td className="py-3.5 text-right font-semibold text-zinc-900 dark:text-zinc-100">{formatTime(rec.delivered_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-400 dark:text-zinc-500 font-medium">
                  ไม่พบข้อมูลรายการส่งมอบ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
