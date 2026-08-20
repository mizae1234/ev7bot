'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import {
  PolicyVehicleRecord,
  PolicyStatsSummary,
  InsuranceMasterType
} from '@/lib/policy/policy-types'
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

  const [loading, setLoading] = useState(true)
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span className="text-2xl">🛡️</span>
            Monitor ประกันภัย พ.ร.บ. และภาษีรถยนต์
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            ติดตามสถานะประกัน พ.ร.บ. (PLMV), พ.ร.บ. (PLMC), ภาษีรถประจำปี และภาษีมิเตอร์แท็กซี่ (อ่านอย่างเดียว)
          </p>
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
        />

        <PolicyTable
          records={records}
          loading={loading}
          onOpenHistory={(vin, reg) => {
            setHistoryVin(vin)
            setHistoryRegisterNo(reg)
          }}
          onOpenEdit={() => {}}
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
