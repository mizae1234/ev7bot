'use client'

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import useSWR from 'swr'
import { exportToExcelMultiSheet, formatDateForExcelRaw } from '@/lib/exportExcel'
import { DailyCompletedHeader } from './DailyCompletedHeader'
import { DailyCompletedCalendar } from './DailyCompletedCalendar'
import {
  DailyCompletedMatrix,
  type MatrixBranchRow,
  type MatrixProblemSubRow,
} from './DailyCompletedMatrix'
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
  const [viewMode, setViewMode] = useState<DailyViewMode>('matrix')
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

  const handleSelectMatrixCell = useCallback((branchCode: string, dateKey: string, problemCode?: string) => {
    setSelectedBranch(branchCode)
    setSelectedDate(dateKey)
    if (problemCode) {
      setSelectedProblemType(problemCode)
    }
  }, [])

  const rawItems = useMemo(() => data?.items || [], [data?.items])
  const allBranches = useMemo(() => data?.branches || [], [data?.branches])
  const allProblemTypes = useMemo(() => data?.problemTypes || [], [data?.problemTypes])
  const rawPendingSummary = useMemo(() => data?.pendingSummary || [], [data?.pendingSummary])

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
    // 1. Aggregate pending items by branch -> problemType
    const scopedPending = rawPendingSummary.filter(p => {
      if (selectedProblemType !== 'all' && p.problem_type_code !== selectedProblemType) return false
      if (selectedBranch !== 'all' && p.location_code !== selectedBranch) return false
      return true
    })

    const pendingByBranch: Record<string, Record<string, { name: string; count: number }>> = {}
    const grandPendingTypeMap: Record<string, { name: string; count: number }> = {}
    let grandPendingTotal = 0

    for (const p of scopedPending) {
      if (p.count <= 0) continue
      if (!pendingByBranch[p.location_code]) pendingByBranch[p.location_code] = {}
      if (!pendingByBranch[p.location_code][p.problem_type_code]) {
        pendingByBranch[p.location_code][p.problem_type_code] = { name: p.problem_type, count: 0 }
      }
      pendingByBranch[p.location_code][p.problem_type_code].count += p.count

      if (!grandPendingTypeMap[p.problem_type_code]) {
        grandPendingTypeMap[p.problem_type_code] = { name: p.problem_type, count: 0 }
      }
      grandPendingTypeMap[p.problem_type_code].count += p.count
      grandPendingTotal += p.count
    }

    // 2. Aggregate completed items by branch -> day & problemType -> day
    const dayMatrix: Record<string, Record<number, number>> = {}
    const completedByBranchType: Record<
      string,
      Record<string, { name: string; total: number; countsByDay: Record<number, number> }>
    > = {}
    const grandCompletedTypeMap: Record<
      string,
      { name: string; total: number; countsByDay: Record<number, number> }
    > = {}
    const dailyTotals: Record<number, number> = {}

    for (const item of filteredItems) {
      const loc = item.service_location_code
      const pCode = item.problem_type_code
      const dayNum = parseInt(item.finish_date_key.split('-')[2] || '0', 10)

      if (!dayMatrix[loc]) dayMatrix[loc] = {}
      if (dayNum) {
        dayMatrix[loc][dayNum] = (dayMatrix[loc][dayNum] || 0) + 1
        dailyTotals[dayNum] = (dailyTotals[dayNum] || 0) + 1
      }

      if (!completedByBranchType[loc]) completedByBranchType[loc] = {}
      if (!completedByBranchType[loc][pCode]) {
        completedByBranchType[loc][pCode] = { name: item.problem_type, total: 0, countsByDay: {} }
      }
      completedByBranchType[loc][pCode].total += 1
      if (dayNum) {
        completedByBranchType[loc][pCode].countsByDay[dayNum] =
          (completedByBranchType[loc][pCode].countsByDay[dayNum] || 0) + 1
      }

      if (!grandCompletedTypeMap[pCode]) {
        grandCompletedTypeMap[pCode] = { name: item.problem_type, total: 0, countsByDay: {} }
      }
      grandCompletedTypeMap[pCode].total += 1
      if (dayNum) {
        grandCompletedTypeMap[pCode].countsByDay[dayNum] =
          (grandCompletedTypeMap[pCode].countsByDay[dayNum] || 0) + 1
      }
    }

    // 3. Build rows for candidate branches
    const candidateBranches =
      selectedBranch !== 'all'
        ? branchOptions.filter(b => b.code === selectedBranch)
        : branchOptions

    const allBuiltRows: MatrixBranchRow[] = candidateBranches.map(b => {
      const countsByDay = dayMatrix[b.code] || {}
      const branchPendMap = pendingByBranch[b.code] || {}
      const branchCompMap = completedByBranchType[b.code] || {}

      const pendingTotal = Object.values(branchPendMap).reduce((sum, x) => sum + x.count, 0)

      const subProblemCodes = new Set<string>([
        ...Object.keys(branchPendMap),
        ...Object.keys(branchCompMap),
      ])

      const subRows: MatrixProblemSubRow[] = Array.from(subProblemCodes)
        .map(pCode => ({
          problemCode: pCode,
          problemName: branchCompMap[pCode]?.name || branchPendMap[pCode]?.name || pCode,
          pendingCount: branchPendMap[pCode]?.count || 0,
          completedTotal: branchCompMap[pCode]?.total || 0,
          countsByDay: branchCompMap[pCode]?.countsByDay || {},
        }))
        .filter(sr => sr.pendingCount > 0 || sr.completedTotal > 0)
        .sort((a, b) => {
          if (b.completedTotal !== a.completedTotal) return b.completedTotal - a.completedTotal
          if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount
          return a.problemName.localeCompare(b.problemName, 'th')
        })

      return {
        code: b.code,
        name: b.name,
        pendingTotal,
        total: b.count,
        activeDays: Object.keys(countsByDay).length,
        countsByDay,
        subRows,
      }
    })

    const rows = (
      selectedBranch !== 'all'
        ? allBuiltRows
        : hideZeroBranches
        ? allBuiltRows.filter(r => r.total > 0 || r.pendingTotal > 0)
        : allBuiltRows
    ).sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      if (b.pendingTotal !== a.pendingTotal) return b.pendingTotal - a.pendingTotal
      if (a.code === 'UNSPECIFIED') return 1
      if (b.code === 'UNSPECIFIED') return -1
      return a.name.localeCompare(b.name, 'th')
    })

    const allGrandProblemCodes = new Set<string>([
      ...Object.keys(grandPendingTypeMap),
      ...Object.keys(grandCompletedTypeMap),
    ])

    const grandSubRows: MatrixProblemSubRow[] = Array.from(allGrandProblemCodes)
      .map(pCode => ({
        problemCode: pCode,
        problemName:
          grandCompletedTypeMap[pCode]?.name || grandPendingTypeMap[pCode]?.name || pCode,
        pendingCount: grandPendingTypeMap[pCode]?.count || 0,
        completedTotal: grandCompletedTypeMap[pCode]?.total || 0,
        countsByDay: grandCompletedTypeMap[pCode]?.countsByDay || {},
      }))
      .filter(sr => sr.pendingCount > 0 || sr.completedTotal > 0)
      .sort((a, b) => {
        if (b.completedTotal !== a.completedTotal) return b.completedTotal - a.completedTotal
        if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount
        return a.problemName.localeCompare(b.problemName, 'th')
      })

    return {
      rows,
      dailyTotals,
      grandPendingTotal,
      grandSubRows,
    }
  }, [rawPendingSummary, selectedProblemType, selectedBranch, filteredItems, branchOptions, hideZeroBranches])

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
    const matrixHeaders = [
      'ลำดับ',
      'สาขา / อู่ซ่อม',
      'ประเภทงานซ่อม',
      'ยอดค้างปัจจุบัน (ใบงาน)',
      'รวมเดือนซ่อมเสร็จ (ใบงาน)',
      'จำนวนวันที่มีงานปิด',
      ...dayHeaders,
    ]
    const matrixRows: (string | number)[][] = []

    matrixData.rows.forEach((r, idx) => {
      matrixRows.push([
        idx + 1,
        r.name,
        'รวมทุกประเภท',
        r.pendingTotal,
        r.total,
        r.activeDays,
        ...Array.from({ length: daysInMonth }, (_, i) => r.countsByDay[i + 1] || 0),
      ])

      for (const sr of r.subRows) {
        matrixRows.push([
          '',
          `   └ ${r.name}`,
          sr.problemName,
          sr.pendingCount,
          sr.completedTotal,
          Object.keys(sr.countsByDay).length,
          ...Array.from({ length: daysInMonth }, (_, i) => sr.countsByDay[i + 1] || 0),
        ])
      }
    })

    matrixRows.push([
      '',
      'รวมทุกสาขารายวัน',
      'รวมทั้งหมด',
      matrixData.grandPendingTotal,
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
          {isCollapsed ? '▼ แสดงตารางสรุปปิดงาน' : '▲ ย่อส่วนนี้'}
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
              grandPendingTotal={matrixData.grandPendingTotal}
              grandTotal={filteredItems.length}
              grandSubRows={matrixData.grandSubRows}
              selectedBranch={selectedBranch}
              selectedProblemType={selectedProblemType}
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
