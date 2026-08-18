import React from 'react'
import { ReplacementPoolCar } from '@/lib/replacement/replacement-types'
import { formatThaiDate, getPoolCarBadge } from '@/lib/replacement/replacement-constants'

interface FleetPoolTableProps {
  records: ReplacementPoolCar[]
  loading: boolean
}

export function FleetPoolTable({ records, loading }: FleetPoolTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูลคลังรถทดแทน...</p>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center">
        <span className="text-4xl mb-2">🚗✨</span>
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">ไม่พบข้อมูลรถในคลัง</h3>
        <p className="text-xs text-zinc-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่อีกครั้ง</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-semibold">
            <th className="py-3 px-4">ข้อมูลรถทดแทน</th>
            <th className="py-3 px-4">รุ่น / สี</th>
            <th className="py-3 px-4">สถานะความพร้อม</th>
            <th className="py-3 px-4">รายละเอียดการจอง (Reserved Info)</th>
            <th className="py-3 px-4">📍 สถานที่จอด (Yard)</th>
            <th className="py-3 px-4 text-center">ความพร้อมใช้งาน</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          {records.map((car) => {
            const badge = getPoolCarBadge(
              car.isReadyToPick,
              car.isReserved,
              car.reservedType || car.reservedRemark,
              car.status,
              car.statusType
            )

            return (
              <tr
                key={car.vinNo}
                className={`hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors ${
                  car.isReadyToPick ? 'bg-emerald-50/20 dark:bg-emerald-950/10' : ''
                }`}
              >
                {/* 1. Vehicle Info */}
                <td className="py-3 px-4">
                  <div className="font-bold text-sm text-zinc-900 dark:text-white">
                    {car.registerNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5">
                    {car.vinNo}
                  </div>
                  {car.project && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mt-1">
                      โครงการ: {car.project}
                    </span>
                  )}
                </td>

                {/* 2. Model & Color */}
                <td className="py-3 px-4">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {car.model || '-'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    สี: {car.exteriorColor || '-'}
                    {car.interiorColor && ` / ${car.interiorColor}`}
                  </div>
                </td>

                {/* 3. Status Badge */}
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                    {badge.label}
                  </span>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    สถานะระบบ: {car.statusType || car.status}
                  </div>
                </td>

                {/* 4. Reservation Details */}
                <td className="py-3 px-4">
                  {car.isReserved ? (
                    <div className="space-y-1">
                      {car.reservedType && (
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">
                          🏷️ {car.reservedType}
                        </div>
                      )}
                      {car.reservedRemark && (
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                          {car.reservedRemark}
                        </div>
                      )}
                      {car.reservedTargetVinNo ? (
                        <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                          🎯 จองให้: <strong>{car.reservedTargetRegisterNo || car.reservedTargetVinNo}</strong>
                        </div>
                      ) : (
                        <div className="text-[11px] text-zinc-400 italic">
                          ⚪ ไม่ระบุทะเบียน (โควตากลาง)
                        </div>
                      )}
                      {car.reservedReleaseDate && (
                        <div className="text-[10px] text-zinc-400">
                          กำหนดปล่อยรถ: {formatThaiDate(car.reservedReleaseDate)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่ได้ติดการจอง</span>
                  )}
                </td>

                {/* 5. Location */}
                <td className="py-3 px-4">
                  {car.location ? (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      <span>📍</span>
                      <span>{car.location}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่ระบุสถานที่</span>
                  )}
                </td>

                {/* 6. Action / Quick Pick Indicator */}
                <td className="py-3 px-4 text-center">
                  {car.isReadyToPick ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500 text-white shadow-sm">
                      <span>✅ พร้อมหยิบใช้</span>
                    </span>
                  ) : car.isReserved ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                      🔒 ติดจอง
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-[11px]">-</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
