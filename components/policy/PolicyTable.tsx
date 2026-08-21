import React from 'react'
import Link from 'next/link'
import { PolicyVehicleRecord } from '@/lib/policy/policy-types'
import { formatThaiDate, getExpiryBadge, getInsuranceTypeLabel } from '@/lib/policy/policy-constants'

interface PolicyTableProps {
  records: PolicyVehicleRecord[]
  loading: boolean
  page?: number
  pageSize?: number
  onOpenHistory: (vinNo: string, registerNo: string | null) => void
  onOpenEdit?: (record: PolicyVehicleRecord) => void
}

const SPACES_CDN = process.env.NEXT_PUBLIC_SPACES_CDN_URL || 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'

export function PolicyTable({
  records,
  loading,
  page = 1,
  pageSize = 50,
  onOpenHistory,
  onOpenEdit
}: PolicyTableProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูลกรมธรรม์และภาษี...</p>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center">
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-zinc-800 dark:text-zinc-200">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
        <p className="text-xs text-zinc-500 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่อีกครั้ง</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-semibold">
            <th className="py-3 px-4 w-12 text-center">ลำดับ</th>
            <th className="py-3 px-4">ข้อมูลรถ</th>
            <th className="py-3 px-4">🛡️ ประกันภัยภาคสมัครใจ (PLMV)</th>
            <th className="py-3 px-4">📜 พ.ร.บ. (PLMC)</th>
            <th className="py-3 px-4 whitespace-nowrap">🗓️ วันที่จดทะเบียน</th>
            <th className="py-3 px-4">🏷️ ภาษีรถประจำปี</th>
            <th className="py-3 px-4">⏱️ ภาษีมิเตอร์แท็กซี่</th>
            <th className="py-3 px-4">สถานะรถ / สถานที่</th>
            {onOpenEdit && <th className="py-3 px-4 text-center">จัดการ</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          {records.map((rec, idx) => {
            const rowNumber = (page - 1) * pageSize + idx + 1
            const insBadge = getExpiryBadge(rec.insuranceStatus, rec.insuranceDaysLeft)
            const actBadge = getExpiryBadge(rec.actStatus, rec.actDaysLeft)
            const taxBadge = getExpiryBadge(rec.vehicleTaxStatus, rec.vehicleTaxDaysLeft)
            const meterBadge = getExpiryBadge(rec.meterTaxStatus, rec.meterTaxDaysLeft)

            const insPdfUrl = rec.insuranceFilePath
              ? rec.insuranceFilePath.startsWith('http')
                ? rec.insuranceFilePath
                : `${SPACES_CDN}/${rec.insuranceFilePath}`
              : null

            const actPdfUrl = rec.actFilePath
              ? rec.actFilePath.startsWith('http')
                ? rec.actFilePath
                : `${SPACES_CDN}/${rec.actFilePath}`
              : null

            // Determine status style
            let statusStyle = 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
            let statusDot = 'bg-zinc-400'
            const s = (rec.status || '').toUpperCase()

            if (s === 'ON_RENT') {
              statusStyle = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              statusDot = 'bg-emerald-500'
            } else if (s === 'AVAILABLE') {
              statusStyle = 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
              statusDot = 'bg-sky-500'
            } else if (s === 'MAINTENANCE') {
              statusStyle = 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
              statusDot = 'bg-rose-500'
            } else if (s === 'REPLACEMENT') {
              statusStyle = 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
              statusDot = 'bg-purple-500'
            } else if (s === 'PENDING' || s === 'PRODUCTION') {
              statusStyle = 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              statusDot = 'bg-amber-500'
            }

            return (
              <tr
                key={rec.vinNo}
                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* 0. Row Sequence Number */}
                <td className="py-3 px-4 text-center font-mono text-zinc-400 dark:text-zinc-500 text-xs font-medium">
                  {rowNumber}
                </td>

                {/* 1. Vehicle Info */}
                <td className="py-3 px-4">
                  <Link
                    href={`/vehicle/${encodeURIComponent(rec.registerNo || rec.vinNo)}`}
                    target="_blank"
                    className="group/link block"
                    title="คลิกเพื่อดูข้อมูลรถและประวัติ (เปิดแท็บใหม่)"
                  >
                    <div className="font-semibold text-sm text-zinc-900 dark:text-white group-hover/link:text-amber-600 dark:group-hover/link:text-amber-400 transition-colors flex items-center gap-1 underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-2 group-hover/link:decoration-amber-400">
                      <span>{rec.registerNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}</span>
                      <span className="opacity-0 group-hover/link:opacity-100 text-[10px] text-amber-500 transition-opacity">↗</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5 group-hover/link:text-amber-700 dark:group-hover/link:text-amber-300 underline decoration-zinc-300 dark:decoration-zinc-600 underline-offset-2 group-hover/link:decoration-amber-400">
                      {rec.vinNo}
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {rec.model && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                        {rec.model}
                      </span>
                    )}
                    {rec.projectType && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium border border-purple-200/50 dark:border-purple-800/40">
                        {rec.projectType}
                      </span>
                    )}
                  </div>
                </td>

                {/* 2. Insurance (PLMV) */}
                <td className="py-3 px-4">
                  {rec.insurancePolicyNo ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 text-[10px] rounded font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
                          {getInsuranceTypeLabel(rec.insuranceType, rec.insuranceTypeName)}
                        </span>
                        <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 text-xs">
                          {rec.insurancePolicyNo}
                        </span>
                      </div>
                      {rec.insuranceCompany && (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                          <span>🏢</span>
                          <span>{rec.insuranceCompany}</span>
                        </div>
                      )}
                      <div className="text-zinc-500 text-[11px]">
                        หมดอายุ: <strong className="text-zinc-800 dark:text-zinc-200">{formatThaiDate(rec.insuranceEndDate)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${insBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${insBadge.dot}`} />
                          {insBadge.label}
                        </span>
                        {insPdfUrl && (
                          <a
                            href={insPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold hover:underline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            เปิด PDF ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่มีข้อมูลประกัน</span>
                  )}
                </td>

                {/* 3. Act (PLMC) */}
                <td className="py-3 px-4">
                  {rec.actPolicyNo ? (
                    <div className="space-y-1">
                      <div className="font-mono text-zinc-700 dark:text-zinc-300">
                        {rec.actPolicyNo}
                      </div>
                      <div className="text-zinc-500 text-[11px]">
                        หมดอายุ: <strong className="text-zinc-800 dark:text-zinc-200">{formatThaiDate(rec.actEndDate)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${actBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${actBadge.dot}`} />
                          {actBadge.label}
                        </span>
                        {actPdfUrl && (
                          <a
                            href={actPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-semibold hover:underline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            เปิด PDF ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่มีข้อมูล พ.ร.บ.</span>
                  )}
                </td>

                {/* 4. วันที่จดทะเบียนรถ (Registration Date Column - ต่อจาก พ.ร.บ.) */}
                <td className="py-3 px-4 whitespace-nowrap">
                  {rec.registerNoDate ? (
                    <div className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatThaiDate(rec.registerNoDate)}
                    </div>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500 font-mono text-xs">-</span>
                  )}
                </td>

                {/* 4. Vehicle Tax */}
                <td className="py-3 px-4">
                  {rec.vehicleTaxEndDate ? (
                    <div className="space-y-1">
                      <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {formatThaiDate(rec.vehicleTaxEndDate)}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${taxBadge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${taxBadge.dot}`} />
                        {taxBadge.label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่มีข้อมูลภาษี</span>
                  )}
                </td>

                {/* 5. Meter Tax */}
                <td className="py-3 px-4">
                  {rec.meterTaxEndDate ? (
                    <div className="space-y-1">
                      <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {formatThaiDate(rec.meterTaxEndDate)}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${meterBadge.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${meterBadge.dot}`} />
                        {meterBadge.label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่มีข้อมูลมิเตอร์</span>
                  )}
                </td>

                {/* 6. Vehicle Status & Location */}
                <td className="py-3 px-4">
                  <div className="space-y-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                      {rec.statusName || rec.status || 'ไม่ระบุ'}
                    </span>

                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                      <span className="text-zinc-400">📍</span>
                      <span className="truncate max-w-[170px] font-medium" title={rec.locationName || rec.currentLocation || 'ไม่ระบุสถานที่'}>
                        {rec.locationName || rec.currentLocation || <span className="italic text-zinc-400">ไม่ระบุสถานที่</span>}
                      </span>
                    </div>
                  </div>
                </td>

                {/* 7. Row Actions (hidden in monitor) */}
                {onOpenEdit && (
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {/* View History Log */}
                    <button
                      type="button"
                      title="ดูประวัติ Log เอกสาร"
                      onClick={() => onOpenHistory(rec.vinNo, rec.registerNo)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Edit Form */}
                    <button
                      type="button"
                      title="แก้ไขข้อมูลประกัน/ภาษี"
                      onClick={() => onOpenEdit(rec)}
                      className="p-1.5 rounded-lg text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
