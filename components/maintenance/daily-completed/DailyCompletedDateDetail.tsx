'use client'

import React, { useState, useEffect, useMemo, memo } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import {
  formatDateKeyFullTh,
  formatDateKeyShortTh,
  formatDateThUtc,
  getBranchPalette,
  type CompletedMaintenanceItem,
} from './types'

interface DailyCompletedDateDetailProps {
  selectedDate: string
  items: CompletedMaintenanceItem[]
  selectedBranch: string
  onSelectBranch: (code: string) => void
  onClose: () => void
}

function DailyCompletedDateDetailComponent({
  selectedDate,
  items,
  selectedBranch,
  onSelectBranch,
  onClose,
}: DailyCompletedDateDetailProps) {
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    setPage(1)
  }, [selectedDate, selectedBranch])

  const branchSummary = useMemo(() => {
    const map: Record<string, { code: string; name: string; count: number }> = {}
    for (const item of items) {
      if (!map[item.service_location_code]) {
        map[item.service_location_code] = {
          code: item.service_location_code,
          name: item.service_location_name,
          count: 0,
        }
      }
      map[item.service_location_code].count++
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [items])

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage))
  const safePage = Math.min(page, totalPages)
  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage
    return items.slice(start, start + itemsPerPage)
  }, [items, safePage])

  return (
    <div className="p-4 bg-zinc-50/90 dark:bg-zinc-950/60 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 text-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/80 dark:border-zinc-800 pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-extrabold text-zinc-900 dark:text-zinc-100">
            📅 รายการซ่อมเสร็จประจำวันที่ {formatDateKeyFullTh(selectedDate)}
          </h4>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            รวม {items.length} ใบงาน
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-rose-500 hover:text-rose-600 font-bold transition-colors text-xs"
        >
          ปิดรายละเอียดวัน ✕
        </button>
      </div>

      {/* Quick branch summary pills for that date */}
      {branchSummary.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {branchSummary.map(b => {
            const palette = getBranchPalette(b.code)
            const isSelected = selectedBranch === b.code
            return (
              <button
                key={b.code}
                type="button"
                onClick={() => onSelectBranch(isSelected ? 'all' : b.code)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${palette.pill}`}
              >
                <span>{b.name}</span>
                <span className="tabular-nums font-black">{b.count}</span>
              </button>
            )
          })}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 py-4 text-center">
          ไม่มีรายการใบงานที่ซ่อมเสร็จในวันนี้
        </p>
      ) : (
        <>
          <div className="overflow-x-auto bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 font-semibold bg-zinc-50/60 dark:bg-zinc-900/60">
                  <th className="py-2.5 px-3">📍 สาขา / อู่ซ่อม</th>
                  <th className="py-2.5 pr-3">ทะเบียน / VIN</th>
                  <th className="py-2.5 pr-3">รุ่น / โครงการ</th>
                  <th className="py-2.5 pr-3">อาการที่แจ้ง</th>
                  <th className="py-2.5 pr-3">ประเภท / เคส</th>
                  <th className="py-2.5 pr-3">วันเริ่ม → เสร็จ</th>
                  <th className="py-2.5 pr-3">ผู้บันทึก</th>
                  <th className="py-2.5 pr-3 text-right">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {pagedItems.map(item => {
                  const palette = getBranchPalette(item.service_location_code)
                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${palette.pill}`}>
                          {item.service_location_name}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <a
                          href={`/vehicle/${encodeURIComponent(item.register_no || item.vin)}`}
                          className="font-mono font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {item.register_no || '-'}
                        </a>
                        <div className="font-mono text-[10px] text-zinc-400">{item.vin}</div>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{item.model || '-'}</div>
                        <div className="text-[10px] text-zinc-400">{item.project || '-'}</div>
                      </td>
                      <td className="py-2.5 pr-3 max-w-[220px] truncate" title={item.issue_title}>
                        {item.issue_title}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <div>{item.problem_type}</div>
                        {item.car_case !== '-' && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{item.car_case}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-[11px]">
                        <div>
                          {formatDateThUtc(item.start_date || item.report_date)} → {formatDateKeyShortTh(item.finish_date_key)}
                        </div>
                        {item.repair_days !== null && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {item.repair_days} วัน
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{item.updater_name}</td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            item.status_code === 'COMPLETE'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
                              : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400'
                          }`}
                        >
                          {item.status_text}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
              totalItems={items.length}
              itemsPerPage={itemsPerPage}
            />
          )}
        </>
      )}
    </div>
  )
}

export const DailyCompletedDateDetail = memo(DailyCompletedDateDetailComponent)
