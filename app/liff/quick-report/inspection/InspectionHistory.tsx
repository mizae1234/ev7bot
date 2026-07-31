'use client'

import React from 'react'
import type { InspectionListItem } from '@/lib/inspection/types'

interface InspectionHistoryProps {
  inspections: InspectionListItem[]
  loading?: boolean
  onSelect: (inspectionId: number) => void
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

export default function InspectionHistory({
  inspections,
  loading = false,
  onSelect,
}: InspectionHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-2 text-sm text-slate-500">กำลังโหลด...</span>
      </div>
    )
  }

  if (inspections.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-3xl mb-2">📋</div>
        <p className="text-sm text-slate-500">ยังไม่มีประวัติการตรวจสภาพรถคันนี้</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500 px-1">
        ประวัติการตรวจสภาพ ({inspections.length} รายการ)
      </p>

      {inspections.map(item => (
        <button
          key={item.inspectionId}
          type="button"
          onClick={() => onSelect(item.inspectionId)}
          className="w-full bg-white rounded-2xl border border-slate-200 p-3 text-left hover:bg-slate-50 transition active:scale-[0.98] shadow-sm"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  item.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {item.status === 'COMPLETED' ? '✅ เสร็จสิ้น' : '📝 ฉบับร่าง'}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  item.inspectionType === 'RETURN'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {item.inspectionType === 'RETURN' ? '🔄 คืนรถ' : '🔍 ตรวจรอบ'}
                </span>
              </div>

              <p className="text-sm font-medium text-slate-800 truncate">
                {item.registerNo || item.vinNo}
              </p>

              <div className="flex items-center gap-3 mt-1">
                <span className="text-[11px] text-slate-500">
                  📅 {formatDate(item.inspectionDate)}
                </span>
                <span className="text-[11px] text-slate-500">
                  📝 {item.itemCount} ข้อ
                </span>
                <span className="text-[11px] text-slate-500">
                  📷 {item.photoCount} รูป
                </span>
              </div>

              {item.inspectorName && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ผู้ตรวจ: {item.inspectorName}
                </p>
              )}
            </div>

            <span className="text-slate-400 text-sm">›</span>
          </div>
        </button>
      ))}
    </div>
  )
}
