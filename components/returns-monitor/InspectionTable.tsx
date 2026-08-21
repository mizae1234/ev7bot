'use client'

import React, { useState, useMemo } from 'react'
import type { InspectionListItem } from '@/lib/inspection/types'
import { getThaiDate, getAssessmentLabel, maskName, PAGE_SIZE } from './constants'

interface InspectionTableProps {
  inspections: InspectionListItem[]
  onSelectInspection: (id: number) => void
}

export default function InspectionTable({ inspections, onSelectInspection }: InspectionTableProps) {
  const [currentPage, setCurrentPage] = useState(1)

  // Reset to page 1 when data changes
  const totalPages = Math.max(1, Math.ceil(inspections.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return inspections.slice(start, start + PAGE_SIZE)
  }, [inspections, safePage])

  // Reset page when inspections change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [inspections.length])

  const handlePrev = () => setCurrentPage(p => Math.max(1, p - 1))
  const handleNext = () => setCurrentPage(p => Math.min(totalPages, p + 1))

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <th className="px-4 py-4 text-center w-12 text-slate-400 font-bold">#</th>
              <th className="px-5 py-4">ทะเบียน / เลขตัวถัง (VIN)</th>
              <th className="px-5 py-4">ผู้เช่า / เบอร์โทร</th>
              <th className="px-5 py-4">สถานที่รับคืน</th>
              <th className="px-5 py-4">วันที่คืนรถ</th>
              <th className="px-5 py-4 text-center">สถานะเอกสาร</th>
              <th className="px-5 py-4 text-center">การประเมินสภาพ</th>
              <th className="px-5 py-4">ผู้ตรวจเช็ค</th>
              <th className="px-5 py-4 text-center">กิโลเมตร</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {paginatedItems.length > 0 ? (
              paginatedItems.map((item, idx) => {
                const isDraft = item.status === 'DRAFT'
                const assessmentLabel = getAssessmentLabel(item.assessmentResult)
                const rowNo = (safePage - 1) * PAGE_SIZE + idx + 1

                return (
                  <tr
                    key={item.inspectionId}
                    onClick={() => onSelectInspection(item.inspectionId)}
                    className="hover:bg-slate-50 transition duration-150 cursor-pointer active:bg-slate-100"
                  >
                    {/* Row No */}
                    <td className="px-4 py-4 text-center font-mono text-[11px] text-slate-400 font-semibold">
                      {rowNo}
                    </td>

                    {/* Register No & VIN */}
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900 text-sm">{item.registerNo || '-'}</p>
                      <p className="font-mono text-[9px] text-slate-400 mt-0.5">{item.vinNo}</p>
                    </td>

                    {/* Customer */}
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-800">{maskName(item.customerName)}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.customerContact || '-'}</p>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4 font-medium text-slate-600">
                      {item.locationName || item.location || '-'}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 font-medium text-slate-600">
                      {getThaiDate(item.inspectionDate)}
                    </td>

                    {/* Document status */}
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                        isDraft
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isDraft ? 'DRAFT' : 'SUBMIT'}
                      </span>
                    </td>

                    {/* Assessment Badge & Damaged Points */}
                    <td className="px-5 py-4 min-w-[200px]">
                      {item.isPendingChecklist ? (
                        <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-violet-50 text-violet-600 border border-violet-200">
                          🔄 รอตรวจภายหลัง
                        </span>
                      ) : (
                        <div className="space-y-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            assessmentLabel === 'ปกติ'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : assessmentLabel === 'ต้องส่งเข้าซ่อม'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <span>
                              {assessmentLabel === 'ปกติ' ? '✅' : assessmentLabel === 'ต้องส่งเข้าซ่อม' ? '⚠️' : '⏳'}
                            </span>
                            {assessmentLabel}
                            {item.damagedCount && item.damagedCount > 0 ? ` (${item.damagedCount} จุด)` : ''}
                          </span>

                          {/* Damaged points breakdown pills */}
                          {item.damagedItems && item.damagedItems.length > 0 && (
                            <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-2 space-y-1">
                              <p className="text-[9px] font-bold text-rose-800 flex items-center gap-1">
                                <span>🛠️</span> จุดที่พบความเสียหาย:
                              </p>
                              <div className="flex flex-wrap gap-1 max-w-[260px]">
                                {item.damagedItems.map((d, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-rose-200 text-[9px] text-slate-800 font-medium shadow-2xs"
                                    title={`${d.categoryLabel} > ${d.label}: ${d.valueLabel}${d.detail ? ` (${d.detail})` : ''}`}
                                  >
                                    <span>{d.categoryIcon}</span>
                                    <span className="font-semibold">{d.label}</span>
                                    <span className="text-rose-600 font-bold">({d.valueLabel})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Inspector */}
                    <td className="px-5 py-4 font-medium text-slate-600">
                      {maskName(item.inspectorName)}
                    </td>

                    {/* Mileage */}
                    <td className="px-5 py-4 text-center font-mono font-bold text-slate-900 text-[11px]">
                      {item.mileage != null ? `${item.mileage.toLocaleString()} กม.` : '-'}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400 font-medium">
                  ไม่พบข้อมูลรายการคืนรถที่ตรงตามตัวกรอง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {inspections.length > PAGE_SIZE && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50/50">
          <p className="text-[10px] text-slate-500 font-medium">
            แสดง {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, inspections.length)} จาก {inspections.length} รายการ
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrev}
              disabled={safePage <= 1}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
            >
              ◀ ก่อนหน้า
            </button>
            <span className="px-3 py-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={safePage >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
            >
              ถัดไป ▶
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
