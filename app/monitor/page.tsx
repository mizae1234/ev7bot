'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import {
  PolicyVehicleRecord,
  PolicyStatsSummary,
  InsuranceMasterType
} from '@/lib/policy/policy-types'
import { formatThaiDate, getInsuranceTypeLabel } from '@/lib/policy/policy-constants'
import { PolicyStatsCards } from '@/components/policy/PolicyStatsCards'
import { PolicyFilters } from '@/components/policy/PolicyFilters'
import { PolicyTable } from '@/components/policy/PolicyTable'
import { PolicyHistoryDrawer } from '@/components/policy/PolicyHistoryDrawer'

function MonitorPageContent() {
  // Data & Filter states
  const [records, setRecords] = useState<PolicyVehicleRecord[]>([])
  const [stats, setStats] = useState<PolicyStatsSummary>({
    totalVehicles: 0,
    insuranceExpiring30: 0,
    insuranceExpiring60: 0,
    insuranceExpired: 0,
    insuranceMissing: 0,
    actExpiring30: 0,
    actExpiring60: 0,
    actExpired: 0,
    actMissing: 0,
    taxExpiring30: 0,
    taxExpiring60: 0,
    taxExpired: 0,
    taxMissing: 0,
    meterExpiring30: 0,
    meterExpiring60: 0,
    meterExpired: 0,
    meterMissing: 0,
    totalWithPolicy: 0,
    totalMissingAll: 0,
    totalMissingAny: 0
  })
  const [masterTypes, setMasterTypes] = useState<InsuranceMasterType[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [projectTypes, setProjectTypes] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [vehicleStatuses, setVehicleStatuses] = useState<{
    mainStatuses: { code: string; label: string }[]
    statusTypes: { code: string; label: string }[]
  }>({ mainStatuses: [], statusTypes: [] })

  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [expiryFilter, setExpiryFilter] = useState('ALL')
  const [missingFilter, setMissingFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [projectTypeFilter, setProjectTypeFilter] = useState('ALL')
  const [modelFilter, setModelFilter] = useState('ALL')

  // Auto-refresh
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [nextRefreshIn, setNextRefreshIn] = useState(300) // 5 min in seconds
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // History Drawer (read-only)
  const [historyVin, setHistoryVin] = useState<string | null>(null)
  const [historyRegisterNo, setHistoryRegisterNo] = useState<string | null>(null)

  // Fetch Master Data
  useEffect(() => {
    fetch('/api/policy/master')
      .then(res => res.json())
      .then(data => {
        if (data.masterTypes) setMasterTypes(data.masterTypes)
        if (data.models && Array.isArray(data.models)) setModels(data.models)
        if (data.projects && Array.isArray(data.projects)) setProjects(data.projects)
        if (data.projectTypes && Array.isArray(data.projectTypes)) setProjectTypes(data.projectTypes)
        if (data.vehicleStatuses) setVehicleStatuses(data.vehicleStatuses)
      })
      .catch(err => console.error('Failed to load master types:', err))
  }, [])

  // Fetch Policies
  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '50'
      })
      if (search) query.append('search', search)
      if (expiryFilter !== 'ALL') query.append('expiryFilter', expiryFilter)
      if (missingFilter !== 'ALL') query.append('missingFilter', missingFilter)
      if (statusFilter !== 'ALL') query.append('statusFilter', statusFilter)
      if (typeFilter !== 'ALL') query.append('typeFilter', typeFilter)
      if (projectFilter !== 'ALL') query.append('projectFilter', projectFilter)
      if (projectTypeFilter !== 'ALL') query.append('projectTypeFilter', projectTypeFilter)
      if (modelFilter !== 'ALL') query.append('modelFilter', modelFilter)

      const res = await fetch(`/api/policy?${query.toString()}`)
      const data = await res.json()

      if (res.ok) {
        setRecords(data.records || [])
        if (data.stats) setStats(data.stats)
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
        setLastUpdated(new Date())
        setNextRefreshIn(300)
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, expiryFilter, missingFilter, statusFilter, typeFilter, projectFilter, projectTypeFilter, modelFilter])

  useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchPolicies()
    }, 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchPolicies])

  // Countdown timer
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setNextRefreshIn(prev => (prev > 0 ? prev - 1 : 300))
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])

  // Export to Excel
  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      const query = new URLSearchParams({ page: '1', limit: '5000' })
      if (search) query.append('search', search)
      if (expiryFilter !== 'ALL') query.append('expiryFilter', expiryFilter)
      if (missingFilter !== 'ALL') query.append('missingFilter', missingFilter)
      if (statusFilter !== 'ALL') query.append('statusFilter', statusFilter)
      if (typeFilter !== 'ALL') query.append('typeFilter', typeFilter)
      if (projectFilter !== 'ALL') query.append('projectFilter', projectFilter)
      if (projectTypeFilter !== 'ALL') query.append('projectTypeFilter', projectTypeFilter)
      if (modelFilter !== 'ALL') query.append('modelFilter', modelFilter)

      const res = await fetch(`/api/policy?${query.toString()}`)
      const data = await res.json()
      const list: PolicyVehicleRecord[] = data.records || []

      const exportRows = list.map((r, idx) => ({
        'ลำดับ': idx + 1,
        'เลขทะเบียน': r.registerNo || 'ไม่มีทะเบียน',
        'เลขตัวถัง (VIN)': r.vinNo,
        'วันที่จดทะเบียนรถ': r.registerNoDate ? formatThaiDate(r.registerNoDate) : '-',
        'รุ่นรถ': r.model || '-',
        'โครงการ': r.project || '-',
        'ประเภทโครงการ': r.projectType || '-',
        'สถานะรถ': r.statusName || r.status || '-',
        'สถานที่จอด': r.locationName || '-',
        'ประเภทประกัน': getInsuranceTypeLabel(r.insuranceType, r.insuranceTypeName),
        'บริษัทประกัน': r.insuranceCompany || '-',
        'เลขกรมธรรม์ประกัน': r.insurancePolicyNo || '-',
        'วันหมดอายุประกัน': formatThaiDate(r.insuranceEndDate),
        'สถานะประกัน': r.insuranceDaysLeft !== null ? (r.insuranceDaysLeft < 0 ? 'หมดอายุแล้ว' : `เหลือ ${r.insuranceDaysLeft} วัน`) : 'ไม่มีข้อมูล',
        'เลข พ.ร.บ.': r.actPolicyNo || '-',
        'วันหมดอายุ พ.ร.บ.': formatThaiDate(r.actEndDate),
        'สถานะ พ.ร.บ.': r.actDaysLeft !== null ? (r.actDaysLeft < 0 ? 'หมดอายุแล้ว' : `เหลือ ${r.actDaysLeft} วัน`) : 'ไม่มีข้อมูล',
        'วันหมดอายุภาษีรถ': formatThaiDate(r.vehicleTaxEndDate),
        'สถานะภาษีรถ': r.vehicleTaxDaysLeft !== null ? (r.vehicleTaxDaysLeft < 0 ? 'หมดอายุแล้ว' : `เหลือ ${r.vehicleTaxDaysLeft} วัน`) : 'ไม่มีข้อมูล',
        'วันหมดอายุภาษีมิเตอร์': formatThaiDate(r.meterTaxEndDate),
        'สถานะภาษีมิเตอร์': r.meterTaxDaysLeft !== null ? (r.meterTaxDaysLeft < 0 ? 'หมดอายุแล้ว' : `เหลือ ${r.meterTaxDaysLeft} วัน`) : 'ไม่มีข้อมูล',
        'ผลตรวจรับคืนล่าสุด': r.latestAssessmentResult === 'NORMAL' ? 'ปกติ' : r.latestAssessmentResult === 'NEED_REPAIR' ? `ต้องส่งซ่อม (${r.latestDamageCount || 0} จุด)` : r.latestIsPendingChecklist ? 'รอตรวจเช็คลิสต์' : '-',
        'วันที่ตรวจคืนล่าสุด': r.latestInspectionDate ? formatThaiDate(r.latestInspectionDate) : '-',
        'รายการความเสียหายที่ตรวจพบ': r.latestDamagedSummary || (r.latestAssessmentResult === 'NORMAL' ? 'ไม่พบจุดเสียหาย' : '-')
      }))

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Monitor_Data')
      XLSX.writeFile(wb, `มอนิเตอร์ประกันและภาษี_EV7_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('Export Excel failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExportLoading(false)
    }
  }

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => { setSearch(val); setPage(1) }
  const handleExpiryFilterChange = (val: string) => { setExpiryFilter(val); setPage(1) }
  const handleMissingFilterChange = (val: string) => { setMissingFilter(val); setPage(1) }
  const handleStatusFilterChange = (val: string) => { setStatusFilter(val); setPage(1) }
  const handleTypeFilterChange = (val: string) => { setTypeFilter(val); setPage(1) }
  const handleProjectFilterChange = (val: string) => { setProjectFilter(val); setPage(1) }
  const handleProjectTypeFilterChange = (val: string) => { setProjectTypeFilter(val); setPage(1) }
  const handleModelFilterChange = (val: string) => { setModelFilter(val); setPage(1) }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="text-2xl">🛡️</span>
            มอนิเตอร์ ประกันภัย พ.ร.บ. และภาษีรถยนต์
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            ติดตามสถานะประกัน พ.ร.บ. ภาษีรถประจำปี และภาษีมิเตอร์แท็กซี่ (รีเฟรชอัตโนมัติทุก 5 นาที)
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              อัปเดตล่าสุด {lastUpdated.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · รีเฟรชใน {Math.floor(nextRefreshIn / 60)}:{String(nextRefreshIn % 60).padStart(2, '0')}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchPolicies()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรช
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <PolicyStatsCards
        stats={stats}
        activeExpiryFilter={expiryFilter}
        activeMissingFilter={missingFilter}
        onSelectFilter={(exp, miss) => {
          setExpiryFilter(exp)
          setMissingFilter(miss)
          setPage(1)
        }}
      />

      {/* Filters & Table */}
      <div className="space-y-4">
        <PolicyFilters
          search={search}
          onSearchChange={handleSearchChange}
          expiryFilter={expiryFilter}
          onExpiryFilterChange={handleExpiryFilterChange}
          missingFilter={missingFilter}
          onMissingFilterChange={handleMissingFilterChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
          projectFilter={projectFilter}
          onProjectFilterChange={handleProjectFilterChange}
          projectTypeFilter={projectTypeFilter}
          onProjectTypeFilterChange={handleProjectTypeFilterChange}
          modelFilter={modelFilter}
          onModelFilterChange={handleModelFilterChange}
          masterTypes={masterTypes}
          projects={projects}
          projectTypes={projectTypes}
          models={models}
          statuses={vehicleStatuses}
          onExportExcel={handleExportExcel}
          exportLoading={exportLoading}
        />

        <PolicyTable
          records={records}
          loading={loading}
          page={page}
          pageSize={50}
          onOpenHistory={(vin, reg) => {
            setHistoryVin(vin)
            setHistoryRegisterNo(reg)
          }}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-zinc-500">
              แสดง {records.length} จากทั้งหมด {total} รายการ
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
      </div>

      {/* History Drawer (read-only) */}
      <PolicyHistoryDrawer
        vinNo={historyVin}
        registerNo={historyRegisterNo}
        isOpen={!!historyVin}
        onClose={() => {
          setHistoryVin(null)
          setHistoryRegisterNo(null)
        }}
      />
    </div>
  )
}

export default function MonitorPage() {
  return (
    <AuthGuard>
      <MonitorPageContent />
    </AuthGuard>
  )
}
