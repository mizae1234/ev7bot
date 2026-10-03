'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { VehicleSearchWithScanner, type DbCar } from '@/components/vehicle/VehicleSearchWithScanner'
import { AuditChecklistForm } from '@/components/inspection-audit/AuditChecklistForm'
import { 
  QC_CHECKLIST_SECTIONS, 
  createEmptyQCItems, 
  buildDynamicSections, 
  createEmptyItemsFromMaster 
} from '@/lib/inspection/checklist-config'
import { QCRecord, QCDatePreset, QCViewMode, QCStatusFilter } from '@/components/inspection-audit/types'
import {
  getBangkokTodayYMD,
  getYesterdayBangkokYMD,
  getSevenDaysAgoBangkokYMD,
  getInspectionDateYMD,
  maskStaffName,
  getThaiDate,
  getQCItemLabel,
  getSpacesCDN,
} from '@/components/inspection-audit/qc-helpers'
import { QCExecutiveKPIs } from '@/components/inspection-audit/QCExecutiveKPIs'
import { QCFilterBar } from '@/components/inspection-audit/QCFilterBar'
import { QCCardsGrid } from '@/components/inspection-audit/QCCardsGrid'
import { QCTableView } from '@/components/inspection-audit/QCTableView'
import { QCDetailModal } from '@/components/inspection-audit/QCDetailModal'

const SPACES_CDN = getSpacesCDN()

interface AuditSession {
  inspectionSessionId: number
  sessionName: string
  sessionDate: string
  location: string
  locationName?: string
  status: 'OPEN' | 'CLOSED'
  notes?: string
  createdBy: string
  creatorName?: string | null
  inspectionCount: number
}

export default function InspectionAuditPage() {
  const router = useRouter()

  // Tabs: 'sessions' vs 'qc_records' (Default: Delivery QC)
  const [activeTab, setActiveTab] = useState<'sessions' | 'qc_records'>('qc_records')

  // Sessions State
  const [sessions, setSessions] = useState<AuditSession[]>([])
  const [locations, setLocations] = useState<Array<{ code: string; name: string }>>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // QC History State
  const [qcRecords, setQcRecords] = useState<QCRecord[]>([])
  const [loadingQC, setLoadingQC] = useState(false)
  const [selectedQCDetail, setSelectedQCDetail] = useState<any | null>(null)
  const [loadingQCDetail, setLoadingQCDetail] = useState(false)
  const [qcMasterItems, setQcMasterItems] = useState<any[]>([])

  // QC Filter State (Default: Today in Bangkok Time)
  const [qcDatePreset, setQcDatePreset] = useState<'today' | 'yesterday' | '7days' | 'all' | 'custom'>('today')
  const [qcFilterPlate, setQcFilterPlate] = useState('')
  const [qcFilterDate, setQcFilterDate] = useState(getBangkokTodayYMD())
  const [qcFilterStatus, setQcFilterStatus] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL')
  const [qcViewMode, setQcViewMode] = useState<'cards' | 'table'>('cards')

  const filteredQCRecords = useMemo(() => {
    const todayStr = getBangkokTodayYMD()
    const yesterdayStr = getYesterdayBangkokYMD()
    const sevenDaysAgoStr = getSevenDaysAgoBangkokYMD()

    return qcRecords.filter(item => {
      // Plate / VIN filter
      if (qcFilterPlate.trim()) {
        const query = qcFilterPlate.trim().toLowerCase().replace(/[-\s]/g, '')
        const plate = (item.registerNo || '').toLowerCase().replace(/[-\s]/g, '')
        const vin = (item.vinNo || '').toLowerCase()
        if (!plate.includes(query) && !vin.includes(query)) {
          return false
        }
      }

      // Date filtering based on preset
      const itemDateStr = getInspectionDateYMD(item.inspectionDate)
      if (qcDatePreset === 'today') {
        if (itemDateStr !== todayStr) return false
      } else if (qcDatePreset === 'yesterday') {
        if (itemDateStr !== yesterdayStr) return false
      } else if (qcDatePreset === '7days') {
        if (!itemDateStr || itemDateStr < sevenDaysAgoStr) return false
      } else if (qcDatePreset === 'custom' && qcFilterDate) {
        if (itemDateStr !== qcFilterDate) return false
      }

      // Status filter
      if (qcFilterStatus === 'PASS') {
        const isPassed = item.assessmentResult === 'NORMAL' || (item.remark && !item.remark.includes('ไม่ผ่าน'))
        if (!isPassed) return false
      } else if (qcFilterStatus === 'FAIL') {
        const isPassed = item.assessmentResult === 'NORMAL' || (item.remark && !item.remark.includes('ไม่ผ่าน'))
        if (isPassed) return false
      }

      return true
    })
  }, [qcRecords, qcFilterPlate, qcFilterDate, qcDatePreset, qcFilterStatus])

  // KPI Summary for current filtered records
  const qcKPIs = useMemo(() => {
    const total = filteredQCRecords.length
    let passed = 0
    let failed = 0
    let totalSoc = 0
    let socCount = 0

    filteredQCRecords.forEach(item => {
      const isPassed = item.assessmentResult === 'NORMAL' || (item.remark && !item.remark.includes('ไม่ผ่าน'))
      if (isPassed) passed++
      else failed++

      const batteryItem = item.items?.find((it: any) => it.category === 'QC_BATTERY_HV')
      if (batteryItem?.numericValue != null && !isNaN(Number(batteryItem.numericValue))) {
        totalSoc += Number(batteryItem.numericValue)
        socCount++
      }
    })

    const avgBattery = socCount > 0 ? Math.round(totalSoc / socCount) : null

    return { total, passed, failed, avgBattery }
  }, [filteredQCRecords])

  const handleViewQCDetail = async (item: any) => {
    setSelectedQCDetail(item)
    setLoadingQCDetail(true)
    try {
      const res = await fetch(`/api/inspection/${item.inspectionId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.inspection) {
          setSelectedQCDetail(data.inspection)
        }
      }
    } catch (err) {
      console.error('Failed to fetch inspection detail:', err)
    } finally {
      setLoadingQCDetail(false)
    }
  }

  // Auth User Profile State
  const [profile, setProfile] = useState<{ userId: string; displayName: string } | null>(null)

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Create Session Modal State
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submittingSession, setSubmittingSession] = useState(false)

  // Standalone QC Modal State
  const [isQCModalOpen, setIsQCModalOpen] = useState(false)
  const [selectedQCCar, setSelectedQCCar] = useState<DbCar | null>(null)
  const [qcFormItems, setQcFormItems] = useState<Record<string, any>>({})
  const [qcMileage, setQcMileage] = useState<number | ''>('')
  const [qcRemark, setQcRemark] = useState('')
  const [qcInspectorName, setQcInspectorName] = useState('')
  const [qcPendingPhotos, setQcPendingPhotos] = useState<Record<string, File[]>>({})
  const [savingQC, setSavingQC] = useState(false)

  // User Role & Permissions (ADMIN / SUPER_ADMIN only for delete)
  const [userRole, setUserRole] = useState<string | null>(null)
  const canDelete = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'

  // Delete Confirmation Modals State
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<AuditSession | null>(null)
  const [deletingSession, setDeletingSession] = useState(false)
  const [deleteConfirmQC, setDeleteConfirmQC] = useState<QCRecord | null>(null)
  const [deletingQC, setDeletingQC] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let uid = ''
      const cached = localStorage.getItem('liff_profile')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setProfile(parsed)
          uid = parsed.userId || ''
          setQcInspectorName(parsed.displayName || parsed.ev7UserName || '')
        } catch (e) {
          console.error('Error parsing profile cache:', e)
        }
      }

      const hostname = window.location.hostname
      const isDev = hostname === 'localhost' || hostname === '127.0.0.1'
      if (!uid && isDev) {
        uid = 'usr_mock_dev'
      }

      if (uid) {
        fetch(`/api/auth/role?userId=${uid}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.role) setUserRole(data.role)
          })
          .catch(err => console.error('Error fetching user role:', err))
      }
    }
  }, [])

  const handleDeleteSession = async () => {
    if (!deleteConfirmSession) return
    setDeletingSession(true)
    try {
      const res = await fetch(`/api/inspection/session?sessionId=${deleteConfirmSession.inspectionSessionId}&lineUserId=${profile?.userId || 'usr_mock_dev'}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ลบรอบตรวจไม่สำเร็จ')
      }
      showToast(`ลบรอบการตรวจ "${deleteConfirmSession.sessionName}" เรียบร้อยแล้ว`, 'success')
      setDeleteConfirmSession(null)
      fetchSessions()
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setDeletingSession(false)
    }
  }

  const handleDeleteQC = async (record: QCRecord) => {
    setDeletingQC(true)
    try {
      const res = await fetch(`/api/inspection/${record.inspectionId}?lineUserId=${profile?.userId || 'usr_mock_dev'}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ลบผลการตรวจไม่สำเร็จ')
      }
      showToast(`ลบผลการตรวจ QC รถทะเบียน ${record.registerNo || record.vinNo} เรียบร้อยแล้ว`, 'success')
      setDeleteConfirmQC(null)
      if (selectedQCDetail?.inspectionId === record.inspectionId) {
        setSelectedQCDetail(null)
      }
      fetchQCRecords()
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setDeletingQC(false)
    }
  }

  // Fetch initial audit sessions & locations
  const fetchSessions = async () => {
    setLoadingSessions(true)
    setError(null)
    try {
      const [sessRes, locRes] = await Promise.all([
        fetch('/api/inspection/session'),
        fetch('/api/liff/locations')
      ])

      if (!sessRes.ok) throw new Error('ไม่สามารถดึงรอบการตรวจสภาพรถได้')
      
      const sessData = await sessRes.json()
      const locData = locRes.ok ? await locRes.json() : []

      setSessions(sessData.sessions || [])
      setLocations(Array.isArray(locData) ? locData : [])
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoadingSessions(false)
    }
  }

  // Fetch QC inspection records
  const fetchQCRecords = useCallback(async () => {
    setLoadingQC(true)
    try {
      const res = await fetch('/api/inspection?type=QC&limit=100')
      if (res.ok) {
        const data = await res.json()
        setQcRecords(data.inspections || [])
      }
    } catch (err) {
      console.error('Failed to fetch QC records:', err)
    } finally {
      setLoadingQC(false)
    }
  }, [])

  // Fetch QC master items dynamically from Database Master
  const fetchQCMaster = useCallback(async () => {
    try {
      const res = await fetch('/api/inspection/master?type=QC')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.masterItems) && data.masterItems.length > 0) {
          setQcMasterItems(data.masterItems)
        }
      }
    } catch (err) {
      console.error('Failed to fetch QC master items:', err)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    fetchQCRecords()
    fetchQCMaster()
  }, [fetchQCRecords, fetchQCMaster])

  // Build dynamic QC checklist sections from DB Master (with fallback to config)
  const dynamicQCSections = useMemo(() => {
    if (qcMasterItems.length > 0) {
      return buildDynamicSections(qcMasterItems)
    }
    return QC_CHECKLIST_SECTIONS
  }, [qcMasterItems])

  // Check URL query parameters on mount (e.g. ?mode=qc&registerNo=1กก-1234&tab=qc&date=today)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const registerNo = params.get('registerNo')
    const tabParam = params.get('tab')
    const dateParam = params.get('date')
    const plateParam = params.get('plate') || params.get('q')

    if (tabParam === 'sessions') {
      setActiveTab('sessions')
    } else if (tabParam === 'qc' || tabParam === 'qc_records') {
      setActiveTab('qc_records')
    }

    if (dateParam === 'all') {
      setQcDatePreset('all')
      setQcFilterDate('')
    } else if (dateParam === 'yesterday') {
      setQcDatePreset('yesterday')
      setQcFilterDate(getYesterdayBangkokYMD())
    } else if (dateParam === '7days') {
      setQcDatePreset('7days')
      setQcFilterDate('')
    } else if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setQcDatePreset('custom')
      setQcFilterDate(dateParam)
    }

    if (plateParam) {
      setQcFilterPlate(plateParam)
    }

    if (mode === 'qc') {
      setIsQCModalOpen(true)
      setActiveTab('qc_records')

      if (registerNo) {
        fetch(`/api/vehicles/search?q=${encodeURIComponent(registerNo)}`)
          .then(res => res.json())
          .then(data => {
            const cars = (Array.isArray(data) ? data : data.cars) || []
            const matched = cars.find((c: any) => c.RegisterNo === registerNo) || cars[0]
            if (matched) {
              handleSelectCarForQC(matched)
            }
          })
          .catch(err => console.error('Failed to auto-select car for QC:', err))
      }
    }
  }, [])

  // Select car for Quick QC
  const handleSelectCarForQC = (car: DbCar) => {
    setSelectedQCCar(car)
    const itemsMap: Record<string, any> = {}
    if (qcMasterItems.length > 0) {
      createEmptyItemsFromMaster(qcMasterItems).forEach(item => {
        itemsMap[`${item.category}_${item.itemCode}`] = item
      })
    } else {
      createEmptyQCItems().forEach(item => {
        itemsMap[`${item.category}_${item.itemCode}`] = item
      })
    }
    setQcFormItems(itemsMap)
    setQcMileage('')
    setQcRemark('')
    setQcPendingPhotos({})
    if (profile?.displayName) {
      setQcInspectorName(profile.displayName)
    }
  }

  // Close QC Modal and reset state
  const handleCloseQCModal = () => {
    setIsQCModalOpen(false)
    setSelectedQCCar(null)
    setQcFormItems({})
    setQcPendingPhotos({})
    setQcRemark('')
  }

  // Handle Save QC inspection
  const handleSaveQC = async (savedMode?: 'QC' | 'AUDIT', isDraft?: boolean): Promise<number | undefined> => {
    if (!selectedQCCar) return
    if (!qcInspectorName.trim()) {
      showToast('กรุณากรอกชื่อผู้ตรวจ QC ก่อนบันทึก', 'error')
      throw new Error('กรุณากรอกชื่อผู้ตรวจ QC')
    }

    setSavingQC(true)
    try {
      // 1. Calculate assessment
      let hasFailed = false
      Object.values(qcFormItems).forEach((item: any) => {
        if (!item.value) return
        if (item.value === 'NOT_CLEAN' || item.value === 'NO_KEY' || item.value === 'NEED_ATTENTION' || item.value === 'WORN_OUT') {
          hasFailed = true
        }
        if (item.category === 'QC_TAX_VEHICLE' && item.value === 'NO') hasFailed = true
        if (item.category === 'QC_TAX_METER' && item.value === 'NO') hasFailed = true
        if (item.category === 'QC_PARK_POSITION' && item.value === 'NOT_READY') hasFailed = true
        if (item.category === 'QC_BATTERY_HV' && item.numericValue != null && item.numericValue < 40) hasFailed = true
      })

      const autoAssessmentText = hasFailed ? 'ไม่ผ่าน QC (ต้องแก้ไข)' : 'ผ่านการตรวจ QC (พร้อมส่งมอบ)'
      const cleanRem = qcRemark.replace(/^\[ผลการประเมิน:[^\]]+\]\s*/, '').trim()
      const finalRemark = `[ผลการประเมิน: ${autoAssessmentText}] ${cleanRem}`.trim()
      const mappedAssessment = hasFailed ? 'NEED_REPAIR' : 'NORMAL'
      const statusToSave = isDraft ? 'DRAFT' : 'COMPLETED'

      const payload = {
        vinNo: selectedQCCar.VinNo,
        registerNo: selectedQCCar.RegisterNo,
        inspectionType: savedMode || 'QC',
        inspectionSessionId: null, // Standalone inspection
        mileage: qcMileage !== '' ? qcMileage : null,
        inspectionDate: new Date().toISOString().split('T')[0],
        remark: finalRemark || null,
        assessmentResult: mappedAssessment,
        items: Object.values(qcFormItems).map((item: any) => {
          const cat = item.category || item.Category
          const code = item.itemCode || item.ItemCode
          if (cat === 'MILEAGE' && code === 'VALUE') {
            return {
              category: cat,
              itemCode: code,
              ...item,
              numericValue: qcMileage !== '' ? qcMileage : null,
              value: qcMileage !== '' ? String(qcMileage) : null,
            }
          }
          return {
            ...item,
            category: cat,
            itemCode: code,
          }
        }).filter((it: any) => !!it.category && !!it.itemCode),
        lineUserId: profile?.userId || undefined,
        location: selectedQCCar.CurrentLocation,
        inspectorName: qcInspectorName,
        status: statusToSave,
        carStatus: null, // "ไม่ต้องปรับสภานะ อะไร"
      }

      const res = await fetch('/api/inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'บันทึกผลการตรวจ QC ไม่สำเร็จ')
      }

      const resData = await res.json()
      const savedInspectionId = resData.inspectionId

      // Upload pending photos if any
      const posKeys = Object.keys(qcPendingPhotos)
      for (const posKey of posKeys) {
        const files = qcPendingPhotos[posKey]
        if (files.length === 0) continue

        const [cat, code, pos] = posKey.split('::')
        const itemCode = code === 'null' ? null : code
        const photoPosition = pos === 'default' ? null : pos

        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        formData.append('inspectionId', String(savedInspectionId))
        formData.append('category', cat)
        if (itemCode) formData.append('itemCode', itemCode)
        if (photoPosition) formData.append('photoPosition', photoPosition)

        await fetch('/api/inspection/upload', {
          method: 'POST',
          body: formData,
        })
      }

      setQcPendingPhotos({})

      if (isDraft) {
        showToast('บันทึกฉบับร่างและอัปโหลดรูปภาพเรียบร้อยแล้ว', 'success')
      } else {
        showToast('✅ บันทึกผลการตรวจ QC รถเรียบร้อยแล้ว', 'success')
        handleCloseQCModal()
        fetchQCRecords()
        setActiveTab('qc_records')
      }
      return savedInspectionId
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึก QC', 'error')
    } finally {
      setSavingQC(false)
    }
  }

  // Handle Create Session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionName || !sessionDate || !selectedLocation) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setSubmittingSession(true)
    try {
      const res = await fetch('/api/inspection/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName,
          sessionDate,
          location: selectedLocation,
          notes,
          lineUserId: profile?.userId,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'สร้างรอบการตรวจไม่สำเร็จ')
      }

      setIsSessionModalOpen(false)
      setSessionName('')
      setSessionDate(new Date().toISOString().split('T')[0])
      setSelectedLocation('')
      setNotes('')
      showToast('สร้างรอบการตรวจสภาพใหม่สำเร็จ', 'success')
      fetchSessions()
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmittingSession(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
        
        {/* Toast Notification */}
        {toast && (
          <div className="fixed top-5 right-5 z-[200] max-w-sm animate-fade-in shadow-xl">
            <div className={`px-4 py-3 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
              <span>{toast.message}</span>
            </div>
          </div>
        )}

        {/* Navigation / Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 transition active:scale-95 text-xs flex items-center gap-1 shadow-sm font-medium"
              >
                <span>⬅</span> แดชบอร์ด
              </button>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
                  <span>🔍</span> ตรวจสภาพ & QC รถยนต์
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">
                  ระบบตรวจสภาพรถยนต์ไฟฟ้าประจำลาน และบันทึกผล QC ก่อนส่งมอบ
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  setSelectedQCCar(null)
                  setIsQCModalOpen(true)
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>⚡</span>
                <span>ตรวจ QC รถก่อนส่งมอบ</span>
              </button>

              <button
                onClick={() => setIsSessionModalOpen(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>➕</span>
                <span>สร้างรอบตรวจสภาพ</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-100 gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => {
                setActiveTab('qc_records')
                fetchQCRecords()
              }}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'qc_records'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🟢 ตรวจ QC รถก่อนส่งมอบ (Delivery QC)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-700">
                {qcRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 shrink-0 cursor-pointer ${
                activeTab === 'sessions'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📋 รอบการตรวจสภาพรถ (Audit Sessions)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
                {sessions.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {error && (
            <div className="p-4 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* TAB 1: AUDIT SESSIONS */}
          {activeTab === 'sessions' && (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="px-5 py-4">ชื่อรอบตรวจสอบสภาพ (Session Name)</th>
                        <th className="px-5 py-4">ลานจอดรถ</th>
                        <th className="px-5 py-4">วันที่ตรวจสอบ</th>
                        <th className="px-5 py-4 text-center">รถที่ตรวจแล้ว (คัน)</th>
                        <th className="px-5 py-4 text-center">สถานะรอบ</th>
                        <th className="px-5 py-4">ผู้เปิดรอบ</th>
                        <th className="px-5 py-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {loadingSessions ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                              กำลังโหลดรอบการตรวจสภาพ...
                            </div>
                          </td>
                        </tr>
                      ) : sessions.length > 0 ? (
                        sessions.map((session) => {
                          const isClosed = session.status === 'CLOSED'
                          return (
                            <tr
                              key={session.inspectionSessionId}
                              onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                              className="hover:bg-slate-50 transition duration-150 cursor-pointer active:bg-slate-100"
                            >
                              <td className="px-5 py-4.5 font-bold text-slate-900 text-sm">
                                {session.sessionName}
                                {session.notes && (
                                  <p className="text-[10px] text-slate-400 font-normal mt-0.5 max-w-sm truncate">{session.notes}</p>
                                )}
                              </td>
                              <td className="px-5 py-4.5 font-medium text-slate-600">
                                {session.locationName || session.location || '-'}
                              </td>
                              <td className="px-5 py-4.5 font-medium text-slate-600">
                                {getThaiDate(session.sessionDate)}
                              </td>
                              <td className="px-5 py-4.5 text-center font-mono font-bold text-slate-900 text-sm">
                                {session.inspectionCount}
                              </td>
                              <td className="px-5 py-4.5 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                                  isClosed
                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {session.status}
                                </span>
                              </td>
                              <td className="px-5 py-4.5 font-medium text-slate-600">
                                {maskStaffName(session.creatorName || (session.createdBy ? `User #${session.createdBy}` : '-'))}
                              </td>
                              <td className="px-5 py-4.5 text-right" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5 ml-auto">
                                  <button
                                    onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold transition active:scale-95"
                                  >
                                    เข้าสเปซตรวจ ➡️
                                  </button>
                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmSession(session)}
                                      title="ลบรอบตรวจสภาพและข้อมูลทั้งหมด"
                                      className="px-2 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold transition active:scale-95 flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>🗑️</span>
                                      <span>ลบ</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                            ยังไม่มีข้อมูลรอบการตรวจสภาพรถยนต์ในระบบ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden space-y-3">
                {loadingSessions ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      กำลังโหลดรอบการตรวจสภาพ...
                    </div>
                  </div>
                ) : sessions.length > 0 ? (
                  sessions.map((session) => {
                    const isClosed = session.status === 'CLOSED'
                    return (
                      <div
                        key={session.inspectionSessionId}
                        onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm active:bg-slate-50 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{session.sessionName}</h4>
                            <p className="text-[11px] text-slate-500 mt-1">
                              📍 {session.locationName || session.location || '-'}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              📅 {getThaiDate(session.sessionDate)}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <span>👤</span> ผู้เปิดรอบ: <strong className="font-semibold text-slate-700">{maskStaffName(session.creatorName || (session.createdBy ? `User #${session.createdBy}` : '-'))}</strong>
                            </p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                            isClosed
                              ? 'bg-slate-100 text-slate-500 border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {session.status}
                          </span>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                          <span>ตรวจแล้ว: <strong className="text-slate-900 font-mono">{session.inspectionCount}</strong> คัน</span>
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmSession(session)}
                                className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <span>🗑️</span>
                                <span>ลบ</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                              className="text-[10px] text-indigo-600 font-bold"
                            >
                              เข้าห้องตรวจ ➡️
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">
                    ยังไม่มีข้อมูลรอบการตรวจสภาพรถยนต์ในระบบ
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: QC HISTORY RECORDS */}
          {activeTab === 'qc_records' && (
            <div className="space-y-4">
              {/* Executive KPI Summary (2x2 on Mobile, 4-col on Desktop) */}
              <QCExecutiveKPIs kpis={qcKPIs} isToday={qcDatePreset === 'today'} />

              {/* Responsive Filter Bar (Presets, Search, Date Picker, Status, View Switcher) */}
              <QCFilterBar
                datePreset={qcDatePreset}
                onDatePresetChange={setQcDatePreset}
                filterDate={qcFilterDate}
                onFilterDateChange={setQcFilterDate}
                filterPlate={qcFilterPlate}
                onFilterPlateChange={setQcFilterPlate}
                filterStatus={qcFilterStatus}
                onFilterStatusChange={setQcFilterStatus}
                viewMode={qcViewMode}
                onViewModeChange={setQcViewMode}
                totalCount={qcRecords.length}
                filteredCount={filteredQCRecords.length}
                loading={loadingQC}
                onRefresh={fetchQCRecords}
                onResetFilters={() => {
                  setQcDatePreset('today')
                  setQcFilterPlate('')
                  setQcFilterDate(getBangkokTodayYMD())
                  setQcFilterStatus('ALL')
                }}
              />

              {/* VIEW 1: INSTANT CARDS VIEW (Dynamic checklist items, 0ms clicks) */}
              {qcViewMode === 'cards' && (
                <QCCardsGrid
                  items={filteredQCRecords}
                  masterItems={qcMasterItems}
                  dynamicSections={dynamicQCSections}
                  loading={loadingQC}
                  datePreset={qcDatePreset}
                  onViewDetail={handleViewQCDetail}
                  onNewQC={() => {
                    setSelectedQCCar(null)
                    setIsQCModalOpen(true)
                  }}
                  onViewAllDates={() => {
                    setQcDatePreset('all')
                    setQcFilterDate('')
                    setQcFilterPlate('')
                    setQcFilterStatus('ALL')
                  }}
                  spacesCdn={SPACES_CDN}
                />
              )}

              {/* VIEW 2: COMPACT TABLE VIEW */}
              {qcViewMode === 'table' && (
                <QCTableView
                  items={filteredQCRecords}
                  loading={loadingQC}
                  canDelete={canDelete}
                  onDelete={handleDeleteQC}
                  onViewDetail={handleViewQCDetail}
                />
              )}
            </div>
          )}

        </div>

        {/* Create Session Modal */}
        {isSessionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">➕ สร้างรอบตรวจสภาพรถใหม่</h3>
                <button
                  onClick={() => setIsSessionModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">ชื่อรอบการตรวจสภาพ</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ตรวจสภาพรถประจำสัปดาห์ / ลานพระประแดง"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">สถานที่ตรวจสอบ / ลานจอด</label>
                  <select
                    required
                    value={selectedLocation}
                    onChange={e => setSelectedLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-750 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  >
                    <option value="">-- เลือกสถานที่ --</option>
                    {locations.map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">วันที่ตรวจเช็ค</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-600">บันทึกเพิ่มเติม (Notes)</label>
                  <textarea
                    rows={3}
                    placeholder="รายละเอียดเพิ่มเติมของรอบตรวจ..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSessionModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold transition active:scale-95"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submittingSession}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition active:scale-95 shadow-sm"
                  >
                    {submittingSession ? 'กำลังสร้าง...' : 'สร้างรอบใหม่'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STANDALONE QUICK QC MODAL / DRAWER */}
        {isQCModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-4 sm:p-6 animate-fade-in my-auto max-h-[95vh] flex flex-col">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-none">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>⚡</span> ตรวจ QC รถก่อนส่งมอบ (ตรวจรายคัน ครั้งเดียวจบ)
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    ตรวจเช็ค 9 ข้อหลัก ไม่เปลี่ยนสถานะรถ และสามารถแท็กทีมงานลงบันทึกได้
                  </p>
                </div>
                <button
                  onClick={handleCloseQCModal}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                {/* STEP 1: Search Vehicle if not selected */}
                {!selectedQCCar ? (
                  <div className="space-y-4 py-6">
                    <div className="text-center max-w-md mx-auto space-y-1">
                      <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-2 border border-emerald-100">
                        🚗
                      </div>
                      <h4 className="text-sm font-bold text-slate-800">เลือกรถที่ต้องการตรวจ QC</h4>
                      <p className="text-xs text-slate-500">
                        ค้นหาด้วยทะเบียนรถ, เลขตัวถัง (VIN) หรือเปิดกล้องสแกนบาร์โค้ด
                      </p>
                    </div>

                    <div className="max-w-xl mx-auto">
                      <VehicleSearchWithScanner
                        onSelectCar={handleSelectCarForQC}
                        placeholder="พิมพ์ค้นหาเลขทะเบียน หรือ VIN..."
                      />
                    </div>
                  </div>
                ) : (
                  /* STEP 2: Selected Vehicle & QC Checklist Form */
                  <div className="space-y-4">
                    {/* Selected Car Banner */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-900">{selectedQCCar.RegisterNo || 'ไม่มีทะเบียน'}</span>
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg">
                            {selectedQCCar.Model || 'ไม่ระบุรุ่น'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          VIN: {selectedQCCar.VinNo} {selectedQCCar.CurrentLocation && `• สถานที่: ${selectedQCCar.CurrentLocation}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedQCCar(null)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 text-xs font-bold transition shadow-xs"
                      >
                        🔄 เปลี่ยนรถ
                      </button>
                    </div>

                    {/* Audit / QC Checklist Form */}
                    <AuditChecklistForm
                      sessionStatus="OPEN"
                      activeVehicle={{
                        vinNo: selectedQCCar.VinNo,
                        registerNo: selectedQCCar.RegisterNo,
                        model: selectedQCCar.Model,
                        project: selectedQCCar.Project,
                        inventoryItemId: selectedQCCar.InventoryItemID,
                        currentLocation: selectedQCCar.CurrentLocation,
                      }}
                      dynamicSections={dynamicQCSections}
                      inspectionMode="QC"
                      formItems={qcFormItems}
                      mileage={qcMileage}
                      remark={qcRemark}
                      inspectorName={qcInspectorName}
                      uploadedPhotos={[]}
                      pendingPhotos={qcPendingPhotos}
                      saving={savingQC}
                      spacesCdn={SPACES_CDN}
                      onMileageChange={setQcMileage}
                      onRemarkChange={setQcRemark}
                      onInspectorNameChange={setQcInspectorName}
                      onChecklistValueChange={(cat, code, val) => {
                        const key = `${cat}_${code}`
                        setQcFormItems(prev => {
                          const existing = prev[key]
                          return {
                            ...prev,
                            [key]: {
                              category: existing?.category || cat,
                              itemCode: existing?.itemCode || code,
                              detail: existing?.detail ?? null,
                              numericValue: existing?.numericValue ?? null,
                              expiryDate: existing?.expiryDate ?? null,
                              value: val,
                            }
                          }
                        })
                      }}
                      onChecklistDetailChange={(cat, code, det) => {
                        const key = `${cat}_${code}`
                        setQcFormItems(prev => {
                          const existing = prev[key]
                          return {
                            ...prev,
                            [key]: {
                              category: existing?.category || cat,
                              itemCode: existing?.itemCode || code,
                              value: existing?.value ?? null,
                              numericValue: existing?.numericValue ?? null,
                              expiryDate: existing?.expiryDate ?? null,
                              detail: det,
                            }
                          }
                        })
                      }}
                      onChecklistNumberChange={(cat, code, num) => {
                        const key = `${cat}_${code}`
                        setQcFormItems(prev => {
                          const existing = prev[key]
                          return {
                            ...prev,
                            [key]: {
                              category: existing?.category || cat,
                              itemCode: existing?.itemCode || code,
                              value: existing?.value ?? null,
                              detail: existing?.detail ?? null,
                              expiryDate: existing?.expiryDate ?? null,
                              numericValue: num,
                            }
                          }
                        })
                      }}
                      onChecklistExpiryChange={(cat, code, exp) => {
                        const key = `${cat}_${code}`
                        setQcFormItems(prev => {
                          const existing = prev[key]
                          return {
                            ...prev,
                            [key]: {
                              category: existing?.category || cat,
                              itemCode: existing?.itemCode || code,
                              value: existing?.value ?? null,
                              detail: existing?.detail ?? null,
                              numericValue: existing?.numericValue ?? null,
                              expiryDate: exp || null,
                            }
                          }
                        })
                      }}
                      onPhotoSelect={(cat, code, files) => {
                        if (!files || files.length === 0) return
                        const posKey = `${cat}::${code}::default`
                        const addedFiles = Array.from(files)
                        setQcPendingPhotos(prev => ({
                          ...prev,
                          [posKey]: [...(prev[posKey] || []), ...addedFiles]
                        }))
                      }}
                      onRemovePendingPhoto={(posKey, idx) => {
                        setQcPendingPhotos(prev => {
                          const list = [...(prev[posKey] || [])]
                          list.splice(idx, 1)
                          return { ...prev, [posKey]: list }
                        })
                      }}
                      onDeleteUploadedPhoto={() => {}}
                      onSave={handleSaveQC}
                      onCancel={handleCloseQCModal}
                      lineUserId={profile?.userId}
                    />
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* STANDALONE QC DETAIL POPUP MODAL */}
        <QCDetailModal
          record={selectedQCDetail}
          loading={loadingQCDetail}
          masterItems={qcMasterItems}
          spacesCdn={SPACES_CDN}
          canDelete={canDelete}
          onDelete={(rec) => setDeleteConfirmQC(rec)}
          onClose={() => setSelectedQCDetail(null)}
        />

        {/* Delete Session Confirmation Modal */}
        {deleteConfirmSession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-2xl flex items-center justify-center mx-auto">
                🗑️
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  ยืนยันการลบรอบการตรวจสภาพ?
                </h3>
                <p className="text-xs text-slate-600">
                  คุณต้องการลบรอบตรวจ <strong className="text-slate-900 font-bold">"{deleteConfirmSession.sessionName}"</strong> ใช่หรือไม่?
                </p>
                <div className="text-[11px] text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-200 text-left space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <span>⚠️</span> คำเตือนสำคัญ:
                  </p>
                  <p>
                    ข้อมูลการตรวจรถยนต์ในรอบนี้ทั้งหมด ({deleteConfirmSession.inspectionCount || 0} คัน) รวมถึงรูปภาพและผลเช็คลิสต์จะถูกลบออกจากระบบอย่างถาวร
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={deletingSession}
                  onClick={() => setDeleteConfirmSession(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={deletingSession}
                  onClick={handleDeleteSession}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {deletingSession ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <span>ยืนยันการลบ</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete QC Record Confirmation Modal */}
        {deleteConfirmQC && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-2xl flex items-center justify-center mx-auto">
                🗑️
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-base font-bold text-slate-900">
                  ยืนยันการลบผลการตรวจ QC?
                </h3>
                <p className="text-xs text-slate-600">
                  คุณต้องการลบผลการตรวจ QC ของรถทะเบียน <strong className="text-slate-900 font-bold">{deleteConfirmQC.registerNo || deleteConfirmQC.vinNo}</strong> ใช่หรือไม่?
                </p>
                <p className="text-[11px] text-rose-600 bg-rose-50/70 p-2.5 rounded-xl border border-rose-150">
                  ⚠️ ข้อมูลเช็คลิสต์และรูปภาพที่บันทึกไว้ของคันนี้จะถูกลบออก
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={deletingQC}
                  onClick={() => setDeleteConfirmQC(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={deletingQC}
                  onClick={() => handleDeleteQC(deleteConfirmQC)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {deletingQC ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังลบ...</span>
                    </>
                  ) : (
                    <span>ยืนยันการลบ</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  )
}
