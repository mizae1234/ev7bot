'use client'

import React from 'react'
import Link from 'next/link'

export interface VehicleLocationMovement {
  movementId: string
  fromLocation: string | null
  toLocation: string | null
  movementDetail: string | null
  movementDate: string
  createDate: string
  createUserName: string | null
}

interface VehicleLocationHistoryProps {
  registerNo: string
  vinNo: string
  movements: VehicleLocationMovement[]
}

// SQL Server stores Bangkok time directly — mssql driver serializes as UTC (Z suffix).
// Use UTC methods to format date/time without double +7 offset.
function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    return `${day} ${month} ${year}`
  } catch {
    return dateStr || '-'
  }
}

function formatThaiDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    const hours = String(d.getUTCHours()).padStart(2, '0')
    const mins = String(d.getUTCMinutes()).padStart(2, '0')
    return `${day} ${month} ${year} ${hours}:${mins} น.`
  } catch {
    return dateStr || '-'
  }
}

export function VehicleLocationHistory({ registerNo, vinNo, movements }: VehicleLocationHistoryProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📍</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                ประวัติการเคลื่อนย้ายสถานที่ (Location History)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                {movements.length} รายการ
              </span>
            </div>
            <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              ประวัติการเปลี่ยนพิกัดจอด และสถานที่ต้นทาง ➔ ปลายทาง ของรถคันนี้
            </p>
          </div>
        </div>

        <Link
          href={`/vehicle-movement?search=${encodeURIComponent(registerNo || vinNo)}`}
          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
        >
          <span>ดูหน้ารวมประวัติย้ายรถ</span>
          <span>↗</span>
        </Link>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 space-y-4">
        {movements.length === 0 ? (
          <div className="text-center py-8 text-zinc-400 space-y-1.5">
            <span className="text-3xl">📍✨</span>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">ยังไม่มีบันทึกการย้ายสถานที่สำหรับรถคันนี้</p>
            <p className="text-[11px] text-zinc-400">เมื่อมีการเปลี่ยนสถานที่จอดรถ ระบบจะบันทึกประวัติการย้ายสถานที่เข้ามาที่นี่โดยอัตโนมัติ</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Mini Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-0.5">
                <span className="text-[11px] font-semibold text-zinc-400">📊 ย้ายสถานที่ทั้งหมด</span>
                <p className="text-base font-black text-zinc-900 dark:text-white">
                  {movements.length} <span className="text-xs font-normal text-zinc-400">ครั้ง</span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/50 space-y-0.5">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">📍 จุดจอดล่าสุด</span>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate" title={movements[0]?.toLocation || movements[0]?.fromLocation || '-'}>
                  {movements[0]?.toLocation || movements[0]?.fromLocation || '-'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-0.5">
                <span className="text-[11px] font-semibold text-zinc-400">📅 ย้ายล่าสุดเมื่อ</span>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {formatThaiDate(movements[0]?.movementDate)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-0.5">
                <span className="text-[11px] font-semibold text-zinc-400">👤 ผู้ดำเนินการล่าสุด</span>
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                  {movements[0]?.createUserName || '-'}
                </p>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-3.5 w-10 text-center">#</th>
                    <th className="py-3 px-3.5">📍 เส้นทางการย้าย (ต้นทาง ➔ ปลายทาง)</th>
                    <th className="py-3 px-3.5 w-44">📅 วันที่ & เวลาที่ย้าย</th>
                    <th className="py-3 px-3.5 w-36">👤 ผู้ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                  {movements.map((m, idx) => (
                    <tr key={m.movementId || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-3.5 text-center font-mono text-zinc-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        {m.fromLocation || m.toLocation ? (
                          <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800">
                              {m.fromLocation || 'ไม่ระบุ'}
                            </span>
                            <span className="text-emerald-500 font-bold">➔</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/50">
                              {m.toLocation || 'ไม่ระบุ'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic text-[11px]">บันทึกย้ายสถานที่</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {formatThaiDate(m.movementDate)}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-400">
                            {formatThaiDateTime(m.movementDate).split(' ').slice(-2).join(' ')}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="text-zinc-800 dark:text-zinc-200 font-medium text-[11px] flex items-center gap-1">
                          <span>👤</span>
                          <span>{m.createUserName || '-'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-2.5">
              {movements.map((m, idx) => (
                <div
                  key={m.movementId || idx}
                  className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/50 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-400 font-semibold">#{idx + 1}</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      📅 {formatThaiDateTime(m.movementDate)}
                    </span>
                  </div>

                  {m.fromLocation || m.toLocation ? (
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {m.fromLocation || '-'}
                      </span>
                      <span className="text-emerald-500 font-bold">➔</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {m.toLocation || '-'}
                      </span>
                    </div>
                  ) : null}

                  <div className="text-[11px] text-zinc-400 text-right">
                    ผู้ดำเนินการ: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{m.createUserName || '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
