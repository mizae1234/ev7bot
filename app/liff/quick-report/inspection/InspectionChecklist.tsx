'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import type { InspectionItemData, InspectionPhotoData } from '@/lib/inspection/types'
import { buildDynamicSections, createEmptyItemsFromMaster } from '@/lib/inspection/checklist-config'
import ChecklistSection from './ChecklistSection'
import SignaturePad from './SignaturePad'
import PhotoUploader from './PhotoUploader'
import { VehicleNotesSection } from '@/components/vehicle/VehicleNotesSection'

const spacesEndpoint = 'https://sgp1.digitaloceanspaces.com'
const spacesBucket = 'space-ev7tracking-prod'
const SPACES_CDN = (typeof window !== 'undefined' && localStorage.getItem('spaces_cdn')) || spacesEndpoint.replace('https://', `https://${spacesBucket}.`)

interface InspectionChecklistProps {
  masterItems: any[]
  inspectionId: number | null
  existingItems?: InspectionItemData[]
  existingPhotos?: InspectionPhotoData[]
  mileage?: number | null
  remark?: string | null
  disabled?: boolean
  existingReturnDate?: string
  existingParkLocation?: string
  defaultInspectorName?: string
  defaultReturnReason?: string | null
  defaultCustomerName?: string | null
  existingCustomerName?: string | null
  existingCustomerContact?: string | null
  existingContractCancellationDate?: string | null
  inventoryItemId?: number
  registerNo?: string
  lineUserId?: string | null
  contractNo?: string | null
  onSave: (data: {
    items: InspectionItemData[]
    mileage: number | null
    remark: string | null
    returnDate: string
    parkLocation: string
    inspectorName?: string | null
    inspectorUserId?: number | null
    returnReason?: string | null
    assessmentResult?: string | null
    customerName?: string | null
    customerContact?: string | null
    contractCancellationDate?: string | null
  }) => Promise<number | undefined>
  onComplete?: (data: {
    items: InspectionItemData[]
    mileage: number | null
    remark: string | null
    returnDate: string
    parkLocation: string
    inspectorName?: string | null
    inspectorUserId?: number | null
    returnReason?: string | null
    assessmentResult?: string | null
    customerName?: string | null
    customerContact?: string | null
    contractCancellationDate?: string | null
  }) => Promise<void>
  saving?: boolean
  status?: string
  showAlert?: (text: string, type?: 'success' | 'error') => void
  onPhotoDeleted?: (photoId: number) => void
  onPhotoUploaded?: (photos: any[]) => void
}

export default function InspectionChecklist({
  masterItems,
  inspectionId,
  existingItems = [],
  existingPhotos = [],
  mileage: initialMileage = null,
  remark: initialRemark = null,
  disabled = false,
  existingReturnDate,
  existingParkLocation,
  defaultInspectorName = '',
  defaultReturnReason = '',
  defaultCustomerName = '',
  existingCustomerName = '',
  existingCustomerContact = '',
  existingContractCancellationDate = '',
  inventoryItemId,
  registerNo,
  lineUserId,
  contractNo,
  onSave,
  onComplete,
  saving = false,
  status = 'DRAFT',
  showAlert,
  onPhotoDeleted,
  onPhotoUploaded,
}: InspectionChecklistProps) {
  // ---- State: items as a flat map (category_itemCode → data) ----
  const CHECKLIST_SECTIONS = useMemo(() => {
    return buildDynamicSections(masterItems)
  }, [masterItems])

  const [itemsMap, setItemsMap] = useState<Record<string, InspectionItemData>>(() => {
    const map: Record<string, InspectionItemData> = {}

    // First, populate from template (all empty)
    const emptyItems = createEmptyItemsFromMaster(masterItems)
    for (const item of emptyItems) {
      map[`${item.category}_${item.itemCode}`] = { ...item }
    }

    // Then overlay with existing saved data
    for (const item of existingItems) {
      const key = `${item.category}_${item.itemCode}`
      map[key] = { ...item }
    }

    return map
  })

  const [mileage, setMileage] = useState<number | null>(initialMileage)
  const [remark, setRemark] = useState<string>(initialRemark || '')

  // ---- Return Date & Park Location States ----
  const [returnDate, setReturnDate] = useState<string>(() => {
    if (existingReturnDate) {
      const d = new Date(existingReturnDate)
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    // Default to Thailand (local) current date
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  
  const [parkLocation, setParkLocation] = useState<string>(existingParkLocation || '')
  const [locations, setLocations] = useState<{ code: string; name: string }[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)

  // ---- Contract Cancellation Date State ----
  const [contractCancellationDate, setContractCancellationDate] = useState<string>(() => {
    if (existingContractCancellationDate) {
      const d = new Date(existingContractCancellationDate)
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })

  useEffect(() => {
    if (existingContractCancellationDate) {
      const d = new Date(existingContractCancellationDate)
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      setContractCancellationDate(`${year}-${month}-${day}`)
    }
  }, [existingContractCancellationDate])

  // ---- Return Reason State ----
  const [returnReason, setReturnReason] = useState<string>(defaultReturnReason || '')
  const [returnReasons, setReturnReasons] = useState<{ code: string; name: string }[]>([])
  const [loadingReturnReasons, setLoadingReturnReasons] = useState(false)

  useEffect(() => {
    if (defaultReturnReason) {
      setReturnReason(defaultReturnReason)
    }
  }, [defaultReturnReason])

  // Force sync returnReason when options list finishes loading (resolves WebView select element visual delay bug)
  useEffect(() => {
    if (returnReasons.length > 0 && defaultReturnReason) {
      setReturnReason(defaultReturnReason)
    }
  }, [returnReasons, defaultReturnReason])

  // ---- Inspector State ----
  const [inspectorName, setInspectorName] = useState<string>(defaultInspectorName || '')

  // ---- Customer Details States ----
  const [customerName, setCustomerName] = useState<string>(() => {
    return existingCustomerName || defaultCustomerName || ''
  })
  const [customerContact, setCustomerContact] = useState<string>(() => {
    return existingCustomerContact || ''
  })

  // Sync states if they change externally (e.g. when inspectionDetail loads)
  useEffect(() => {
    if (existingCustomerName) {
      setCustomerName(existingCustomerName)
    }
  }, [existingCustomerName])

  useEffect(() => {
    if (existingCustomerContact) {
      setCustomerContact(existingCustomerContact)
    }
  }, [existingCustomerContact])

  useEffect(() => {
    if (defaultCustomerName && !customerName && !existingCustomerName) {
      setCustomerName(defaultCustomerName)
    }
  }, [defaultCustomerName, customerName, existingCustomerName])

  // ---- Note Text Sync State ----
  const [initialNoteText, setInitialNoteText] = useState('')

  useEffect(() => {
    if (defaultInspectorName && !inspectorName) {
      setInspectorName(defaultInspectorName)
    }
  }, [defaultInspectorName, inspectorName])

  // ---- Signature states ----
  const [sigMethod, setSigMethod] = useState<'screen' | 'paper'>('screen')
  const [screenSignatureFile, setScreenSignatureFile] = useState<File | null>(null)
  const [screenSignaturePreview, setScreenSignaturePreview] = useState<string | null>(null)
  const [signaturePhotos, setSignaturePhotos] = useState<InspectionPhotoData[]>(() =>
    existingPhotos.filter(p => p.category === 'SIGNATURE' && p.itemCode === 'CUSTOMER_SIGNATURE')
  )
  const [confirmDeleteSigId, setConfirmDeleteSigId] = useState<number | null>(null)

  useEffect(() => {
    setSignaturePhotos(existingPhotos.filter(p => p.category === 'SIGNATURE' && p.itemCode === 'CUSTOMER_SIGNATURE'))
  }, [existingPhotos])

  const hasSignature = signaturePhotos.length > 0 || screenSignatureFile !== null

  const triggerAlert = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    if (showAlert) {
      showAlert(text, type)
    } else {
      console.log(`[Alert] ${type.toUpperCase()}: ${text}`)
    }
  }, [showAlert])

  const handleSignatureSave = useCallback(async (file: File) => {
    setScreenSignatureFile(file)
    setScreenSignaturePreview(URL.createObjectURL(file))
    
    if (inspectionId) {
      try {
        const formData = new FormData()
        formData.append('files', file)
        formData.append('inspectionId', String(inspectionId))
        formData.append('category', 'SIGNATURE')
        formData.append('itemCode', 'CUSTOMER_SIGNATURE')

        const res = await fetch('/api/inspection/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        setSignaturePhotos(data.photos || [])
        triggerAlert('บันทึกลายเซ็นลูกค้าสำเร็จ ✅')
      } catch (err) {
        console.error(err)
        triggerAlert('อัปโหลดลายเซ็นไม่สำเร็จ', 'error')
      }
    } else {
      triggerAlert('บันทึกลายเซ็นเตรียมอัปโหลดแล้ว กรุณากดบันทึกฉบับร่างเพื่ออัปโหลดลงระบบ')
    }
  }, [inspectionId, triggerAlert])

  // ---- Filled count (for progress display) ----
  const filledCount = useMemo(() => {
    let count = 0
    for (const section of CHECKLIST_SECTIONS) {
      for (const itemDef of section.items) {
        if (itemDef.inputType === 'photos_only') {
          if (itemDef.photoPositions && itemDef.photoPositions.length > 0) {
            const hasAllPositions = itemDef.photoPositions.every(pos =>
              existingPhotos.some(p => p.category === section.category && p.itemCode === itemDef.itemCode && p.photoPosition === pos)
            )
            if (hasAllPositions) count++
          } else {
            const hasPhoto = existingPhotos.some(p => p.category === section.category && p.itemCode === itemDef.itemCode)
            if (hasPhoto) count++
          }
        } else {
          const item = itemsMap[`${section.category}_${itemDef.itemCode}`]
          if (item && (item.value || item.numericValue != null || item.detail || item.expiryDate)) {
            count++
          }
        }
      }
    }
    return count
  }, [itemsMap, existingPhotos, CHECKLIST_SECTIONS])

  const totalCount = useMemo(() => {
    return CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0)
  }, [CHECKLIST_SECTIONS])

  // ---- Auto Assessment Summary ----
  const autoAssessment = useMemo(() => {
    if (totalCount === 0 || filledCount < totalCount) {
      return 'รอผลการตรวจ'
    }

    let hasIssues = false
    Object.values(itemsMap).forEach((item: any) => {
      // 1. check three_way items (like body condition, tire, underbody)
      if (item.value === 'SCRATCH' || item.value === 'DENT') {
        hasIssues = true
      }
      // 2. check boolean items (for ACCIDENT, YES is an issue; for others, NO is an issue)
      if (item.value === 'NO' && item.category !== 'ACCIDENT') {
        hasIssues = true
      }
      if (item.value === 'YES' && item.category === 'ACCIDENT') {
        hasIssues = true
      }
      // 3. check license plate
      if (item.value === 'NONE' || item.value === 'FRONT_ONLY' || item.value === 'BACK_ONLY') {
        hasIssues = true
      }
    })
    return hasIssues ? 'ต้องส่งเข้าซ่อม' : 'ปกติ'
  }, [itemsMap, filledCount, totalCount])

  const damagedItems = useMemo(() => {
    const list: { label: string; valueLabel: string }[] = []
    for (const section of CHECKLIST_SECTIONS) {
      for (const itemDef of section.items) {
        const data = itemsMap[`${section.category}_${itemDef.itemCode}`]
        if (!data || !data.value) continue
        
        let isDamaged = false
        if (section.category === 'ACCIDENT') {
          isDamaged = data.value === 'YES'
        } else {
          isDamaged = data.value === 'SCRATCH' || data.value === 'DENT' || data.value === 'NO' ||
                      data.value === 'NONE' || data.value === 'FRONT_ONLY' || data.value === 'BACK_ONLY'
        }

        if (isDamaged) {
          const opt = itemDef.options?.find(o => o.value === data.value)
          list.push({
            label: itemDef.label,
            valueLabel: opt ? opt.label : data.value
          })
        }
      }
    }
    return list
  }, [itemsMap])

  // ---- Fetch locations ----
  useEffect(() => {
    setLoadingLocations(true)
    fetch('/api/liff/locations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLocations(data)
        }
      })
      .catch(err => console.error('Failed to fetch locations:', err))
      .finally(() => setLoadingLocations(false))
  }, [])

  // ---- Fetch return reasons ----
  useEffect(() => {
    setLoadingReturnReasons(true)
    fetch('/api/liff/return-reasons')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setReturnReasons(data)
        }
      })
      .catch(err => console.error('Failed to fetch return reasons:', err))
      .finally(() => setLoadingReturnReasons(false))
  }, [])

  // Sync states if props change (e.g. when loading details)
  useEffect(() => {
    if (existingReturnDate) {
      const d = new Date(existingReturnDate)
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      setReturnDate(`${year}-${month}-${day}`)
    }
    if (existingParkLocation) {
      setParkLocation(existingParkLocation)
    }
    if (initialMileage !== null) {
      setMileage(initialMileage)
    }
    if (initialRemark !== null) {
      setRemark(initialRemark || '')
    }
    if (defaultReturnReason) {
      setReturnReason(defaultReturnReason)
    }
  }, [existingReturnDate, existingParkLocation, initialMileage, initialRemark, defaultReturnReason])

  // Sync itemsMap when existingItems changes (e.g. when draft details finish loading)
  useEffect(() => {
    if (!existingItems || existingItems.length === 0) return
    setItemsMap(prev => {
      const map = { ...prev }
      for (const item of existingItems) {
        const key = `${item.category}_${item.itemCode}`
        map[key] = {
          ...map[key],
          ...item,
        }
      }
      return map
    })
  }, [existingItems])

  // ---- Handlers ----

  const handleItemChange = useCallback((
    category: string,
    itemCode: string,
    field: keyof InspectionItemData,
    value: any
  ) => {
    const key = `${category}_${itemCode}`
    setItemsMap(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        category,
        itemCode,
        [field]: value,
      },
    }))
  }, [])

  const handlePhotosChange = useCallback((
    category: string,
    itemCode: string | null,
    files: File[],
    position?: string | null
  ) => {
    // Photos are handled by PhotoUploader directly via API
  }, [])

  const handleSave = useCallback(async () => {
    const rawItems = Object.values(itemsMap)
    const items = rawItems.map(item => {
      if (item.category === 'CAR_PHOTOS' && item.itemCode === 'AROUND') {
        const carPhotos = existingPhotos.filter(p => p.category === 'CAR_PHOTOS' && p.itemCode === 'AROUND')
        const hasFront = carPhotos.some(p => p.photoPosition === 'FRONT')
        const hasBack = carPhotos.some(p => p.photoPosition === 'BACK')
        const hasLeft = carPhotos.some(p => p.photoPosition === 'LEFT')
        const hasRight = carPhotos.some(p => p.photoPosition === 'RIGHT')
        const isDone = hasFront && hasBack && hasLeft && hasRight
        return {
          ...item,
          value: isDone ? 'YES' : 'NO'
        }
      }
      return item
    })
    const cleanRem = remark.replace(/^\[ผลการประเมิน:[^\]]+\]\s*/, '').trim()
    const finalRemark = `[ผลการประเมิน: ${autoAssessment}] ${cleanRem}`.trim()
    const mappedAssessment = autoAssessment === 'ปกติ' ? 'NORMAL' : autoAssessment === 'ต้องส่งเข้าซ่อม' ? 'NEED_REPAIR' : null
    
    const newId = await onSave({ 
      items, 
      mileage, 
      remark: finalRemark || null, 
      returnDate, 
      parkLocation,
      inspectorName: inspectorName || null,
      returnReason: returnReason || null,
      assessmentResult: mappedAssessment,
      customerName: customerName || null,
      customerContact: customerContact || null,
      contractCancellationDate: contractCancellationDate || null,
    })

    if (screenSignatureFile && !inspectionId && newId) {
      try {
        const formData = new FormData()
        formData.append('files', screenSignatureFile)
        formData.append('inspectionId', String(newId))
        formData.append('category', 'SIGNATURE')
        formData.append('itemCode', 'CUSTOMER_SIGNATURE')

        const res = await fetch('/api/inspection/upload', {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          setSignaturePhotos(data.photos || [])
          setScreenSignatureFile(null)
          setScreenSignaturePreview(null)
        }
      } catch (err) {
        console.error(err)
      }
    }
  }, [itemsMap, existingPhotos, mileage, remark, returnDate, parkLocation, inspectorName, screenSignatureFile, inspectionId, autoAssessment, returnReason, customerName, customerContact, contractCancellationDate, onSave])

  const handleCompleteClick = useCallback(async () => {
    if (!returnDate) {
      triggerAlert('กรุณากรอกวันที่คืนรถ', 'error')
      return
    }
    if (!contractCancellationDate) {
      triggerAlert('กรุณากรอกวันที่ยกเลิกสัญญา', 'error')
      return
    }
    if (!parkLocation) {
      triggerAlert('กรุณาเลือกสถานที่คืนรถ/ลานจอด', 'error')
      return
    }
    if (!inspectorName) {
      triggerAlert('กรุณากรอกชื่อผู้ตรวจเช็ค/เจ้าหน้าที่', 'error')
      return
    }
    if (!customerName) {
      triggerAlert('กรุณากรอกชื่อลูกค้าที่นำรถมาคืน', 'error')
      return
    }
    if (!customerContact) {
      triggerAlert('กรุณากรอกเบอร์ติดต่อลูกค้า', 'error')
      return
    }
    if (!returnReason) {
      triggerAlert('กรุณาเลือกเหตุผลในการคืนรถ', 'error')
      return
    }

    // Validate that all 4 sides of the car are uploaded (รูปรถรอบคัน FRONT, BACK, LEFT, RIGHT)
    const carPhotos = existingPhotos.filter(p => p.category === 'CAR_PHOTOS' && p.itemCode === 'AROUND')
    const hasFront = carPhotos.some(p => p.photoPosition === 'FRONT')
    const hasBack = carPhotos.some(p => p.photoPosition === 'BACK')
    const hasLeft = carPhotos.some(p => p.photoPosition === 'LEFT')
    const hasRight = carPhotos.some(p => p.photoPosition === 'RIGHT')

    if (!hasFront || !hasBack || !hasLeft || !hasRight) {
      triggerAlert('กรุณาอัปโหลดรูปรถรอบคันให้ครบทั้ง 4 ด้าน (หน้า, หลัง, ซ้าย, ขวา)', 'error')
      return
    }

    // Validate that any damaged item has at least one photo uploaded
    for (const section of CHECKLIST_SECTIONS) {
      for (const itemDef of section.items) {
        if (itemDef.hasPhoto === false) continue

        const data = itemsMap[`${section.category}_${itemDef.itemCode}`]
        if (!data) continue

        let isDamaged = false
        if (section.category === 'ACCIDENT') {
          isDamaged = data.value === 'YES'
        } else if (itemDef.inputType === 'three_way') {
          isDamaged = data.value === 'SCRATCH' || data.value === 'DENT'
        }

        if (isDamaged) {
          const photos = existingPhotos.filter(
            p => p.category === section.category && p.itemCode === itemDef.itemCode
          )
          if (photos.length === 0) {
            triggerAlert(`กรุณาแนบรูปภาพสำหรับหัวข้อที่มีความเสียหาย: ${itemDef.label}`, 'error')
            return
          }
        }
      }
    }

    if (onComplete) {
      const rawItems = Object.values(itemsMap)
      const items = rawItems.map(item => {
        if (item.category === 'CAR_PHOTOS' && item.itemCode === 'AROUND') {
          const carPhotos = existingPhotos.filter(p => p.category === 'CAR_PHOTOS' && p.itemCode === 'AROUND')
          const hasFront = carPhotos.some(p => p.photoPosition === 'FRONT')
          const hasBack = carPhotos.some(p => p.photoPosition === 'BACK')
          const hasLeft = carPhotos.some(p => p.photoPosition === 'LEFT')
          const hasRight = carPhotos.some(p => p.photoPosition === 'RIGHT')
          const isDone = hasFront && hasBack && hasLeft && hasRight
          return {
            ...item,
            value: isDone ? 'YES' : 'NO'
          }
        }
        return item
      })
      const cleanRem = remark.replace(/^\[ผลการประเมิน:[^\]]+\]\s*/, '').trim()
      const finalRemark = `[ผลการประเมิน: ${autoAssessment}] ${cleanRem}`.trim()
      const mappedAssessment = autoAssessment === 'ปกติ' ? 'NORMAL' : autoAssessment === 'ต้องส่งเข้าซ่อม' ? 'NEED_REPAIR' : null

      let activeId = inspectionId
      if (screenSignatureFile && !inspectionId) {
        const newId = await onSave({
          items,
          mileage,
          remark: finalRemark || null,
          returnDate,
          parkLocation,
          inspectorName: inspectorName || null,
          returnReason: returnReason || null,
          assessmentResult: mappedAssessment,
          customerName: customerName || null,
          customerContact: customerContact || null,
          contractCancellationDate: contractCancellationDate || null,
        })
        if (!newId) return
        activeId = newId

        try {
          const formData = new FormData()
          formData.append('files', screenSignatureFile)
          formData.append('inspectionId', String(newId))
          formData.append('category', 'SIGNATURE')
          formData.append('itemCode', 'CUSTOMER_SIGNATURE')

          const res = await fetch('/api/inspection/upload', {
            method: 'POST',
            body: formData,
          })
          if (res.ok) {
            setScreenSignatureFile(null)
            setScreenSignaturePreview(null)
          }
        } catch (err) {
          console.error(err)
        }
      }

      await onComplete({
        items,
        mileage,
        remark: finalRemark || null,
        returnDate,
        parkLocation,
        inspectorName: inspectorName || null,
        returnReason: returnReason || null,
        assessmentResult: mappedAssessment,
        customerName: customerName || null,
        customerContact: customerContact || null,
        contractCancellationDate: contractCancellationDate || null,
      })
    }
  }, [itemsMap, mileage, remark, returnDate, parkLocation, inspectorName, screenSignatureFile, signaturePhotos, existingPhotos, inspectionId, autoAssessment, returnReason, customerName, customerContact, contractCancellationDate, onSave, onComplete])



  return (
    <div className="space-y-4">
      {/* Return Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 animate-scale-up">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <span>📅</span> ข้อมูลการส่งคืนรถ
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-500">วันที่คืนรถ <span className="text-rose-500">*</span></label>
            <input
              type="date"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-500">วันที่ยกเลิกสัญญา <span className="text-rose-500">*</span></label>
            <input
              type="date"
              value={contractCancellationDate}
              onChange={e => setContractCancellationDate(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          
          <div className="space-y-1 col-span-2">
            <label className="text-[10px] font-bold text-slate-500">สถานที่คืนรถ/ลานจอด <span className="text-rose-500">*</span></label>
            <select
              value={parkLocation}
              onChange={e => setParkLocation(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="">-- เลือกสถานที่จอดคืน --</option>
              {locations.map(loc => (
                <option key={loc.code} value={loc.code}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-[10px] font-bold text-slate-500">เหตุผลในการคืนรถ <span className="text-rose-500">*</span></label>
            <select
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="">-- เลือกเหตุผลการคืนรถ --</option>
              {returnReasons.map(r => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-500">ชื่อลูกค้าที่นำรถมาคืน <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="กรอกชื่อลูกค้าที่นำรถมาคืน"
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-bold text-slate-500">เบอร์ติดต่อลูกค้า <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={customerContact}
              onChange={e => setCustomerContact(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="กรอกเบอร์โทรศัพท์ลูกค้า"
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-[10px] font-bold text-slate-500">เจ้าหน้าที่ตรวจเช็ค (ชื่อผู้ตรวจเช็ค) <span className="text-rose-500">*</span></label>
            <input
              type="text"
              value={inspectorName}
              onChange={e => setInspectorName(e.target.value)}
              placeholder="พิมพ์ชื่อเจ้าหน้าที่หรือช่างผู้ตรวจเช็ค"
              disabled={disabled}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500">ความคืบหน้า</span>
          <span className="text-xs font-bold text-emerald-600">
            {filledCount}/{totalCount} ข้อ
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (filledCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Checklist sections */}
      {CHECKLIST_SECTIONS.map(section => (
        <ChecklistSection
          key={section.category}
          section={section}
          items={
            Object.fromEntries(
              section.items.map(itemDef => [
                itemDef.itemCode,
                itemsMap[`${section.category}_${itemDef.itemCode}`] || {},
              ])
            )
          }
          inspectionId={inspectionId}
          existingPhotos={existingPhotos.filter(p => p.category === section.category)}
          onChange={(itemCode, field, value) =>
            handleItemChange(section.category, itemCode, field, value)
          }
          onPhotosChange={handlePhotosChange}
          disabled={disabled}
          onPhotoDeleted={onPhotoDeleted}
          onUploadSuccess={onPhotoUploaded}
          lineUserId={lineUserId}
        />
      ))}


      {/* Customer Signature Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <span>✍️</span> ลายเซ็นของลูกค้า (ไม่บังคับ)
        </h4>
        
        {!disabled && (
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setSigMethod('screen')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                sigMethod === 'screen' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              🖊️ เซ็นผ่านหน้าจอ
            </button>
            <button
              type="button"
              onClick={() => setSigMethod('paper')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                sigMethod === 'paper' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              📸 แนบเอกสาร/รูปเซ็น
            </button>
          </div>
        )}

        {sigMethod === 'screen' ? (
          <div className="space-y-3">
            {/* Drawing Area */}
            {!disabled && (
              <SignaturePad 
                onSave={handleSignatureSave} 
                disabled={disabled} 
              />
            )}

            {/* Signature preview / Uploaded signature */}
            {signaturePhotos.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500">ลายเซ็นที่บันทึกแล้วในระบบ:</p>
                <div className="flex flex-wrap gap-2">
                  {signaturePhotos.map((photo, i) => (
                    <div key={i} className="relative w-32 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img
                        src={`${SPACES_CDN}/${photo.s3Key}`}
                        alt="Customer Signature"
                        className="w-full h-full object-contain"
                      />
                      {!disabled && photo.inspectionPhotoId && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSigId(photo.inspectionPhotoId!)}
                          className="absolute top-0 right-0 bg-rose-500 text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center active:scale-90 transition shadow-sm z-10"
                          title="ลบลายเซ็น"
                        >
                          ✕
                        </button>
                      )}
                      {confirmDeleteSigId === photo.inspectionPhotoId && (
                        <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-20 transition-all duration-200">
                          <span className="text-[10px] font-bold text-white mb-1">ลบลายเซ็น?</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                const photoId = photo.inspectionPhotoId
                                if (!photoId) return
                                try {
                                  const url = lineUserId
                                    ? `/api/inspection/photo/${photoId}?lineUserId=${encodeURIComponent(lineUserId)}`
                                    : `/api/inspection/photo/${photoId}`
                                  const res = await fetch(url, {
                                    method: 'DELETE',
                                  })
                                  if (!res.ok) throw new Error('Delete failed')
                                  setSignaturePhotos(prev => prev.filter(p => p.inspectionPhotoId !== photoId))
                                  if (onPhotoDeleted) onPhotoDeleted(photoId)
                                } catch (err) {
                                  console.error(err)
                                } finally {
                                  setConfirmDeleteSigId(null)
                                }
                              }}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded font-bold"
                            >
                              ลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSigId(null)}
                              className="bg-slate-600 hover:bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded font-bold"
                            >
                              เลิก
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : screenSignaturePreview ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  ลายเซ็นรอดำเนินการบันทึก (กรุณากดบันทึกฉบับร่างหรือยืนยันเพื่อให้ระบบอัปโหลดลงฐานข้อมูล)
                </p>
                <div className="w-32 h-16 rounded-xl overflow-hidden border border-amber-300 bg-amber-50">
                  <img
                    src={screenSignaturePreview}
                    alt="Pending Signature"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ) : disabled && (
              <p className="text-xs text-slate-500 italic">ไม่มีข้อมูลลายเซ็นสด</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <PhotoUploader
              inspectionId={inspectionId}
              category="SIGNATURE"
              itemCode="CUSTOMER_SIGNATURE"
              label="📷 ถ่ายรูปเอกสารเซ็นชื่อ"
              existingPhotos={signaturePhotos}
              disabled={disabled}
              onUploadSuccess={(photos) => {
                setSignaturePhotos(prev => [...prev, ...photos])
              }}
              onPhotoDeleted={(photoId) => {
                setSignaturePhotos(prev => prev.filter(p => p.inspectionPhotoId !== photoId))
                if (onPhotoDeleted) onPhotoDeleted(photoId)
              }}
              lineUserId={lineUserId}
            />
          </div>
        )}
      </div>

      {/* Remark */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm space-y-2">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>📝</span> หมายเหตุ
        </label>
        <textarea
          value={remark}
          onChange={e => setRemark(e.target.value)}
          disabled={disabled}
          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
        />
      </div>

      {/* Auto Assessment Card with Damage Summary List */}
      <div className={`p-4 rounded-2xl border flex flex-col gap-2 shadow-sm transition duration-300 ${
        autoAssessment === 'ต้องส่งเข้าซ่อม' 
          ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100/50' 
          : autoAssessment === 'รอผลการตรวจ'
          ? 'bg-slate-50 border-slate-200 text-slate-800 shadow-slate-100/50'
          : 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/50'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {autoAssessment === 'ต้องส่งเข้าซ่อม' ? '⚠️' : autoAssessment === 'รอผลการตรวจ' ? '⏳' : '✅'}
          </span>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ผลประเมินสภาพรถ (ประมวลผลอัตโนมัติ)</p>
            <p className="text-sm font-extrabold">{autoAssessment}</p>
          </div>
        </div>

        {autoAssessment === 'ต้องส่งเข้าซ่อม' && damagedItems.length > 0 && (
          <div className="mt-1 pt-2 border-t border-rose-200/60 text-xs space-y-2">
            <div className="flex justify-between items-center">
              <p className="font-extrabold text-[10px] uppercase text-rose-700">🛠️ รายการความเสียหายที่ตรวจพบ:</p>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => {
                    const summaryText = `พบจุดที่ต้องส่งซ่อมจากการคืนรถ:\n` + damagedItems.map((item, idx) => `${idx + 1}. ${item.label} (${item.valueLabel})`).join('\n') + `\n`
                    setInitialNoteText(summaryText)
                    triggerAlert('ดึงจุดเสียหายลงกล่องแชตเรียบร้อย 📋')
                  }}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] flex items-center gap-1 active:scale-95 transition"
                >
                  📋 ดึงลงกล่องแชต
                </button>
              )}
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-700 font-medium">
              {damagedItems.map((item, idx) => (
                <li key={idx}>
                  <span className="font-semibold text-slate-800">{item.label}</span>: <span className="text-rose-600 underline font-semibold">{item.valueLabel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Vehicle Note section (Above Action Buttons) */}
      {inventoryItemId && registerNo && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 pb-2">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
            <span>💬</span> บันทึกข้อมูลรถประจำรอบการคืนนี้
          </h4>
          <VehicleNotesSection
            inventoryItemId={inventoryItemId}
            registerNo={registerNo}
            lineUserId={lineUserId}
            sourceProcess="VEHICLE_RETURN"
            refDocNo={contractNo || undefined}
            initialNoteText={initialNoteText}
          />
        </div>
      )}

      {/* Action buttons */}
      {!disabled && (
        <div className="space-y-2 pb-6 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-2xl font-bold text-sm transition shadow-sm active:scale-[0.98] bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                กำลังบันทึก...
              </span>
            ) : (
              `💾 บันทึกฉบับร่าง (${filledCount}/${totalCount} ข้อ)`
            )}
          </button>

          {status === 'DRAFT' && onComplete && filledCount === totalCount && (
            <button
              type="button"
              onClick={handleCompleteClick}
              disabled={saving}
              className="w-full py-3 rounded-2xl font-bold text-sm transition shadow-sm active:scale-[0.98] bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            >
              ✅ ยืนยัน — ตรวจสภาพเสร็จสิ้น
            </button>
          )}
        </div>
      )}
    </div>
  )
}
