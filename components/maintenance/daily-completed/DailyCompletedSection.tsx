'use client'

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import useSWR from 'swr'
import { exportToExcelMultiSheet, formatDateForExcelRaw } from '@/lib/exportExcel'
import { DailyCompletedHeader } from './DailyCompletedHeader'
import { DailyCompletedCalendar } from './DailyCompletedCalendar'
import { DailyCompletedMatrix } from './DailyCompletedMatrix'
import { DailyCompletedDateDetail } from './DailyCompletedDateDetail'
import {
  THAI_MONTHS_FULL,
  THAI_MONTHS_SHORT,
  getBangkokTodayParts,
  formatDateKeyFullTh,
  formatDateKeyShortTh,
  type CompletedMaintenanceItem,
  type CompletionScope,
  type DailyCompletedResponse,
  type DailyViewMode,
  type SubBreakdownMode,
} from './types'

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const json = await r.json()
  if (!r.ok) {
    throw new Error(json?.error || `HTTP ${r.status}`)
  }
  return json
}

function DailyCompletedSectionComponent() {
  const todayInfo = useMemo(() => getBangkokTodayParts(), [])

  const [isCollapsed, setIsCollapsed] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number>(todayInfo.year)
  const [selectedMonth, setSelectedMonth] = useState<number>(todayInfo.month)
  const [viewMode, setViewMode] = useState<DailyViewMode>('calendar')
  const [completionScope, setCompletionScope] = useState<CompletionScope>('all')
  const [selectedProblemType, setSelectedProblemType] = useState<string>('all')
  const [selectedBranch, setSelectedBranch] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [subBreakdown, setSubBreakdown] = useState<SubBreakdownMode>('auto')
  const [hideZeroBranches, setHideZeroBranches] = useState<boolean>(true)

  const { data, isLoading, isValidating, error } = useSWR<DailyCompletedResponse>(
    isCollapsed ? null : `/api/maintenance/daily-completed?year=${selectedYear}&month=${selectedMonth}`,
    fetcher,
    {
      refreshInterval: 60_000,
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )

  useEffect(() => {
    setSelectedDate(null)
  }, [selectedYear, selectedMonth])

  const handlePrevMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev === 1) {
        setSelectedYear(y => y - 1)
        return 12
      }
      return prev - 1
    })
  }, [])

  const handleNextMonth = useCallback(() => {
    setSelectedMonth(prev => {
      if (prev === 12) {
        setSelectedYear(y => y + 1)
        return 1
      }
      return prev + 1
    })
  }, [])

  const handleResetCurrentMonth = useCallback(() => {
    setSelectedYear(todayInfo.year)
    setSelectedMonth(todayInfo.month)
    setSelectedDate(null)
  }, [todayInfo.year, todayInfo.month])

  const handleClearFilters = useCallback(() => {
    setSelectedProblemType('all')
    setSelectedBranch('all')
    setSelectedDate(null)
  }, [])

  const handleSelectMatrixCell = useCallback((branchCode: string, dateKey: string) => {
    setSelectedBranch(branchCode)
    setSelectedDate(dateKey)
  }, [])

  const rawItems = useMemo(() => data?.items || [], [data?.items])
  const allBranches = useMemo(() => data?.branches || [], [data?.branches])
  const allProblemTypes = useMemo(() => data?.problemTypes || [], [data?.problemTypes])

  // Step 1: Items filtered by completionScope
  const scopeFilteredItems = useMemo(() => {
    if (completionScope === 'all') return rawItems
    if (completionScope === 'COMPLETE') return rawItems.filter(i => i.status_code === 'COMPLETE')
    return rawItems.filter(i => i.status_code !== 'COMPLETE')
  }, [rawItems, completionScope])

  // Items matching completionScope + selectedBranch (used to compute counts per Problem Type)
  const itemsForProblemCounts = useMemo(() => {
    if (selectedBranch === 'all') return scopeFilteredItems
    return scopeFilteredItems.filter(i => i.service_location_code === selectedBranch)
  }, [scopeFilteredItems, selectedBranch])

  // Items matching completionScope + selectedProblemType (used to compute counts per Branch)
  const itemsForBranchCounts = useMemo(() => {
    if (selectedProblemType === 'all') return scopeFilteredItems
    return scopeFilteredItems.filter(i => i.problem_type_code === selectedProblemType)
  }, [scopeFilteredItems, selectedProblemType])

  // Final filtered items (completionScope + selectedProblemType + selectedBranch)
  const filteredItems = useMemo(() => {
    if (selectedBranch === 'all') return itemsForBranchCounts
    return itemsForBranchCounts.filter(i => i.service_location_code === selectedBranch)
  }, [itemsForBranchCounts, selectedBranch])

  // Dynamic Problem Type options from EV_MsSubStatus + monthly items
  const problemTypeOptions = useMemo(() => {
    const countMap: Record<string, number> = {}
    const nameMap: Record<string, string> = {}
    for (const p of allProblemTypes) nameMap[p.code] = p.name
    for (const item of itemsForProblemCounts) {
      countMap[item.problem_type_code] = (countMap[item.problem_type_code] || 0) + 1
      nameMap[item.problem_type_code] = item.problem_type
    }

    const codes = new Set<string>([
      ...allProblemTypes.map(p => p.code),
      ...Object.keys(countMap),
    ])

    return Array.from(codes)
      .map(code => ({
        code,
        name: nameMap[code] || code,
        count: countMap[code] || 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        if (a.code === 'UNSPECIFIED') return 1
        if (b.code === 'UNSPECIFIED') return -1
        return a.name.localeCompare(b.name, 'th')
      })
  }, [allProblemTypes, itemsForProblemCounts])

  // Dynamic branch options from DB master + monthly items
  const branchOptions = useMemo(() => {
    const countMap: Record<string, number> = {}
    const nameMap: Record<string, string> = {}
    for (const b of allBranches) nameMap[b.code] = b.name
    for (const item of itemsForBranchCounts) {
      countMap[item.service_location_code] = (countMap[item.service_location_code] || 0) + 1
      nameMap[item.service_location_code] = item.service_location_name
    }

    const codes = new Set<string>([
      ...allBranches.map(b => b.code),
      ...Object.keys(countMap),
    ])

    return Array.from(codes)
      .map(code => ({
        code,
        name: nameMap[code] || code,
        count: countMap[code] || 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count
        if (a.code === 'UNSPECIFIED') return 1
        if (b.code === 'UNSPECIFIED') return -1
        return a.name.localeCompare(b.name, 'th')
      })
  }, [allBranches, itemsForBranchCounts])

  const activeBranchPills = useMemo(
    () => branchOptions.filter(b => b.count > 0),
    [branchOptions]
  )

  const itemsByDate = useMemo(() => {
    const map: Record<string, CompletedMaintenanceItem[]> = {}
    for (const item of filteredItems) {
      if (!item.finish_date_key) continue
      if (!map[item.finish_date_key]) map[item.finish_date_key] = []
      map[item.finish_date_key].push(item)
    }
    return map
  }, [filteredItems])

  const kpiStats = useMemo(() => {
    const uniqueCars = new Set(filteredItems.map(i => i.vin || i.register_no).filter(Boolean)).size
    let completeCount = 0
    let readyPickupCount = 0
    let repairDaysSum = 0
    let repairDaysValidCount = 0
    const byBranch: Record<string, { name: string; count: number }> = {}

    for (const item of filteredItems) {
      if (item.status_code === 'COMPLETE') completeCount++
      else readyPickupCount++

      if (typeof item.repair_days === 'number') {
        repairDaysSum += item.repair_days
        repairDaysValidCount++
      }

      if (!byBranch[item.service_location_code]) {
        byBranch[item.service_location_code] = { name: item.service_location_name, count: 0 }
      }
      byBranch[item.service_location_code].count++
    }

    const activeDaysCount = Object.keys(itemsByDate).length
    const avgPerActiveDay =
      activeDaysCount > 0 ? Math.round((filteredItems.length / activeDaysCount) * 10) / 10 : 0
    const avgRepairDays =
      repairDaysValidCount > 0 ? Math.round((repairDaysSum / repairDaysValidCount) * 10) / 10 : 0
    const topBranch = Object.values(byBranch).sort((a, b) => b.count - a.count)[0] || null

    return {
      totalTickets: filteredItems.length,
      uniqueCars,
      completeCount,
      readyPickupCount,
      activeDaysCount,
      avgPerActiveDay,
      avgRepairDays,
      topBranch,
    }
  }, [filteredItems, itemsByDate])

  const daysInMonth = useMemo(
    () => new Date(Date.UTC(selectedYear, selectedMonth, 0)).getUTCDate(),
    [selectedYear, selectedMonth]
  )
  const startDayOfWeek = useMemo(
    () => new Date(Date.UTC(selectedYear, selectedMonth - 1, 1)).getUTCDay(),
    [selectedYear, selectedMonth]
  )

  const matrixData = useMemo(() => {
    const targetBranches =
      selectedBranch !== 'all'
        ? branchOptions.filter(b => b.code === selectedBranch)
        : hideZeroBranches
        ? branchOptions.filter(b => b.count > 0)
        : branchOptions

    const dayMatrix: Record<string, Record<number, number>> = {}
    const dailyTotals: Record<number, number> = {}

    for (const item of filteredItems) {
      const dayNum = parseInt(item.finish_date_key.split('-')[2] || '0', 10)
      if (!dayNum) continue
      if (!dayMatrix[item.service_location_code]) dayMatrix[item.service_location_code] = {}
      dayMatrix[item.service_location_code][dayNum] =
        (dayMatrix[item.service_location_code][dayNum] || 0) + 1
      dailyTotals[dayNum] = (dailyTotals[dayNum] || 0) + 1
    }

    const rows = targetBranches.map(b => {
      const countsByDay = dayMatrix[b.code] || {}
      return {
        code: b.code,
        name: b.name,
        total: b.count,
        activeDays: Object.keys(countsByDay).length,
        countsByDay,
      }
    })

    return { rows, dailyTotals }
  }, [branchOptions, selectedBranch, hideZeroBranches, filteredItems])

  const handleExportExcel = useCallback(() => {
    const monthTitle = `${THAI_MONTHS_FULL[selectedMonth - 1]} ${selectedYear + 543}`
    const branchLabel =
      selectedBranch === 'all'
        ? 'ทุกสาขา/อู่'
        : branchOptions.find(b => b.code === selectedBranch)?.name || selectedBranch
    const problemLabel =
      selectedProblemType === 'all'
        ? 'ทุกประเภทงาน'
        : problemTypeOptions.find(p => p.code === selectedProblemType)?.name || selectedProblemType

    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'))
    const matrixHeaders = ['ลำดับ', 'สาขา / อู่ซ่อม', 'รวมเดือน (ใบงาน)', 'จำนวนวันที่มีงานปิด', ...dayHeaders]
    const matrixRows: (string | number)[][] = matrixData.rows.map((r, idx) => [
      idx + 1,
      r.name,
      r.total,
      r.activeDays,
      ...Array.from({ length: daysInMonth }, (_, i) => r.countsByDay[i + 1] || 0),
    ])

    matrixRows.push([
      '',
      'รวมทุกสาขารายวัน',
      filteredItems.length,
      Object.keys(matrixData.dailyTotals).length,
      ...Array.from({ length: daysInMonth }, (_, i) => matrixData.dailyTotals[i + 1] || 0),
    ])

    const detailSource = selectedDate ? (itemsByDate[selectedDate] || []) : filteredItems
    const detailHeaders = [
      'ลำดับ',
      'วันที่ซ่อมเสร็จ',
      'สาขา / อู่ซ่อม',
      'ทะเบียน',
      'เลขตัวถัง (VIN)',
      'รุ่นรถ',
      'โครงการ',
      'อาการที่แจ้ง',
      'ประเภทปัญหา',
      'เคสการซ่อม',
      'วันแจ้งซ่อม',
      'วันเริ่มซ่อม',
      'วันรับรถคืน',
      'ระยะเวลาซ่อม (วัน)',
      'สถานะใบงาน',
      'ผู้บันทึกอัปเดต',
    ]

    const detailRows = detailSource.map((item, idx) => [
      idx + 1,
      formatDateKeyShortTh(item.finish_date_key),
      item.service_location_name,
      item.register_no || '-',
      item.vin,
      item.model || '-',
      item.project || '-',
      item.issue_title,
      item.problem_type,
      item.car_case,
      formatDateForExcelRaw(item.report_date),
      formatDateForExcelRaw(item.start_date),
      formatDateForExcelRaw(item.return_date),
      item.repair_days ?? '-',
      item.status_text,
      item.updater_name,
    ])

    exportToExcelMultiSheet({
      fileName: `สรุปปิดงานซ่อมรายวัน_${THAI_MONTHS_SHORT[selectedMonth - 1]}${selectedYear + 543}`,
      sheets: [
        {
          sheetName: 'สรุปรายสาขา_รายวัน',
          reportName: `ตารางสรุปยอดปิดงานซ่อมรายวัน แยกตามสาขา/อู่ (${monthTitle})`,
          periodLabel: `เดือน: ${monthTitle} | สาขา: ${branchLabel} | ประเภทงาน: ${problemLabel}`,
          headers: matrixHeaders,
          rows: matrixRows,
        },
        {
          sheetName: 'รายการใบงานซ่อมเสร็จ',
          reportName: `รายการใบงานซ่อมเสร็จ (${selectedDate ? formatDateKeyFullTh(selectedDate) : monthTitle})`,
          periodLabel: `${selectedDate ? `วันที่: ${formatDateKeyFullTh(selectedDate)}` : `เดือน: ${monthTitle}`} | สาขา: ${branchLabel} | ประเภทงาน: ${problemLabel}`,
          headers: detailHeaders,
          rows: detailRows,
        },
      ],
    })
  }, [selectedMonth, selectedYear, selectedBranch, branchOptions, selectedProblemType, problemTypeOptions, daysInMonth, matrixData, filteredItems, selectedDate, itemsByDate])

  return (
    <section className="bg-white/75 dark:bg-zinc-900/65 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm backdrop-blur-md space-y-4">
      {/* Section Title & Collapse Button */}
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📅</span>
              <span>สรุปผลงานปิดงานซ่อมรายวัน แยกตามสาขา/อู่</span>
            </h2>
            {isValidating && !isLoading && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" title="กำลังอัปเดตข้อมูล" />
            )}
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            ติดตามจำนวนใบงานที่ซ่อมเสร็จในแต่ละวันของทุกสาขา/อู่ (อ้างอิงตามวันซ่อมเสร็จ MaintenanceFinishDate) • คลิกช่องวันที่เพื่อดูรายละเอียดรถรายคัน
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(c => !c)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition shrink-0"
        >
          {isCollapsed ? '▼ แสดงปฏิทินปิดงาน' : '▲ ย่อส่วนนี้'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <DailyCompletedHeader
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            todayYear={todayInfo.year}
            todayMonth={todayInfo.month}
            onChangeYear={setSelectedYear}
            onChangeMonth={setSelectedMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onResetCurrentMonth={handleResetCurrentMonth}
            completionScope={completionScope}
            onChangeCompletionScope={setCompletionScope}
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            subBreakdown={subBreakdown}
            onChangeSubBreakdown={setSubBreakdown}
            selectedProblemType={selectedProblemType}
            onSelectProblemType={setSelectedProblemType}
            problemTypeOptions={problemTypeOptions}
            totalBeforeProblemTypeFilter={itemsForProblemCounts.length}
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            branchOptions={branchOptions}
            activeBranchPills={activeBranchPills}
            totalBeforeBranchFilter={itemsForBranchCounts.length}
            hasActiveDateOrBranchFilter={
              selectedProblemType !== 'all' || selectedBranch !== 'all' || selectedDate !== null
            }
            onClearFilters={handleClearFilters}
            kpiStats={kpiStats}
            onExport={handleExportExcel}
          />

          {isLoading && !data ? (
            <div className="flex justify-center py-14">
              <div className="animate-spin h-7 w-7 border-4 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-rose-500 text-xs font-bold">
              ไม่สามารถโหลดข้อมูลสรุปยอดปิดงานรายวันได้
            </div>
          ) : viewMode === 'calendar' ? (
            <DailyCompletedCalendar
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              todayDateKey={todayInfo.dateKey}
              daysInMonth={daysInMonth}
              startDayOfWeek={startDayOfWeek}
              itemsByDate={itemsByDate}
              selectedBranch={selectedBranch}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              subBreakdown={subBreakdown}
            />
          ) : (
            <DailyCompletedMatrix
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              daysInMonth={daysInMonth}
              startDayOfWeek={startDayOfWeek}
              rows={matrixData.rows}
              dailyTotals={matrixData.dailyTotals}
              grandTotal={filteredItems.length}
              selectedBranch={selectedBranch}
              selectedDate={selectedDate}
              hideZeroBranches={hideZeroBranches}
              onToggleHideZeroBranches={setHideZeroBranches}
              onSelectBranch={setSelectedBranch}
              onSelectDate={setSelectedDate}
              onSelectCell={handleSelectMatrixCell}
            />
          )}

          {selectedDate && !error && (
            <DailyCompletedDateDetail
              selectedDate={selectedDate}
              items={itemsByDate[selectedDate] || []}
              selectedBranch={selectedBranch}
              onSelectBranch={setSelectedBranch}
              onClose={() => setSelectedDate(null)}
            />
          )}
        </>
      )}
    </section>
  )
}

export const DailyCompletedSection = memo(DailyCompletedSectionComponent)
export default DailyCompletedSection
