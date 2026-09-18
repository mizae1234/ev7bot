import React from 'react'
import { QCDatePreset, QCRecord } from './types'
import { QCCardItem } from './QCCardItem'
import type { ChecklistSectionDef } from '@/lib/inspection/types'

interface QCCardsGridProps {
  items: QCRecord[]
  masterItems?: any[]
  dynamicSections?: ChecklistSectionDef[]
  loading: boolean
  datePreset: QCDatePreset
  onViewDetail: (item: QCRecord) => void
  onNewQC: () => void
  onViewAllDates: () => void
  spacesCdn: string
}

export const QCCardsGrid: React.FC<QCCardsGridProps> = ({
  items,
  masterItems,
  dynamicSections,
  loading,
  datePreset,
  onViewDetail,
  onNewQC,
  onViewAllDates,
  spacesCdn,
}) => {
  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-3xl">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          กำลังโหลดผลการตรวจ QC...
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-3xl p-6 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-2xl flex items-center justify-center mx-auto text-slate-400">
          🚗
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-700">
            {datePreset === 'today'
              ? 'วันนี้ยังไม่มีรายการตรวจ QC'
              : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา'}
          </p>
          <p className="text-slate-400 text-xs">
            {datePreset === 'today'
              ? 'สามารถเริ่มตรวจสภาพรถก่อนส่งมอบได้ทันที หรือเลือกดูประวัติย้อนหลัง'
              : 'ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูรายการทั้งหมด'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
          <button
            type="button"
            onClick={onNewQC}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
          >
            ⚡ ตรวจ QC รถคันใหม่
          </button>
          {datePreset !== 'all' && (
            <button
              type="button"
              onClick={onViewAllDates}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              📅 ดูประวัติทั้งหมด
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
      {items.map((item) => (
        <QCCardItem
          key={item.inspectionId}
          item={item}
          masterItems={masterItems}
          dynamicSections={dynamicSections}
          onViewDetail={onViewDetail}
          spacesCdn={spacesCdn}
        />
      ))}
    </div>
  )
}
