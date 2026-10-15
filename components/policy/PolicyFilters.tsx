import React from 'react'
import { InsuranceMasterType } from '@/lib/policy/policy-types'
import { ExportButton } from '@/lib/exportExcel'

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
  projectTypeFilter?: string
  onProjectTypeFilterChange?: (val: string) => void
  modelFilter: string
  onModelFilterChange: (val: string) => void
  statusFilter: string
  onStatusFilterChange: (val: string) => void
  masterTypes: InsuranceMasterType[]
  projects: string[]
  projectTypes?: string[]
  models: string[]
  statuses?: {
    mainStatuses?: { code: string; label: string }[]
    statusTypes?: { code: string; label: string }[]
  } | { code: string; label: string }[]
  onExportExcel?: () => void
  exportLoading?: boolean
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
  projectTypeFilter = 'ALL',
  onProjectTypeFilterChange,
  modelFilter,
  onModelFilterChange,
  statusFilter,
  onStatusFilterChange,
  masterTypes,
  projects,
  projectTypes = [],
  models,
  statuses,
  onExportExcel,
  exportLoading
}: PolicyFiltersProps) {
  const [showBatchModal, setShowBatchModal] = React.useState(false)
  const [batchInputText, setBatchInputText] = React.useState('')

  // Determine mainStatuses and statusTypes
  const isGroupedStatuses = statuses && !Array.isArray(statuses) && ('mainStatuses' in statuses || 'statusTypes' in statuses)
  const mainStatuses = isGroupedStatuses
    ? (statuses as { mainStatuses?: { code: string; label: string }[] }).mainStatuses || []
    : Array.isArray(statuses)
    ? statuses
    : [
        { code: 'ON_RENT', label: '🚗 อยู่ระหว่างเช่า (ON_RENT)' },
        { code: 'AVAILABLE', label: '🟢 พร้อมใช้งาน / รถว่าง (AVAILABLE)' },
        { code: 'MAINTENANCE', label: '🛠️ อยู่ระหว่างซ่อม (MAINTENANCE)' },
        { code: 'REPLACEMENT', label: '🔄 รถทดแทน (REPLACEMENT)' },
        { code: 'PENDING', label: '⏳ รอดำเนินการ (PENDING)' },
        { code: 'PRODUCTION', label: '🏭 รอประกอบ/ผลิต (PRODUCTION)' }
      ]

  const statusTypes = isGroupedStatuses
    ? (statuses as { statusTypes?: { code: string; label: string }[] }).statusTypes || []
    : []

  // Detect active search tokens
  const activeTokens = search.trim() ? Array.from(new Set(search.trim().split(/[\r\n,\t\s]+/).filter(Boolean))) : []
  const isMultiSearch = activeTokens.length > 1

  // Parse batch modal textarea tokens
  const batchTokens = batchInputText.trim()
    ? Array.from(new Set(batchInputText.split(/[\r\n,\t\s,]+/).map(s => s.trim()).filter(Boolean)))
    : []

  // Auto-handle paste in main search input if copied multiple rows from Excel
  const handleSearchPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (text.includes('\n') || text.includes('\r') || text.includes('\t')) {
      const tokens = Array.from(new Set(text.split(/[\r\n,\t\s,]+/).map(s => s.trim()).filter(Boolean)))
      if (tokens.length > 1) {
        e.preventDefault()
        onSearchChange(tokens.join(' '))
      }
    }
  }

  const handleOpenBatchModal = () => {
    // Prepopulate with current search tokens if any
    if (activeTokens.length > 0) {
      setBatchInputText(activeTokens.join('\n'))
    }
    setShowBatchModal(true)
  }

  const handleApplyBatchSearch = () => {
    if (batchTokens.length > 0) {
      onSearchChange(batchTokens.join(' '))
    } else {
      onSearchChange('')
    }
    setShowBatchModal(false)
  }

  const hasActiveFilter =
    !!search || expiryFilter !== 'ALL' || missingFilter !== 'ALL' || statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' || projectFilter !== 'ALL' || projectTypeFilter !== 'ALL' || modelFilter !== 'ALL'

  const clearAll = () => {
    onSearchChange('')
    onExpiryFilterChange('ALL')
    onMissingFilterChange('ALL')
    onStatusFilterChange('ALL')
    onTypeFilterChange('ALL')
    onProjectFilterChange('ALL')
    if (onProjectTypeFilterChange) onProjectTypeFilterChange('ALL')
    onModelFilterChange('ALL')
  }

  // Shared field styles (same look as the insurance-purchase page)
  const fieldCls =
    'w-full px-3 py-2 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
  const selectCls = (active: boolean) =>
    `${fieldCls} truncate ${active ? 'border-emerald-400 dark:border-emerald-600 ring-1 ring-emerald-400/40' : ''}`
  const labelCls = 'block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 whitespace-nowrap'
  const cellCls = 'flex-1 min-w-[150px] lg:min-w-0'

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
      {/* Top Bar: Search (stretches) + Multi-VIN, Export, Clear (right aligned) */}
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-3">
        {/* Main Search Input */}
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onPaste={handleSearchPaste}
            placeholder="ค้นหา ทะเบียน, VIN, สถานะรถ, สถานที่..."
            className={`${fieldCls} pl-10 pr-9`}
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 cursor-pointer"
              title="ล้างคำค้นหา"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Right-aligned actions */}
        <div className="flex flex-wrap items-stretch justify-end gap-2 shrink-0">
          {/* Multi-VIN Batch Button */}
          <button
            type="button"
            onClick={handleOpenBatchModal}
            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shrink-0 cursor-pointer ${
              isMultiSearch
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700/60'
            }`}
            title="ค้นหาทีละหลาย VinNo. จาก Excel"
          >
            <span>📋</span>
            <span>{isMultiSearch ? `ค้นหา (${activeTokens.length} VinNo.)` : 'ค้นหาทีละหลาย VinNo.'}</span>
          </button>

          {/* Export Excel (same style as insurance-purchase page) */}
          {onExportExcel && (
            <ExportButton
              onClick={() => { if (!exportLoading) onExportExcel() }}
              label={exportLoading ? '⏳ กำลังส่งออก...' : '📥 Export Excel'}
              className="min-w-[160px] justify-center"
            />
          )}

          {/* Clear all filters */}
          <button
            type="button"
            disabled={!hasActiveFilter}
            onClick={clearAll}
            title="ล้างค่าตัวกรองทั้งหมด"
            className="inline-flex items-center justify-center px-3 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            ✕ ล้างค่า
          </button>
        </div>
      </div>

      {/* Multi-Search Active Badge Banner */}
      {isMultiSearch && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold flex items-center gap-1">
              <span>🔍 กำลังค้นหาแบบชุด:</span>
              <span className="px-1.5 py-0.2 bg-amber-200/60 dark:bg-amber-900/60 rounded text-amber-900 dark:text-amber-100 font-mono">
                {activeTokens.length} รายการ
              </span>
            </span>
            <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-md hidden sm:inline">
              ({activeTokens.slice(0, 3).join(', ')}{activeTokens.length > 3 ? `, ...อีก ${activeTokens.length - 3} คัน` : ''})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenBatchModal}
              className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
            >
              แก้ไขรายการ
            </button>
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-xs text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
            >
              ล้างค่า
            </button>
          </div>
        </div>
      )}

      {/* Filter Dropdowns (single row on large screens) */}
      <div className="flex flex-wrap lg:flex-nowrap items-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* 1. Missing / Completeness Filter */}
        <div className={cellCls}>
          <label className={labelCls}>📑 ความครบถ้วนเอกสาร</label>
          <select value={missingFilter} onChange={(e) => onMissingFilterChange(e.target.value)} className={selectCls(missingFilter !== 'ALL')}>
            <option value="ALL">ทั้งหมด</option>
            <option value="MISSING_INSURANCE">🛡️ ไม่มีข้อมูลประกันภัย (PLMV)</option>
            <option value="MISSING_ACT">📜 ไม่มีข้อมูล พ.ร.บ. (PLMC)</option>
            <option value="MISSING_VEHICLE_TAX">🚗 ไม่มีข้อมูลภาษีรถยนต์</option>
            <option value="MISSING_METER_TAX">📟 ไม่มีข้อมูลภาษีมิเตอร์</option>
            <option value="MISSING_ANY">⚪ ขาดเอกสารอย่างใดอย่างหนึ่ง</option>
            <option value="MISSING_ALL">❌ ไม่มีข้อมูลเอกสารใดๆ เลย</option>
            <option value="COMPLETE">✅ ข้อมูลเอกสารครบถ้วน</option>
          </select>
        </div>

        {/* 2. Vehicle Status Filter */}
        <div className={cellCls}>
          <label className={labelCls}>🚗 สถานะรถ</label>
          <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className={selectCls(statusFilter !== 'ALL')}>
            <option value="ALL">ทั้งหมด</option>
            {mainStatuses.length > 0 && (
              <optgroup label="── สถานะหลัก (Main Status) ──">
                {mainStatuses.map(st => (
                  <option key={`main_${st.code}`} value={st.code}>{st.label}</option>
                ))}
              </optgroup>
            )}
            {statusTypes.length > 0 && (
              <optgroup label="── สถานะย่อย (Status Type) ──">
                {statusTypes.map(st => (
                  <option key={`type_${st.code}`} value={st.code}>{st.label} ({st.code})</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* 3. Expiry Status */}
        <div className={cellCls}>
          <label className={labelCls}>⏳ สถานะวันหมดอายุ</label>
          <select value={expiryFilter} onChange={(e) => onExpiryFilterChange(e.target.value)} className={selectCls(expiryFilter !== 'ALL')}>
            <option value="ALL">ทั้งหมด</option>
            <option value="EXPIRING_30">⚠️ ใกล้หมดอายุ (≤ 30 วัน)</option>
            <option value="EXPIRING_60">🟡 ใกล้หมดอายุ (31-60 วัน)</option>
            <option value="EXPIRED">🔴 หมดอายุแล้ว (เลยกำหนด)</option>
            <option value="ACTIVE">🟢 ความคุ้มครองปกติ</option>
          </select>
        </div>

        {/* 4. Insurance Type */}
        <div className={cellCls}>
          <label className={labelCls}>🛡️ ประเภทประกัน</label>
          <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)} className={selectCls(typeFilter !== 'ALL')}>
            <option value="ALL">ทั้งหมด</option>
            {masterTypes.map(m => (
              <option key={m.typeCode} value={m.typeCode}>{m.typeCode} - {m.typeName}</option>
            ))}
          </select>
        </div>

        {/* 5. Project */}
        {projects.length > 0 && (
          <div className={cellCls}>
            <label className={labelCls}>🏢 โครงการ</label>
            <select value={projectFilter} onChange={(e) => onProjectFilterChange(e.target.value)} className={selectCls(projectFilter !== 'ALL')}>
              <option value="ALL">ทั้งหมด</option>
              {projects.map(pr => (
                <option key={pr} value={pr}>{pr}</option>
              ))}
            </select>
          </div>
        )}

        {/* 5.1 Project Type */}
        {projectTypes && projectTypes.length > 0 && (
          <div className={cellCls}>
            <label className={labelCls}>🏷️ ประเภทโครงการ</label>
            <select
              value={projectTypeFilter}
              onChange={(e) => onProjectTypeFilterChange && onProjectTypeFilterChange(e.target.value)}
              className={selectCls(projectTypeFilter !== 'ALL')}
            >
              <option value="ALL">ทั้งหมด</option>
              {projectTypes.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          </div>
        )}

        {/* 6. Model */}
        {models.length > 0 && (
          <div className={cellCls}>
            <label className={labelCls}>🚙 รุ่นรถ</label>
            <select value={modelFilter} onChange={(e) => onModelFilterChange(e.target.value)} className={selectCls(modelFilter !== 'ALL')}>
              <option value="ALL">ทั้งหมด</option>
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Batch VIN Search Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-zinc-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowBatchModal(false)}
          />

          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-10 my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    ค้นหาทีละหลาย VinNo.
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    คัดลอกจาก Excel แล้ววางลงในช่องด้านล่างเพื่อค้นหาหลายคันพร้อมกัน
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  รายการ VIN หรือเลขทะเบียน (1 บรรทัดต่อ 1 คัน หรือคั่นด้วยจุลภาค/เว้นวรรค)
                </label>
                <textarea
                  rows={7}
                  value={batchInputText}
                  onChange={(e) => setBatchInputText(e.target.value)}
                  placeholder={`ตัวอย่างเช่น:\nLNAAKAA10R5E01134\nLNAAKAA10R5E01148\nทอ-4141\nทอ-4183`}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-y"
                  autoFocus
                />
              </div>

              {/* Status / Preview Bar */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">
                  {batchTokens.length > 0 ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ✅ ตรวจพบ {batchTokens.length} รายการที่ไม่ซ้ำกัน
                    </span>
                  ) : (
                    <span className="text-zinc-400">ยังไม่มีรายการที่ระบุ</span>
                  )}
                </span>
                {batchInputText && (
                  <button
                    type="button"
                    onClick={() => setBatchInputText('')}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium hover:underline cursor-pointer"
                  >
                    ล้างข้อความ
                  </button>
                )}
              </div>

              {/* Preview Chips */}
              {batchTokens.length > 0 && (
                <div className="max-h-32 overflow-y-auto p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-wrap gap-1.5">
                  {batchTokens.map((tok, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 text-[11px] font-mono bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-md border border-zinc-200 dark:border-zinc-600 shadow-2xs"
                    >
                      {tok}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setBatchInputText('')
                  onSearchChange('')
                  setShowBatchModal(false)
                }}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                ล้างการค้นหา
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleApplyBatchSearch}
                  disabled={batchTokens.length === 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🔍</span>
                  <span>ค้นหา {batchTokens.length > 0 ? `(${batchTokens.length} คัน)` : ''}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
