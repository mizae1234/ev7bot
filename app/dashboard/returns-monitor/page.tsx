'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { buildDynamicSections } from '@/lib/inspection/checklist-config'
import type { InspectionListItem, InspectionData, MasterItemDef } from '@/lib/inspection/types'

const spacesEndpoint = 'https://sgp1.digitaloceanspaces.com'
const spacesBucket = 'space-ev7tracking-prod'
const SPACES_CDN = (typeof window !== 'undefined' && localStorage.getItem('spaces_cdn')) || spacesEndpoint.replace('https://', `https://${spacesBucket}.`)

function getThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
  } catch {
    return String(dateStr)
  }
}

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

  // Detailed Modal/Drawer state
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null)
  const [inspectionDetail, setInspectionDetail] = useState<InspectionData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'checklist' | 'photos'>('info')

  // Image Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Build query string
      const params = new URLSearchParams()
      params.append('type', 'RETURN')
      params.append('limit', '200') // fetch more for monitoring
      if (selectedLocation) params.append('location', selectedLocation)
      if (selectedDocStatus) params.append('status', selectedDocStatus)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const [inspRes, masterRes, locRes] = await Promise.all([
        fetch(`/api/inspection?${params.toString()}`),
        fetch('/api/inspection/master'),
        fetch('/api/liff/locations')
      ])

      if (!inspRes.ok) throw new Error('ไม่สามารถดึงข้อมูลรายการคืนรถได้')
      if (!masterRes.ok) throw new Error('ไม่สามารถดึงข้อมูลมาสเตอร์เช็คลิสต์ได้')

      const inspData = await inspRes.json()
      const masterData = await masterRes.json()
      const locData = locRes.ok ? await locRes.json() : { locations: [] }

      setInspections(inspData.inspections || [])
      setMasterItems(masterData.items || [])
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

  // Fetch Inspection details when selected
  useEffect(() => {
    if (!selectedInspectionId) {
      setInspectionDetail(null)
      return
    }

    const fetchDetail = async () => {
      setLoadingDetail(true)
      try {
        const res = await fetch(`/api/inspection/${selectedInspectionId}`)
        if (!res.ok) throw new Error('ไม่สามารถดึงรายละเอียดการตรวจสภาพได้')
        const data = await res.json()
        setInspectionDetail(data.inspection)
        setActiveTab('info')
      } catch (err: any) {
        alert(err.message || 'เกิดข้อผิดพลาด')
        setSelectedInspectionId(null)
      } finally {
        setLoadingDetail(false)
      }
    }

    fetchDetail()
  }, [selectedInspectionId])

  // Filtered Inspections client-side search
  const filteredInspections = useMemo(() => {
    return inspections.filter(item => {
      const matchSearch =
        (item.registerNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.vinNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.inspectorName || '').toLowerCase().includes(search.toLowerCase())

      // Auto assessment mapping
      const mappedAssessment =
        item.assessmentResult === 'NORMAL'
          ? 'ปกติ'
          : item.assessmentResult === 'NEED_REPAIR'
          ? 'ต้องส่งเข้าซ่อม'
          : 'รอผลการตรวจ'

      const matchAssessment = !selectedAssessment || mappedAssessment === selectedAssessment

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

  // Dynamic sections generator from masterItems
  const dynamicSections = useMemo(() => {
    return buildDynamicSections(masterItems)
  }, [masterItems])

  // Map reasons to readable Thai labels
  const getReasonLabel = (code: string | null | undefined): string => {
    if (!code) return '-'
    const reasons: Record<string, string> = {
      RETURN_CONTRACT_END: 'คืนรถครบสัญญาเช่า',
      RETURN_REPOSSESSED: 'ยึดคืนรถยนต์เนื่องจากค้างค่างวด',
      RETURN_ACCIDENT: 'คืนเนื่องจากอุบัติเหตุหนัก/ทุนประกันชำรุด',
      RETURN_VOLUNTARY: 'ยกเลิกสัญญาก่อนกำหนด/คืนสมัครใจ',
      RETURN_UPGRADE: 'คืนเพื่อเปลี่ยนรุ่นรถยนต์ (Upgrade)',
      RETURN_MAINTENANCE: 'คืนรถสับเปลี่ยนเพื่อตรวจสภาพเช็คระยะ',
    }
    return reasons[code] || code
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
        
        {/* Navigation / Header */}
        <div className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition active:scale-95 text-xs text-slate-300 flex items-center gap-1"
              >
                <span>⬅</span> แดชบอร์ด
              </button>
              <div>
                <h1 className="text-lg font-extrabold text-slate-100">
                  🚗 Vehicle Return Monitor
                </h1>
                <p className="text-[10px] text-slate-400 font-medium">ระบบตรวจสอบสถานะการรับคืนรถและการตรวจสภาพยนต์ไฟฟ้า</p>
              </div>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">

          {/* Stats Cards Section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-lg">
                📦
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">คืนรถทั้งหมด</p>
                <h3 className="text-xl font-black mt-0.5 text-slate-100">{stats.total} <span className="text-xs font-medium text-slate-500">คัน</span></h3>
              </div>
            </div>

            {/* Normal */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
                ✅
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">สภาพปกติ</p>
                <h3 className="text-xl font-black mt-0.5 text-emerald-300">{stats.normal} <span className="text-xs font-medium text-slate-500">คัน</span></h3>
              </div>
            </div>

            {/* Repair */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-lg">
                ⚠️
              </div>
              <div>
                <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">ส่งเข้าซ่อม</p>
                <h3 className="text-xl font-black mt-0.5 text-rose-300">{stats.repair} <span className="text-xs font-medium text-slate-500">คัน</span></h3>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
                ⏳
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">รอผลตรวจ</p>
                <h3 className="text-xl font-black mt-0.5 text-amber-300">{stats.pending} <span className="text-xs font-medium text-slate-500">คัน</span></h3>
              </div>
            </div>

          </div>

          {/* Filters / Search Bar Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <span>🔍</span> ค้นหาและกรองข้อมูล
              </h4>
              <button
                onClick={handleResetFilters}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-200 transition active:scale-95"
              >
                ล้างตัวกรองทั้งหมด ✖
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Search text */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">คำค้นหา</label>
                <input
                  type="text"
                  placeholder="ทะเบียน, VIN, ลูกค้า, ผู้ตรวจ..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {/* Location filter */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">สถานที่คืนรถ</label>
                <select
                  value={selectedLocation}
                  onChange={e => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">-- ทั้งหมด --</option>
                  {locations.map(loc => (
                    <option key={loc.code} value={loc.code}>{loc.name}</option>
                  ))}
                </select>
              </div>

              {/* Assessment filter */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">ผลการประเมินรถ</label>
                <select
                  value={selectedAssessment}
                  onChange={e => setSelectedAssessment(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">-- ทั้งหมด --</option>
                  <option value="ปกติ">ปกติ (Normal)</option>
                  <option value="ต้องส่งเข้าซ่อม">ต้องส่งเข้าซ่อม (Needs Repair)</option>
                  <option value="รอผลการตรวจ">รอผลการตรวจ (Pending)</option>
                </select>
              </div>

              {/* Document Status filter */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">สถานะเอกสาร</label>
                <select
                  value={selectedDocStatus}
                  onChange={e => setSelectedDocStatus(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                >
                  <option value="">-- ทั้งหมด --</option>
                  <option value="DRAFT">ฉบับร่าง (DRAFT)</option>
                  <option value="SUBMIT">เสร็จสมบูรณ์ (SUBMIT)</option>
                </select>
              </div>

              {/* Date Start */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-1 text-xs rounded-lg border border-slate-800 bg-slate-950 text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                />
              </div>

              {/* Date End */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-500">ถึงวันที่</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-3 py-1 text-xs rounded-lg border border-slate-800 bg-slate-950 text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-5 py-4">ทะเบียน / เลขตัวถัง (VIN)</th>
                    <th className="px-5 py-4">ผู้เช่า / เบอร์โทร</th>
                    <th className="px-5 py-4">สถานที่รับคืน</th>
                    <th className="px-5 py-4">วันที่คืนรถ</th>
                    <th className="px-5 py-4 text-center">สถานะเอกสาร</th>
                    <th className="px-5 py-4 text-center">การประเมินสภาพ</th>
                    <th className="px-5 py-4">ผู้ตรวจเช็ค</th>
                    <th className="px-5 py-4 text-center">กิโลเมตร</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-slate-300">
                  {filteredInspections.length > 0 ? (
                    filteredInspections.map((item) => {
                      const isDraft = item.status === 'DRAFT'
                      const mappedAssessment =
                        item.assessmentResult === 'NORMAL'
                          ? 'ปกติ'
                          : item.assessmentResult === 'NEED_REPAIR'
                          ? 'ต้องส่งเข้าซ่อม'
                          : 'รอผลการตรวจ'

                      return (
                        <tr
                          key={item.inspectionId}
                          onClick={() => setSelectedInspectionId(item.inspectionId)}
                          className="hover:bg-slate-800/50 transition duration-150 cursor-pointer active:bg-slate-800"
                        >
                          {/* Register No & VIN */}
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-100 text-sm">{item.registerNo || '-'}</p>
                            <p className="font-mono text-[9px] text-slate-500 mt-0.5">{item.vinNo}</p>
                          </td>

                          {/* Customer */}
                          <td className="px-5 py-4">
                            <p className="font-medium text-slate-250">{item.customerName || '-'}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.customerContact || '-'}</p>
                          </td>

                          {/* Location */}
                          <td className="px-5 py-4 font-medium text-slate-300">
                            {item.locationName || item.location || '-'}
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4 font-medium text-slate-300">
                            {getThaiDate(item.inspectionDate)}
                          </td>

                          {/* Document status */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                              isDraft
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {isDraft ? 'DRAFT' : 'SUBMIT'}
                            </span>
                          </td>

                          {/* Assessment Badge */}
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              mappedAssessment === 'ปกติ'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : mappedAssessment === 'ต้องส่งเข้าซ่อม'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-750'
                            }`}>
                              <span>
                                {mappedAssessment === 'ปกติ' ? '✅' : mappedAssessment === 'ต้องส่งเข้าซ่อม' ? '⚠️' : '⏳'}
                              </span>
                              {mappedAssessment}
                            </span>
                          </td>

                          {/* Inspector */}
                          <td className="px-5 py-4 font-medium text-slate-300">
                            {item.inspectorName || '-'}
                          </td>

                          {/* Mileage */}
                          <td className="px-5 py-4 text-center font-mono font-bold text-slate-100 text-[11px]">
                            {item.mileage != null ? `${item.mileage.toLocaleString()} กม.` : '-'}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-500 font-medium">
                        ไม่พบข้อมูลรายการคืนรถที่ตรงตามตัวกรอง
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Detailed Modal Drawer */}
        {selectedInspectionId && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 transition-all duration-300">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => setSelectedInspectionId(null)} />

            {/* Drawer Content */}
            <div className="relative w-full max-w-2xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
              
              {/* Header */}
              <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/40">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-100">📋 รายงานผลการตรวจรับคืนรถ</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">เลขรายงานอ้างอิง: #{selectedInspectionId}</p>
                </div>
                <button
                  onClick={() => setSelectedInspectionId(null)}
                  className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-705 hover:text-slate-200 transition"
                >
                  ✕
                </button>
              </div>

              {/* Loader */}
              {loadingDetail || !inspectionDetail ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-500">กำลังโหลดรายละเอียดการประเมินสภาพ...</p>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-slate-800 bg-slate-950/20 px-2 py-1 gap-1">
                    <button
                      onClick={() => setActiveTab('info')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === 'info'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ℹ️ ข้อมูลรับคืน
                    </button>
                    <button
                      onClick={() => setActiveTab('checklist')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === 'checklist'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      ✏️ เช็คลิสต์ ({inspectionDetail.items?.length || 0})
                    </button>
                    <button
                      onClick={() => setActiveTab('photos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeTab === 'photos'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      📷 ภาพแนบ ({inspectionDetail.photos?.filter(p => p.category !== 'SIGNATURE').length || 0})
                    </button>
                  </div>

                  {/* Tab Body */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    
                    {/* INFO TAB */}
                    {activeTab === 'info' && (
                      <div className="space-y-4">
                        
                        {/* Auto Assessment Hero Banner */}
                        <div className={`p-4 rounded-2xl border text-center space-y-1.5 shadow-lg ${
                          inspectionDetail.assessmentResult === 'NORMAL'
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : inspectionDetail.assessmentResult === 'NEED_REPAIR'
                            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                            : 'bg-slate-800/80 border-slate-700 text-slate-400'
                        }`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ผลการประเมินสภาพรถอัตโนมัติ</p>
                          <h4 className="text-lg font-black flex items-center justify-center gap-1.5">
                            <span>
                              {inspectionDetail.assessmentResult === 'NORMAL' ? '✅ ปกติเรียบร้อย' : inspectionDetail.assessmentResult === 'NEED_REPAIR' ? '⚠️ ต้องส่งเข้าซ่อมแซม' : '⏳ รอตรวจสภาพ'}
                            </span>
                          </h4>
                          {inspectionDetail.assessmentResult === 'NEED_REPAIR' && (
                            <p className="text-[10px] text-rose-400 font-medium">ตรวจพบรอยเสียหายหรือสภาพไม่ปกติในเช็คลิสต์ด้านล่าง</p>
                          )}
                        </div>

                        {/* Return details card */}
                        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
                          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <span>📅</span> รายละเอียดการคืนรถ
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">ทะเบียนรถ</span>
                              <p className="font-bold text-slate-100">{inspectionDetail.registerNo || '-'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">เลขตัวถัง (VIN)</span>
                              <p className="font-mono text-slate-100">{inspectionDetail.vinNo}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">ชื่อลูกค้าที่คืนรถ</span>
                              <p className="font-bold text-slate-100">{inspectionDetail.customerName || '-'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">เบอร์โทรศัพท์ติดต่อ</span>
                              <p className="font-mono text-slate-100">{inspectionDetail.customerContact || '-'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">วันที่รับคืนจริง</span>
                              <p className="font-bold text-slate-100">{getThaiDate(inspectionDetail.returnDate || inspectionDetail.inspectionDate)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">วันที่ยกเลิกสัญญา</span>
                              <p className="font-bold text-slate-100">{getThaiDate(inspectionDetail.contractCancellationDate)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">สถานที่จอดคืน</span>
                              <p className="font-bold text-slate-100">{inspectionDetail.locationName || inspectionDetail.location || '-'}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-slate-500">เลขไมล์สะสม</span>
                              <p className="font-mono font-bold text-slate-100">{inspectionDetail.mileage != null ? `${inspectionDetail.mileage.toLocaleString()} กม.` : '-'}</p>
                            </div>
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-[10px] text-slate-500">เหตุผลในการคืนรถ</span>
                              <p className="font-medium text-slate-100">{getReasonLabel(inspectionDetail.returnReason)}</p>
                            </div>
                            <div className="space-y-0.5 col-span-2 border-t border-slate-800/80 pt-2 mt-1">
                              <span className="text-[10px] text-slate-500">เจ้าหน้าที่ผู้ตรวจเช็ค</span>
                              <p className="font-bold text-indigo-300">{inspectionDetail.inspectorName || '-'}</p>
                            </div>
                            <div className="space-y-0.5 col-span-2">
                              <span className="text-[10px] text-slate-500">หมายเหตุเพิ่มเติม</span>
                              <p className="text-slate-300 whitespace-pre-line bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 mt-1">{inspectionDetail.remark || 'ไม่มีบันทึกข้อความ'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Customer signature card */}
                        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-2">
                          <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <span>✍️</span> ลายเซ็นลูกค้า (ยืนยันส่งคืน)
                          </h4>
                          <div className="bg-white rounded-xl p-3 border border-slate-200 max-w-[240px] mx-auto">
                            {inspectionDetail.photos.some(p => p.category === 'SIGNATURE') ? (
                              inspectionDetail.photos
                                .filter(p => p.category === 'SIGNATURE')
                                .map((sig, i) => (
                                  <img
                                    key={i}
                                    src={`${SPACES_CDN}/${sig.s3Key}`}
                                    alt="Customer Signature"
                                    className="max-h-28 mx-auto object-contain cursor-pointer hover:opacity-90 animate-fade-in"
                                    onClick={() => setLightboxUrl(`${SPACES_CDN}/${sig.s3Key}`)}
                                  />
                                ))
                            ) : (
                              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                                ไม่พบลายเซ็นลูกค้าในระบบ
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                    {/* CHECKLIST TAB */}
                    {activeTab === 'checklist' && (
                      <div className="space-y-4">
                        {dynamicSections.map(section => {
                          return (
                            <div key={section.category} className="bg-slate-950/30 border border-slate-800 rounded-2xl overflow-hidden">
                              {/* Section Header */}
                              <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                                <span className="text-sm">{section.icon}</span>
                                <h4 className="text-xs font-bold text-slate-200">{section.label}</h4>
                              </div>

                              {/* Section Items */}
                              <div className="divide-y divide-slate-800/40">
                                {section.items.map(itemDef => {
                                  const savedItem = inspectionDetail.items.find(
                                    i => i.category === section.category && i.itemCode === itemDef.itemCode
                                  )
                                  const hasSavedValue = !!savedItem
                                  
                                  // Style values
                                  let valLabel = '-'
                                  let valStyle = 'text-slate-500'

                                  if (hasSavedValue) {
                                    if (itemDef.inputType === 'select') {
                                      const opt = itemDef.options?.find(o => o.value === savedItem.value)
                                      valLabel = opt ? opt.label : (savedItem.value || '-')
                                      valStyle = 'text-slate-100 font-bold'
                                    } else if (itemDef.inputType === 'three_way') {
                                      if (savedItem.value === 'NORMAL') {
                                        valLabel = 'ปกติ'
                                        valStyle = 'text-emerald-400 font-bold'
                                      } else if (savedItem.value === 'SCRATCH') {
                                        valLabel = 'มีรอยขีดข่วน ⚠️'
                                        valStyle = 'text-amber-400 font-bold'
                                      } else if (savedItem.value === 'DENT') {
                                        valLabel = 'บุบ-แตก ⚠️'
                                        valStyle = 'text-rose-400 font-bold'
                                      }
                                    } else if (itemDef.inputType === 'number') {
                                      valLabel = savedItem.numericValue != null ? String(savedItem.numericValue) : '-'
                                      valStyle = 'text-slate-100 font-mono font-bold'
                                    } else {
                                      // Boolean / Expiry type
                                      if (savedItem.value === 'YES') {
                                        valLabel = section.category === 'ACCIDENT' ? 'มี ⚠️' : 'มี'
                                        valStyle = section.category === 'ACCIDENT' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'
                                      } else if (savedItem.value === 'NO') {
                                        valLabel = section.category === 'ACCIDENT' ? 'ไม่มี' : 'ไม่มี ⚠️'
                                        valStyle = section.category === 'ACCIDENT' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'
                                      }
                                    }
                                  }

                                  return (
                                    <div key={itemDef.itemCode} className="px-4 py-3 flex items-center justify-between gap-4">
                                      <div className="space-y-0.5">
                                        <p className="text-xs font-semibold text-slate-300">{itemDef.label}</p>
                                        {savedItem?.detail && (
                                          <p className="text-[10px] text-slate-500 italic bg-slate-900 px-2 py-0.5 rounded border border-slate-800 mt-1 inline-block">
                                            โน้ต: {savedItem.detail}
                                          </p>
                                        )}
                                        {savedItem?.expiryDate && (
                                          <p className="text-[9px] text-slate-400 font-medium">วันหมดอายุ: {getThaiDate(savedItem.expiryDate)}</p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className={`text-xs ${valStyle}`}>{valLabel}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* PHOTOS TAB */}
                    {activeTab === 'photos' && (
                      <div className="space-y-4">
                        {inspectionDetail.photos.filter(p => p.category !== 'SIGNATURE').length > 0 ? (
                          <div className="grid grid-cols-3 gap-3">
                            {inspectionDetail.photos
                              .filter(p => p.category !== 'SIGNATURE')
                              .map((photo, i) => {
                                const matchedSection = dynamicSections.find(s => s.category === photo.category)
                                const matchedItem = matchedSection?.items.find(item => item.itemCode === photo.itemCode)
                                const itemLabel = matchedItem ? matchedItem.label : photo.category

                                return (
                                  <div
                                    key={photo.inspectionPhotoId || i}
                                    className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-slate-700 transition"
                                  >
                                    <div className="relative aspect-square bg-slate-950 overflow-hidden">
                                      <img
                                        src={`${SPACES_CDN}/${photo.s3Key}`}
                                        alt=""
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                                        onClick={() => setLightboxUrl(`${SPACES_CDN}/${photo.s3Key}`)}
                                      />
                                    </div>
                                    <div className="p-2 space-y-0.5 bg-slate-950/20 text-[9px] leading-tight">
                                      <p className="font-bold text-slate-300 truncate">{itemLabel}</p>
                                      {photo.photoPosition && (
                                        <span className="px-1 py-0.5 bg-slate-800 rounded text-slate-400 font-extrabold">{photo.photoPosition}</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        ) : (
                          <div className="py-12 text-center text-xs text-slate-500 font-medium bg-slate-950/20 border border-slate-800/85 rounded-2xl">
                            ไม่มีรูปภาพตรวจสภาพประกอบเอกสารนี้
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Print / Save PDF Actions footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition active:scale-95 flex items-center gap-1"
                    >
                      <span>🖨️</span> พิมพ์เอกสารรายงาน
                    </button>
                    <button
                      onClick={() => setSelectedInspectionId(null)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition active:scale-95"
                    >
                      ปิดหน้ารายงาน
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        )}

        {/* Image Lightbox Modal */}
        {lightboxUrl && (
          <div
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxUrl(null)}
          >
            <div className="relative max-w-4xl max-h-[85vh]">
              <img
                src={lightboxUrl}
                alt="Enlarged view"
                className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800"
              />
              <button
                onClick={() => setLightboxUrl(null)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
              >
                ✕
              </button>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  )
}
