import React from 'react'
import { QCRecord } from './types'
import { maskStaffName, getThaiDate, getQCItemLabel, formatQCItemStatus } from './qc-helpers'

interface QCDetailModalProps {
  record: QCRecord | null
  loading: boolean
  masterItems?: any[]
  spacesCdn: string
  onClose: () => void
}

export const QCDetailModal: React.FC<QCDetailModalProps> = ({
  record,
  loading,
  masterItems,
  spacesCdn,
  onClose,
}) => {
  if (!record) return null

  const isPassed =
    record.assessmentResult === 'NORMAL' ||
    (record.remark ? !record.remark.includes('ไม่ผ่าน') : true)

  const batteryItem = record.items?.find((it: any) => {
    const cat = (it.category || it.Category || '').toUpperCase()
    return cat.includes('BATTERY')
  })
  const socVal = batteryItem?.numericValue != null ? `${batteryItem.numericValue}%` : '-'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-4 sm:p-6 animate-fade-in my-auto max-h-[92vh] flex flex-col space-y-4">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3 flex-none">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {record.registerNo || record.vinNo}
              </h3>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  isPassed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isPassed ? '🟢 ผ่าน QC (พร้อมส่งมอบ)' : '🔴 ไม่ผ่าน QC (ต้องแก้ไข)'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              VIN: {record.vinNo} {record.model ? `• รุ่น: ${record.model}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Summary Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px]">วันที่ตรวจ QC</span>
              <span className="font-semibold text-slate-700">{getThaiDate(record.inspectionDate)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">ผู้ตรวจ QC</span>
              <span className="font-bold text-slate-900">{maskStaffName(record.inspectorName)}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">แบตเตอรี่ HV</span>
              <span className="font-bold text-slate-900 font-mono">{socVal}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">เลขไมล์</span>
              <span className="font-bold text-slate-800 font-mono">
                {record.mileage != null ? `${Number(record.mileage).toLocaleString()} กม.` : '-'}
              </span>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="font-medium">กำลังโหลดรายละเอียดการตรวจ...</p>
            </div>
          ) : (
            <>
              {/* Dynamic Checklist Items */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                  <span>รายการตรวจเช็ค ({record.items?.length || 0} รายการ)</span>
                  <span className="text-[10px] text-slate-400 font-normal">สถานะและผลประเมิน</span>
                </div>
                {record.items && record.items.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {record.items.map((it: any, idx: number) => {
                      const cat = it.category || it.Category
                      const code = it.itemCode || it.ItemCode
                      const status = formatQCItemStatus(cat, it)
                      const label = getQCItemLabel(cat, code, masterItems)

                      return (
                        <div
                          key={idx}
                          className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                        >
                          <div className="space-y-0.5">
                            <p className="text-slate-800 font-semibold text-xs">
                              {label}
                            </p>
                            {status.detail && (
                              <p className="text-[11px] text-slate-500">
                                {status.detail}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-lg font-bold text-xs ${
                                status.isGood
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {status.label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs">
                    ไม่มีข้อมูลรายการตรวจเช็ค
                  </div>
                )}
              </div>

              {/* Attached Photos */}
              {record.photos && record.photos.length > 0 && (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2.5 text-xs">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                    <span>📷</span> รูปภาพประกอบการตรวจ ({record.photos.length} รูป)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {record.photos.map((photo: any, idx: number) => {
                      const photoUrl = photo.s3Key?.startsWith('http')
                        ? photo.s3Key
                        : `${spacesCdn}/${photo.s3Key}`
                      return (
                        <a
                          key={photo.inspectionPhotoId || idx}
                          href={photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative aspect-4/3 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 block shadow-2xs hover:shadow-md transition"
                        >
                          <img
                            src={photoUrl}
                            alt={photo.fileName || 'QC Photo'}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                            <p className="text-[10px] text-white font-medium truncate">
                              {getQCItemLabel(photo.category, photo.itemCode, masterItems)}
                            </p>
                          </div>
                          <div className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-md px-1.5 py-0.5 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition">
                            ดูรูปใหญ่ ↗
                          </div>
                        </a>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Remark */}
              {record.remark && (
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                  <p className="font-bold text-slate-600 flex items-center gap-1">
                    <span>📝</span> หมายเหตุ / รายละเอียดเพิ่มเติม:
                  </p>
                  <p className="text-slate-800 whitespace-pre-line text-xs pl-4">{record.remark}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100 flex-none">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
