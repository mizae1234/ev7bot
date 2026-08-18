import React from 'react'

interface ReplacementFiltersProps {
  activeTab: 'ACTIVE' | 'POOL' | 'HISTORY'
  search: string
  onSearchChange: (val: string) => void
  locationFilter: string
  onLocationFilterChange: (val: string) => void
  modelFilter: string
  onModelFilterChange: (val: string) => void
  reservationFilter?: string
  onReservationFilterChange?: (val: string) => void
  durationFilter?: string
  onDurationFilterChange?: (val: string) => void
  locations: string[]
  models: string[]
  onExportExcel: () => void
  exportLoading?: boolean
}

export function ReplacementFilters({
  activeTab,
  search,
  onSearchChange,
  locationFilter,
  onLocationFilterChange,
  modelFilter,
  onModelFilterChange,
  reservationFilter = 'ALL',
  onReservationFilterChange,
  durationFilter = 'ALL',
  onDurationFilterChange,
  locations,
  models,
  onExportExcel,
  exportLoading = false
}: ReplacementFiltersProps) {
  const isFiltered =
    search !== '' ||
    locationFilter !== 'ALL' ||
    modelFilter !== 'ALL' ||
    (reservationFilter && reservationFilter !== 'ALL') ||
    (durationFilter && durationFilter !== 'ALL')

  const handleClearFilters = () => {
    onSearchChange('')
    onLocationFilterChange('ALL')
    onModelFilterChange('ALL')
    if (onReservationFilterChange) onReservationFilterChange('ALL')
    if (onDurationFilterChange) onDurationFilterChange('ALL')
  }

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Search Box */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="🔍 ค้นหาทะเบียน, VIN, งานซ่อม, อู่..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
          />
          <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* 2. Specific Tab Filters */}
        {activeTab === 'ACTIVE' && onDurationFilterChange && (
          <div>
            <select
              value={durationFilter}
              onChange={(e) => onDurationFilterChange(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border font-medium transition-all ${
                durationFilter !== 'ALL'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
              } focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
            >
              <option value="ALL">⏳ ระยะเวลาใช้งาน (ทั้งหมด)</option>
              <option value="NORMAL">🟢 ปกติ (น้อยกว่า 14 วัน)</option>
              <option value="WARNING">🟡 เฝ้าระวัง (14 - 30 วัน)</option>
              <option value="CRITICAL">🔴 เกินกำหนด (มากกว่า 30 วัน Alert)</option>
            </select>
          </div>
        )}

        {activeTab === 'POOL' && onReservationFilterChange && (
          <div>
            <select
              value={reservationFilter}
              onChange={(e) => onReservationFilterChange(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-xl border font-medium transition-all ${
                reservationFilter !== 'ALL'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
              } focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
            >
              <option value="ALL">🚗 สถานะคลัง / การจอง (ทั้งหมด)</option>
              <option value="READY">🟢 พร้อมใช้ทันที (Replacement Available)</option>
              <option value="STANDBY">🔵 Standby สามารถเปลี่ยนเป็นรถทดแทนได้</option>
              <option value="RESERVED_LINEMAN">🟢 จองให้ Line Man</option>
              <option value="RESERVED_OTHERS">🟡 จองให้คันหลักอื่นๆ</option>
              <option value="RESERVED_UNASSIGNED">⚪ จองแบบไม่ระบุทะเบียน (โควตากลาง)</option>
            </select>
          </div>
        )}

        {/* 3. Location Filter */}
        <div>
          <select
            value={locationFilter}
            onChange={(e) => onLocationFilterChange(e.target.value)}
            className={`w-full px-3 py-2 text-xs rounded-xl border font-medium transition-all ${
              locationFilter !== 'ALL'
                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold'
                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
            } focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
          >
            <option value="ALL">📍 สถานที่จอด / Yard (ทั้งหมด)</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Model Filter */}
        <div>
          <select
            value={modelFilter}
            onChange={(e) => onModelFilterChange(e.target.value)}
            className={`w-full px-3 py-2 text-xs rounded-xl border font-medium transition-all ${
              modelFilter !== 'ALL'
                ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold'
                : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
            } focus:outline-none focus:ring-2 focus:ring-amber-500/30`}
          >
            <option value="ALL">🚘 รุ่นรถ (ทั้งหมด)</option>
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* 5. Action Buttons (Export & Clear) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportExcel}
            disabled={exportLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {exportLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span>Excel</span>
          </button>

          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-all cursor-pointer"
              title="ล้างตัวกรอง"
            >
              ล้างค่า
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
