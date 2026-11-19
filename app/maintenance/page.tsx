'use client'

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { IMPORT_CONFIG } from '@/lib/maintenance-import/config'
import MaintenanceTicketTree from '@/components/maintenance/MaintenanceTicketTree'
import MultiLocationTicketsBlock from '@/components/maintenance/MultiLocationTicketsBlock'
import { MaintenanceLocationGrid } from '@/components/maintenance/MaintenanceLocationGrid'
import { MaintenanceTicketsTable } from '@/components/maintenance/MaintenanceTicketsTable'
import type { CarCaseFilterType, MaintenanceData } from '@/components/maintenance/types'

const DailyCompletedSection = dynamic(
  () => import('@/components/maintenance/daily-completed/DailyCompletedSection'),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/50 animate-pulse" />
    ),
  }
)

const MaintenanceImportModal = dynamic(
  () => import('@/components/maintenance/MaintenanceImportModal').then(m => m.MaintenanceImportModal),
  { ssr: false }
)

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const json = await r.json()
  if (!r.ok) {
    throw new Error(json?.error || `HTTP ${r.status}`)
  }
  return json
}

function MaintenanceContent() {
  const searchParams = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [problemTypeFilter, setProblemTypeFilter] = useState('all')
  const [carCaseFilter, setCarCaseFilter] = useState<CarCaseFilterType>('all')
  const [externalSearch, setExternalSearch] = useState('')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    const loc = searchParams.get('location')
    if (loc) {
      setLocationFilter(loc)
    }
  }, [searchParams])

  // Build exact SWR URL so unfiltered state shares the exact '/api/maintenance' cache key (no duplicate fetch!)
  const maintenanceUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (locationFilter !== 'all') params.set('location', locationFilter)
    const qs = params.toString()
    return qs ? `/api/maintenance?${qs}` : '/api/maintenance'
  }, [statusFilter, locationFilter])

  const { data, isLoading, error, mutate } = useSWR<MaintenanceData>(
    maintenanceUrl,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false }
  )

  const { data: baseData } = useSWR<MaintenanceData>(
    '/api/maintenance',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false }
  )

  const locationNames = useMemo(
    () => ({ ...(baseData?.locationNames || {}), ...(data?.locationNames || {}) }),
    [baseData?.locationNames, data?.locationNames]
  )

  const formatLocation = useCallback(
    (code: string | null | undefined): string => {
      if (!code) return IMPORT_CONFIG.unspecifiedLocationLabel
      return locationNames[code] || code.replace(/_/g, ' ')
    },
    [locationNames]
  )

  const treeItems = useMemo(
    () => baseData?.items || data?.items || [],
    [baseData?.items, data?.items]
  )

  const tableItems = useMemo(
    () => data?.items || [],
    [data?.items]
  )

  const statusCounts = useMemo(() => {
    const allItems = baseData?.items || data?.items || []
    let inMaint = 0
    let waiting = 0
    let readyPickup = 0
    let complete = 0
    let stillWork = 0
    for (const item of allItems) {
      if (item.status_code === 'IN_MAINTENANCE') inMaint++
      else if (item.status_code === 'WAITING_FOR_MAINTENANCE') waiting++
      else if (item.status_code === 'READY_PICKUP_MAINTENANCE' || item.status_code === 'GARAGE_COMPLETE') readyPickup++
      else if (item.status_code === 'COMPLETE') complete++
      else if (item.status_code === 'STILL_WORK') stillWork++
    }
    return {
      total: allItems.length,
      activeRepair: inMaint + waiting,
      inMaint,
      waiting,
      readyPickup,
      complete,
      stillWork,
    }
  }, [baseData?.items, data?.items])

  const handleSelectTreeFilter = useCallback((pt: string, st: string, cc?: string) => {
    setProblemTypeFilter(pt)
    setStatusFilter(st)
    setCarCaseFilter((cc as CarCaseFilterType) || 'all')
  }, [])

  const handleSelectMultiLocCar = useCallback((regNo: string) => {
    setExternalSearch(regNo)
    const el = document.getElementById('maintenance-search-input')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const handleConsumeExternalSearch = useCallback(() => {
    setExternalSearch('')
  }, [])

  const handleOpenImport = useCallback(() => {
    setShowImport(true)
  }, [])

  return (
    <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-emerald-600 dark:from-zinc-100 dark:to-emerald-400 tracking-tight">
                🔧 รายละเอียด ใบงานซ่อม
              </h1>
              <a
                href="/maintenance/dashboard"
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900 dark:hover:bg-indigo-900/30 dark:text-indigo-400 transition-all flex items-center gap-1.5"
              >
                📊 แดชบอร์ดวิเคราะห์งานซ่อม
              </a>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              รายละเอียดงานซ่อมทั้งหมด สถานที่ซ่อม สถานะ และรถทดแทน
            </p>
            {data?.summary && (
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300">
                  🚗 สถานะรถหลักในระบบ: <strong>{data.summary.total_cars ?? data.summary.total} คัน</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Indicator */}
        {(statusFilter !== 'all' || problemTypeFilter !== 'all' || carCaseFilter !== 'all') && (
          <div className="flex items-center justify-end px-1">
            <div className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <span className="font-semibold">กำลังกรอง:</span>
              <span className="font-bold">
                {problemTypeFilter !== 'all' ? `ประเภท: ${problemTypeFilter}` : ''}
                {statusFilter !== 'all'
                  ? ` • สถานะ: ${
                      statusFilter === 'READY_PICKUP_MAINTENANCE' ? 'ซ่อมเสร็จ รอลูกค้ามารับ' :
                      statusFilter === 'ACTIVE_REPAIR' ? 'เฉพาะค้างซ่อม' :
                      statusFilter === 'COMPLETE' ? 'ปิดงานแล้ว (ซ่อมเสร็จ)' :
                      statusFilter === 'PENDING_ALL' ? 'งานค้างทั้งหมด' :
                      statusFilter === 'IN_MAINTENANCE' ? 'กำลังซ่อม' :
                      statusFilter === 'WAITING_FOR_MAINTENANCE' ? 'รอเข้าซ่อม' :
                      statusFilter === 'STILL_WORK' ? 'รถยังขับได้' : statusFilter
                    }`
                  : ''}
                {carCaseFilter !== 'all'
                  ? ` • เคส: ${
                      carCaseFilter === 'HEAVY' ? 'ซ่อมหนัก' :
                      carCaseFilter === 'LIGHT' ? 'ซ่อมเบา' :
                      carCaseFilter === 'TOTAL' ? 'ไม่คุ้มซ่อม' : 'ไม่ระบุ'
                    }`
                  : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setProblemTypeFilter('all')
                  setStatusFilter('all')
                  setCarCaseFilter('all')
                }}
                className="ml-1 text-zinc-400 hover:text-rose-500 font-bold"
                title="ล้างตัวกรอง"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 1. Original Ticket Tree Chart */}
        <MaintenanceTicketTree
          items={treeItems}
          selectedProblemType={problemTypeFilter}
          selectedStatus={statusFilter}
          selectedCarCase={carCaseFilter}
          totalCarsCount={baseData?.summary?.total_cars ?? data?.summary?.total_cars ?? 0}
          onSelectFilter={handleSelectTreeFilter}
        />

        {/* 2. Original Multi-Location Conflict Block */}
        <MultiLocationTicketsBlock
          items={treeItems}
          onSelectCar={handleSelectMultiLocCar}
          formatLocation={formatLocation}
        />

        {/* 3. Original Repairs by Location Grid */}
        <MaintenanceLocationGrid
          locationSummary={data?.locationSummary || []}
          selectedLocation={locationFilter}
          onSelectLocation={setLocationFilter}
          formatLocation={formatLocation}
        />

        {/* 4. Added Section: Daily Completed Repairs by Branch (Calendar & Matrix) */}
        <DailyCompletedSection />

        {/* 5. Original Maintenance Tickets Table (Now with Isolated State & Pagination) */}
        <MaintenanceTicketsTable
          items={tableItems}
          isLoading={isLoading}
          error={error}
          statusFilter={statusFilter}
          onChangeStatusFilter={setStatusFilter}
          locationFilter={locationFilter}
          onChangeLocationFilter={setLocationFilter}
          problemTypeFilter={problemTypeFilter}
          onChangeProblemTypeFilter={setProblemTypeFilter}
          carCaseFilter={carCaseFilter}
          locations={data?.locations || []}
          problemTypes={data?.problemTypes || []}
          statusCounts={statusCounts}
          externalSearch={externalSearch}
          onExternalSearchConsumed={handleConsumeExternalSearch}
          formatLocation={formatLocation}
          onOpenImport={handleOpenImport}
        />
      </div>

      {showImport && (
        <MaintenanceImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onImported={() => mutate()}
        />
      )}
    </main>
  )
}

export default function MaintenancePage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
              <div className="flex justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
              </div>
            </div>
          </main>
        }
      >
        <MaintenanceContent />
      </Suspense>
    </AuthGuard>
  )
}
