'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { getStatusStyle } from '@/lib/audit-status'

interface AuditSessionOption {
  AuditSessionID: number
  AuditDate: string
  Location: string
  LocationName?: string
  Status: string
  CreatedBy: string
  CheckedCount: number
}

interface TargetSessionDetail {
  AuditSessionID: number
  AuditDate: string
  Location: string
  LocationName?: string
  Status: string
  CreatedBy: string
  Notes?: string
}

interface MissingVehicle {
  InventoryItemID: string
  RegisterNo: string
  VinNo: string
  Model: string
  Exterior_Color: string
  Status: string
  StatusType: string
  StatusThai: string
  CurrentLocation: string
  CurrentLocationName: string
  StockLocation: string
  Company: string
  ProjectType?: string
  PrevAuditRow?: string
  PrevAuditSlot?: string
  PrevScanTime?: string
  ScannedInPrevSession: number
}

interface MismatchedVehicle {
  InventoryItemID: string
  RegisterNo: string
  VinNo: string
  Status: string
  StatusType: string
  StatusThai: string
  CurrentLocation: string
  CurrentLocationName: string
  AuditLocation: string
  AuditLocationName: string
  Model?: string
  Exterior_Color?: string
  Company?: string
  ProjectType?: string
  AuditRow?: string
  AuditSlot?: string
  SlotPosition?: number | null
  ScanTime?: string
  AuditedBy?: string
  DetectedStatus?: string
}

interface StatusSummary {
  Status: string
  StatusType: string
  StatusThai: string
  Count: number
}

function getThaiDate(dateStr: string): string {
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
    return dateStr
  }
}

function MissingAuditContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialSessionId = searchParams.get('sessionId') || ''
  const initialTab = searchParams.get('tab') === 'missing' ? 'missing' : 'mismatch'

  // Active Report Tab: 'mismatch' (พิกัดไม่ตรง) or 'missing' (รถที่ไม่อยู่ตามการตรวจ)
  const [activeTab, setActiveTab] = useState<'mismatch' | 'missing'>(initialTab)

  const [sessions, setSessions] = useState<AuditSessionOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>(initialSessionId)
  const [manualSessionInput, setManualSessionInput] = useState<string>(initialSessionId)
  const [sessionDetail, setSessionDetail] = useState<TargetSessionDetail | null>(null)
  const [prevSessionId, setPrevSessionId] = useState<number | null>(null)

  const [missingVehicles, setMissingVehicles] = useState<MissingVehicle[]>([])
  const [mismatchedVehicles, setMismatchedVehicles] = useState<MismatchedVehicle[]>([])
  const [totalInLocation, setTotalInLocation] = useState<number>(0)
  const [auditedCount, setAuditedCount] = useState<number>(0)
  const [allMissingCount, setAllMissingCount] = useState<number>(0)
  const [allMismatchCount, setAllMismatchCount] = useState<number>(0)
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([])
  const [mismatchStatusSummary, setMismatchStatusSummary] = useState<StatusSummary[]>([])

  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedVin, setCopiedVin] = useState<string | null>(null)

  // Fetch report data
  const fetchReport = async (sessionId?: string, keyword?: string, status?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sessionId) params.set('sessionId', sessionId)
      if (keyword) params.set('search', keyword)
      if (status && status !== 'ALL') params.set('status', status)

      const res = await fetch(`/api/audit/missing?${params.toString()}`)
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลรายงานได้')

      const data = await res.json()
      setSessions(data.sessions || [])
      setSessionDetail(data.session || null)
      setPrevSessionId(data.prevSessionId || null)
      setMissingVehicles(data.missingVehicles || [])
      setMismatchedVehicles(data.mismatchedVehicles || [])
      setTotalInLocation(data.totalInLocation || 0)
      setAuditedCount(data.auditedCount || 0)
      setAllMissingCount(data.allMissingCount || 0)
      setAllMismatchCount(data.allMismatchCount || 0)
      setStatusSummary(data.statusSummary || [])
      setMismatchStatusSummary(data.mismatchStatusSummary || [])

      if (data.session?.AuditSessionID) {
        const idStr = String(data.session.AuditSessionID)
        setSelectedSessionId(idStr)
        setManualSessionInput(idStr)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport(initialSessionId)
  }, [initialSessionId])

  // Handle Session Change
  const handleSessionChange = (newSessionId: string) => {
    setSelectedSessionId(newSessionId)
    setManualSessionInput(newSessionId)
    fetchReport(newSessionId, searchKeyword, selectedStatus)
    router.replace(`/audit/missing?sessionId=${newSessionId}&tab=${activeTab}`, { scroll: false })
  }

  // Handle manual input search
  const handleManualSessionSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualSessionInput.trim()) {
      handleSessionChange(manualSessionInput.trim())
    }
  }

  // Handle Search Input
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchReport(selectedSessionId, searchKeyword, selectedStatus)
  }

  // Handle Status Pill Click
  const handleStatusFilterClick = (statusKey: string) => {
    const newStatus = selectedStatus === statusKey ? 'ALL' : statusKey
    setSelectedStatus(newStatus)
    fetchReport(selectedSessionId, searchKeyword, newStatus)
  }

  // Copy VIN to clipboard
  const copyToClipboard = (vin: string) => {
    navigator.clipboard.writeText(vin)
    setCopiedVin(vin)
    setTimeout(() => setCopiedVin(null), 2000)
  }

  // Export to Excel for Location Mismatch (Query: ทะเบียน, VIN, สถานะหลัก, สถานะย่อย, พิกัดปัจจุบันในระบบ, พิกัดที่ตรวจพบ)
  const handleExportMismatchExcel = () => {
    if (mismatchedVehicles.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก')
      return
    }

    const sessionLocation = sessionDetail?.LocationName || sessionDetail?.Location || 'พระประแดง'
    const sessionDate = sessionDetail?.AuditDate ? getThaiDate(sessionDetail.AuditDate) : '-'
    const sessionId = sessionDetail?.AuditSessionID || selectedSessionId

    // Header info rows
    const headerRows = [
      ['รายงานรถที่จอดอยู่ตามรอบ Audit แต่พิกัดในระบบไม่ตรง (Location Mismatch Report)'],
      [`รอบการตรวจ (Session ID): ${sessionId}`, `วันที่ตรวจ: ${sessionDate}`, `สถานที่ตรวจ: ${sessionLocation}`],
      [`จำนวนรถที่พิกัดไม่ตรงทั้งหมด: ${mismatchedVehicles.length} คัน`, `วันที่ส่งออกข้อมูล: ${new Date().toLocaleString('th-TH')}`],
      [] // empty row
    ]

    // Table data matching exact user query format: ทะเบียน, VIN, สถานะหลัก, สถานะย่อย, Project Type, พิกัดปัจจุบันในระบบ, พิกัดที่ตรวจพบ
    const tableData = mismatchedVehicles.map((v, idx) => ({
      'ลำดับ': idx + 1,
      'ทะเบียน': v.RegisterNo || 'รถใหม่',
      'VIN': v.VinNo,
      'สถานะหลัก': v.Status || '-',
      'สถานะย่อย': v.StatusType || '-',
      'Project Type': v.ProjectType || '-',
      'แถว': v.AuditRow || '-',
      'ช่อง': !v.AuditRow ? '-' : v.AuditSlot ? v.AuditSlot : '(นอกช่อง)',
      'ซ้อนคัน': v.SlotPosition === 1 ? 'ซ้อนคัน' : '-',
      'พิกัดปัจจุบันในระบบ': v.CurrentLocation || 'ไม่ระบุ',
      [`พิกัดที่ตรวจพบ (Session ${sessionId})`]: v.AuditLocation || sessionLocation
    }))

    const ws = XLSX.utils.aoa_to_sheet(headerRows)
    XLSX.utils.sheet_add_json(ws, tableData, { origin: `A${headerRows.length + 1}` })

    // Column widths
    ws['!cols'] = [
      { wch: 8 },  // ลำดับ
      { wch: 16 }, // ทะเบียน
      { wch: 22 }, // VIN
      { wch: 18 }, // สถานะหลัก
      { wch: 24 }, // สถานะย่อย
      { wch: 18 }, // Project Type
      { wch: 12 }, // แถว
      { wch: 14 }, // ช่อง
      { wch: 12 }, // ซ้อนคัน
      { wch: 28 }, // พิกัดปัจจุบันในระบบ
      { wch: 30 }, // พิกัดที่ตรวจพบ
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Location Mismatch')
    XLSX.writeFile(wb, `รายงานรถพิกัดไม่ตรง_Session_${sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Export to Excel for Missing Vehicles
  const handleExportMissingExcel = () => {
    if (missingVehicles.length === 0) {
      alert('ไม่มีข้อมูลสำหรับส่งออก')
      return
    }

    const sessionLocation = sessionDetail?.LocationName || sessionDetail?.Location || 'พระประแดง'
    const sessionDate = sessionDetail?.AuditDate ? getThaiDate(sessionDetail.AuditDate) : '-'
    const sessionId = sessionDetail?.AuditSessionID || selectedSessionId

    const headerRows = [
      ['รายงานรถที่ไม่อยู่ตามการตรวจ (Missing from Audit Report)'],
      [`รอบการตรวจ (Session ID): ${sessionId}`, `วันที่ตรวจ: ${sessionDate}`, `สถานที่: ${sessionLocation}`],
      [`จำนวนรถในระบบทั้งหมด: ${totalInLocation} คัน`, `ตรวจพบแล้ว: ${auditedCount} คัน`, `ไม่อยู่ตามการตรวจ: ${missingVehicles.length} คัน`],
      [`วันที่ออกรายงาน: ${new Date().toLocaleString('th-TH')}`],
      []
    ]

    const tableData = missingVehicles.map((v, idx) => ({
      'ลำดับ': idx + 1,
      'ทะเบียนรถ': v.RegisterNo || 'ไม่มีทะเบียน',
      'เลขตัวถัง (VIN)': v.VinNo,
      'รุ่นรถ': v.Model || '-',
      'Project Type': v.ProjectType || '-',
      'สถานะรถ': v.StatusThai || v.StatusType || v.Status || '-',
      'สถานะย่อย (Code)': v.StatusType || '-',
      'สถานะหลัก (Code)': v.Status || '-',
      'พิกัดในระบบ (CurrentLocation)': v.CurrentLocationName || v.CurrentLocation || '-',
      'บริษัท/โครงการ': v.Company || '-',
      'ประวัติรอบก่อนหน้า': v.ScannedInPrevSession ? `เคยพบใน Session ${prevSessionId} (${v.PrevAuditRow || ''} ${v.PrevAuditSlot ? 'ช่อง ' + v.PrevAuditSlot : ''})` : 'ไม่พบในรอบก่อนหน้า'
    }))

    const ws = XLSX.utils.aoa_to_sheet(headerRows)
    XLSX.utils.sheet_add_json(ws, tableData, { origin: `A${headerRows.length + 1}` })

    ws['!cols'] = [
      { wch: 8 },  // ลำดับ
      { wch: 16 }, // ทะเบียน
      { wch: 22 }, // VIN
      { wch: 20 }, // รุ่นรถ
      { wch: 18 }, // Project Type
      { wch: 22 }, // สถานะภาษาไทย
      { wch: 24 }, // StatusType
      { wch: 18 }, // Status
      { wch: 25 }, // พิกัด
      { wch: 18 }, // บริษัท
      { wch: 35 }, // ประวัติรอบก่อน
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Missing Vehicles')
    XLSX.writeFile(wb, `รายงานรถที่ไม่อยู่ตามการตรวจ_Session_${sessionId}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Active status summary list
  const currentStatusSummary = activeTab === 'mismatch' ? mismatchStatusSummary : statusSummary
  const currentTotalCount = activeTab === 'mismatch' ? allMismatchCount : allMissingCount

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16 font-sans">
      {/* Top Header */}
      <div className="bg-slate-900/90 border-b border-indigo-500/20 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/audit"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition duration-150 flex items-center justify-center text-sm border border-slate-700"
              title="กลับหน้ารวม Stock Audit"
            >
              ⬅️ รวมรอบตรวจ
            </Link>
            {sessionDetail?.AuditSessionID && (
              <Link
                href={`/audit/${sessionDetail.AuditSessionID}`}
                className="p-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold transition duration-150 flex items-center gap-1.5 text-sm border border-slate-700"
                title="ไปหน้าสแกนรอบนี้"
              >
                🔍 หน้าสแกน #{sessionDetail.AuditSessionID}
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeTab === 'mismatch' ? '🔄' : '⚠️'}</span>
                <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-amber-400 via-rose-300 to-cyan-400 bg-clip-text text-transparent">
                  {activeTab === 'mismatch' ? 'รายงานรถพิกัดในระบบไม่ตรง (Location Mismatch)' : 'รายงานรถที่ไม่อยู่ตามการตรวจ (Missing)'}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === 'mismatch'
                  ? 'รถที่สแกนพบในรอบ Audit แต่พิกัดใน Inventory (CurrentLocation) ไม่ตรงกับสถานที่ตรวจ'
                  : 'รายการรถที่พิกัดในระบบระบุว่าอยู่ที่ลาน แต่ไม่ถูกสแกนตรวจพบในรอบ Audit'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchReport(selectedSessionId, searchKeyword, selectedStatus)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition duration-150 border border-slate-700 flex items-center gap-1.5 shadow-sm"
            >
              <span className={loading ? 'animate-spin' : ''}>🔄</span> รีเฟรช
            </button>
            <button
              onClick={activeTab === 'mismatch' ? handleExportMismatchExcel : handleExportMissingExcel}
              disabled={loading || (activeTab === 'mismatch' ? mismatchedVehicles.length === 0 : missingVehicles.length === 0)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition duration-150 flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>📥</span> ส่งออก Excel (.xlsx)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Tab Switcher */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <button
            onClick={() => {
              setActiveTab('mismatch')
              router.replace(`/audit/missing?sessionId=${selectedSessionId}&tab=mismatch`, { scroll: false })
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition duration-150 flex items-center gap-2 border ${
              activeTab === 'mismatch'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-md ring-1 ring-amber-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>🔄</span>
            <span>รถที่พิกัดไม่ตรง (Location Mismatch)</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-950/60 text-[11px] font-bold text-amber-400">
              {allMismatchCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('missing')
              router.replace(`/audit/missing?sessionId=${selectedSessionId}&tab=missing`, { scroll: false })
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition duration-150 flex items-center gap-2 border ${
              activeTab === 'missing'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-md ring-1 ring-rose-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <span>⚠️</span>
            <span>รถที่ไม่อยู่ตามการตรวจ (Missing)</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-950/60 text-[11px] font-bold text-rose-400">
              {allMissingCount}
            </span>
          </button>
        </div>

        {/* Filters and Session Selector Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* 1. Dropdown Select Audit Session */}
            <div className="md:col-span-5 space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>🎯 เลือกรอบการตรวจ (Audit Session)</span>
                <span className="text-[10px] text-cyan-400 font-normal">ทั้งหมด {sessions.length} รอบ</span>
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => handleSessionChange(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition duration-150"
              >
                {sessions.map((s) => (
                  <option key={s.AuditSessionID} value={s.AuditSessionID}>
                    ID: {s.AuditSessionID} — {getThaiDate(s.AuditDate)} | {s.LocationName || s.Location} ({s.CheckedCount} คัน) [{s.Status}]
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Manual Session ID Input Box */}
            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                🔢 ระบุเลข Session ID โดยตรง
              </label>
              <form onSubmit={handleManualSessionSubmit} className="flex gap-2">
                <input
                  type="number"
                  placeholder="เช่น 18"
                  value={manualSessionInput}
                  onChange={(e) => setManualSessionInput(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition duration-150"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition duration-150 shrink-0 shadow-sm"
                >
                  ค้นหา ID
                </button>
              </form>
            </div>

            {/* 3. Search Keyword Input */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-300">
                🔎 ค้นหาทะเบียน / VIN / รุ่น / บริษัท
              </label>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="พิมพ์ทะเบียน, VIN..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  className="w-full bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition duration-150"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold transition duration-150 shrink-0"
                >
                  ค้นหา
                </button>
              </form>
            </div>
          </div>

          {/* Session Summary Info Banner */}
          {sessionDetail && (
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                <span className="text-slate-200 font-bold">
                  📍 สถานที่ตรวจ: <span className="text-cyan-300">{sessionDetail.LocationName || sessionDetail.Location}</span>
                </span>
                <span>📅 วันที่: <span className="text-slate-200">{getThaiDate(sessionDetail.AuditDate)}</span></span>
                <span>👤 ผู้สร้างรอบ: <span className="text-slate-200">{sessionDetail.CreatedBy}</span></span>
                <span>
                  สถานะรอบ: <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    sessionDetail.Status === 'DRAFT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>{sessionDetail.Status}</span>
                </span>
              </div>

              {sessionDetail.Notes && (
                <div className="text-[11px] text-slate-500 italic">
                  หมายเหตุ: {sessionDetail.Notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Statistics KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
            <div className="text-2xl sm:text-3xl font-black text-slate-100">{totalInLocation}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-1">🚗 รถทั้งหมดในพิกัดนี้</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ในฐานข้อมูลระบบสต็อก</div>
          </div>

          <div className="bg-slate-900/70 border border-emerald-500/20 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{auditedCount}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-1">✅ ตรวจเช็คเจอแล้ว</div>
            <div className="text-[10px] text-emerald-400/80 mt-0.5">ในรอบ Audit #{selectedSessionId}</div>
          </div>

          <div className={`bg-slate-900/70 border rounded-2xl p-4 shadow-sm backdrop-blur-sm ${
            activeTab === 'mismatch'
              ? 'border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-transparent'
              : 'border-rose-500/30 bg-gradient-to-br from-rose-950/20 to-transparent'
          }`}>
            <div className={`text-2xl sm:text-3xl font-black ${activeTab === 'mismatch' ? 'text-amber-400' : 'text-rose-400'}`}>
              {activeTab === 'mismatch' ? allMismatchCount : allMissingCount}
            </div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-1">
              {activeTab === 'mismatch' ? '🔄 รถที่พิกัดไม่ตรง' : '⚠️ รถที่ไม่อยู่ตามการตรวจ'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {activeTab === 'mismatch' ? 'พบในลานแต่พิกัดเดิมไม่ใช่' : 'มีในระบบแต่ยังไม่พบ'}
            </div>
          </div>

          <div className="bg-slate-900/70 border border-cyan-500/20 rounded-2xl p-4 shadow-sm backdrop-blur-sm">
            <div className="text-2xl sm:text-3xl font-black text-cyan-400">
              {activeTab === 'mismatch' ? mismatchedVehicles.length : missingVehicles.length}
            </div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mt-1">📋 รายการที่แสดงอยู่</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ตามตัวกรองที่เลือก</div>
          </div>
        </div>

        {/* Status Breakdown Pills */}
        {currentStatusSummary.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>📊 สรุปจำนวนรถแยกตามสถานะ (คลิกเพื่อกรอง)</span>
              {selectedStatus !== 'ALL' && (
                <button
                  onClick={() => handleStatusFilterClick('ALL')}
                  className="text-xs text-cyan-400 hover:underline font-normal"
                >
                  ล้างตัวกรองสถานะ
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleStatusFilterClick('ALL')}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition duration-150 ${
                  selectedStatus === 'ALL'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                ทั้งหมด ({currentTotalCount})
              </button>

              {currentStatusSummary.map((item) => {
                const statusKey = item.StatusType || item.Status
                const style = getStatusStyle(item.StatusThai || item.Status)
                const isSelected = selectedStatus === statusKey || selectedStatus === item.Status

                return (
                  <button
                    key={`${item.Status}-${item.StatusType}`}
                    onClick={() => handleStatusFilterClick(statusKey)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition duration-150 flex items-center gap-1.5 ${
                      isSelected
                        ? `${style.bg} ${style.border} ${style.text} ring-2 ring-cyan-500/50 shadow-md`
                        : `${style.bg} ${style.border} ${style.text} opacity-80 hover:opacity-100`
                    }`}
                  >
                    <span>{style.label}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-950/40 text-[10px]">
                      {item.Count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tab 1: Mismatched Vehicles Table (ตาม Query ของผู้ใช้) */}
        {activeTab === 'mismatch' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>🔄 รายการรถที่พิกัดในระบบไม่ตรงกับที่ตรวจพบ</span>
                <span className="text-xs font-normal text-slate-400">({mismatchedVehicles.length} คัน)</span>
              </h2>
              {copiedVin && (
                <span className="text-xs text-emerald-400 font-bold animate-pulse">
                  ✅ คัดลอก VIN {copiedVin} แล้ว!
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
                <div className="text-sm text-slate-400 font-medium">กำลังรวบรวมข้อมูล...</div>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-400 text-sm">
                ❌ {error}
              </div>
            ) : mismatchedVehicles.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <div className="text-4xl">🎉</div>
                <div className="text-base font-bold text-slate-200">ไม่พบรถที่พิกัดไม่ตรงตามเงื่อนไข</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  รถทั้งหมดที่สแกนเจอตรงกับพิกัดในระบบ หรือไม่มีรายการที่ตรงกับคำค้นหา
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/60 border-b border-slate-700/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-3.5 w-12 text-center">#</th>
                      <th className="py-3 px-3.5">ทะเบียน</th>
                      <th className="py-3 px-3.5">VIN</th>
                      <th className="py-3 px-3.5">สถานะหลัก</th>
                      <th className="py-3 px-3.5">สถานะย่อย</th>
                      <th className="py-3 px-3.5">Project Type</th>
                      <th className="py-3 px-3.5">พิกัดปัจจุบันในระบบ</th>
                      <th className="py-3 px-3.5">พิกัดที่ตรวจพบ (Session {selectedSessionId})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {mismatchedVehicles.map((v, idx) => {
                      const style = getStatusStyle(v.StatusThai || v.StatusType || v.Status)
                      const isNewCar = !v.RegisterNo || v.RegisterNo === 'รถใหม่' || v.RegisterNo.trim() === ''

                      return (
                        <tr
                          key={v.VinNo || idx}
                          className="hover:bg-slate-800/40 transition duration-150"
                        >
                          <td className="py-3 px-3.5 text-center text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5 font-bold">
                            {isNewCar ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
                                รถใหม่
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs font-black shadow-sm tracking-wide">
                                {v.RegisterNo}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-300 text-xs select-all">
                                {v.VinNo}
                              </span>
                              <button
                                onClick={() => copyToClipboard(v.VinNo)}
                                className="text-slate-500 hover:text-cyan-400 transition text-xs p-1"
                                title="คัดลอก VIN"
                              >
                                📋
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-bold text-[11px]">
                              {v.Status || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${style.bg} ${style.border} ${style.text}`}>
                              {v.StatusType || style.label || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-bold text-[11px]">
                              {v.ProjectType || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-mono text-rose-400 font-bold text-[11px]">
                              {v.CurrentLocation || 'ไม่ระบุ'}
                            </div>
                            {v.CurrentLocationName && v.CurrentLocationName !== v.CurrentLocation && (
                              <div className="text-[10px] text-slate-400">
                                {v.CurrentLocationName}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-mono text-emerald-400 font-bold text-[11px]">
                              {v.AuditLocation || sessionDetail?.Location || '-'}
                            </div>
                            {v.AuditLocationName && v.AuditLocationName !== v.AuditLocation && (
                              <div className="text-[10px] text-emerald-400/80">
                                {v.AuditLocationName}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Missing Vehicles Table */}
        {activeTab === 'missing' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <span>⚠️ รายการรถที่ตกหล่น</span>
                <span className="text-xs font-normal text-slate-400">({missingVehicles.length} คัน)</span>
              </h2>
              {copiedVin && (
                <span className="text-xs text-emerald-400 font-bold animate-pulse">
                  ✅ คัดลอก VIN {copiedVin} แล้ว!
                </span>
              )}
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
                <div className="text-sm text-slate-400 font-medium">กำลังรวบรวมข้อมูลรถที่ตกหล่น...</div>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-rose-400 text-sm">
                ❌ {error}
              </div>
            ) : missingVehicles.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2">
                <div className="text-4xl">🎉</div>
                <div className="text-base font-bold text-slate-200">ไม่พบรถที่ตกหล่นตามเงื่อนไขที่เลือก</div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  รถทั้งหมดในระบบได้รับการตรวจเช็คครบถ้วน หรือไม่มีรายการที่ตรงกับคำค้นหา
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800/60 border-b border-slate-700/60 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-3.5 w-12 text-center">#</th>
                      <th className="py-3 px-3.5">ทะเบียนรถ</th>
                      <th className="py-3 px-3.5">เลขตัวถัง (VIN)</th>
                      <th className="py-3 px-3.5">รุ่นรถ</th>
                      <th className="py-3 px-3.5">Project Type</th>
                      <th className="py-3 px-3.5">สถานะในระบบ</th>
                      <th className="py-3 px-3.5">พิกัดในระบบ</th>
                      <th className="py-3 px-3.5">บริษัท / โครงการ</th>
                      <th className="py-3 px-3.5">ประวัติรอบก่อนหน้า</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {missingVehicles.map((v, idx) => {
                      const style = getStatusStyle(v.StatusThai || v.StatusType || v.Status)
                      const isNewCar = !v.RegisterNo || v.RegisterNo === 'รถใหม่' || v.RegisterNo.trim() === ''

                      return (
                        <tr
                          key={v.VinNo || idx}
                          className="hover:bg-slate-800/40 transition duration-150"
                        >
                          <td className="py-3 px-3.5 text-center text-slate-500 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3.5 font-bold">
                            {isNewCar ? (
                              <span className="inline-block px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
                                รถใหม่ (ไม่มีทะเบียน)
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-100 text-xs font-black shadow-sm tracking-wide">
                                {v.RegisterNo}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-300 text-xs select-all">
                                {v.VinNo}
                              </span>
                              <button
                                onClick={() => copyToClipboard(v.VinNo)}
                                className="text-slate-500 hover:text-cyan-400 transition text-xs p-1"
                                title="คัดลอก VIN"
                              >
                                📋
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3.5">
                            <div className="font-bold text-slate-200">{v.Model || '-'}</div>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className="inline-block px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-bold text-[11px]">
                              {v.ProjectType || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${style.bg} ${style.border} ${style.text}`}>
                              {style.label}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-slate-300 text-[11px]">
                            {v.CurrentLocationName || v.CurrentLocation || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-slate-400 text-[11px]">
                            {v.Company || '-'}
                          </td>
                          <td className="py-3 px-3.5">
                            {v.ScannedInPrevSession ? (
                              <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                                <span>✅ พบใน Session {prevSessionId}</span>
                                {(v.PrevAuditRow || v.PrevAuditSlot) && (
                                  <span className="text-[10px] text-slate-400">
                                    ({v.PrevAuditRow || ''} {v.PrevAuditSlot ? `ช่อง ${v.PrevAuditSlot}` : ''})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500">
                                - ไม่พบในรอบก่อน
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function MissingAuditReportPage() {
  return (
    <AuthGuard>
      <Suspense fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
        </div>
      }>
        <MissingAuditContent />
      </Suspense>
    </AuthGuard>
  )
}
