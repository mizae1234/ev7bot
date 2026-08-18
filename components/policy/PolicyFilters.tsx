import React from 'react'
import { InsuranceMasterType } from '@/lib/policy/policy-types'

interface PolicyFiltersProps {
  search: string
  onSearchChange: (val: string) => void
  expiryFilter: string
  onExpiryFilterChange: (val: string) => void
  missingFilter: string
  onMissingFilterChange: (val: string) => void
  typeFilter: string
  onTypeFilterChange: (val: string) => void
  projectFilter: string
  onProjectFilterChange: (val: string) => void
  modelFilter: string
  onModelFilterChange: (val: string) => void
  statusFilter: string
  onStatusFilterChange: (val: string) => void
  masterTypes: InsuranceMasterType[]
  projects: string[]
  models: string[]
  statuses?: { code: string; label: string }[]
  onExportExcel: () => void
  exportLoading: boolean
}

export function PolicyFilters({
  search,
  onSearchChange,
  expiryFilter,
  onExpiryFilterChange,
  missingFilter,
  onMissingFilterChange,
  typeFilter,
  onTypeFilterChange,
  projectFilter,
  onProjectFilterChange,
  modelFilter,
  onModelFilterChange,
  statusFilter,
  onStatusFilterChange,
  masterTypes,
  projects,
  models,
  statuses,
  onExportExcel,
  exportLoading
}: PolicyFiltersProps) {
  const defaultStatuses = statuses || [
    { code: 'ON_RENT', label: '🚗 อยู่ระหว่างเช่า (ON_RENT)' },
    { code: 'AVAILABLE', label: '🟢 พร้อมใช้งาน / รถว่าง (AVAILABLE)' },
    { code: 'MAINTENANCE', label: '🛠️ อยู่ระหว่างซ่อม (MAINTENANCE)' },
    { code: 'REPLACEMENT', label: '🔄 รถทดแทน (REPLACEMENT)' },
    { code: 'PENDING', label: '⏳ รอดำเนินการ (PENDING)' },
    { code: 'PRODUCTION', label: '🏭 รอประกอบ/ผลิต (PRODUCTION)' }
  ]

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
      {/* Top Bar: Search & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหา ทะเบียน, VIN, เลขกรมธรรม์..."
            className="w-full pl-9.5 pr-4 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onExportExcel}
            disabled={exportLoading}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {exportLoading ? (
              <svg className="w-4 h-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span>ส่งออก Excel</span>
          </button>
        </div>
      </div>

      {/* Filter Dropdowns */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* 1. Missing / Completeness Filter (ความครบถ้วนของเอกสาร) */}
        <select
          value={missingFilter}
          onChange={(e) => onMissingFilterChange(e.target.value)}
          className={`text-xs py-1.5 px-3 rounded-lg border font-medium transition-all ${
            missingFilter !== 'ALL'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400'
              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <option value="ALL">ความครบถ้วนของเอกสาร: ทั้งหมด</option>
          <option value="MISSING_INSURANCE">🛡️ ไม่มีข้อมูลประกันภัย (PLMV)</option>
          <option value="MISSING_ACT">📜 ไม่มีข้อมูล พ.ร.บ. (PLMC)</option>
          <option value="MISSING_VEHICLE_TAX">🚗 ไม่มีข้อมูลภาษีรถยนต์</option>
          <option value="MISSING_METER_TAX">📟 ไม่มีข้อมูลภาษีมิเตอร์</option>
          <option value="MISSING_ANY">⚪ ขาดเอกสารอย่างใดอย่างหนึ่ง</option>
          <option value="MISSING_ALL">❌ ไม่มีข้อมูลเอกสารใดๆ เลย</option>
          <option value="COMPLETE">✅ ข้อมูลเอกสารครบถ้วน</option>
        </select>

        {/* 2. Vehicle Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className={`text-xs py-1.5 px-3 rounded-lg border font-medium transition-all ${
            statusFilter !== 'ALL'
              ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-400'
              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <option value="ALL">สถานะรถ: ทั้งหมด</option>
          {defaultStatuses.map(s => (
            <option key={s.code} value={s.code}>
              {s.label}
            </option>
          ))}
        </select>

        {/* 3. Expiry Status */}
        <select
          value={expiryFilter}
          onChange={(e) => onExpiryFilterChange(e.target.value)}
          className={`text-xs py-1.5 px-3 rounded-lg border font-medium transition-all ${
            expiryFilter !== 'ALL'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 ring-1 ring-amber-400'
              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <option value="ALL">สถานะวันหมดอายุ: ทั้งหมด</option>
          <option value="EXPIRING_30">⚠️ ใกล้หมดอายุ (≤ 30 วัน)</option>
          <option value="EXPIRING_60">🟡 ใกล้หมดอายุ (31-60 วัน)</option>
          <option value="EXPIRED">🔴 หมดอายุแล้ว (เลยกำหนด)</option>
          <option value="ACTIVE">🟢 ความคุ้มครองปกติ</option>
        </select>

        {/* 4. Insurance Type */}
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value)}
          className="text-xs py-1.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
        >
          <option value="ALL">ประเภทประกัน: ทั้งหมด</option>
          {masterTypes.map(m => (
            <option key={m.typeCode} value={m.typeCode}>
              {m.typeCode} - {m.typeName}
            </option>
          ))}
        </select>

        {/* 5. Project */}
        {projects.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => onProjectFilterChange(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">โครงการ: ทั้งหมด</option>
            {projects.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        {/* 6. Model */}
        {models.length > 0 && (
          <select
            value={modelFilter}
            onChange={(e) => onModelFilterChange(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            <option value="ALL">รุ่นรถ: ทั้งหมด</option>
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {/* Clear Filters button */}
        {(search || expiryFilter !== 'ALL' || missingFilter !== 'ALL' || statusFilter !== 'ALL' || typeFilter !== 'ALL' || projectFilter !== 'ALL' || modelFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('')
              onExpiryFilterChange('ALL')
              onMissingFilterChange('ALL')
              onStatusFilterChange('ALL')
              onTypeFilterChange('ALL')
              onProjectFilterChange('ALL')
              onModelFilterChange('ALL')
            }}
            className="text-xs py-1 px-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
    </div>
  )
}
