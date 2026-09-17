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

const spacesEndpoint = 'https://sgp1.digitaloceanspaces.com'
const spacesBucket = 'space-ev7tracking-prod'
const SPACES_CDN = (typeof window !== 'undefined' && localStorage.getItem('spaces_cdn')) || spacesEndpoint.replace('https://', `https://${spacesBucket}.`)

interface AuditSession {
  inspectionSessionId: number
  sessionName: string
  sessionDate: string
  location: string
  locationName?: string
  status: 'OPEN' | 'CLOSED'
  notes?: string
  createdBy: string
  inspectionCount: number
}

interface QCRecord {
  inspectionId: number
  vinNo: string
  registerNo: string | null
  inspectionType: string
  inspectionDate: string
  inspectorName: string
  status: string
  mileage?: number
  createDate?: string
  location?: string
  locationName?: string
  assessmentResult?: string
  remark?: string
  itemCount: number
  photoCount: number
  items?: Array<{
    inspectionItemId: number
    category: string
    itemCode: string
    value: string | null
    detail: string | null
    numericValue?: number | null
    expiryDate?: string | null
  }>
}

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

function maskStaffName(name?: string | null): string {
  if (!name) return '-'
  const trimmed = name.trim()
  if (!trimmed) return '-'
  const parts = trimmed.split(/\s+/)
  return parts[0]
}

function getInspectionDateYMD(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return (dateStr || '').slice(0, 10)
  }
}

function getQCItemLabel(category: string, itemCode: string, masterItems?: any[]): string {
  if (masterItems && masterItems.length > 0) {
    const found = masterItems.find(m => m.category === category && m.itemCode === itemCode)
    if (found?.labelTh) return found.labelTh
  }
  switch (category) {
    case 'QC_CLEAN': return '1. ความสะอาด ภายนอก - ภายใน'
    case 'QC_KEY': return '2. กุญแจพร้อม'
    case 'QC_TAX_VEHICLE': return '3. ทะเบียนเหลือมากกว่า 3 เดือน'
    case 'QC_TAX_METER': return '4. ภาษีมิเตอร์เหลือมากกว่า 1 เดือน'
    case 'QC_PARK_POSITION': return '5. รถอยู่ในตำแหน่งพร้อมส่ง (ระบุจุดจอด)'
    case 'QC_BATTERY_HV': return '6. ไฟแบตลูกใหญ่มากกว่า 40%'
    case 'QC_QR_CODE': return '7. QR code มี-ไม่มี'
    case 'QC_WIPER': return '8. ยางปัดน้ำฝน'
    case 'QC_TIRE': return '9. ยางรถ'
    default: return `${category} - ${itemCode}`
  }
}

function renderQCValueBadge(category: string, value: string | null, numericValue?: number | null, detail?: string | null) {
  if (category === 'QC_BATTERY_HV' && numericValue != null) {
    const isOk = numericValue >= 40
    return (
      <div className="text-right">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg font-mono font-bold text-xs ${
          isOk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {numericValue}% {isOk ? '✅' : '⚠️ ต่ำกว่า 40%'}
        </span>
        {detail && <p className="text-[10px] text-slate-500 mt-0.5">{detail}</p>}
      </div>
    )
  }

  let label = value || '-'
  let isGood = true

  if (value === 'CLEAN') label = 'สะอาดพร้อม'
  else if (value === 'NOT_CLEAN') { label = 'ไม่สะอาด'; isGood = false }
  else if (value === 'READY') label = 'พร้อมใช้งาน'
  else if (value === 'NO_KEY') { label = 'ไม่มีกุญแจ'; isGood = false }
  else if (value === 'YES') label = 'พร้อม / มี'
  else if (value === 'NO') { label = 'ไม่พร้อม / ไม่มี'; isGood = false }
  else if (value === 'PARK_READY') label = 'จอดพร้อมส่ง'
  else if (value === 'NOT_READY') { label = 'ยังไม่พร้อมส่ง'; isGood = false }
  else if (value === 'WORN_OUT') { label = 'เสื่อมสภาพ'; isGood = false }

  return (
    <div className="text-right">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg font-bold text-xs ${
        isGood ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
      }`}>
        {label}
      </span>
      {detail && <p className="text-[10px] text-slate-500 mt-0.5">{detail}</p>}
    </div>
  )
}

export default function InspectionAuditPage() {
  const router = useRouter()

  // Tabs: 'sessions' vs 'qc_records'
  const [activeTab, setActiveTab] = useState<'sessions' | 'qc_records'>('sessions')

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

  // QC Filter State
  const [qcFilterPlate, setQcFilterPlate] = useState('')
  const [qcFilterDate, setQcFilterDate] = useState('')
  const [qcFilterStatus, setQcFilterStatus] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL')

  const filteredQCRecords = useMemo(() => {
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

      // Date filter (Bangkok date / UTC format)
      if (qcFilterDate) {
        const itemDateStr = getInspectionDateYMD(item.inspectionDate)
        if (itemDateStr !== qcFilterDate) {
          return false
        }
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
  }, [qcRecords, qcFilterPlate, qcFilterDate, qcFilterStatus])

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('liff_profile')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setProfile(parsed)
          setQcInspectorName(parsed.displayName || parsed.ev7UserName || '')
        } catch (e) {
          console.error('Error parsing profile cache:', e)
        }
      }
    }
  }, [])

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

  // Check URL query parameters on mount (e.g. ?mode=qc&registerNo=1กก-1234)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const registerNo = params.get('registerNo')

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
  const handleSaveQC = async (savedMode?: 'QC' | 'AUDIT') => {
    if (!selectedQCCar) return
    if (!qcInspectorName.trim()) {
      showToast('กรุณากรอกชื่อผู้ตรวจ QC ก่อนบันทึก', 'error')
      return
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
        status: 'COMPLETED',
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

      showToast('✅ บันทึกผลการตรวจ QC รถเรียบร้อยแล้ว', 'success')
      handleCloseQCModal()
      fetchQCRecords()
      setActiveTab('qc_records')
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-100 gap-2">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
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

            <button
              onClick={() => {
                setActiveTab('qc_records')
                fetchQCRecords()
              }}
              className={`py-2.5 px-3.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === 'qc_records'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🟢 ประวัติการตรวจ QC รถก่อนส่งมอบ (Delivery QC)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-700">
                {qcRecords.length}
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
                              <td className="px-5 py-4.5 font-medium text-slate-500">
                                {session.createdBy || '-'}
                              </td>
                              <td className="px-5 py-4.5 text-right" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold transition active:scale-95"
                                >
                                  เข้าสเปซตรวจ ➡️
                                </button>
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
                          <span className="text-[10px] text-indigo-600 font-bold">เข้าห้องตรวจ ➡️</span>
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
            <>
              {/* Filter Bar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="flex flex-1 flex-wrap items-center gap-2.5">
                    {/* License Plate / VIN Filter */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={qcFilterPlate}
                        onChange={e => setQcFilterPlate(e.target.value)}
                        placeholder="ค้นหาทะเบียน หรือ VIN (เช่น ทอ-4141)..."
                        className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition"
                      />
                      {qcFilterPlate && (
                        <button
                          type="button"
                          onClick={() => setQcFilterPlate('')}
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 px-1 text-xs"
                          title="ล้างข้อความค้นหา"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Date Filter */}
                    <div className="relative flex items-center gap-1.5 min-w-[160px]">
                      <span className="text-[11px] text-slate-500 font-medium shrink-0">วันที่ตรวจ:</span>
                      <input
                        type="date"
                        value={qcFilterDate}
                        onChange={e => setQcFilterDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition cursor-pointer"
                      />
                      {qcFilterDate && (
                        <button
                          type="button"
                          onClick={() => setQcFilterDate('')}
                          title="ล้างตัวกรองวันที่"
                          className="text-slate-400 hover:text-slate-600 px-1 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Status Filter Buttons */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                      <button
                        type="button"
                        onClick={() => setQcFilterStatus('ALL')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition text-[11px] cursor-pointer ${
                          qcFilterStatus === 'ALL'
                            ? 'bg-white text-slate-800 shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        ทั้งหมด
                      </button>
                      <button
                        type="button"
                        onClick={() => setQcFilterStatus('PASS')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition text-[11px] cursor-pointer ${
                          qcFilterStatus === 'PASS'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        🟢 ผ่าน QC
                      </button>
                      <button
                        type="button"
                        onClick={() => setQcFilterStatus('FAIL')}
                        className={`px-3 py-1.5 rounded-lg font-bold transition text-[11px] cursor-pointer ${
                          qcFilterStatus === 'FAIL'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        🔴 ไม่ผ่าน
                      </button>
                    </div>
                  </div>

                  {/* Actions / Reset / Refresh */}
                  <div className="flex items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {(qcFilterPlate || qcFilterDate || qcFilterStatus !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setQcFilterPlate('')
                          setQcFilterDate('')
                          setQcFilterStatus('ALL')
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        ✕ ล้างตัวกรอง
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={fetchQCRecords}
                      disabled={loadingQC}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <span className={loadingQC ? 'animate-spin' : ''}>🔄</span> รีเฟรช
                    </button>
                  </div>
                </div>

                {/* Counter summary */}
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                  <span>
                    แสดงผล <strong className="text-slate-800 font-semibold">{filteredQCRecords.length}</strong> จากทั้งหมด {qcRecords.length} รายการ
                    {(qcFilterPlate || qcFilterDate || qcFilterStatus !== 'ALL') && (
                      <span className="text-emerald-700 font-medium ml-2">(กำลังกรองข้อมูล)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="px-5 py-4">ทะเบียนรถ (Register No)</th>
                        <th className="px-5 py-4">วันที่ตรวจ QC</th>
                        <th className="px-5 py-4">ผลการตรวจ QC</th>
                        <th className="px-5 py-4 text-center">แบตเตอรี่ (HV SoC)</th>
                        <th className="px-5 py-4">ผู้ตรวจ QC</th>
                        <th className="px-5 py-4">หมายเหตุ / สรุป</th>
                        <th className="px-5 py-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {loadingQC ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                              กำลังโหลดประวัติการตรวจ QC...
                            </div>
                          </td>
                        </tr>
                      ) : filteredQCRecords.length > 0 ? (
                        filteredQCRecords.map((item) => {
                          const isPassed = item.assessmentResult === 'NORMAL' || (item.remark && !item.remark.includes('ไม่ผ่าน'))
                          const batteryItem = item.items?.find(it => it.category === 'QC_BATTERY_HV')
                          const socVal = batteryItem?.numericValue != null ? `${batteryItem.numericValue}%` : '-'

                          return (
                            <tr
                              key={item.inspectionId}
                              onClick={() => handleViewQCDetail(item)}
                              className="hover:bg-slate-50 transition duration-150 cursor-pointer active:bg-slate-100 group"
                            >
                              <td className="px-5 py-4 font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                                {item.registerNo || '-'}
                                <p className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">{item.vinNo}</p>
                              </td>
                              <td className="px-5 py-4 font-medium text-slate-600">
                                {getThaiDate(item.inspectionDate)}
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                  isPassed
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {isPassed ? '🟢 ผ่านการตรวจ QC' : '🔴 ไม่ผ่าน QC'}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-center font-bold text-slate-800 font-mono">
                                {socVal}
                              </td>
                              <td className="px-5 py-4 font-medium text-slate-600">
                                {maskStaffName(item.inspectorName)}
                              </td>
                              <td className="px-5 py-4 text-slate-500 max-w-xs truncate text-[11px]">
                                {item.remark || '-'}
                              </td>
                              <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleViewQCDetail(item)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition active:scale-95 cursor-pointer flex items-center gap-1 ml-auto"
                                >
                                  <span>ดูผลตรวจ</span> <span>🔍</span>
                                </button>
                              </td>
                            </tr>
                          )
                        })
                      ) : qcRecords.length > 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                            <p>ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</p>
                            <button
                              type="button"
                              onClick={() => {
                                setQcFilterPlate('')
                                setQcFilterDate('')
                                setQcFilterStatus('ALL')
                              }}
                              className="mt-2 text-xs text-emerald-600 hover:underline font-semibold"
                            >
                              ล้างตัวกรองทั้งหมด
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                            ยังไม่มีข้อมูลประวัติการตรวจ QC ในระบบ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards View */}
              <div className="block md:hidden space-y-3">
                {loadingQC ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      กำลังโหลดประวัติการตรวจ QC...
                    </div>
                  </div>
                ) : filteredQCRecords.length > 0 ? (
                  filteredQCRecords.map((item) => {
                    const isPassed = item.assessmentResult === 'NORMAL' || (item.remark && !item.remark.includes('ไม่ผ่าน'))
                    const batteryItem = item.items?.find(it => it.category === 'QC_BATTERY_HV')
                    const socVal = batteryItem?.numericValue != null ? `${batteryItem.numericValue}%` : '-'

                    return (
                      <div
                        key={item.inspectionId}
                        onClick={() => handleViewQCDetail(item)}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm active:bg-slate-50 transition space-y-2.5 cursor-pointer hover:border-emerald-300"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{item.registerNo || item.vinNo}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">{item.vinNo}</p>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}>
                            {isPassed ? '🟢 ผ่าน QC' : '🔴 ไม่ผ่าน'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400 text-[10px]">วันที่ตรวจ: </span>
                            <span className="font-semibold">{getThaiDate(item.inspectionDate)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px]">แบตเตอรี่: </span>
                            <span className="font-bold text-slate-800 font-mono">{socVal}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400 text-[10px]">ผู้ตรวจ: </span>
                            <span className="font-medium text-slate-700">{maskStaffName(item.inspectorName)}</span>
                          </div>
                        </div>

                        {item.remark && (
                          <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                            {item.remark}
                          </p>
                        )}

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewQCDetail(item)
                            }}
                            className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>ดูผลตรวจ 🔍</span>
                          </button>
                        </div>
                      </div>
                    )
                  })
                ) : qcRecords.length > 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                    <p>ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา</p>
                    <button
                      type="button"
                      onClick={() => {
                        setQcFilterPlate('')
                        setQcFilterDate('')
                        setQcFilterStatus('ALL')
                      }}
                      className="text-xs text-emerald-600 hover:underline font-semibold"
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">
                    ยังไม่มีข้อมูลประวัติการตรวจ QC ในระบบ
                  </div>
                )}
              </div>
            </>
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

        {/* QC RECORD DETAIL VIEWER MODAL */}
        {selectedQCDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 animate-fade-in space-y-4 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>🔍</span> รายละเอียดผลการตรวจ QC รถก่อนส่งมอบ
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {selectedQCDetail.registerNo || selectedQCDetail.vinNo} • ตรวจเมื่อ {getThaiDate(selectedQCDetail.inspectionDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedQCDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition cursor-pointer"
                  title="ปิดหน้าต่าง"
                >
                  ✕
                </button>
              </div>

              {/* Status & Inspector Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">ผลการประเมิน: </span>
                    <span className={`font-extrabold ml-1 ${
                      selectedQCDetail.assessmentResult === 'NORMAL' || (selectedQCDetail.remark && !selectedQCDetail.remark.includes('ไม่ผ่าน'))
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}>
                      {selectedQCDetail.assessmentResult === 'NORMAL' || (selectedQCDetail.remark && !selectedQCDetail.remark.includes('ไม่ผ่าน'))
                        ? '🟢 ผ่านการตรวจ QC พร้อมส่งมอบ'
                        : '🔴 ไม่ผ่าน QC (ต้องแก้ไขก่อนส่งมอบ)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    ผู้ตรวจ QC: <span className="font-bold text-slate-900">{maskStaffName(selectedQCDetail.inspectorName)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">ทะเบียนรถ</span>
                    <span className="font-bold text-slate-800">{selectedQCDetail.registerNo || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">VIN (เลขตัวถัง)</span>
                    <span className="font-mono font-medium text-slate-700">{selectedQCDetail.vinNo || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">วันที่ตรวจ</span>
                    <span className="font-medium text-slate-800">{getThaiDate(selectedQCDetail.inspectionDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">เลขไมล์</span>
                    <span className="font-bold text-slate-800 font-mono">
                      {selectedQCDetail.mileage != null ? `${Number(selectedQCDetail.mileage).toLocaleString()} กม.` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Loading Indicator */}
              {loadingQCDetail ? (
                <div className="py-12 text-center text-xs text-slate-500 bg-slate-50/50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="font-medium">กำลังโหลดรายการตรวจเช็ค 9 ข้อและรูปถ่าย...</p>
                </div>
              ) : (
                <>
                  {/* Checklist Items */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                    <div className="bg-slate-50 px-4 py-2.5 font-bold text-slate-700 border-b border-slate-200 flex items-center justify-between">
                      <span>รายการตรวจเช็ค QC ({selectedQCDetail.items?.length || 0} รายการ)</span>
                      <span className="text-[10px] text-slate-400 font-normal">สถานะและผลประเมิน</span>
                    </div>
                    {selectedQCDetail.items && selectedQCDetail.items.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {selectedQCDetail.items.map((it: any, idx: number) => (
                          <div key={idx} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                            <div className="space-y-0.5">
                              <p className="text-slate-800 font-semibold text-xs">
                                {getQCItemLabel(it.category, it.itemCode, qcMasterItems)}
                              </p>
                              {it.detail && (
                                <p className="text-[11px] text-slate-500">
                                  {it.detail}
                                </p>
                              )}
                            </div>
                            <div>
                              {renderQCValueBadge(it.category, it.value, it.numericValue, null)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-400 text-xs">
                        ไม่มีข้อมูลรายการตรวจเช็ค
                      </div>
                    )}
                  </div>

                  {/* Attached Photos */}
                  {selectedQCDetail.photos && selectedQCDetail.photos.length > 0 && (
                    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-2.5 text-xs">
                      <h4 className="font-bold text-slate-700 flex items-center gap-1.5">
                        <span>📷</span> รูปภาพประกอบการตรวจ ({selectedQCDetail.photos.length} รูป)
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {selectedQCDetail.photos.map((photo: any, idx: number) => {
                          const photoUrl = photo.s3Key?.startsWith('http') ? photo.s3Key : `${SPACES_CDN}/${photo.s3Key}`
                          return (
                            <a
                              key={photo.inspectionPhotoId || idx}
                              href={photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-4/3 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 block shadow-2xs hover:shadow-md transition"
                            >
                              <img
                                src={photoUrl}
                                alt={photo.fileName || 'QC Photo'}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                loading="lazy"
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                                <p className="text-[10px] text-white font-medium truncate">
                                  {getQCItemLabel(photo.category, photo.itemCode, qcMasterItems)}
                                </p>
                              </div>
                              <div className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-md px-1.5 py-0.5 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition">
                                ดูรูปใหญ่ ↗
                              </div>
                            </a>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Remark */}
                  {selectedQCDetail.remark && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                      <p className="font-bold text-slate-600 flex items-center gap-1">
                        <span>📝</span> หมายเหตุ / รายละเอียดเพิ่มเติม:
                      </p>
                      <p className="text-slate-800 whitespace-pre-line text-xs pl-4">{selectedQCDetail.remark}</p>
                    </div>
                  )}
                </>
              )}

              {/* Modal Footer */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedQCDetail(null)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  )
}
