'use client'

import React, { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { Pagination } from '@/components/ui/Pagination'
import {
  PolicyVehicleRecord,
  PolicyStatsSummary,
  InsuranceMasterType
} from '@/lib/policy/policy-types'
import { formatThaiDate } from '@/lib/policy/policy-constants'
import { PolicyStatsCards } from '@/components/policy/PolicyStatsCards'
import { PolicyFilters } from '@/components/policy/PolicyFilters'
import { PolicyTable } from '@/components/policy/PolicyTable'
import { PolicyBatchUpload } from '@/components/policy/PolicyBatchUpload'
import { PolicyTaxExcelImport } from '@/components/policy/PolicyTaxExcelImport'
import { PolicyHistoryDrawer } from '@/components/policy/PolicyHistoryDrawer'
import { PolicyEditModal } from '@/components/policy/PolicyEditModal'
import { PdfViewerModal } from '@/components/policy/PdfViewerModal'

function PolicyPageContent() {
  const [activeTab, setActiveTab] = useState<'LIST' | 'UPLOAD_PDF' | 'IMPORT_EXCEL'>('LIST')

  // Data & Filter states
  const [records, setRecords] = useState<PolicyVehicleRecord[]>([])
  const [stats, setStats] = useState<PolicyStatsSummary>({
    totalVehicles: 0,
    insuranceExpiring30: 0,
    insuranceExpiring60: 0,
    insuranceExpired: 0,
    actExpiring30: 0,
    actExpiring60: 0,
    actExpired: 0,
    taxExpiring30: 0,
    taxExpiring60: 0,
    taxExpired: 0,
    meterExpiring30: 0,
    meterExpiring60: 0,
    meterExpired: 0,
    totalWithPolicy: 0
  })
  const [masterTypes, setMasterTypes] = useState<InsuranceMasterType[]>([])
  const [projects, setProjects] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [expiryFilter, setExpiryFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [modelFilter, setModelFilter] = useState('ALL')

  // Modals & Drawers
  const [editRecord, setEditRecord] = useState<PolicyVehicleRecord | null>(null)
  const [historyVin, setHistoryVin] = useState<string | null>(null)
  const [historyRegisterNo, setHistoryRegisterNo] = useState<string | null>(null)
  const [pdfModal, setPdfModal] = useState<{ isOpen: boolean; url: string | null; title: string }>({
    isOpen: false,
    url: null,
    title: ''
  })

  // User Profile
  const [liffUserId, setLiffUserId] = useState<string | null>(null)

  useEffect(() => {
    const cachedProfile = localStorage.getItem('liff_profile')
    if (cachedProfile) {
      try {
        const parsed = JSON.parse(cachedProfile)
        setLiffUserId(parsed.userId || null)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  // Fetch Master Data
  useEffect(() => {
    fetch('/api/policy/master')
      .then(res => res.json())
      .then(data => {
        if (data.masterTypes) setMasterTypes(data.masterTypes)
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
      if (typeFilter !== 'ALL') query.append('typeFilter', typeFilter)
      if (projectFilter !== 'ALL') query.append('projectFilter', projectFilter)
      if (modelFilter !== 'ALL') query.append('modelFilter', modelFilter)

      const res = await fetch(`/api/policy?${query.toString()}`)
      const data = await res.json()

      if (res.ok) {
        setRecords(data.records || [])
        setStats(data.stats || stats)
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)

        // Extract distinct projects & models for dropdowns
        if (data.records) {
          const distinctProjects = Array.from(new Set(data.records.map((r: any) => r.project).filter(Boolean))) as string[]
          const distinctModels = Array.from(new Set(data.records.map((r: any) => r.model).filter(Boolean))) as string[]
          setProjects(prev => Array.from(new Set([...prev, ...distinctProjects])))
          setModels(prev => Array.from(new Set([...prev, ...distinctModels])))
        }
      }
    } catch (err) {
      console.error('Failed to fetch policies:', err)
    } finally {
      setLoading(false)
    }
  }, [page, search, expiryFilter, typeFilter, projectFilter, modelFilter])

  useEffect(() => {
    fetchPolicies()
  }, [fetchPolicies])

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }
  const handleExpiryFilterChange = (val: string) => {
    setExpiryFilter(val)
    setPage(1)
  }
  const handleTypeFilterChange = (val: string) => {
    setTypeFilter(val)
    setPage(1)
  }
  const handleProjectFilterChange = (val: string) => {
    setProjectFilter(val)
    setPage(1)
  }
  const handleModelFilterChange = (val: string) => {
    setModelFilter(val)
    setPage(1)
  }

  // Export to Excel
  const handleExportExcel = async () => {
    setExportLoading(true)
    try {
      // Fetch all matching records without pagination limit
      const query = new URLSearchParams({
        page: '1',
        limit: '5000'
      })
      if (search) query.append('search', search)
      if (expiryFilter !== 'ALL') query.append('expiryFilter', expiryFilter)
      if (typeFilter !== 'ALL') query.append('typeFilter', typeFilter)
      if (projectFilter !== 'ALL') query.append('projectFilter', projectFilter)
      if (modelFilter !== 'ALL') query.append('modelFilter', modelFilter)

      const res = await fetch(`/api/policy?${query.toString()}`)
      const data = await res.json()
      const list: PolicyVehicleRecord[] = data.records || []

      const exportRows = list.map((r, idx) => ({
        'ลำดับ': idx + 1,
        'เลขทะเบียน': r.registerNo || 'ไม่มีทะเบียน',
        'เลขตัวถัง (VIN)': r.vinNo,
        'รุ่นรถ': r.model || '-',
        'โครงการ': r.project || '-',
        'ประเภทประกัน': r.insuranceType || '-',
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
        'ผู้เช่าปัจจุบัน': r.customerName || '-',
        'เลขที่สัญญา': r.contractNo || '-',
        'เบอร์โทร': r.phoneNo || '-'
      }))

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Policy_Data')
      XLSX.writeFile(wb, `รายงานประกันและภาษี_EV7_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      console.error('Export Excel failed:', err)
      alert('เกิดข้อผิดพลาดในการส่งออก Excel')
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl sm:text-3xl">🛡️</span>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
              จัดการประกันภัย พ.ร.บ. และภาษีรถยนต์
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Policy & Tax Hub
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            ระบบติดตามความคุ้มครองประกันภัยภาคสมัครใจ (PLMV), พ.ร.บ. (PLMC), ภาษีรถประจำปี และภาษีมิเตอร์แท็กซี่
          </p>
        </div>

        {/* Quick Tabs Button Group */}
        <div className="flex items-center p-1 bg-zinc-200/60 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-sm w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'LIST'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📋 รายการรถและกรมธรรม์
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD_PDF')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'UPLOAD_PDF'
                ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📤 อัปโหลด PDF (PLMV/PLMC)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('IMPORT_EXCEL')}
            className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'IMPORT_EXCEL'
                ? 'bg-emerald-600 text-white shadow-sm font-bold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            📥 นำเข้าภาษี (Excel)
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <PolicyStatsCards
        stats={stats}
        activeExpiryFilter={expiryFilter}
        onSelectFilter={handleExpiryFilterChange}
      />

      {/* Tab 1: All Policies Table */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          <PolicyFilters
            search={search}
            onSearchChange={handleSearchChange}
            expiryFilter={expiryFilter}
            onExpiryFilterChange={handleExpiryFilterChange}
            typeFilter={typeFilter}
            onTypeFilterChange={handleTypeFilterChange}
            projectFilter={projectFilter}
            onProjectFilterChange={handleProjectFilterChange}
            modelFilter={modelFilter}
            onModelFilterChange={handleModelFilterChange}
            masterTypes={masterTypes}
            projects={projects}
            models={models}
            onExportExcel={handleExportExcel}
            exportLoading={exportLoading}
          />

          <PolicyTable
            records={records}
            loading={loading}
            onViewPdf={(url, title) => setPdfModal({ isOpen: true, url, title })}
            onOpenHistory={(vin, reg) => {
              setHistoryVin(vin)
              setHistoryRegisterNo(reg)
            }}
            onOpenEdit={(rec) => setEditRecord(rec)}
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
      )}

      {/* Tab 2: Batch PDF Upload (PLMV & PLMC Auto-Parser) */}
      {activeTab === 'UPLOAD_PDF' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <span>📤 ระบบอัปโหลดและแยกประเภทกรมธรรม์อัตโนมัติ (Batch PDF Auto-Parser)</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              นำเข้าไฟล์ PDF กรมธรรม์จากบริษัทประกันภัย ระบบจะทำการถอดรหัส VIN, ประเภทความคุ้มครอง, และวันหมดอายุ (พ.ศ. ➔ ค.ศ.) ให้ทันทีก่อนบันทึก
            </p>
          </div>

          <PolicyBatchUpload
            lineUserId={liffUserId}
            onUploadSuccess={() => {
              fetchPolicies()
            }}
          />
        </div>
      )}

      {/* Tab 3: Excel Import for Vehicle Tax and Meter Tax */}
      {activeTab === 'IMPORT_EXCEL' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
          <PolicyTaxExcelImport
            lineUserId={liffUserId}
            onImportSuccess={() => {
              fetchPolicies()
            }}
          />
        </div>
      )}

      {/* Modals & Drawers */}
      <PolicyEditModal
        record={editRecord}
        isOpen={!!editRecord}
        onClose={() => setEditRecord(null)}
        onSaveSuccess={() => {
          fetchPolicies()
        }}
        masterTypes={masterTypes}
        lineUserId={liffUserId}
      />

      <PolicyHistoryDrawer
        vinNo={historyVin}
        registerNo={historyRegisterNo}
        isOpen={!!historyVin}
        onClose={() => {
          setHistoryVin(null)
          setHistoryRegisterNo(null)
        }}
        onViewPdf={(url, title) => setPdfModal({ isOpen: true, url, title })}
      />

      <PdfViewerModal
        isOpen={pdfModal.isOpen}
        url={pdfModal.url}
        title={pdfModal.title}
        onClose={() => setPdfModal({ isOpen: false, url: null, title: '' })}
      />
    </div>
  )
}

export default function PolicyPage() {
  return (
    <AuthGuard>
      <PolicyPageContent />
    </AuthGuard>
  )
}
