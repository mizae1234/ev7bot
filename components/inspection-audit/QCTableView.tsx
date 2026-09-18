import React from 'react'
import { QCRecord } from './types'
import { maskStaffName, getThaiDate } from './qc-helpers'

interface QCTableViewProps {
  items: QCRecord[]
  loading: boolean
  onViewDetail: (item: QCRecord) => void
}

export const QCTableView: React.FC<QCTableViewProps> = ({
  items,
  loading,
  onViewDetail,
}) => {
  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-5 py-4">ทะเบียนรถ (Register No)</th>
                <th className="px-5 py-4">วันที่ตรวจ QC</th>
                <th className="px-5 py-4">ผลการตรวจ QC</th>
                <th className="px-5 py-4 text-center">แบตเตอรี่ (HV SoC)</th>
                <th className="px-5 py-4">ผู้ตรวจ QC</th>
                <th className="px-5 py-4">หมายเหตุ / สรุป</th>
                <th className="px-5 py-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      กำลังโหลดประวัติการตรวจ QC...
                    </div>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item) => {
                  const isPassed =
                    item.assessmentResult === 'NORMAL' ||
                    (item.remark ? !item.remark.includes('ไม่ผ่าน') : true)
                  const batteryItem = item.items?.find((it: any) => {
                    const cat = (it.category || it.Category || '').toUpperCase()
                    return cat.includes('BATTERY')
                  })
                  const socVal = batteryItem?.numericValue != null ? `${batteryItem.numericValue}%` : '-'

                  return (
                    <tr
                      key={item.inspectionId}
                      onClick={() => onViewDetail(item)}
                      className="hover:bg-slate-50 transition duration-150 cursor-pointer active:bg-slate-100 group"
                    >
                      <td className="px-5 py-4 font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                        {item.registerNo || '-'}
                        <p className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">
                          {item.vinNo}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">
                        {getThaiDate(item.inspectionDate)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isPassed ? '🟢 ผ่านการตรวจ QC' : '🔴 ไม่ผ่าน QC'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-slate-800 font-mono">
                        {socVal}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">
                        {maskStaffName(item.inspectorName)}
                      </td>
                      <td className="px-5 py-4 text-slate-500 max-w-xs truncate text-[11px]">
                        {item.remark || '-'}
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onViewDetail(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <span>ดูผลตรวจ</span> <span>🔍</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                    ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards (Compact List) */}
      <div className="block md:hidden space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const isPassed =
              item.assessmentResult === 'NORMAL' ||
              (item.remark ? !item.remark.includes('ไม่ผ่าน') : true)
            const batteryItem = item.items?.find((it: any) => {
              const cat = (it.category || it.Category || '').toUpperCase()
              return cat.includes('BATTERY')
            })
            const socVal = batteryItem?.numericValue != null ? `${batteryItem.numericValue}%` : '-'

            return (
              <div
                key={item.inspectionId}
                onClick={() => onViewDetail(item)}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:border-slate-300 transition space-y-2 cursor-pointer active:scale-98"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">
                      {item.registerNo || item.vinNo}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">VIN: {item.vinNo}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      isPassed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isPassed ? '🟢 ผ่าน' : '🔴 ไม่ผ่าน'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[10px]">วันที่ตรวจ: </span>
                    <span className="font-semibold">{getThaiDate(item.inspectionDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px]">แบตเตอรี่: </span>
                    <span className="font-bold text-slate-800 font-mono">{socVal}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 text-[10px]">ผู้ตรวจ: </span>
                    <span className="font-medium text-slate-700">{maskStaffName(item.inspectorName)}</span>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewDetail(item)
                    }}
                    className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>ดูผลตรวจ 🔍</span>
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">
            ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
          </div>
        )}
      </div>
    </>
  )
}
