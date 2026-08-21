'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'
import type { InspectionListItem, MasterItemDef } from '@/lib/inspection/types'
import { exportToExcel, ExportButton } from '@/lib/exportExcel'
import { getAssessmentLabel, getThaiDate, getThaiDateTime, getReasonLabel } from '@/components/returns-monitor/constants'

import StatsCards from '@/components/returns-monitor/StatsCards'
import FilterBar from '@/components/returns-monitor/FilterBar'
import InspectionTable from '@/components/returns-monitor/InspectionTable'
import InspectionDrawer from '@/components/returns-monitor/InspectionDrawer'

export default function ReturnsMonitorPage() {
  const router = useRouter()
  const [inspections, setInspections] = useState<InspectionListItem[]>([])
  const [masterItems, setMasterItems] = useState<MasterItemDef[]>([])
  const [locations, setLocations] = useState<Array<{ code: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters state
  const [search, setSearch] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedDocStatus, setSelectedDocStatus] = useState('')
  const [selectedAssessment, setSelectedAssessment] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Drawer state
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null)

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Build query string
      const params = new URLSearchParams()
      params.append('type', 'RETURN')
      params.append('limit', '200')
      if (selectedLocation) params.append('location', selectedLocation)
      if (selectedDocStatus) params.append('status', selectedDocStatus)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const [inspRes, masterRes, locRes] = await Promise.all([
        fetch(`/api/inspection?${params.toString()}`),
        fetch('/api/inspection/master'),
        fetch('/api/maintenance/locations'),
      ])

      if (!inspRes.ok) throw new Error('ไม่สามารถดึงข้อมูลรายการคืนรถได้')
      if (!masterRes.ok) throw new Error('ไม่สามารถดึงข้อมูลมาสเตอร์เช็คลิสต์ได้')

      const inspData = await inspRes.json()
      const masterData = await masterRes.json()
      const locData = locRes.ok ? await locRes.json() : { locations: [] }

      setInspections(inspData.inspections || [])
      setMasterItems(masterData.masterItems || [])
      setLocations(locData.locations || [])
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }, [selectedLocation, selectedDocStatus, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered Inspections — client-side search + assessment filter
  const filteredInspections = useMemo(() => {
    return inspections.filter(item => {
      const matchSearch =
        (item.registerNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.vinNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.inspectorName || '').toLowerCase().includes(search.toLowerCase())

      const assessmentLabel = getAssessmentLabel(item.assessmentResult)
      const matchAssessment = !selectedAssessment || assessmentLabel === selectedAssessment

      return matchSearch && matchAssessment
    })
  }, [inspections, search, selectedAssessment])

  // Calculate statistics
  const stats = useMemo(() => {
    let total = inspections.length
    let normal = 0
    let repair = 0
    let pending = 0

    inspections.forEach(item => {
      if (item.assessmentResult === 'NORMAL') normal++
      else if (item.assessmentResult === 'NEED_REPAIR') repair++
      else pending++
    })

    return { total, normal, repair, pending }
  }, [inspections])

  // Reset all filters
  const handleResetFilters = () => {
    setSearch('')
    setSelectedLocation('')
    setSelectedDocStatus('')
    setSelectedAssessment('')
    setStartDate('')
    setEndDate('')
  }

  // ─── Export Excel Handler ────────────────────────────
  const handleExportExcel = () => {
    const headers = [
      'ทะเบียน', 'เลขตัวถัง (VIN)', 'ผู้เช่า', 'เบอร์โทร',
      'สถานที่รับคืน', 'วันที่คืนรถ', 'สถานะเอกสาร', 'ผลการประเมิน',
      'รอตรวจภายหลัง', 'ผู้ตรวจเช็ค', 'กิโลเมตร', 'เหตุผลคืนรถ',
      'วันที่สร้าง', 'ผู้บันทึก (สร้าง)', 'วันที่อัพเดตล่าสุด', 'ผู้อัพเดตล่าสุด',
    ]

    const rows = filteredInspections.map(item => [
      item.registerNo || '-',
      item.vinNo,
      item.customerName || '-',
      item.customerContact || '-',
      item.locationName || item.location || '-',
      getThaiDate(item.inspectionDate),
      item.status === 'DRAFT' ? 'ฉบับร่าง' : 'เสร็จสมบูรณ์',
      item.isPendingChecklist ? 'รอตรวจภายหลัง' : getAssessmentLabel(item.assessmentResult),
      item.isPendingChecklist ? 'ใช่' : '-',
      item.inspectorName || '-',
      item.mileage != null ? item.mileage : '-',
      item.returnReasonName || getReasonLabel(item.returnReason),
      getThaiDateTime(item.createDate),
      item.createdByName || '-',
      getThaiDateTime(item.updateDate),
      item.updatedByName || '-',
    ])

    // Build period label
    let periodLabel = 'ทั้งหมด'
    if (startDate && endDate) {
      periodLabel = `${getThaiDate(startDate)} - ${getThaiDate(endDate)}`
    } else if (startDate) {
      periodLabel = `ตั้งแต่ ${getThaiDate(startDate)}`
    } else if (endDate) {
      periodLabel = `ถึง ${getThaiDate(endDate)}`
    }

    exportToExcel({
      reportName: 'รายการรับคืนรถ',
      periodLabel,
      headers,
      rows,
      fileName: 'Returns_Monitor',
    })
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">

        {/* Navigation / Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition active:scale-95 text-xs flex items-center gap-1 shadow-sm font-medium"
              >
                <span>⬅</span> แดชบอร์ด
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  🚗 Vehicle Return Monitor
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">ระบบตรวจสอบสถานะการรับคืนรถและการตรวจสภาพยนต์ไฟฟ้า</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExportButton onClick={handleExportExcel} label="📥 Export Excel" />
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shadow-sm"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔄</span>
                )}
                รีเฟรชข้อมูล
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Stats Cards */}
          <StatsCards stats={stats} />

          {/* Filters */}
          <FilterBar
            search={search} onSearchChange={setSearch}
            selectedLocation={selectedLocation} onLocationChange={setSelectedLocation}
            selectedAssessment={selectedAssessment} onAssessmentChange={setSelectedAssessment}
            selectedDocStatus={selectedDocStatus} onDocStatusChange={setSelectedDocStatus}
            startDate={startDate} onStartDateChange={setStartDate}
            endDate={endDate} onEndDateChange={setEndDate}
            locations={locations}
            onReset={handleResetFilters}
          />

          {/* Results Table with Pagination */}
          <InspectionTable
            inspections={filteredInspections}
            onSelectInspection={setSelectedInspectionId}
          />

        </div>

        {/* Detailed Drawer */}
        {selectedInspectionId && (
          <InspectionDrawer
            inspectionId={selectedInspectionId}
            masterItems={masterItems}
            onClose={() => setSelectedInspectionId(null)}
          />
        )}

      </div>
    </AuthGuard>
  )
}
