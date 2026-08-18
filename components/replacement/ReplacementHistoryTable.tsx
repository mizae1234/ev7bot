import React from 'react'
import { ReplacementHistoryItem } from '@/lib/replacement/replacement-types'
import { formatThaiDate } from '@/lib/replacement/replacement-constants'

interface ReplacementHistoryTableProps {
  records: ReplacementHistoryItem[]
  loading: boolean
  startIndex?: number
}

export function ReplacementHistoryTable({
  records,
  loading,
  startIndex = 0
}: ReplacementHistoryTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-zinc-500">กำลังโหลดประวัติการให้รถทดแทน...</p>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center">
        <span className="text-4xl mb-2">📜✨</span>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">ไม่พบประวัติการให้รถทดแทน</h3>
        <p className="text-xs text-zinc-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่อีกครั้ง</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-semibold">
            <th className="py-3 px-3 text-center w-12">#</th>
            <th className="py-3 px-4">🛠️ รถคันหลัก</th>
            <th className="py-3 px-4">🚗 รถทดแทนที่ให้ (VIN)</th>
            <th className="py-3 px-4">ช่วงเวลาการใช้งาน</th>
            <th className="py-3 px-4 text-center">จำนวนวันที่ใช้</th>
            <th className="py-3 px-4">📍 สถานที่ / อู่</th>
            <th className="py-3 px-4">ผู้บันทึกข้อมูล</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          {records.map((rec, idx) => (
            <tr
              key={`${rec.vinNo}-${rec.vinNoReplacement}-${idx}`}
              className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
            >
              {/* 0. Row Number */}
              <td className="py-3 px-3 text-center font-mono text-zinc-400 dark:text-zinc-500 font-semibold">
                {startIndex + idx + 1}
              </td>

              {/* 1. Main Car Info */}
              <td className="py-3 px-4">
                <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                  {rec.registerNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5">
                  {rec.vinNo}
                </div>
                {rec.model && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mt-1">
                    {rec.model}
                  </span>
                )}
              </td>

              {/* 2. Replacement Car VIN */}
              <td className="py-3 px-4">
                <div className="font-mono text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {rec.vinNoReplacement}
                </div>
                {rec.remark && (
                  <div className="text-[11px] text-zinc-500 mt-0.5 italic">
                    หมายเหตุ: {rec.remark}
                  </div>
                )}
              </td>

              {/* 3. Duration Dates */}
              <td className="py-3 px-4">
                <div className="space-y-0.5">
                  <div className="text-zinc-700 dark:text-zinc-300">
                    เริ่ม: <strong>{formatThaiDate(rec.replacementStartDate)}</strong>
                  </div>
                  <div className="text-zinc-500 text-[11px]">
                    คืน: {rec.replacementReturnDate ? (
                      <strong className="text-zinc-700 dark:text-zinc-300">{formatThaiDate(rec.replacementReturnDate)}</strong>
                    ) : (
                      <span className="text-amber-600 font-medium">ยังไม่คืน (ใช้งานอยู่)</span>
                    )}
                  </div>
                </div>
              </td>

              {/* 4. Days Used */}
              <td className="py-3 px-4 text-center">
                {rec.daysUsed !== null ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                    {rec.daysUsed} วัน
                  </span>
                ) : (
                  <span className="text-zinc-400">-</span>
                )}
              </td>

              {/* 5. Location */}
              <td className="py-3 px-4">
                {rec.location ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                    📍 {rec.location}
                  </span>
                ) : (
                  <span className="text-zinc-400 italic text-[11px]">-</span>
                )}
              </td>

              {/* 6. User Info */}
              <td className="py-3 px-4">
                <div className="text-xs text-zinc-800 dark:text-zinc-200">
                  {rec.createName || '-'}
                </div>
                {rec.createDate && (
                  <div className="text-[10px] text-zinc-400 mt-0.5">
                    บันทึก: {formatThaiDate(rec.createDate)}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
