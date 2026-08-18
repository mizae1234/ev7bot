import React from 'react'
import { ReplacementActiveItem } from '@/lib/replacement/replacement-types'
import { formatThaiDate, getDurationBadge } from '@/lib/replacement/replacement-constants'

interface ReplacementDetailModalProps {
  item: ReplacementActiveItem | null
  isOpen: boolean
  onClose: () => void
}

export function ReplacementDetailModal({
  item,
  isOpen,
  onClose
}: ReplacementDetailModalProps) {
  if (!isOpen || !item) return null

  const badge = getDurationBadge(item.daysInUse)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🚗🔄</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                รายละเอียดการจับคู่รถทดแทน
              </h2>
              <p className="text-xs text-zinc-500">
                เลขที่รายการ: #{item.replacementItemId} (ใบสั่งซ่อม #{item.maintenanceItemId})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Duration Summary Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${badge.bg} ${badge.border}`}>
            <div>
              <div className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                ระยะเวลาที่ใช้งานรถทดแทนไปแล้ว
              </div>
              <div className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">
                {item.daysInUse} วัน
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                เริ่มให้ใช้งาน: {formatThaiDate(item.replacementStartDate)}
              </div>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs ${badge.text} bg-white dark:bg-zinc-800 border ${badge.border} shadow-sm`}>
              <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
              <span>{badge.label}</span>
            </div>
          </div>

          {/* 2-Column Comparison: Replacement Car vs Main Damaged Car */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Replacement Car */}
            <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/60 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-indigo-200/60 dark:border-indigo-800/40">
                <span className="text-base">🚗</span>
                <span className="font-bold text-indigo-900 dark:text-indigo-300 text-sm">
                  รถทดแทนที่นำไปใช้
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500">เลขทะเบียน:</span>
                  <div className="font-bold text-zinc-900 dark:text-white text-sm">
                    {item.replacementRegisterNo || 'ไม่มีทะเบียน'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">เลขตัวถัง (VIN):</span>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">
                    {item.replacementVin}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">รุ่นรถ:</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    {item.replacementModel || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">สถานที่จอดประจำ:</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    📍 {item.replacementLocationName || item.replacementLocation || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Main Damaged Car */}
            <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-800/60 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-rose-200/60 dark:border-rose-800/40">
                <span className="text-base">🛠️</span>
                <span className="font-bold text-rose-900 dark:text-rose-300 text-sm">
                  รถคันหลักที่เข้าซ่อม
                </span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-zinc-500">เลขทะเบียน:</span>
                  <div className="font-bold text-zinc-900 dark:text-white text-sm">
                    {item.mainRegisterNo || 'ไม่มีทะเบียน'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">เลขตัวถัง (VIN):</span>
                  <div className="font-mono text-zinc-800 dark:text-zinc-200">
                    {item.mainVinNo || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">รุ่นรถ:</span>
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">
                    {item.mainModel || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-zinc-500">สถานะงานซ่อม:</span>
                  <div className="font-semibold text-rose-600 dark:text-rose-400">
                    {item.mainStatus || 'อยู่ระหว่างซ่อม'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Details Section */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-2.5">
            <h4 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <span>📋</span> รายละเอียดใบสั่งซ่อม
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-zinc-500">อาการเสีย / ชื่องานซ่อม:</span>
                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {item.issueTitle || '-'}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">อู่ / ศูนย์บริการ:</span>
                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                  🏢 {item.garageName || '-'}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">วันที่นำรถเข้าซ่อม:</span>
                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {formatThaiDate(item.maintenanceStartDate)}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">ประเภทบริการ:</span>
                <div className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {item.serviceType || '-'}
                </div>
              </div>
            </div>
            {item.remark && (
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <span className="text-zinc-500">หมายเหตุ:</span>
                <p className="text-zinc-700 dark:text-zinc-300 mt-0.5">{item.remark}</p>
              </div>
            )}
          </div>

          {/* Audit Trail / Meta */}
          <div className="text-[11px] text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div>
              ผู้บันทึก: <strong>{item.createUserName || '-'}</strong> ({formatThaiDate(item.createDate)})
            </div>
            {item.updateUserName && (
              <div>
                แก้ไขล่าสุดโดย: <strong>{item.updateUserName}</strong> ({formatThaiDate(item.updateDate)})
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  )
}
