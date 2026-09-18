import React from 'react'
import { QCRecord } from './types'
import {
  maskStaffName,
  getThaiDate,
  getQCItemIcon,
  getQCItemLabel,
  formatQCItemStatus,
} from './qc-helpers'
import type { ChecklistSectionDef } from '@/lib/inspection/types'

interface QCCardItemProps {
  item: QCRecord
  masterItems?: any[]
  dynamicSections?: ChecklistSectionDef[]
  onViewDetail: (item: QCRecord) => void
  spacesCdn: string
}

export const QCCardItem: React.FC<QCCardItemProps> = ({
  item,
  masterItems,
  dynamicSections,
  onViewDetail,
  spacesCdn,
}) => {
  const isPassed =
    item.assessmentResult === 'NORMAL' ||
    (item.remark ? !item.remark.includes('ไม่ผ่าน') : true)

  // Find battery item dynamically
  const batteryItem = item.items?.find((it: any) => {
    const cat = (it.category || it.Category || '').toUpperCase()
    return cat.includes('BATTERY')
  })
  const socVal = batteryItem?.numericValue != null ? `${batteryItem.numericValue}%` : null

  // Build dynamic checklist items: prioritize DB MasterItems, fallback to dynamicSections, or record items
  const dynamicChecklist = React.useMemo(() => {
    if (masterItems && masterItems.length > 0) {
      return masterItems.map((m) => {
        const cat = m.Category || m.category
        const code = m.ItemCode || m.itemCode
        const label = m.Label || m.labelTh || m.label || getQCItemLabel(cat, code)
        const icon = getQCItemIcon(cat)
        const matched = item.items?.find((it: any) => {
          const itCat = it.category || it.Category
          const itCode = it.itemCode || it.ItemCode
          return itCat === cat && itCode === code
        })
        const status = formatQCItemStatus(cat, matched)
        return {
          category: cat,
          itemCode: code,
          label,
          icon,
          status,
        }
      })
    }

    if (dynamicSections && dynamicSections.length > 0) {
      return dynamicSections.flatMap((sec: any) =>
        sec.items.map((it: any) => {
          const matched = item.items?.find((recIt: any) => {
            const itCat = recIt.category || recIt.Category
            const itCode = recIt.itemCode || recIt.ItemCode
            return itCat === it.category && itCode === it.itemCode
          })
          const status = formatQCItemStatus(it.category, matched)
          return {
            category: it.category,
            itemCode: it.itemCode,
            label: it.label || getQCItemLabel(it.category, it.itemCode),
            icon: sec.icon || getQCItemIcon(it.category),
            status,
          }
        })
      )
    }

    if (item.items && item.items.length > 0) {
      return item.items.map((it: any) => {
        const cat = it.category || it.Category
        const code = it.itemCode || it.ItemCode
        const label = getQCItemLabel(cat, code, masterItems)
        const icon = getQCItemIcon(cat)
        const status = formatQCItemStatus(cat, it)
        return {
          category: cat,
          itemCode: code,
          label,
          icon,
          status,
        }
      })
    }

    return []
  }, [masterItems, dynamicSections, item.items])

  return (
    <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-sm hover:shadow-md transition duration-200 space-y-3.5 flex flex-col justify-between">
      <div className="space-y-3">
        {/* Header: Plate & Status Badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                {item.registerNo || item.vinNo}
              </h3>
              {item.model && (
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold">
                  {item.model}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              VIN: {item.vinNo}
            </p>
          </div>

          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border shrink-0 ${
              isPassed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                : 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
            }`}
          >
            {isPassed ? '🟢 ผ่าน QC' : '🔴 ไม่ผ่าน QC'}
          </span>
        </div>

        {/* Date & Inspector info */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2 px-3 bg-slate-50/70 rounded-2xl text-[11px] border border-slate-100">
          <div>
            <span className="text-slate-400 text-[10px] block">เวลาที่ตรวจ:</span>
            <span className="font-semibold text-slate-700">{getThaiDate(item.inspectionDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] block">ผู้ตรวจ QC:</span>
            <span className="font-medium text-slate-800">{maskStaffName(item.inspectorName)}</span>
          </div>
          {socVal && (
            <div>
              <span className="text-slate-400 text-[10px] block">แบตเตอรี่ (SoC):</span>
              <span className="font-bold text-slate-900 font-mono">{socVal}</span>
            </div>
          )}
          {item.mileage != null && (
            <div>
              <span className="text-slate-400 text-[10px] block">เลขไมล์:</span>
              <span className="font-bold text-slate-800 font-mono">
                {Number(item.mileage).toLocaleString()} กม.
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Checklist Micro-Grid (Open & Visible Immediately!) */}
        {dynamicChecklist.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <span>📋</span> ผลตรวจเช็ค ({dynamicChecklist.length} รายการ):
              </span>
              <span className="text-[9px] text-slate-400">อิงตาม DB Master</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {dynamicChecklist.map((cfg) => {
                const { label: statusLabel, isGood, detail } = cfg.status

                return (
                  <div
                    key={`${cfg.category}_${cfg.itemCode}`}
                    className={`p-2 rounded-xl border transition flex flex-col justify-between ${
                      isGood
                        ? 'bg-emerald-50/40 border-emerald-100 text-emerald-950'
                        : 'bg-rose-50 border-rose-200 text-rose-950 ring-1 ring-rose-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-slate-600 truncate flex items-center gap-1" title={cfg.label}>
                        <span>{cfg.icon}</span> <span className="truncate">{cfg.label}</span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                          isGood
                            ? 'bg-emerald-100/80 text-emerald-800'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    {detail && (
                      <p className="text-[9px] text-slate-500 mt-1 truncate" title={detail}>
                        {detail}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Attached Photos Horizontal Strip */}
        {item.photos && item.photos.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                <span>📷</span> รูปภาพประกอบ ({item.photos.length} รูป)
              </span>
              <span className="text-[9px] text-slate-400">แตะเพื่อเปิดรูปใหญ่</span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none snap-x">
              {item.photos.map((photo: any, pIdx: number) => {
                const photoUrl = photo.s3Key?.startsWith('http')
                  ? photo.s3Key
                  : `${spacesCdn}/${photo.s3Key}`
                return (
                  <a
                    key={photo.inspectionPhotoId || pIdx}
                    href={photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 w-24 h-18 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative group snap-start block shadow-2xs hover:scale-105 transition duration-150 cursor-pointer"
                  >
                    <img
                      src={photoUrl}
                      alt={photo.fileName || 'QC Photo'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                      <p className="text-[8px] text-white truncate font-medium">
                        {getQCItemLabel(photo.category, photo.itemCode, masterItems)}
                      </p>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Remark */}
        {item.remark && (
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600">
            <span className="font-bold text-slate-700">หมายเหตุ: </span>
            <span>{item.remark}</span>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onViewDetail(item)}
          className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 border border-slate-200"
        >
          <span>ดูผลตรวจแบบป๊อปอัป</span>
          <span>🔍</span>
        </button>
      </div>
    </div>
  )
}
