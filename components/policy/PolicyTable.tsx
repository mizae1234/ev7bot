import React from 'react'
import { PolicyVehicleRecord } from '@/lib/policy/policy-types'
import { formatThaiDate, getExpiryBadge } from '@/lib/policy/policy-constants'

interface PolicyTableProps {
  records: PolicyVehicleRecord[]
  loading: boolean
  onViewPdf: (url: string, title: string) => void
  onOpenHistory: (vinNo: string, registerNo: string | null) => void
  onOpenEdit: (record: PolicyVehicleRecord) => void
}

const SPACES_CDN = process.env.NEXT_PUBLIC_SPACES_CDN_URL || 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'

export function PolicyTable({
  records,
  loading,
  onViewPdf,
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
            <th className="py-3 px-4">ข้อมูลรถ</th>
            <th className="py-3 px-4">🛡️ ประกันภัยภาคสมัครใจ (PLMV)</th>
            <th className="py-3 px-4">📜 พ.ร.บ. (PLMC)</th>
            <th className="py-3 px-4">🏷️ ภาษีรถประจำปี</th>
            <th className="py-3 px-4">⏱️ ภาษีมิเตอร์แท็กซี่</th>
            <th className="py-3 px-4">ผู้เช่า / สัญญา</th>
            <th className="py-3 px-4 text-center">จัดการ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
          {records.map((rec) => {
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

            return (
              <tr
                key={rec.vinNo}
                className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* 1. Vehicle Info */}
                <td className="py-3 px-4">
                  <div className="font-semibold text-sm text-zinc-900 dark:text-white">
                    {rec.registerNo || <span className="text-zinc-400 italic">ไม่มีทะเบียน</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono tracking-tight mt-0.5">
                    {rec.vinNo}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {rec.model && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                        {rec.model}
                      </span>
                    )}
                    {rec.project && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium border border-amber-200/50 dark:border-amber-800/40">
                        {rec.project}
                      </span>
                    )}
                  </div>
                </td>

                {/* 2. Insurance (PLMV) */}
                <td className="py-3 px-4">
                  {rec.insurancePolicyNo ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 text-[10px] rounded font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
                          {rec.insuranceType || 'PLMV'}
                        </span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300">
                          {rec.insurancePolicyNo}
                        </span>
                      </div>
                      <div className="text-zinc-500 text-[11px]">
                        หมดอายุ: <strong className="text-zinc-800 dark:text-zinc-200">{formatThaiDate(rec.insuranceEndDate)}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${insBadge.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${insBadge.dot}`} />
                          {insBadge.label}
                        </span>
                        {insPdfUrl && (
                          <button
                            type="button"
                            onClick={() => onViewPdf(insPdfUrl, `ประกันภัย ${rec.registerNo || rec.vinNo}`)}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium underline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            ดู PDF
                          </button>
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
                          <button
                            type="button"
                            onClick={() => onViewPdf(actPdfUrl, `พ.ร.บ. ${rec.registerNo || rec.vinNo}`)}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium underline"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            ดู PDF
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic text-[11px]">ไม่มีข้อมูล พ.ร.บ.</span>
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

                {/* 6. Customer / Contract */}
                <td className="py-3 px-4">
                  <div className="text-zinc-900 dark:text-zinc-100 font-medium">
                    {rec.customerName || '-'}
                  </div>
                  {rec.contractNo && (
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      สัญญา: {rec.contractNo}
                    </div>
                  )}
                  {rec.phoneNo && (
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      📞 {rec.phoneNo}
                    </div>
                  )}
                </td>

                {/* 7. Row Actions */}
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
