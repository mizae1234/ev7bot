'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { buildDynamicSections } from '@/lib/inspection/checklist-config'
import type { MasterItemDef, InspectionData, InspectionPhotoData } from '@/lib/inspection/types'
import { AuditVehicleList } from '@/components/inspection-audit/AuditVehicleList'
import { AuditChecklistForm } from '@/components/inspection-audit/AuditChecklistForm'
import { maskStaffName, getSpacesCDN } from '@/components/inspection-audit/qc-helpers'

const SPACES_CDN = getSpacesCDN()

interface SessionDetail {
  inspectionSessionId: number
  sessionName: string
  sessionDate: string
  location: string
  locationName?: string
  status: 'OPEN' | 'CLOSED'
  notes?: string
  createdBy: string
  creatorName?: string | null
}

interface AuditedVehicle {
  inspectionId: number
  vinNo: string
  registerNo: string | null
  model: string | null
  status: string
  inspectionDate: string
  mileage?: number
  remark?: string
  inspectorName?: string
  items: Array<{
    category: string
    itemCode: string
    value: string | null
    detail: string | null
    numericValue: number | null
    expiryDate: string | null
  }>
  photos: import('@/lib/inspection/types').InspectionPhotoData[]
}

interface SearchVehicle {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project: string
  Status: string
  StatusType: string
  CurrentLocation: string
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

export default function SessionWorkspacePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = parseInt(params.sessionId as string)

  const [session, setSession] = useState<SessionDetail | null>(null)
  const [auditedVehicles, setAuditedVehicles] = useState<AuditedVehicle[]>([])
  const [masterItems, setMasterItems] = useState<MasterItemDef[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Auth profile
  const [profile, setProfile] = useState<{ userId: string; displayName: string } | null>(null)

  // Active Vehicle / Form State
  const [activeVehicle, setActiveVehicle] = useState<{
    inspectionId?: number
    inventoryItemId?: number
    vinNo: string
    registerNo: string | null
    model: string | null
    project?: string | null
    currentLocation?: string | null
  } | null>(null)

  const [formItems, setFormItems] = useState<Record<string, {
    category: string
    itemCode: string
    value: string | null
    detail: string | null
    numericValue: number | null
    expiryDate: string | null
  }>>({})

  // Mileage & Remark
  const [mileage, setMileage] = useState<number | ''>('')
  const [remark, setRemark] = useState('')
  const [inspectorName, setInspectorName] = useState('')

  // Local/Pending photos to upload
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, File[]>>({})
  const [uploadedPhotos, setUploadedPhotos] = useState<AuditedVehicle['photos']>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [])

  const askConfirmation = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ title, message, onConfirm })
  }, [])

  // User Role & Permissions (ADMIN / SUPER_ADMIN only for delete)
  const [userRole, setUserRole] = useState<string | null>(null)
  const canDelete = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'

  // Delete modal state
  const [deleteVehicleConfirm, setDeleteVehicleConfirm] = useState<{ inspectionId: number; vinNo: string; registerNo: string | null } | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState(false)
  const [showDeleteSessionModal, setShowDeleteSessionModal] = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let uid = ''
      const cached = localStorage.getItem('liff_profile')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          setProfile(parsed)
          uid = parsed.userId || ''
          setInspectorName(parsed.displayName || 'Auditor')
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

  const handleDeleteCurrentSession = async () => {
    if (!session) return
    setDeletingSession(true)
    try {
      const res = await fetch(`/api/inspection/session?sessionId=${session.inspectionSessionId}&lineUserId=${profile?.userId || 'usr_mock_dev'}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ลบรอบตรวจไม่สำเร็จ')
      }
      showToast('ลบรอบการตรวจสภาพและข้อมูลทั้งหมดเรียบร้อยแล้ว', 'success')
      setShowDeleteSessionModal(false)
      setTimeout(() => {
        router.push('/dashboard/inspection-audit')
      }, 400)
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setDeletingSession(false)
    }
  }

  const handleDeleteVehicle = async (vehicle: { inspectionId: number; vinNo: string; registerNo: string | null }) => {
    setDeletingVehicle(true)
    try {
      const res = await fetch(`/api/inspection/${vehicle.inspectionId}?lineUserId=${profile?.userId || 'usr_mock_dev'}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'ลบข้อมูลการตรวจไม่สำเร็จ')
      }
      showToast(`ลบข้อมูลผลการตรวจของรถ ${vehicle.registerNo || vehicle.vinNo} เรียบร้อยแล้ว`, 'success')
      setDeleteVehicleConfirm(null)
      if (activeVehicle?.vinNo === vehicle.vinNo) {
        setActiveVehicle(null)
      }
      fetchSessionData()
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาดในการลบ', 'error')
    } finally {
      setDeletingVehicle(false)
    }
  }

  // Fetch session details & master items & audited items list
  const fetchSessionData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sessRes, masterRes, inspRes] = await Promise.all([
        fetch(`/api/inspection/session`),
        fetch(`/api/inspection/master`),
        fetch(`/api/inspection?sessionId=${sessionId}&type=AUDIT&limit=500`)
      ])

      if (!sessRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลรอบตรวจได้')
      if (!masterRes.ok) throw new Error('ไม่สามารถโหลดข้อมูลข้อตรวจสอบได้')
      if (!inspRes.ok) throw new Error('ไม่สามารถดึงข้อมูลรายการรถในรอบตรวจได้')

      const sessData = await sessRes.json()
      const masterData = await masterRes.json()
      const inspData = await inspRes.json()

      const currentSess = (sessData.sessions || []).find((s: any) => s.inspectionSessionId === sessionId)
      if (!currentSess) throw new Error('ไม่พบรอบการตรวจนี้ในระบบ')

      setSession(currentSess)
      setMasterItems(masterData.masterItems || [])
      
      const rawInsps = inspData.inspections || []
      const parsedInsps: AuditedVehicle[] = rawInsps.map((i: any) => ({
        inspectionId: i.inspectionId,
        vinNo: i.vinNo,
        registerNo: i.registerNo,
        model: i.model,
        status: i.status,
        inspectionDate: i.inspectionDate,
        mileage: i.mileage,
        remark: i.remark,
        inspectorName: i.inspectorName,
        items: [],
        photos: []
      }))
      setAuditedVehicles(parsedInsps)

    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchSessionData()
  }, [fetchSessionData])

  // Fetch full details of an inspection when it is set as active
  const selectAuditedVehicle = async (vehicle: { inspectionId: number }) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inspection/${vehicle.inspectionId}`)
      if (!res.ok) throw new Error('โหลดข้อมูลรายละเอียดเช็คลิสต์ล้มเหลว')
      const data = await res.json()
      const inspDetail: InspectionData = data.inspection

      setActiveVehicle({
        inspectionId: inspDetail.inspectionId,
        inventoryItemId: inspDetail.inventoryItemId ?? undefined,
        vinNo: inspDetail.vinNo,
        registerNo: inspDetail.registerNo,
        model: inspDetail.model ?? null,
        project: inspDetail.project ?? null,
        currentLocation: inspDetail.location ?? null,
      })

      const itemsMap: Record<string, any> = {}
      masterItems.forEach(master => {
        const saved = (inspDetail.items || []).find(it => it.category === master.Category && it.itemCode === master.ItemCode)
        const key = `${master.Category}_${master.ItemCode}`
        itemsMap[key] = {
          category: master.Category,
          itemCode: master.ItemCode,
          value: saved ? saved.value : null,
          detail: saved ? saved.detail : null,
          numericValue: saved ? saved.numericValue : null,
          expiryDate: saved ? saved.expiryDate : null,
        }
      })

      setFormItems(itemsMap)
      setMileage(inspDetail.mileage != null ? inspDetail.mileage : '')
      setRemark(inspDetail.remark || '')
      setInspectorName(inspDetail.inspectorName || profile?.displayName || '')
      setPendingPhotos({})
      setUploadedPhotos(inspDetail.photos || [])
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setLoading(false)
    }
  }

  const dynamicSections = useMemo(() => {
    return buildDynamicSections(masterItems).filter(s => s.category !== 'MILEAGE')
  }, [masterItems])

  // ---- Auto Assessment & Mapped Result ----
  const autoAssessment = useMemo(() => {
    let hasIssues = false
    let filledCount = 0
    const itemsList = Object.values(formItems)

    itemsList.forEach((item: any) => {
      if (item.category === 'MILEAGE') return

      const isFilled = item.value !== null || item.numericValue !== null
      if (isFilled) {
        filledCount++
      }

      if (item.value === 'SCRATCH' || item.value === 'DENT') {
        hasIssues = true
      }
      if (item.value === 'NO' && item.category !== 'ACCIDENT' && item.category !== 'CAR_PHOTOS') {
        hasIssues = true
      }
      if (item.value === 'YES' && item.category === 'ACCIDENT') {
        hasIssues = true
      }
      if (item.value === 'NONE' || item.value === 'FRONT_ONLY' || item.value === 'BACK_ONLY') {
        hasIssues = true
      }
    })

    if (hasIssues) {
      return 'ต้องส่งเข้าซ่อม'
    }

    const totalCount = masterItems.filter(m => m.Category !== 'MILEAGE').length
    if (totalCount === 0 || filledCount < totalCount) {
      return 'รอผลการตรวจ'
    }

    return 'ปกติ'
  }, [formItems, masterItems])

  const damagedItems = useMemo(() => {
    const list: { label: string; valueLabel: string }[] = []
    Object.values(formItems).forEach((data: any) => {
      if (!data.value) return

      let isDamaged = false
      if (data.category === 'ACCIDENT') {
        isDamaged = data.value === 'YES'
      } else if (data.category !== 'CAR_PHOTOS' && data.category !== 'MILEAGE') {
        isDamaged = data.value === 'SCRATCH' || data.value === 'DENT' || data.value === 'NO' ||
                    data.value === 'NONE' || data.value === 'FRONT_ONLY' || data.value === 'BACK_ONLY'
      }

      if (isDamaged) {
        const master = masterItems.find(m => m.Category === data.category && m.ItemCode === data.itemCode)
        const label = master?.Label || data.itemCode
        
        let valueLabel = data.value
        if (data.value === 'NORMAL') valueLabel = 'ปกติ'
        else if (data.value === 'SCRATCH') valueLabel = 'มีรอยขีดข่วน'
        else if (data.value === 'DENT') valueLabel = 'บุบ-แตก'
        else if (data.value === 'YES') valueLabel = 'มี'
        else if (data.value === 'NO') valueLabel = 'ไม่มี'
        else if (data.value === 'NONE') valueLabel = 'ไม่มีป้ายทะเบียน'
        else if (data.value === 'FRONT_ONLY') valueLabel = 'มีเฉพาะป้ายหน้า'
        else if (data.value === 'BACK_ONLY') valueLabel = 'มีเฉพาะป้ายหลัง'

        list.push({ label, valueLabel })
      }
    })
    return list
  }, [formItems, masterItems])

  const handleSelectSearchVehicle = (v: SearchVehicle) => {
    const existing = auditedVehicles.find(item => item.vinNo === v.VinNo)
    if (existing) {
      selectAuditedVehicle(existing)
    } else {
      setActiveVehicle({
        vinNo: v.VinNo,
        registerNo: v.RegisterNo,
        model: v.Model,
        project: v.Project,
        inventoryItemId: v.InventoryItemID,
        currentLocation: v.CurrentLocation,
      })

      const itemsMap: Record<string, any> = {}
      masterItems.forEach(master => {
        const key = `${master.Category}_${master.ItemCode}`
        itemsMap[key] = {
          category: master.Category,
          itemCode: master.ItemCode,
          value: null,
          detail: null,
          numericValue: null,
          expiryDate: null,
        }
      })

      setFormItems(itemsMap)
      setMileage('')
      setRemark('')
      if (!inspectorName && profile?.displayName) {
        setInspectorName(profile.displayName)
      }
      setPendingPhotos({})
      setUploadedPhotos([])
    }
  }

  const handleCloseSession = () => {
    askConfirmation(
      'ยืนยันการปิดรอบตรวจ',
      'คุณยืนยันที่จะปิดรอบการตรวจสภาพรถรอบนี้ใช่หรือไม่? (หลังจากปิดแล้วจะไม่สามารถตรวจบันทึกเพิ่มในรอบนี้ได้)',
      async () => {
        try {
          const res = await fetch('/api/inspection/session', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })
          if (!res.ok) throw new Error('ปิดรอบตรวจล้มเหลว')
          fetchSessionData()
        } catch (err: any) {
          showToast(err.message || 'เกิดข้อผิดพลาด', 'error')
        }
      }
    )
  }

  const handleChecklistValueChange = (category: string, itemCode: string, value: string | null) => {
    const key = `${category}_${itemCode}`
    setFormItems(prev => {
      const existing = prev[key]
      return {
        ...prev,
        [key]: {
          category: existing?.category || category,
          itemCode: existing?.itemCode || itemCode,
          detail: existing?.detail ?? null,
          numericValue: existing?.numericValue ?? null,
          expiryDate: existing?.expiryDate ?? null,
          value,
        }
      }
    })
  }

  const handleChecklistDetailChange = (category: string, itemCode: string, detail: string) => {
    const key = `${category}_${itemCode}`
    setFormItems(prev => {
      const existing = prev[key]
      return {
        ...prev,
        [key]: {
          category: existing?.category || category,
          itemCode: existing?.itemCode || itemCode,
          value: existing?.value ?? null,
          numericValue: existing?.numericValue ?? null,
          expiryDate: existing?.expiryDate ?? null,
          detail,
        }
      }
    })
  }

  const handleChecklistNumberChange = (category: string, itemCode: string, val: number | null) => {
    const key = `${category}_${itemCode}`
    setFormItems(prev => {
      const existing = prev[key]
      return {
        ...prev,
        [key]: {
          category: existing?.category || category,
          itemCode: existing?.itemCode || itemCode,
          value: existing?.value ?? null,
          detail: existing?.detail ?? null,
          expiryDate: existing?.expiryDate ?? null,
          numericValue: val,
        }
      }
    })
  }

  const handleChecklistExpiryChange = (category: string, itemCode: string, expiry: string) => {
    const key = `${category}_${itemCode}`
    setFormItems(prev => {
      const existing = prev[key]
      return {
        ...prev,
        [key]: {
          category: existing?.category || category,
          itemCode: existing?.itemCode || itemCode,
          value: existing?.value ?? null,
          detail: existing?.detail ?? null,
          numericValue: existing?.numericValue ?? null,
          expiryDate: expiry || null,
        }
      }
    })
  }

  const handlePhotoSelect = (category: string, itemCode: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    const posKey = `${category}::${itemCode}::default`
    const addedFiles = Array.from(files)

    setPendingPhotos(prev => ({
      ...prev,
      [posKey]: [...(prev[posKey] || []), ...addedFiles]
    }))
  }

  const removePendingPhoto = (posKey: string, index: number) => {
    setPendingPhotos(prev => {
      const list = [...(prev[posKey] || [])]
      list.splice(index, 1)
      const updated = { ...prev, [posKey]: list }
      if (list.length === 0) delete updated[posKey]
      return updated
    })
  }

  const deleteUploadedPhoto = (photoId: number) => {
    askConfirmation(
      'ยืนยันการลบรูปภาพ',
      'คุณต้องการลบรูปภาพนี้ใช่หรือไม่?',
      async () => {
        try {
          const res = await fetch(`/api/inspection/photo/${photoId}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('ลบรูปภาพล้มเหลว')
          setUploadedPhotos(prev => prev.filter(p => p.inspectionPhotoId !== photoId))
        } catch (err: any) {
          showToast(err.message || 'เกิดข้อผิดพลาด', 'error')
        }
      }
    )
  }

  const handleSaveAuditItem = async (savedMode?: 'QC' | 'AUDIT', isDraft?: boolean): Promise<number | undefined> => {
    if (!activeVehicle) return
    if (!inspectorName.trim()) {
      showToast('กรุณากรอกชื่อผู้ตรวจสอบก่อนบันทึก', 'error')
      throw new Error('กรุณากรอกชื่อผู้ตรวจสอบ')
    }

    setSaving(true)
    try {
      const cleanRem = remark.replace(/^\[ผลการประเมิน:[^\]]+\]\s*/, '').trim()
      const finalRemark = `[ผลการประเมิน: ${autoAssessment}] ${cleanRem}`.trim()
      const mappedAssessment = autoAssessment === 'ปกติ' || autoAssessment?.includes('ผ่าน') ? 'NORMAL' : (autoAssessment === 'ต้องส่งเข้าซ่อม' || autoAssessment?.includes('ไม่ผ่าน')) ? 'NEED_REPAIR' : null

      const resolvedInspectionType = savedMode === 'QC' ? 'QC' : 'AUDIT'
      const statusToSave = isDraft ? 'DRAFT' : 'COMPLETED'

      const payload = {
        vinNo: activeVehicle.vinNo,
        registerNo: activeVehicle.registerNo,
        inspectionType: resolvedInspectionType,
        inspectionSessionId: sessionId,
        mileage: mileage !== '' ? mileage : null,
        inspectionDate: session?.sessionDate || new Date().toISOString().split('T')[0],
        remark: finalRemark || null,
        assessmentResult: mappedAssessment,
        items: Object.values(formItems).map((item: any) => {
          const cat = item.category || item.Category
          const code = item.itemCode || item.ItemCode
          if (cat === 'MILEAGE' && code === 'VALUE') {
            return {
              category: cat,
              itemCode: code,
              ...item,
              numericValue: mileage !== '' ? mileage : null,
              value: mileage !== '' ? String(mileage) : null,
            }
          }
          return {
            ...item,
            category: cat,
            itemCode: code,
          }
        }).filter((it: any) => !!it.category && !!it.itemCode),
        lineUserId: profile?.userId || undefined,
        location: session?.location,
        inspectorName,
        status: statusToSave,
      }

      const isEdit = !!activeVehicle.inspectionId
      const url = '/api/inspection'
      
      const bodyPayload = isEdit 
        ? { ...payload, inspectionId: activeVehicle.inspectionId }
        : payload

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'บันทึกข้อมูลไม่สำเร็จ')
      }

      const resData = await res.json()
      const savedId = activeVehicle.inspectionId || resData.inspectionId

      // Update activeVehicle so subsequent steps know its inspectionId
      if (savedId && (!activeVehicle.inspectionId || activeVehicle.inspectionId !== savedId)) {
        setActiveVehicle(prev => prev ? { ...prev, inspectionId: savedId } : null)
      }

      // Upload pending photos for this step
      const posKeys = Object.keys(pendingPhotos)
      const newlyUploaded: InspectionPhotoData[] = []

      for (const posKey of posKeys) {
        const files = pendingPhotos[posKey]
        if (!files || files.length === 0) continue

        const [cat, code, pos] = posKey.split('::')
        const itemCode = code === 'null' ? null : code
        const photoPosition = pos === 'default' ? null : pos

        const formData = new FormData()
        files.forEach(file => formData.append('files', file))
        formData.append('inspectionId', String(savedId))
        formData.append('category', cat)
        if (itemCode) formData.append('itemCode', itemCode)
        if (photoPosition) formData.append('photoPosition', photoPosition)

        const uploadRes = await fetch('/api/inspection/upload', {
          method: 'POST',
          body: formData,
        })
        if (uploadRes.ok) {
          const upData = await uploadRes.json()
          if (upData.photos) {
            newlyUploaded.push(...upData.photos)
          }
        } else {
          console.error(`Failed to upload photos for ${posKey}`)
        }
      }

      if (newlyUploaded.length > 0) {
        setUploadedPhotos(prev => [...prev, ...newlyUploaded])
      }
      setPendingPhotos({})

      if (isDraft) {
        showToast('บันทึกฉบับร่างและอัปโหลดรูปภาพเรียบร้อยแล้ว', 'success')
      } else {
        showToast('บันทึกผลการตรวจสอบสภาพคันนี้สำเร็จ!', 'success')
        setActiveVehicle(null)
      }

      fetchSessionData()
      return savedId
    } catch (err: any) {
      showToast(err.message || 'เกิดข้อผิดพลาด', 'error')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleCancelAuditItem = () => {
    askConfirmation(
      'ยกเลิกการแก้ไข',
      'ยกเลิกการแก้ไขและปิดฟอร์มนี้ใช่หรือไม่?',
      () => {
        setActiveVehicle(null)
        setPendingPhotos({})
      }
    )
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16 flex flex-col h-screen">
        
        {/* Navigation / Header */}
        <div className="bg-white border-b border-slate-200 shadow-sm flex-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard/inspection-audit')}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 transition active:scale-95 text-xs flex items-center gap-1 shadow-sm font-medium"
              >
                <span>⬅</span> รายการรอบตรวจ
              </button>
              {session && (
                <div>
                  <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>🔍</span> {session.sessionName}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                      session.status === 'CLOSED'
                        ? 'bg-slate-100 text-slate-500 border-slate-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {session.status}
                    </span>
                  </h1>
                  <p className="text-[10px] text-slate-500 font-medium">
                    ลานจอด: {session.locationName || session.location} • วันที่: {getThaiDate(session.sessionDate)}
                    {(session.creatorName || session.createdBy) && (
                      <> • ผู้เปิดรอบ: <strong className="font-semibold text-slate-700">{maskStaffName(session.creatorName || `User #${session.createdBy}`)}</strong></>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canDelete && session && (
                <button
                  type="button"
                  onClick={() => setShowDeleteSessionModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition active:scale-95 flex items-center gap-1 border border-rose-200 cursor-pointer"
                >
                  <span>🗑️</span>
                  <span>ลบรอบตรวจนี้</span>
                </button>
              )}
              {session && session.status === 'OPEN' && (
                <button
                  onClick={handleCloseSession}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  <span>🔒</span>
                  ปิดรอบการตรวจสภาพ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Split Layout Workspace */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-0 md:px-8 py-0 md:py-6 flex flex-col md:flex-row gap-6 overflow-hidden h-[calc(100vh-80px)] md:h-[calc(100vh-100px)]">
          
          {/* Left Column wrapper (responsive toggle) */}
          <div className={`w-full md:w-1/3 flex flex-col bg-white border-0 md:border border-slate-200 rounded-none md:rounded-2xl p-4 shadow-none md:shadow-sm overflow-hidden h-full ${activeVehicle ? 'hidden md:flex' : 'flex'}`}>
            {session ? (
              <AuditVehicleList
                sessionStatus={session.status}
                auditedVehicles={auditedVehicles}
                activeVin={activeVehicle?.vinNo}
                totalChecklistItems={masterItems.length}
                canDelete={canDelete}
                onSelectVehicle={selectAuditedVehicle}
                onAddVehicle={handleSelectSearchVehicle}
                onDeleteVehicle={(item) => setDeleteVehicleConfirm(item)}
              />
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">กำลังโหลด...</div>
            )}
          </div>

          {/* Right Column wrapper (responsive toggle) */}
          <div className={`w-full md:w-2/3 flex flex-col bg-white border-0 md:border border-slate-200 shadow-none md:shadow-sm overflow-hidden h-full ${activeVehicle ? 'flex' : 'hidden md:flex'}`}>
            {activeVehicle && session ? (
              <AuditChecklistForm
                sessionStatus={session.status}
                activeVehicle={activeVehicle}
                dynamicSections={dynamicSections}
                formItems={formItems}
                mileage={mileage}
                remark={remark}
                inspectorName={inspectorName}
                uploadedPhotos={uploadedPhotos}
                pendingPhotos={pendingPhotos}
                saving={saving}
                spacesCdn={SPACES_CDN}
                autoAssessment={autoAssessment}
                damagedItems={damagedItems}
                onMileageChange={setMileage}
                onRemarkChange={setRemark}
                onInspectorNameChange={setInspectorName}
                onChecklistValueChange={handleChecklistValueChange}
                onChecklistDetailChange={handleChecklistDetailChange}
                onChecklistNumberChange={handleChecklistNumberChange}
                onChecklistExpiryChange={handleChecklistExpiryChange}
                onPhotoSelect={handlePhotoSelect}
                onRemovePendingPhoto={removePendingPhoto}
                onDeleteUploadedPhoto={deleteUploadedPhoto}
                onSave={handleSaveAuditItem}
                onCancel={handleCancelAuditItem}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-white">
                <span className="text-4xl">🚗</span>
                <p className="text-xs font-medium mt-3 text-slate-550 max-w-sm">
                  กรุณาพิมพ์หรือค้นหาทะเบียนรถยนต์ทางแผงฝั่งซ้าย เพื่อเริ่มลงบันทึกใบตรวจสภาพในรอบนี้
                </p>
              </div>
            )}
          </div>

        </div>

      </div>

      {toast && (
        <div className={`fixed bottom-5 right-5 z-[100] px-4 py-3 rounded-xl shadow-xl border flex items-center gap-2.5 transition-all duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/50'
            : 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100/50'
        }`}>
          <span className="text-base">{toast.type === 'success' ? '✅' : '❌'}</span>
          <span className="text-xs font-bold">{toast.message}</span>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full space-y-4 animate-scale-in">
            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">{confirmModal.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition active:scale-95"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm()
                  setConfirmModal(null)
                }}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 shadow-sm"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Vehicle Confirmation Modal */}
      {deleteVehicleConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-2xl flex items-center justify-center mx-auto">
              🗑️
            </div>
            <div className="text-center space-y-1.5">
              <h4 className="text-base font-bold text-slate-900">
                ยืนยันการลบผลการตรวจรถคันนี้?
              </h4>
              <p className="text-xs text-slate-600">
                คุณต้องการลบข้อมูลผลการตรวจของรถทะเบียน <strong className="text-slate-900 font-bold">{deleteVehicleConfirm.registerNo || deleteVehicleConfirm.vinNo}</strong> ใช่หรือไม่?
              </p>
              <p className="text-[11px] text-rose-600 bg-rose-50/70 p-2.5 rounded-xl border border-rose-150">
                ⚠️ ข้อมูลเช็คลิสต์และรูปภาพทั้งหมดที่บันทึกของคันนี้จะถูกลบออก
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={deletingVehicle}
                onClick={() => setDeleteVehicleConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deletingVehicle}
                onClick={() => handleDeleteVehicle(deleteVehicleConfirm)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                {deletingVehicle ? (
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

      {/* Delete Current Session Confirmation Modal */}
      {showDeleteSessionModal && session && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-2xl flex items-center justify-center mx-auto">
              🗑️
            </div>
            <div className="text-center space-y-1.5">
              <h4 className="text-base font-bold text-slate-900">
                ยืนยันการลบรอบการตรวจสภาพนี้?
              </h4>
              <p className="text-xs text-slate-600">
                คุณต้องการลบรอบตรวจ <strong className="text-slate-900 font-bold">"{session.sessionName}"</strong> ใช่หรือไม่?
              </p>
              <div className="text-[11px] text-rose-700 bg-rose-50/80 p-3 rounded-xl border border-rose-200 text-left space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span>⚠️</span> คำเตือนสำคัญ:
                </p>
                <p>
                  ข้อมูลการตรวจรถยนต์ในรอบนี้ทั้งหมด ({auditedVehicles.length} คัน) รวมถึงรูปภาพและรายการตรวจเช็คจะถูกลบออกจากระบบอย่างถาวร
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={deletingSession}
                onClick={() => setShowDeleteSessionModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={deletingSession}
                onClick={handleDeleteCurrentSession}
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
    </AuthGuard>
  )
}
