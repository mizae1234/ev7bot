import React from 'react'
import { ReplacementActiveItem } from '@/lib/replacement/replacement-types'
import { formatThaiDate, getDurationBadge } from '@/lib/replacement/replacement-constants'

interface ActiveReplacementTableProps {
  records: ReplacementActiveItem[]
  loading: boolean
  startIndex?: number
  onOpenDetail: (item: ReplacementActiveItem) => void
}

export function ActiveReplacementTable({
  records,
  loading,
  startIndex = 0,
  onOpenDetail
}: ActiveReplacementTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูลรายการใช้งานรถทดแทน...</p>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center">
        <span className="text-4xl mb-2">🚗✨</span>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">ไม่พบรายการใช้งานรถทดแทน</h3>
        <p className="text-xs text-zinc-500 mt-1">ไม่มีรายการที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรองที่เลือก</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-semibold">
            <th className="py-3 px-3 text-center w-12">#</th>
            <th className="py-3 px-4">🚗 รถทดแทนที่นำไปใช้</th>
            <th className="py-3 px-4 text-center">➔</th>
            <th className="py-3 px-4">🛠️ รถคันหลักที่เข้าซ่อม</th>
            <th className="py-3 px-4">ชื่องานซ่อม / อู่บริการ</th>
            <th className="py-3 px-4">วันที่เริ่มใช้</th>
            <th className="py-3 px-4 text-center">ระยะเวลาใช้งาน</th>
            <th className="py-3 px-4 text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          {records.map((rec, idx) => {
            const badge = getDurationBadge(rec.daysInUse)

            return (
              <tr
                key={rec.replacementItemId}
                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* 0. Row Number */}
                <td className="py-3 px-3 text-center font-mono text-zinc-400 dark:text-zinc-500 font-semibold">
                  {startIndex + idx + 1}
                </td>

                {/* 1. Replacement Car Info */}
                <td className="py-3 px-4">
                  <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                    {rec.replacementRegisterNo || <span className="text-zinc-400 font-normal italic">ไม่มีทะเบียน</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5">
                    {rec.replacementVin}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                      {rec.replacementModel || 'Aion'}
                    </span>
                    {rec.replacementStatus?.toUpperCase().includes('MAINTENANCE') && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-800">
                        🛠️ ตัวรถทดแทนเข้าซ่อม
                      </span>
                    )}
                    {rec.replacementLocationName && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        📍 {rec.replacementLocationName}
                      </span>
                    )}
                  </div>
                </td>

                {/* Arrow Icon */}
                <td className="py-3 px-2 text-center text-zinc-400">
                  <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400 font-bold">
                    ➔
                  </div>
                </td>

                {/* 2. Main Damaged Car Info */}
                <td className="py-3 px-4">
                  <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                    {rec.mainRegisterNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5">
                    {rec.mainVinNo || '-'}
                  </div>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      {rec.mainModel || '-'} (คันหลัก)
                    </span>
                  </div>
                </td>

                {/* 3. Maintenance Issue & Garage */}
                <td className="py-3 px-4">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
                    {rec.issueTitle || <span className="text-zinc-400 italic">ไม่ได้ระบุอาการ</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                    <span>🏢</span>
                    <span className="truncate max-w-[180px]">{rec.garageName || 'ศูนย์บริการ EV7'}</span>
                  </div>
                  {rec.maintenanceStartDate && (
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">
                      เข้าซ่อม: {formatThaiDate(rec.maintenanceStartDate)}
                    </div>
                  )}
                </td>

                {/* 4. Replacement Start Date */}
                <td className="py-3 px-4">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatThaiDate(rec.replacementStartDate)}
                  </div>
                  {rec.createUserName && (
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      โดย: {rec.createUserName}
                    </div>
                  )}
                </td>

                {/* 5. Duration Badge */}
                <td className="py-3 px-4 text-center whitespace-nowrap">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${badge.bg} ${badge.text} ${badge.border}`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
                    <span>{badge.label}</span>
                  </div>
                </td>

                {/* 6. Actions */}
                <td className="py-3 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenDetail(rec)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    ดูคู่รถ
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
