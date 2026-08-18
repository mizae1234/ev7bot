'use client'

import React, { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import {
  ReplacementActiveItem,
  ReplacementPoolCar,
  ReplacementHistoryItem,
  ReplacementStatsSummary
} from '@/lib/replacement/replacement-types'
import { formatThaiDate } from '@/lib/replacement/replacement-constants'
import { ReplacementStatsCards } from '@/components/replacement/ReplacementStatsCards'
import { ReplacementFilters } from '@/components/replacement/ReplacementFilters'
import { ActiveReplacementTable } from '@/components/replacement/ActiveReplacementTable'
import { FleetPoolTable } from '@/components/replacement/FleetPoolTable'
import { ReplacementHistoryTable } from '@/components/replacement/ReplacementHistoryTable'
import { ReplacementDetailModal } from '@/components/replacement/ReplacementDetailModal'

function ReplacementPageContent() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'POOL' | 'HISTORY'>('ACTIVE')

  // Data states
  const [activeRecords, setActiveRecords] = useState<ReplacementActiveItem[]>([])
  const [poolRecords, setPoolRecords] = useState<ReplacementPoolCar[]>([])
  const [historyRecords, setHistoryRecords] = useState<ReplacementHistoryItem[]>([])
  const [stats, setStats] = useState<ReplacementStatsSummary>({
    totalFleet: 0,
    activeInUse: 0,
    readyToPick: 0,
    availableUseStandby: 0,
    reservedLineman: 0,
    reservedOthers: 0,
    reservedUnassigned: 0,
    inMaintenance: 0,
    criticalDurationAlert: 0,
    warningDurationAlert: 0
  })

  const [locations, setLocations] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('ALL')
  const [modelFilter, setModelFilter] = useState('ALL')
  const [reservationFilter, setReservationFilter] = useState('ALL')
  const [durationFilter, setDurationFilter] = useState('ALL')

  // Detail Modal
  const [selectedItem, setSelectedItem] = useState<ReplacementActiveItem | null>(null)

  // Fetch Data Function
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'HISTORY') {
        const query = new URLSearchParams({
          page: String(page),
          limit: '50'
        })
        if (search) query.append('search', search)
        if (locationFilter !== 'ALL') query.append('location', locationFilter)
        if (modelFilter !== 'ALL') query.append('model', modelFilter)

        const res = await fetch(`/api/replacement/history?${query.toString()}`)
        const data = await res.json()
        if (res.ok) {
          setHistoryRecords(data.records || [])
          setTotal(data.total || 0)
          setTotalPages(data.totalPages || 1)

          if (data.records) {
            const list = data.records as ReplacementHistoryItem[]
            const distinctLocs = Array.from(new Set(list.map(r => r.location).filter(Boolean))) as string[]
            const distinctModels = Array.from(new Set(list.map(r => r.model).filter(Boolean))) as string[]
            setLocations(prev => Array.from(new Set([...prev, ...distinctLocs])))
            setModels(prev => Array.from(new Set([...prev, ...distinctModels])))
          }
        }
      } else {
        const query = new URLSearchParams({
          tab: activeTab,
          page: String(page),
          limit: '50'
        })
        if (search) query.append('search', search)
        if (locationFilter !== 'ALL') query.append('location', locationFilter)
        if (modelFilter !== 'ALL') query.append('model', modelFilter)
        if (activeTab === 'POOL' && reservationFilter !== 'ALL') {
          query.append('reservationType', reservationFilter)
        }
        if (activeTab === 'ACTIVE' && durationFilter !== 'ALL') {
          query.append('durationFilter', durationFilter)
        }

        const res = await fetch(`/api/replacement?${query.toString()}`)
        const data = await res.json()
        if (res.ok) {
          if (activeTab === 'ACTIVE') {
            const list = (data.records || []) as ReplacementActiveItem[]
            setActiveRecords(list)
            const distinctLocs = Array.from(new Set(list.map(r => r.replacementLocationName || r.replacementLocation).filter(Boolean))) as string[]
            const distinctModels = Array.from(new Set(list.map(r => r.replacementModel || r.mainModel).filter(Boolean))) as string[]
            setLocations(prev => Array.from(new Set([...prev, ...distinctLocs])))
            setModels(prev => Array.from(new Set([...prev, ...distinctModels])))
          } else {
            const list = (data.records || []) as ReplacementPoolCar[]
            setPoolRecords(list)
            const distinctLocs = Array.from(new Set(list.map(r => r.location).filter(Boolean))) as string[]
            const distinctModels = Array.from(new Set(list.map(r => r.model).filter(Boolean))) as string[]
            setLocations(prev => Array.from(new Set([...prev, ...distinctLocs])))
            setModels(prev => Array.from(new Set([...prev, ...distinctModels])))
          }
          if (data.stats) setStats(data.stats)
          setTotal(data.total || 0)
          setTotalPages(data.totalPages || 1)
        }
      }
    } catch (err) {
      console.error('Failed to fetch replacement data:', err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, page, search, locationFilter, modelFilter, reservationFilter, durationFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter change handlers
  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }
  const handleLocationChange = (val: string) => {
    setLocationFilter(val)
    setPage(1)
  }
  const handleModelChange = (val: string) => {
    setModelFilter(val)
    setPage(1)
  }
  const handleReservationChange = (val: string) => {
    setReservationFilter(val)
    setPage(1)
  }
  const handleDurationChange = (val: string) => {
    setDurationFilter(val)
    setPage(1)
  }

  const handleSelectCardFilter = (targetTab: 'ACTIVE' | 'POOL' | 'HISTORY', filterKey?: string) => {
    setActiveTab(targetTab)
    setPage(1)
    if (targetTab === 'ACTIVE') {
      setDurationFilter(filterKey || 'ALL')
      setReservationFilter('ALL')
    } else if (targetTab === 'POOL') {
      setReservationFilter(filterKey || 'ALL')
      setDurationFilter('ALL')
    }
  }

  // Export to Excel
  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      let exportRows: Record<string, unknown>[] = []
      let fileName = `รายงานรถทดแทน_EV7_${new Date().toISOString().slice(0, 10)}.xlsx`

      if (activeTab === 'ACTIVE') {
        const query = new URLSearchParams({
          tab: 'ACTIVE',
          page: '1',
          limit: '3000'
        })
        if (search) query.append('search', search)
        if (locationFilter !== 'ALL') query.append('location', locationFilter)
        if (modelFilter !== 'ALL') query.append('model', modelFilter)
        if (durationFilter !== 'ALL') query.append('durationFilter', durationFilter)

        const res = await fetch(`/api/replacement?${query.toString()}`)
        const data = await res.json()
        const list: ReplacementActiveItem[] = data.records || []

        exportRows = list.map((r, idx) => ({
          'ลำดับ': idx + 1,
          'ทะเบียนรถทดแทน': r.replacementRegisterNo || 'ไม่มีทะเบียน',
          'VIN รถทดแทน': r.replacementVin,
          'รุ่นรถทดแทน': r.replacementModel || '-',
          'สถานที่จอดรถทดแทน': r.replacementLocationName || r.replacementLocation || '-',
          'ทะเบียนรถคันหลัก (ที่เข้าซ่อม)': r.mainRegisterNo || 'ไม่มีทะเบียน',
          'VIN รถคันหลัก': r.mainVinNo || '-',
          'รุ่นรถคันหลัก': r.mainModel || '-',
          'อาการเสีย / ชื่องานซ่อม': r.issueTitle || '-',
          'อู่ / ศูนย์บริการ': r.garageName || '-',
          'วันที่เข้าซ่อม': formatThaiDate(r.maintenanceStartDate),
          'วันที่เริ่มให้รถทดแทน': formatThaiDate(r.replacementStartDate),
          'จำนวนวันใช้งานจริง (วัน)': r.daysInUse,
          'สถานะระยะเวลา': r.durationStatus === 'CRITICAL' ? 'เกิน 30 วัน (Alert)' : r.durationStatus === 'WARNING' ? '14-30 วัน' : 'ปกติ (<14 วัน)',
          'ผู้บันทึก': r.createUserName || '-',
          'หมายเหตุ': r.remark || '-'
        }))
        fileName = `รายงานการใช้งานรถทดแทนปัจจุบัน_${new Date().toISOString().slice(0, 10)}.xlsx`
      } else if (activeTab === 'POOL') {
        const query = new URLSearchParams({
          tab: 'POOL',
          page: '1',
          limit: '3000'
        })
        if (search) query.append('search', search)
        if (locationFilter !== 'ALL') query.append('location', locationFilter)
        if (modelFilter !== 'ALL') query.append('model', modelFilter)
        if (reservationFilter !== 'ALL') query.append('reservationType', reservationFilter)

        const res = await fetch(`/api/replacement?${query.toString()}`)
        const data = await res.json()
        const list: ReplacementPoolCar[] = data.records || []

        exportRows = list.map((r, idx) => ({
          'ลำดับ': idx + 1,
          'ทะเบียน': r.registerNo || 'ไม่มีทะเบียน',
          'VIN': r.vinNo,
          'รุ่นรถ': r.model || '-',
          'สีภายนอก': r.exteriorColor || '-',
          'สีภายใน': r.interiorColor || '-',
          'โครงการ': r.project || '-',
          'สถานะระบบ': r.statusType || r.status,
          'ความพร้อมใช้งาน': r.isReadyToPick ? 'พร้อมใช้งาน (ว่าง)' : r.isReserved ? 'ติดจอง' : r.status,
          'ประเภทการจอง': r.reservedType || '-',
          'หมายเหตุการจอง': r.reservedRemark || '-',
          'จองให้คันหลัก (VIN/ทะเบียน)': r.reservedTargetRegisterNo || r.reservedTargetVinNo || 'ไม่ระบุทะเบียน (โควตากลาง)',
          'กำหนดการปล่อยรถ': formatThaiDate(r.reservedReleaseDate),
          'สถานที่จอด (Yard)': r.location || '-'
        }))
        fileName = `รายงานคลังรถทดแทน_${new Date().toISOString().slice(0, 10)}.xlsx`
      } else {
        const query = new URLSearchParams({
          page: '1',
          limit: '3000'
        })
        if (search) query.append('search', search)
        if (locationFilter !== 'ALL') query.append('location', locationFilter)
        if (modelFilter !== 'ALL') query.append('model', modelFilter)

        const res = await fetch(`/api/replacement/history?${query.toString()}`)
        const data = await res.json()
        const list: ReplacementHistoryItem[] = data.records || []

        exportRows = list.map((r, idx) => ({
          'ลำดับ': idx + 1,
          'ทะเบียนรถคันหลัก': r.registerNo || 'ไม่มีทะเบียน',
          'VIN รถคันหลัก': r.vinNo,
          'รุ่นรถ': r.model || '-',
          'VIN รถทดแทนที่ให้': r.vinNoReplacement,
          'วันที่เริ่มใช้': formatThaiDate(r.replacementStartDate),
          'วันที่ส่งคืน': r.replacementReturnDate ? formatThaiDate(r.replacementReturnDate) : 'ยังไม่คืน',
          'จำนวนวันที่ใช้ (วัน)': r.daysUsed || '-',
          'สถานที่ / อู่': r.location || '-',
          'ผู้บันทึก': r.createName || '-',
          'หมายเหตุ': r.remark || '-'
        }))
        fileName = `รายงานประวัติการให้รถทดแทน_${new Date().toISOString().slice(0, 10)}.xlsx`
      }

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Replacement_Data')
      XLSX.writeFile(wb, fileName)
    } catch (err) {
      console.error('Export Excel failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl sm:text-3xl">🚗🔄</span>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              ระบบมอนิเตอร์และจัดการรถทดแทน (Replacement Hub)
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Live Fleet Monitor
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            ติดตามการใช้งานรถทดแทนแบบเรียลไทม์ ตรวจสอบคลังรถว่างพร้อมใช้ (Available Pool) และคันที่ล็อกโควตาจองไว้
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-zinc-200/60 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-sm w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVE')
              setPage(1)
            }}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'ACTIVE'
                ? 'bg-indigo-600 text-white shadow-sm font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            🔄 การใช้งานปัจจุบัน ({stats.activeInUse})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('POOL')
              setPage(1)
            }}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'POOL'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            🚗 คลังรถ & การจอง ({stats.readyToPick + (stats.availableUseStandby || 0) + stats.reservedLineman + stats.reservedOthers + stats.inMaintenance})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('HISTORY')
              setPage(1)
            }}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📜 ประวัติย้อนหลัง
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <ReplacementStatsCards
        stats={stats}
        activeTab={activeTab}
        activeFilter={activeTab === 'ACTIVE' ? durationFilter : reservationFilter}
        onSelectFilter={handleSelectCardFilter}
      />

      {/* Filter Component */}
      <ReplacementFilters
        activeTab={activeTab}
        search={search}
        onSearchChange={handleSearchChange}
        locationFilter={locationFilter}
        onLocationFilterChange={handleLocationChange}
        modelFilter={modelFilter}
        onModelFilterChange={handleModelChange}
        reservationFilter={reservationFilter}
        onReservationFilterChange={handleReservationChange}
        durationFilter={durationFilter}
        onDurationFilterChange={handleDurationChange}
        locations={locations}
        models={models}
        onExportExcel={handleExportExcel}
        exportLoading={exportLoading}
      />

      {/* Tables based on active tab */}
      {activeTab === 'ACTIVE' && (
        <ActiveReplacementTable
          records={activeRecords}
          loading={loading}
          startIndex={(page - 1) * 50}
          onOpenDetail={(item) => setSelectedItem(item)}
        />
      )}

      {activeTab === 'POOL' && (
        <FleetPoolTable
          records={poolRecords}
          loading={loading}
          startIndex={(page - 1) * 50}
        />
      )}

      {activeTab === 'HISTORY' && (
        <ReplacementHistoryTable
          records={historyRecords}
          loading={loading}
          startIndex={(page - 1) * 50}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-500">
            แสดง {activeTab === 'ACTIVE' ? activeRecords.length : activeTab === 'POOL' ? poolRecords.length : historyRecords.length} จากทั้งหมด {total} รายการ
          </span>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={50}
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}

      {/* Detail Modal */}
      <ReplacementDetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}

export default function ReplacementPage() {
  return (
    <AuthGuard>
      <ReplacementPageContent />
    </AuthGuard>
  )
}
