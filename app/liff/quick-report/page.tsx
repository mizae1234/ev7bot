'use client'

import React, { useState, useEffect } from 'react'

interface DbCar {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project: string
}

interface AttachedFile {
  id: string
  name: string
  url: string
  type: 'image' | 'document'
  fileSize?: string
  file?: File
}

interface FollowUpLog {
  MaintenanceFollowUpID: number
  FollowUpDate: string
  FollowUpDetail: string
  CreateUserName: string
}

interface MaintenanceTicket {
  MaintenanceItemID: number
  ReportDate: string
  IncidentDate: string
  CarStatusCode?: string
  CarStatusDescription: string
  IssueTitle: string
  ServiceLocation: string
  ServiceLocationCode?: string
  DriverName?: string
  ProblemTypeCode?: string
  FaultPartyCode?: string
  CarCaseCode?: string
  InsuranceCode?: string
  ClaimNumber?: string
  VinNo?: string
  RegisterNo?: string
  followUps: FollowUpLog[]
  attachments?: any[]
}

const locationOptions = [
  { code: 'AION_GI_KANCHANAPISEK', name: 'Aion กาญจนาฯ' },
  { code: 'AION_GI_RAMINTRA_EXPRESSWAY', name: 'Aion เลียบด่วนฯ' },
  { code: 'AION_GI_PIBULSONGKRAM', name: 'Aion พิบูลฯ' },
  { code: 'AION_GI_MINBURI', name: 'Aion มีนบุรี' },
  { code: 'AION_GI_MAHACHAI', name: 'Aion มหาชัย' },
  { code: 'AION_GI_SALAYA', name: 'Aion ศาลายา' },
  { code: 'EV7_YARD_PRAPADAENG', name: 'EV7 Yard พระประแดง' },
  { code: 'SMART_TAXI', name: 'สมาร์ทเแท็กซี่' },
  { code: 'GARAGE_BUNGKHWANG', name: 'อู่ บึงขวาง' },
  { code: 'GARAGE_TS', name: 'อู่ TS' },
  { code: 'GARAGE_88_CAR', name: 'อู่ 88 คาร์' },
  { code: 'GARAGE_CRN_PAKKRET', name: 'อู่ CRN ปากเกร็ด' },
  { code: 'GARAGE_56_COLOR', name: 'อู่ 56 Color' },
  { code: 'GARAGE_PRICHA', name: 'อู่ ปรีชา' },
  { code: 'GARAGE_PERFECTCAR', name: 'อู่ เพอร์เฟคคาร์' },
  { code: 'GARAGE_SAHACAR', name: 'อู่ สหาคาร์' },
  { code: 'GARAGE_PREMIUMCAR', name: 'อู่ พรีเมี่ยมคาร์' },
  { code: 'GARAGE_BESTCARPAINT', name: 'อู่ เบสท์คาร์เพ้นท์' },
  { code: 'BRANCH_AYUTTHAYA', name: 'สาขา อยุธยา' },
  { code: 'BB_CARPAINT', name: 'อู่ บีบี คาร์เพ้นท์' },
  { code: 'AUTOHAUS', name: 'อู่ Autohaus' }
]

const ImagePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  if (!previewUrl) return null

  return (
    <div className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
      <img
        src={previewUrl}
        alt={file.name}
        className="w-full h-full object-cover"
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm transition active:scale-90"
      >
        ✕
      </button>
    </div>
  )
}

export default function QuickReportPage() {
  const [activeTab, setActiveTab] = useState<'report' | 'history' | 'contact' | 'dashboard'>('report')

  // Search and selection
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCar, setSelectedCar] = useState<DbCar | null>(null)
  const [showCarDropdown, setShowCarDropdown] = useState(false)
  const [dbCars, setDbCars] = useState<DbCar[]>([])
  const [loadingCars, setLoadingCars] = useState(false)

  // Form Fields
  const [driverName, setDriverName] = useState('')
  const [incidentDate, setIncidentDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })
  const [issueDescription, setIssueDescription] = useState('')
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [serviceLocation, setServiceLocation] = useState('')
  const [initialCarStatus, setInitialCarStatus] = useState('')

  // Master database fields (Problem Type & Insurance)
  const [problemType, setProblemType] = useState('ACCIDENT')
  const [insurance, setInsurance] = useState('')
  const [claimNo, setClaimNo] = useState('')
  const [faultParty, setFaultParty] = useState('')
  const [carCase, setCarCase] = useState('')

  // Statuses
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submittedData, setSubmittedData] = useState<any>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [speechError, setSpeechError] = useState<string | null>(null)

  // Selected Car Details (Real Database)
  const [vehicleHistory, setVehicleHistory] = useState<MaintenanceTicket[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Inline update ticket states (Sub-page/SPA View)
  const [editingTicket, setEditingTicket] = useState<MaintenanceTicket | null>(null)
  const [editStatus, setEditStatus] = useState('')
  const [editFollowUp, setEditFollowUp] = useState('')
  const [updatingTicket, setUpdatingTicket] = useState(false)
  const [editAttachments, setEditAttachments] = useState<File[]>([])
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<number[]>([])
  const [dbCarStatuses, setDbCarStatuses] = useState<{ StatusCode: string, StatusName: string }[]>([])

  // Full Detail Edit SPA States
  const [editDetailTicket, setEditDetailTicket] = useState<MaintenanceTicket | null>(null)
  const [editDetailFields, setEditDetailFields] = useState({
    driverName: '',
    incidentDate: '',
    issueTitle: '',
    carStatusCode: '',
    serviceLocationCode: '',
    problemType: '',
    faultParty: '',
    carCase: '',
    insurance: '',
    claimNumber: '',
  })
  const [editDetailAttachments, setEditDetailAttachments] = useState<File[]>([])
  const [editDetailDeletedPhotoIds, setEditDetailDeletedPhotoIds] = useState<number[]>([])
  const [savingDetailEdit, setSavingDetailEdit] = useState(false)

  // Tab 2 Quick Follow-up States
  const [quickLogs, setQuickLogs] = useState<Record<number, string>>({})
  const [savingQuickLogId, setSavingQuickLogId] = useState<number | null>(null)

  // Tab 3 Update Location States
  const [selectedMaintId, setSelectedMaintId] = useState<number | ''>('')
  const [selectedLocCode, setSelectedLocCode] = useState('')
  const [locSearchTerm, setLocSearchTerm] = useState('')
  const [showLocDropdown, setShowLocDropdown] = useState(false)
  const [updatingLocation, setUpdatingLocation] = useState(false)

  // Tab 4 Mobile Dashboard States
  const [mobileDashboardData, setMobileDashboardData] = useState<any>(null)
  const [loadingMobileDashboard, setLoadingMobileDashboard] = useState(false)
  const [expandedLocationCode, setExpandedLocationCode] = useState<string | null>(null)

  // Quick Check-in State
  const [checkingInId, setCheckingInId] = useState<number | null>(null)

  // Show Add Incident Form State
  const [showAddIncidentForm, setShowAddIncidentForm] = useState(false)

  // Bulk Action States
  const [bulkActionType, setBulkActionType] = useState<'park' | 'start' | 'complete' | null>(null)
  const [bulkLocation, setBulkLocation] = useState('')
  const [bulkStartDate, setBulkStartDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })
  const [bulkFinishDate, setBulkFinishDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 16)
  })
  const [submittingBulk, setSubmittingBulk] = useState(false)
  const [selectedBulkTicketIds, setSelectedBulkTicketIds] = useState<number[]>([])

  // Fetch cars on mount or when typing (Debounced)
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      setLoadingCars(true)
      try {
        const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(searchTerm)}`)
        if (res.ok) {
          const data = await res.json()
          setDbCars(data)
        }
      } catch (err) {
        console.error('Error searching cars:', err)
      } finally {
        setLoadingCars(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [searchTerm])

  // Get current user's LINE User ID from AuthGuard's liff_profile cache
  const getLineUserId = (): string | null => {
    if (typeof window === 'undefined') return null
    const profileStr = localStorage.getItem('liff_profile')
    if (!profileStr) return null
    try {
      const profile = JSON.parse(profileStr)
      return profile.userId || null
    } catch {
      return null
    }
  }

  // Fetch real details (active driver, history) when selectedCar changes
  const handleSelectCar = async (car: DbCar) => {
    setSelectedCar(car)
    setShowCarDropdown(false)
    setLoadingHistory(true)
    setVehicleHistory([])
    setShowAddIncidentForm(false)

    try {
      const res = await fetch(`/api/vehicle/${encodeURIComponent(car.RegisterNo)}`)
      if (res.ok) {
        const data = await res.json()
        setDbCarStatuses(data.carStatuses || [])
        
        // 1. Set driver name if there is an active rental contract
        if (data.currentRent) {
          const name = `${data.currentRent.FirstName} ${data.currentRent.LastName}`.trim()
          setDriverName(name)
        } else {
          setDriverName('')
        }

        // 2. Set maintenance history & prepopulate location states for Tab 3
        if (data.maintenance) {
          setVehicleHistory(data.maintenance)
          const firstPending = data.maintenance.find((t: any) => t.CarStatusDescription !== 'ซ่อมเสร็จ')
          setShowAddIncidentForm(!firstPending)
          if (firstPending) {
            setSelectedMaintId(firstPending.MaintenanceItemID)
            const matchedLoc = locationOptions.find(o => o.code === firstPending.ServiceLocationCode || o.name === firstPending.ServiceLocation)
            setSelectedLocCode(matchedLoc ? matchedLoc.code : (firstPending.ServiceLocationCode || ''))
            setLocSearchTerm(matchedLoc ? matchedLoc.name : (firstPending.ServiceLocation || ''))
          } else if (data.maintenance.length > 0) {
            setSelectedMaintId(data.maintenance[0].MaintenanceItemID)
            const matchedLoc = locationOptions.find(o => o.code === data.maintenance[0].ServiceLocationCode || o.name === data.maintenance[0].ServiceLocation)
            setSelectedLocCode(matchedLoc ? matchedLoc.code : (data.maintenance[0].ServiceLocationCode || ''))
            setLocSearchTerm(matchedLoc ? matchedLoc.name : (data.maintenance[0].ServiceLocation || ''))
          } else {
            setSelectedMaintId('')
            setSelectedLocCode('')
            setLocSearchTerm('')
          }
        }
      }
    } catch (err) {
      console.error('Error fetching vehicle contract/history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Quick Check-in Function
  const handleQuickCheckIn = async (maintId: number) => {
    if (!confirm('ยืนยันนำรถคันนี้เข้าซ่อมบำรุงใช่หรือไม่?\n(สถานะใบแจ้งซ่อมจะเปลี่ยนเป็น "อยู่ระหว่างการซ่อม")')) {
      return
    }

    setCheckingInId(maintId)
    try {
      const res = await fetch('/api/maintenance/update-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId: maintId,
          carStatusCode: 'IN_MAINTENANCE',
          followUpDetail: '🔴 ดำเนินการ: นำรถเข้าซ่อมบำรุง (งดใช้งาน)',
          lineUserId: getLineUserId()
        })
      })

      if (!res.ok) {
        throw new Error('ไม่สามารถอัปเดตสถานะนำรถเข้าซ่อมได้')
      }

      const result = await res.json()
      alert(result.message || 'บันทึกนำรถเข้าซ่อมเรียบร้อยแล้ว')

      // Refresh data
      if (selectedCar) {
        handleSelectCar(selectedCar)
      }
      
      // Also fetch dashboard data in background if it was loaded
      fetchMobileDashboard()
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setCheckingInId(null)
    }
  }

  // Bulk Action Save Handler
  const handleSaveBulkAction = async (type: 'park' | 'start' | 'complete') => {
    const selectedTickets = pendingTickets.filter(t => selectedBulkTicketIds.includes(t.MaintenanceItemID))
    if (selectedTickets.length === 0) {
      alert('กรุณาเลือกรายการใบงานที่ต้องการดำเนินการอย่างน้อย 1 รายการ')
      return
    }

    setSubmittingBulk(true)
    try {
      const locName = locationOptions.find(o => o.code === bulkLocation)?.name || 'ไม่ระบุ / นอกสถานที่'
      
      const promises = selectedTickets.map(ticket => {
        const payload: any = {
          maintenanceId: ticket.MaintenanceItemID,
          lineUserId: getLineUserId()
        }

        if (type === 'park') {
          payload.carStatusCode = 'WAITING_FOR_MAINTENANCE'
          payload.serviceLocationCode = bulkLocation
          payload.serviceLocationName = locName
          payload.followUpDetail = `🟡 อัปเดต: รถจอดรอซ่อม ณ สถานที่: ${locName}`
        } else if (type === 'start') {
          payload.carStatusCode = 'IN_MAINTENANCE'
          payload.startDate = bulkStartDate
          payload.serviceLocationCode = bulkLocation
          payload.serviceLocationName = locName
          payload.followUpDetail = `🔴 อัปเดต: เริ่มซ่อม ณ อู่: ${locName} เมื่อวันที่: ${formatLiffTime(bulkStartDate)}`
        } else if (type === 'complete') {
          payload.carStatusCode = 'COMPLETE'
          payload.finishDate = bulkFinishDate
          payload.followUpDetail = `🟢 อัปเดต: ซ่อมเสร็จสิ้น เมื่อวันที่: ${formatLiffTime(bulkFinishDate)}`
        }

        return fetch('/api/maintenance/update-quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      })

      const responses = await Promise.all(promises)
      const failed = responses.filter(r => !r.ok)

      if (failed.length > 0) {
        throw new Error(`อัปเดตไม่สำเร็จจำนวน ${failed.length} รายการ`)
      }

      alert('บันทึกอัปเดตข้อมูลเรียบร้อยแล้ว')
      setBulkActionType(null)
      setBulkLocation('')
      setSelectedBulkTicketIds([])
      
      // Refresh current vehicle data
      if (selectedCar) {
        handleSelectCar(selectedCar)
      }

      // Refresh dashboard data
      fetchMobileDashboard()
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmittingBulk(false)
    }
  }

  // Fetch Mobile Dashboard Data
  const fetchMobileDashboard = async () => {
    setLoadingMobileDashboard(true)
    try {
      const res = await fetch('/api/maintenance/dashboard')
      if (res.ok) {
        const data = await res.json()
        setMobileDashboardData(data)
      }
    } catch (err) {
      console.error('Error fetching mobile dashboard:', err)
    } finally {
      setLoadingMobileDashboard(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchMobileDashboard()
    }
  }, [activeTab])

  const handleSpeechInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechError('เบราว์เซอร์นี้ไม่รองรับการพิมพ์ด้วยเสียง')
      return
    }

    if (isRecording) {
      setIsRecording(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'th-TH'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsRecording(true)
      setSpeechError(null)
    }

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript
      setIssueDescription(prev => (prev ? `${prev} ${speechToText}` : speechToText))
    }

    recognition.onerror = (event: any) => {
      console.error('Speech error:', event.error)
      setSpeechError('เกิดข้อผิดพลาดเกี่ยวกับการฟังเสียง')
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognition.start()
  }

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('เบราว์เซอร์นี้ไม่รองรับการแชร์โลเคชัน')
      return
    }

    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
        setLocationLoading(false)
      },
      (error) => {
        console.error('Geolocation error:', error)
        setLocation({ lat: 13.7563, lng: 100.5018 })
        setLocationLoading(false)
      },
      { enableHighAccuracy: true, timeout: 5000 }
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'document') => {
    const files = e.target.files
    if (files && files.length > 0) {
      const newAttachments: AttachedFile[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const url = URL.createObjectURL(file)
        const sizeMb = (file.size / (1024 * 1024)).toFixed(2)
        newAttachments.push({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          url,
          type: fileType,
          fileSize: `${sizeMb} MB`,
          file: file
        })
      }
      setAttachments(prev => [...prev, ...newAttachments])
    }
    e.target.value = ''
  }

  const handleRemoveAttachment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCar) {
      alert('กรุณาเลือกรถที่เกิดเหตุ')
      return
    }
    if (!initialCarStatus) {
      alert('กรุณาเลือกสถานะใบแจ้งซ่อม')
      return
    }
    if (!issueDescription.trim()) {
      alert('กรุณาระบุอาการรถเสีย / รายละเอียดความเสียหาย')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        source: 'MOBILE_LIFF',
        lineUserId: getLineUserId(),
        carInfo: {
          registerNo: selectedCar.RegisterNo,
          vin: selectedCar.VinNo,
          project: selectedCar.Project,
          model: selectedCar.Model
        },
        driverName,
        incidentDate,
        issueDescription,
        carStatusCode: initialCarStatus,
        problemType,
        insurance,
        claimNo,
        faultPartyCode: faultParty,
        carCaseCode: carCase,
        serviceLocationCode: serviceLocation,
        serviceLocationName: locationOptions.find(o => o.code === serviceLocation)?.name || '',
        location: location ? `${location.lat}, ${location.lng}` : null,
        attachments: attachments.map(a => ({
          name: a.name,
          type: a.type,
          fileSize: a.fileSize
        }))
      }

      const res = await fetch('/api/external-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('บันทึกข้อมูลไม่สำเร็จ')
      }

      const result = await res.json()

      // If there are files, upload them now
      const filesToUpload = attachments.map(a => a.file).filter((f): f is File => !!f)
      if (filesToUpload.length > 0 && result.data?.maintenanceId) {
        const formData = new FormData()
        filesToUpload.forEach((file) => {
          formData.append('files', file)
        })
        formData.append('maintenanceId', String(result.data.maintenanceId))
        formData.append('lineUserId', getLineUserId() || '')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json()
          throw new Error(uploadErr.error || 'ไม่สามารถอัปโหลดรูปภาพแนบได้')
        }
      }

      setSubmittedData({ ...payload, response: result })
      setSubmitSuccess(true)
      
      // Refresh history list
      handleSelectCar(selectedCar)
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดของระบบ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setSearchTerm('')
    setSelectedCar(null)
    setDriverName('')
    setIssueDescription('')
    setAttachments([])
    setLocation(null)
    setServiceLocation('')
    setSubmitSuccess(false)
    setSubmittedData(null)
    setVehicleHistory([])
    setProblemType('ACCIDENT')
    setInsurance('')
    setClaimNo('')
    setFaultParty('')
    setCarCase('')
    setInitialCarStatus('')
    setShowAddIncidentForm(false)
    setLocSearchTerm('')
    setSelectedLocCode('')
  }

  const handleStartEditTicket = (ticket: MaintenanceTicket) => {
    setEditingTicket(ticket)
    if (ticket.CarStatusCode) {
      setEditStatus(ticket.CarStatusCode)
    } else {
      if (ticket.CarStatusDescription === 'อยู่ระหว่างการซ่อม' || ticket.CarStatusDescription === 'รถอยู่ระหว่างซ่อม') {
        setEditStatus('IN_MAINTENANCE')
      } else if (ticket.CarStatusDescription === 'ซ่อมเสร็จ' || ticket.CarStatusDescription === 'ซ่อมเสร็จสิ้น') {
        setEditStatus('COMPLETE')
      } else if (ticket.CarStatusDescription === 'รถยังขับใช้งานได้อยู่' || ticket.CarStatusDescription === 'ยังวิ่งอยู่') {
        setEditStatus('STILL_WORK')
      } else {
        setEditStatus('WAITING_FOR_MAINTENANCE')
      }
    }
    setEditFollowUp('')
    setEditAttachments([])
  }

  const handleSaveTicketUpdate = async () => {
    if (!editingTicket) return

    setUpdatingTicket(true)
    try {
      const res = await fetch('/api/maintenance/update-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId: editingTicket.MaintenanceItemID,
          carStatusCode: editStatus,
          followUpDetail: editFollowUp,
          lineUserId: getLineUserId(),
          deletedAttachmentIds: deletedPhotoIds
        })
      })

      if (!res.ok) {
        throw new Error('ไม่สามารถอัปเดตสถานะได้')
      }

      // If there are files to upload, upload them now
      if (editAttachments.length > 0) {
        const formData = new FormData()
        editAttachments.forEach((file) => {
          formData.append('files', file)
        })
        formData.append('maintenanceId', String(editingTicket.MaintenanceItemID))
        formData.append('lineUserId', getLineUserId() || '')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json()
          throw new Error(uploadErr.error || 'ไม่สามารถอัปโหลดรูปภาพได้')
        }
      }

      const result = await res.json()
      alert(result.message || 'บันทึกอัปเดตเรียบร้อย')
      setEditingTicket(null)
      setEditFollowUp('')
      setEditAttachments([])
      setDeletedPhotoIds([])

      // Refresh list immediately
      if (selectedCar) {
        handleSelectCar(selectedCar)
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setUpdatingTicket(false)
    }
  }

  const handleStartDetailEdit = (ticket: MaintenanceTicket) => {
    setEditDetailTicket(ticket)
    setEditDetailFields({
      driverName: ticket.DriverName || '',
      incidentDate: ticket.IncidentDate ? new Date(ticket.IncidentDate).toISOString().slice(0, 16) : '',
      issueTitle: ticket.IssueTitle || '',
      carStatusCode: ticket.CarStatusCode || 'WAITING_FOR_MAINTENANCE',
      serviceLocationCode: ticket.ServiceLocationCode || '',
      problemType: ticket.ProblemTypeCode || 'ACCIDENT',
      faultParty: ticket.FaultPartyCode || '',
      carCase: ticket.CarCaseCode || '',
      insurance: ticket.InsuranceCode || '',
      claimNumber: ticket.ClaimNumber || '',
    })
    setEditDetailAttachments([])
    setEditDetailDeletedPhotoIds([])
  }

  const handleSaveDetailEdit = async () => {
    if (!editDetailTicket) return

    setSavingDetailEdit(true)
    try {
      const res = await fetch('/api/maintenance/update-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId: editDetailTicket.MaintenanceItemID,
          carStatusCode: editDetailFields.carStatusCode,
          serviceLocationCode: editDetailFields.serviceLocationCode || null,
          lineUserId: getLineUserId(),
          deletedAttachmentIds: editDetailDeletedPhotoIds.length > 0 ? editDetailDeletedPhotoIds : null,
          // Extended detail fields
          driverName: editDetailFields.driverName || null,
          incidentDate: editDetailFields.incidentDate || null,
          issueTitle: editDetailFields.issueTitle || null,
          problemTypeCode: editDetailFields.problemType || null,
          faultPartyCode: editDetailFields.faultParty || null,
          carCaseCode: editDetailFields.carCase || null,
          insuranceCode: editDetailFields.insurance || null,
          claimNumber: editDetailFields.claimNumber || null,
        })
      })

      if (!res.ok) {
        throw new Error('ไม่สามารถบันทึกการแก้ไขได้')
      }

      // Upload new attachments if any
      if (editDetailAttachments.length > 0) {
        const formData = new FormData()
        editDetailAttachments.forEach((file) => {
          formData.append('files', file)
        })
        formData.append('maintenanceId', String(editDetailTicket.MaintenanceItemID))
        formData.append('lineUserId', getLineUserId() || '')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadRes.ok) {
          const uploadErr = await uploadRes.json()
          throw new Error(uploadErr.error || 'ไม่สามารถอัปโหลดรูปภาพได้')
        }
      }

      const result = await res.json()
      alert(result.message || 'บันทึกการแก้ไขเรียบร้อย')
      setEditDetailTicket(null)
      setEditDetailAttachments([])
      setEditDetailDeletedPhotoIds([])

      // Refresh list
      if (selectedCar) {
        handleSelectCar(selectedCar)
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSavingDetailEdit(false)
    }
  }

  const handleSaveQuickFollowUp = async (maintId: number) => {
    const detail = quickLogs[maintId]
    if (!detail || !detail.trim()) return

    setSavingQuickLogId(maintId)
    try {
      const res = await fetch('/api/maintenance/update-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId: maintId,
          followUpDetail: detail.trim(),
          lineUserId: getLineUserId()
        })
      })

      if (!res.ok) {
        throw new Error('ไม่สามารถบันทึกความคืบหน้าได้')
      }

      // Clear input field
      setQuickLogs(prev => ({
        ...prev,
        [maintId]: ''
      }))

      // Refresh data
      if (selectedCar) {
        handleSelectCar(selectedCar)
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSavingQuickLogId(null)
    }
  }

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault()

    let targetMaintId = selectedMaintId
    if (!targetMaintId && vehicleHistory.length > 0) {
      targetMaintId = vehicleHistory[0].MaintenanceItemID
    }

    if (!targetMaintId) {
      alert('ไม่สามารถอัปเดตสถานที่ได้ เนื่องจากรถคันนี้ไม่มีประวัติใบงานซ่อมในระบบ (กรุณาแจ้งเหตุใหม่เพื่อเปิดเคสก่อน)')
      return
    }

    setUpdatingLocation(true)
    try {
      const locName = locationOptions.find(o => o.code === selectedLocCode)?.name || 'ไม่ระบุ / นอกสถานที่'
      
      const res = await fetch('/api/maintenance/update-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId: targetMaintId,
          serviceLocationCode: selectedLocCode,
          serviceLocationName: locName,
          lineUserId: getLineUserId()
        })
      })

      if (!res.ok) {
        throw new Error('ไม่สามารถอัปเดตสถานที่ซ่อมได้')
      }

      const result = await res.json()
      alert(result.message || 'อัปเดตสถานที่นำส่งซ่อมเรียบร้อยแล้ว')
      
      // Refresh list
      if (selectedCar) {
        handleSelectCar(selectedCar)
      }
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setUpdatingLocation(false)
    }
  }

  // Fetch a single ticket's full details (with timeline) and transition to Edit SPA page
  const handleViewTicketDetail = async (registerNo: string, maintenanceId: number) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/vehicle/${encodeURIComponent(registerNo)}`)
      if (res.ok) {
        const data = await res.json()
        setDbCarStatuses(data.carStatuses || [])
        if (data.maintenance) {
          const ticket = data.maintenance.find((t: any) => t.MaintenanceItemID === maintenanceId)
          if (ticket) {
            // Set selected car & load history in state
            const carObj = {
              InventoryItemID: 0,
              RegisterNo: registerNo,
              VinNo: ticket.VinNo || data.vehicle?.VinNo || '',
              Model: ticket.Model || data.vehicle?.Model || '',
              Project: ticket.Project || data.vehicle?.ProjectType || ''
            }
            setSelectedCar(carObj)
            setVehicleHistory(data.maintenance)
            
            // Open SPA Edit Sub-page View directly
            handleStartEditTicket(ticket)
          } else {
            alert('ไม่พบข้อมูลงานซ่อมนี้ในระบบ')
          }
        }
      }
    } catch (err) {
      console.error('Error fetching ticket detail:', err)
      alert('ไม่สามารถโหลดรายละเอียดใบงานได้')
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatLiffTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
      })
    } catch {
      return isoString
    }
  }

  const pendingTickets = vehicleHistory.filter(
    ticket => ticket.CarStatusDescription !== 'ซ่อมเสร็จ'
  )

  // Group vehicles at location from Mobile Dashboard Data
  const getVehiclesAtLocation = (locCode: string) => {
    const repairs = mobileDashboardData?.longestRepairs || []
    return repairs.filter((r: any) => r.ServiceLocationCode === locCode || (locCode === 'ไม่ระบุ' && !r.ServiceLocationCode))
  }

  // ─── RENDER FULL DETAIL EDIT SPA VIEW ──────────────────────────────────
  if (editDetailTicket) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col items-center justify-start p-4 pb-12">
        <div className="w-full max-w-md space-y-4 animate-fade-in-up">
          
          {/* Header with Back button */}
          <div className="flex items-center gap-3 py-3 border-b border-slate-200">
            <button
              onClick={() => setEditDetailTicket(null)}
              className="bg-white hover:bg-slate-100 p-2 rounded-2xl border border-slate-200 text-slate-755 transition flex items-center justify-center active:scale-95 shadow-xs"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">แก้ไขรายละเอียดใบแจ้งซ่อม</h1>
              <p className="text-[10px] text-slate-450 font-mono">เลขอ้างอิงใบงาน: #{editDetailTicket.MaintenanceItemID}</p>
            </div>
          </div>

          {/* Car Info (Read-only) */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-lg">🚗</div>
              <div>
                <p className="text-sm font-bold text-slate-855">{selectedCar?.RegisterNo || editDetailTicket.RegisterNo || '-'}</p>
                <p className="text-[10px] text-slate-500">VIN: {selectedCar?.VinNo || editDetailTicket.VinNo || '-'} | {selectedCar?.Model || '-'}</p>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">📝 แก้ไขข้อมูลใบแจ้งซ่อม</h3>

            {/* Driver Name */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">👤 ชื่อคนขับ</label>
              <input
                type="text"
                value={editDetailFields.driverName}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, driverName: e.target.value }))}
                placeholder="ระบุชื่อคนขับ..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition"
              />
            </div>

            {/* Incident Date */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 วันเวลาเกิดเหตุ</label>
              <input
                type="datetime-local"
                value={editDetailFields.incidentDate}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, incidentDate: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition"
              />
            </div>

            {/* Issue Title */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">💬 อาการรถเสีย / รายละเอียดความเสียหาย</label>
              <textarea
                rows={3}
                value={editDetailFields.issueTitle}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, issueTitle: e.target.value }))}
                placeholder="ระบุอาการ / ความเสียหาย..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition resize-none"
              />
            </div>

            {/* Car Status */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">🚦 สถานะใบแจ้งซ่อม</label>
              <select
                value={editDetailFields.carStatusCode}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, carStatusCode: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
              >
                {(dbCarStatuses.length > 0 ? dbCarStatuses : [
                  { StatusCode: 'WAITING_FOR_MAINTENANCE', StatusName: 'รถจอดรอซ่อม' },
                  { StatusCode: 'STILL_WORK', StatusName: 'รถยังขับใช้งานได้อยู่' },
                  { StatusCode: 'IN_MAINTENANCE', StatusName: 'รถอยู่ระหว่างซ่อม' },
                  { StatusCode: 'GARAGE_COMPLETE', StatusName: 'ซ่อมเสร็จ' }
                ]).map((st) => {
                  let emoji = '⚙️'
                  if (st.StatusCode === 'WAITING_FOR_MAINTENANCE') emoji = '🟡'
                  else if (st.StatusCode === 'STILL_WORK') emoji = '🔵'
                  else if (st.StatusCode === 'IN_MAINTENANCE') emoji = '🔴'
                  else if (st.StatusCode === 'GARAGE_COMPLETE') emoji = '🟢'
                  return (
                    <option key={st.StatusCode} value={st.StatusCode}>
                      {emoji} {st.StatusName}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Service Location */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">📍 สถานที่นำส่งซ่อม</label>
              <select
                value={editDetailFields.serviceLocationCode}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, serviceLocationCode: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
              >
                <option value="">-- ยังไม่ระบุ --</option>
                {locationOptions.map(loc => (
                  <option key={loc.code} value={loc.code}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Problem Details Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">📋 รายละเอียดเพิ่มเติม</h3>

            {/* Problem Type */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">ประเภทปัญหา</label>
              <select
                value={editDetailFields.problemType}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, problemType: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
              >
                <option value="ACCIDENT">อุบัติเหตุ</option>
                <option value="BREAKDOWN">รถเสีย/ขัดข้อง</option>
                <option value="WEAR">สึกหรอ</option>
              </select>
            </div>

            {/* Fault Party */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">ฝ่ายผิด</label>
              <select
                value={editDetailFields.faultParty}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, faultParty: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
              >
                <option value="">-- ยังไม่ระบุ --</option>
                <option value="DRIVER">คนขับ</option>
                <option value="COUNTERPART">คู่กรณี</option>
                <option value="OTHER">อื่นๆ</option>
                <option value="MANUFACTURER">ผู้ผลิต</option>
              </select>
            </div>

            {/* Car Case */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">กรณีรถ</label>
              <select
                value={editDetailFields.carCase}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, carCase: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
              >
                <option value="">-- ยังไม่ระบุ --</option>
                <option value="DAMAGE_LIGHT">เคสซ่อมเบา</option>
                <option value="DAMAGE_HEAVY">เคสซ่อมหนัก</option>
                <option value="DAMAGE_TOTAL">ความเสียหายรุนแรง ไม่คุ้มค่าต่อการซ่อม</option>
              </select>
            </div>

            {/* Insurance */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">ประกันภัย</label>
              <select
                value={editDetailFields.insurance}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, insurance: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
              >
                <option value="">-- ยังไม่ระบุ --</option>
                <option value="ICARE_INSURANCE">ไอแคร์ประกันภัย</option>
                <option value="NO_INSURANCE">ไม่มีประกัน</option>
              </select>
            </div>

            {/* Claim Number */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">เลขที่ใบเคลม</label>
              <input
                type="text"
                value={editDetailFields.claimNumber}
                onChange={(e) => setEditDetailFields(prev => ({ ...prev, claimNumber: e.target.value }))}
                placeholder="ระบุเลขที่ใบเคลม (ถ้ามี)..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition"
              />
            </div>
          </div>

          {/* Attachments Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">🖼️ รูปภาพแนบ</h3>

            {/* Existing Attachments */}
            {editDetailTicket.attachments && editDetailTicket.attachments.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-2">รูปภาพเดิม ({editDetailTicket.attachments.length} รูป - แตะเพื่อเลือกลบ)</label>
                <div className="grid grid-cols-3 gap-2">
                  {editDetailTicket.attachments.map((att) => {
                    const isQueuedForDelete = editDetailDeletedPhotoIds.includes(att.FileAttachmentID)
                    return (
                      <div 
                        key={att.FileAttachmentID} 
                        onClick={() => {
                          if (isQueuedForDelete) {
                            setEditDetailDeletedPhotoIds(prev => prev.filter(id => id !== att.FileAttachmentID))
                          } else {
                            setEditDetailDeletedPhotoIds(prev => [...prev, att.FileAttachmentID])
                          }
                        }}
                        className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm cursor-pointer hover:border-indigo-300 transition"
                      >
                        <img
                          src={att.FilePath}
                          alt={att.FileName}
                          className={`w-full h-full object-cover transition duration-150 ${isQueuedForDelete ? 'filter grayscale blur-[1px]' : ''}`}
                        />
                        {isQueuedForDelete ? (
                          <div className="absolute inset-0 bg-rose-600/75 flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 transition">
                            <span className="text-sm">🗑️</span>
                            <span>เตรียมลบ</span>
                          </div>
                        ) : (
                          <div className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm transition">
                            ✕
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upload New Photos */}
            <div className="border-t border-slate-100 pt-3">
              <label className="text-xs font-bold text-slate-600 block mb-1.5">📷 แนบรูปภาพเพิ่มเติม</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setEditDetailAttachments(prev => [...prev, ...Array.from(e.target.files!)])
                  }
                }}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              {editDetailAttachments.length > 0 && (
                <div className="mt-3 text-xs text-slate-600 font-bold space-y-2">
                  <span>📸 เลือกรูปภาพเพิ่มเติม {editDetailAttachments.length} รูป:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {editDetailAttachments.map((f, i) => (
                      <ImagePreview
                        key={i}
                        file={f}
                        onRemove={() => {
                          setEditDetailAttachments(prev => prev.filter((_, idx) => idx !== i))
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveDetailEdit}
              disabled={savingDetailEdit}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-2xl shadow-md transition duration-150 active:scale-[0.98] flex items-center justify-center"
            >
              {savingDetailEdit ? '⏳ กำลังบันทึก...' : '💾 บันทึกการแก้ไข'}
            </button>
            <button
              type="button"
              onClick={() => setEditDetailTicket(null)}
              className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-xs transition active:scale-95"
            >
              ยกเลิก
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ─── RENDER SUB-PAGE VIEW FOR EDITING ───────────────────────────────────
  if (editingTicket) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col items-center justify-start p-4 pb-12">
        <div className="w-full max-w-md space-y-4 animate-fade-in-up">
          
          {/* Header Sub-page style */}
          <div className="flex items-center gap-3 py-3 border-b border-slate-200">
            <button
              onClick={() => setEditingTicket(null)}
              className="bg-white hover:bg-slate-100 p-2 rounded-2xl border border-slate-200 text-slate-755 transition flex items-center justify-center active:scale-95 shadow-xs"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">อัปเดตความคืบหน้าการซ่อม</h1>
              <p className="text-[10px] text-slate-450 font-mono">เลขอ้างอิงใบงาน: #{editingTicket.MaintenanceItemID}</p>
            </div>
          </div>

          {/* Ticket Information Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">คันที่เกิดเหตุ:</span>
              <p className="text-sm font-bold text-slate-855">{selectedCar?.RegisterNo} ({selectedCar?.Model})</p>
            </div>
            
            <div className="border-t border-slate-100 pt-2.5">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">อาการ/รายละเอียดแจ้งซ่อม:</span>
              <p className="text-xs font-semibold text-slate-750 break-words leading-relaxed">{editingTicket.IssueTitle}</p>
              <p className="text-[10px] text-slate-400 mt-1">วันที่รายงานเข้าระบบ: {formatLiffTime(editingTicket.ReportDate)}</p>
            </div>
          </div>

          {/* Existing Follow-up Timeline logs */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              📋 ประวัติบันทึกการติดตามเดิม ({editingTicket.followUps?.length || 0} รายการ)
            </h3>
            
            {editingTicket.followUps && editingTicket.followUps.length > 0 ? (
              <div className="space-y-3 pl-2.5 border-l-2 border-slate-150 ml-1 py-1 max-h-48 overflow-y-auto pr-1">
                {editingTicket.followUps.map((log) => (
                  <div key={log.MaintenanceFollowUpID} className="relative text-xxs">
                    <span className="absolute -left-[14.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 border border-white" />
                    <div className="flex justify-between text-slate-400">
                      <span>{formatLiffTime(log.FollowUpDate)}</span>
                      <span className="font-bold">{log.CreateUserName}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {log.FollowUpDetail}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xxs text-slate-400 italic text-center py-2">ยังไม่มีบันทึกประวัติการติดตามก่อนหน้านี้</p>
            )}
          </div>

          {/* Edit Form Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            
             {/* Status Selector */}
             <div>
               <label className="text-xs font-bold text-slate-600 block mb-1.5">🚦 ปรับสถานะใบแจ้งซ่อม</label>
               <select
                 value={editStatus}
                 onChange={(e) => setEditStatus(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
               >
                 {(dbCarStatuses.length > 0 ? dbCarStatuses : [
                   { StatusCode: 'WAITING_FOR_MAINTENANCE', StatusName: 'รถจอดรอซ่อม' },
                   { StatusCode: 'STILL_WORK', StatusName: 'รถยังขับใช้งานได้อยู่' },
                   { StatusCode: 'IN_MAINTENANCE', StatusName: 'รถอยู่ระหว่างซ่อม' }
                 ]).map((st) => {
                   let emoji = '⚙️'
                   if (st.StatusCode === 'WAITING_FOR_MAINTENANCE') emoji = '🟡'
                   else if (st.StatusCode === 'STILL_WORK') emoji = '🔵'
                   else if (st.StatusCode === 'IN_MAINTENANCE') emoji = '🔴'
                   else if (st.StatusCode === 'GARAGE_COMPLETE') emoji = '🟢'

                   return (
                     <option key={st.StatusCode} value={st.StatusCode}>
                       {emoji} {st.StatusName}
                     </option>
                   )
                 })}
               </select>
             </div>

            {/* Follow-up Note Textarea */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">💬 เพิ่มบันทึกการติดตาม / ดำเนินการล่าสุด</label>
              <textarea
                rows={4}
                value={editFollowUp}
                onChange={(e) => setEditFollowUp(e.target.value)}
                placeholder="ระบุรายละเอียด เช่น รถเข้าอู่ทำสีแล้ว, ช่างกำลังถอดชิ้นส่วนตรวจสอบ, หรืออะไหล่มาถึงพร้อมซ่อม..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition resize-none"
              />
            </div>

            {/* Existing Attachments / Photos */}
            {editingTicket.attachments && editingTicket.attachments.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <label className="text-xs font-bold text-slate-600 block mb-2">🖼️ รูปภาพแนบเดิมในระบบ ({editingTicket.attachments.length} รูป - แตะเพื่อเลือกเตรียมลบ)</label>
                <div className="grid grid-cols-3 gap-2">
                  {editingTicket.attachments.map((att) => {
                    const isQueuedForDelete = deletedPhotoIds.includes(att.FileAttachmentID)
                    return (
                      <div 
                        key={att.FileAttachmentID} 
                        onClick={() => {
                          if (isQueuedForDelete) {
                            setDeletedPhotoIds(prev => prev.filter(id => id !== att.FileAttachmentID))
                          } else {
                            setDeletedPhotoIds(prev => [...prev, att.FileAttachmentID])
                          }
                        }}
                        className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm cursor-pointer hover:border-indigo-300 transition"
                      >
                        <img
                          src={att.FilePath}
                          alt={att.FileName}
                          className={`w-full h-full object-cover transition duration-150 ${isQueuedForDelete ? 'filter grayscale blur-[1px]' : ''}`}
                        />
                        {isQueuedForDelete ? (
                          <div className="absolute inset-0 bg-rose-600/75 flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 transition">
                            <span className="text-sm">🗑️</span>
                            <span>เตรียมลบ</span>
                          </div>
                        ) : (
                          <div className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm transition">
                            ✕
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Photo upload component in edit sub-page */}
            <div className="border-t border-slate-100 pt-3">
              <label className="text-xs font-bold text-slate-600 block mb-1.5">📷 แนบรูปภาพเพิ่มเติม (สามารถแนบได้หลายภาพ)</label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setEditAttachments(Array.from(e.target.files))
                  }
                }}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              
              {editAttachments.length > 0 && (
                <div className="mt-3 text-xs text-slate-600 font-bold space-y-2">
                  <span>📸 เลือกรูปภาพเพิ่มเติมแล้ว {editAttachments.length} รูป:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {editAttachments.map((f, i) => (
                      <ImagePreview
                        key={i}
                        file={f}
                        onRemove={() => {
                          setEditAttachments(prev => prev.filter((_, idx) => idx !== i))
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveTicketUpdate}
              disabled={updatingTicket}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 px-6 rounded-2xl shadow-md transition duration-150 active:scale-[0.98] flex items-center justify-center"
            >
              {updatingTicket ? '⏳ กำลังบันทึกข้อมูล...' : '✅ บันทึกอัปเดตข้อมูล'}
            </button>
            <button
              type="button"
              onClick={() => setEditingTicket(null)}
              className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-xs transition active:scale-95"
            >
              ยกเลิก
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ─── RENDER STANDARD VIEW ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col items-center justify-start p-4 pb-24">
      {/* Header */}
      <header className="w-full max-w-md py-4 mb-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚨</span>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">แจ้งอุบัติเหตุ / รถเสียด่วน</h1>
            <p className="text-xs text-slate-500">EV7 Tracking - Mobile LIFF Application</p>
          </div>
        </div>
      </header>

      {/* RENDER ACTIVE TAB VIEW */}
      <div className="w-full max-w-md">
        
        {/* TAB 1: REPORT FORM */}
        {activeTab === 'report' && (
          submitSuccess ? (
            /* SUCCESS CARD */
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xl flex flex-col items-center text-center animate-fade-in-up">
              <div className="w-20 h-20 bg-emerald-50 rounded-full border-2 border-emerald-500 flex items-center justify-center mb-5 animate-scale-up">
                <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">ส่งรายงานแจ้งเหตุสำเร็จ!</h2>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                ข้อมูลได้รับการบันทึก และส่งต่อไปยังระบบแอดมินเรียบร้อยแล้ว แอดมินและฝ่ายซ่อมบำรุงจะรีบดำเนินการติดต่อกลับด่วนที่สุด
              </p>

              <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs mb-6 space-y-2.5">
                <div className="flex justify-between border-b border-slate-200 pb-2">
                  <span className="text-slate-505">เลขอ้างอิงใบงาน:</span>
                  <span className="font-bold text-slate-800">{submittedData?.response?.data?.maintenanceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505">รถที่เกิดเหตุ:</span>
                  <span className="font-bold text-slate-800">{submittedData?.carInfo?.registerNo} ({submittedData?.carInfo?.model})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505">ผู้ขับ:</span>
                  <span className="font-bold text-slate-800">{submittedData?.driverName || '-'}</span>
                </div>
                {submittedData?.serviceLocationName && (
                  <div className="flex justify-between border-b border-slate-100 pb-2.5">
                    <span className="text-slate-505">สถานที่นำส่งซ่อม:</span>
                    <span className="font-bold text-slate-800">{submittedData?.serviceLocationName}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleReset}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md hover:from-emerald-600 hover:to-teal-600 transition duration-200 active:scale-[0.98]"
              >
                แจ้งเหตุใหม่
              </button>
            </div>
          ) : (
            /* MAIN FORM */
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Card 1: Car Search (REAL DB SEARCH) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
                <label className="text-xs font-bold text-slate-600 block mb-2">🚗 1. ข้อมูลรถที่เกิดเหตุ / มีปัญหา <span className="text-rose-550">*</span></label>
                
                {selectedCar ? (
                  <div className="flex items-center justify-between bg-slate-50 border border-emerald-300 rounded-2xl p-3">
                    <div>
                      <p className="text-base font-bold text-slate-800">{selectedCar.RegisterNo}</p>
                      <p className="text-xs text-slate-500 font-mono">VIN: {selectedCar.VinNo}</p>
                      <p className="text-xxs text-slate-655 mt-1">โครงการ: <span className="font-bold text-emerald-700">{selectedCar.Project}</span> | รุ่น: {selectedCar.Model}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCar(null)
                        setVehicleHistory([])
                      }}
                      className="bg-white hover:bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition border border-slate-200 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3.5 py-1 transition">
                      <span className="text-slate-400 mr-2">🔍</span>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value)
                          setShowCarDropdown(true)
                        }}
                        onFocus={() => setShowCarDropdown(true)}
                        placeholder="พิมพ์ค้นหาเลขทะเบียนจริง หรือ VIN..."
                        className="bg-transparent text-sm w-full py-2.5 focus:outline-none text-slate-800 placeholder-slate-400"
                      />
                      {loadingCars && <span className="text-xs text-slate-400 animate-pulse">ค้นหา...</span>}
                    </div>

                    {/* Dropdown search results */}
                    {showCarDropdown && searchTerm && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden max-h-56">
                        {dbCars.length > 0 ? (
                          dbCars.map((car, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSelectCar(car)}
                              className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between text-slate-800"
                            >
                              <div>
                                <p className="font-bold text-slate-900">{car.RegisterNo}</p>
                                <p className="text-xxs text-slate-550 font-mono">VIN: {car.VinNo}</p>
                              </div>
                              <span className="text-xxs font-bold text-slate-655 bg-slate-150 px-2 py-1 rounded">
                                {car.Project}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="p-4 text-center text-xs text-slate-400">ไม่พบข้อมูลทะเบียนรถในฐานข้อมูล</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pending Repairs Block */}
              {selectedCar && pendingTickets.length > 0 && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🚨</span> รายการแจ้งซ่อมที่รอดำเนินการ
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const nextType = bulkActionType === 'park' ? null : 'park'
                          setBulkActionType(nextType)
                          setBulkLocation('')
                          setSelectedBulkTicketIds(nextType ? pendingTickets.map(t => t.MaintenanceItemID) : [])
                        }}
                        className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                          bulkActionType === 'park'
                            ? 'bg-amber-100 border-amber-300 text-amber-800'
                            : 'bg-amber-50 hover:bg-amber-100 border-amber-250 text-amber-700'
                        }`}
                      >
                        รถจอดรอซ่อม
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextType = bulkActionType === 'start' ? null : 'start'
                          setBulkActionType(nextType)
                          setBulkLocation('')
                          setSelectedBulkTicketIds(nextType ? pendingTickets.map(t => t.MaintenanceItemID) : [])
                          const now = new Date()
                          setBulkStartDate(now.toISOString().slice(0, 16))
                        }}
                        className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                          bulkActionType === 'start'
                            ? 'bg-rose-100 border-rose-300 text-rose-800'
                            : 'bg-rose-50 hover:bg-rose-100 border-rose-250 text-rose-700'
                        }`}
                      >
                        เริ่มซ่อม
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const nextType = bulkActionType === 'complete' ? null : 'complete'
                          setBulkActionType(nextType)
                          setBulkLocation('')
                          setSelectedBulkTicketIds(nextType ? pendingTickets.map(t => t.MaintenanceItemID) : [])
                          const now = new Date()
                          setBulkFinishDate(now.toISOString().slice(0, 16))
                        }}
                        className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                          bulkActionType === 'complete'
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-250 text-emerald-700'
                        }`}
                      >
                        ซ่อมเสร็จ
                      </button>
                    </div>
                  </div>

                  {/* Bulk Action Panels */}
                  {bulkActionType === 'park' && (
                    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3.5 mb-3 animate-fade-in text-slate-700">
                      <div className="flex items-center justify-between border-b border-amber-150 pb-1.5">
                        <span className="text-xs font-bold text-amber-800">🟡 ระบุสถานที่: รถจอดรอซ่อม</span>
                        <button
                          type="button"
                          onClick={() => setBulkActionType(null)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                        >
                          ปิด x
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">📍 เลือกสถานที่ / พิกัดที่จอด</label>
                        <select
                          value={bulkLocation}
                          onChange={(e) => setBulkLocation(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-amber-500 font-bold"
                        >
                          <option value="">-- เลือกสถานที่ --</option>
                          {locationOptions.map((opt) => (
                            <option key={opt.code} value={opt.code}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={submittingBulk || !bulkLocation}
                          onClick={() => handleSaveBulkAction('park')}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2 rounded-xl text-xxs transition active:scale-98"
                        >
                          {submittingBulk ? '⏳ กำลังบันทึก...' : '💾 บันทึก รถจอดรอซ่อม'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkActionType(null)}
                          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 font-semibold px-3 py-2 rounded-xl text-xxs transition active:scale-95"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}

                  {bulkActionType === 'start' && (
                    <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4 space-y-3.5 mb-3 animate-fade-in text-slate-700">
                      <div className="flex items-center justify-between border-b border-rose-150 pb-1.5">
                        <span className="text-xs font-bold text-rose-800">🔴 ระบุรายละเอียด: เริ่มซ่อม</span>
                        <button
                          type="button"
                          onClick={() => setBulkActionType(null)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                        >
                          ปิด x
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">📅 วันที่เริ่มซ่อม</label>
                          <input
                            type="datetime-local"
                            value={bulkStartDate}
                            onChange={(e) => setBulkStartDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-rose-500 font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">📍 เลือกอู่ที่ซ่อม</label>
                          <select
                            value={bulkLocation}
                            onChange={(e) => setBulkLocation(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-rose-500 font-bold"
                          >
                            <option value="">-- เลือกสถานที่ --</option>
                            {locationOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={submittingBulk || !bulkLocation}
                          onClick={() => handleSaveBulkAction('start')}
                          className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2 rounded-xl text-xxs transition active:scale-98"
                        >
                          {submittingBulk ? '⏳ กำลังบันทึก...' : '💾 บันทึก เริ่มซ่อม'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkActionType(null)}
                          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 font-semibold px-3 py-2 rounded-xl text-xxs transition active:scale-95"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}

                  {bulkActionType === 'complete' && (
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-3.5 mb-3 animate-fade-in text-slate-700">
                      <div className="flex items-center justify-between border-b border-emerald-150 pb-1.5">
                        <span className="text-xs font-bold text-emerald-800">🟢 ระบุรายละเอียด: ซ่อมเสร็จสิ้น</span>
                        <button
                          type="button"
                          onClick={() => setBulkActionType(null)}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                        >
                          ปิด x
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">📅 วันที่ซ่อมเสร็จ</label>
                          <input
                            type="datetime-local"
                            value={bulkFinishDate}
                            onChange={(e) => setBulkFinishDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-emerald-500 font-bold"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          disabled={submittingBulk}
                          onClick={() => handleSaveBulkAction('complete')}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2 rounded-xl text-xxs transition active:scale-98"
                        >
                          {submittingBulk ? '⏳ กำลังบันทึก...' : '💾 บันทึก ซ่อมเสร็จ'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkActionType(null)}
                          className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 font-semibold px-3 py-2 rounded-xl text-xxs transition active:scale-95"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {/* Select All / Deselect All when bulk action is active */}
                    {bulkActionType && pendingTickets.length > 1 && (
                      <div className="flex items-center justify-between px-1 py-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          เลือก {selectedBulkTicketIds.length}/{pendingTickets.length} รายการ
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedBulkTicketIds.length === pendingTickets.length) {
                              setSelectedBulkTicketIds([])
                            } else {
                              setSelectedBulkTicketIds(pendingTickets.map(t => t.MaintenanceItemID))
                            }
                          }}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                        >
                          {selectedBulkTicketIds.length === pendingTickets.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                        </button>
                      </div>
                    )}
                    {pendingTickets.map((ticket) => {
                      const isSelected = selectedBulkTicketIds.includes(ticket.MaintenanceItemID)
                      return (
                      <div
                        key={ticket.MaintenanceItemID}
                        className={`bg-slate-50 border rounded-2xl p-3.5 flex flex-col gap-2.5 transition ${
                          bulkActionType
                            ? isSelected
                              ? 'border-indigo-400 bg-indigo-50/40 shadow-sm'
                              : 'border-slate-200 opacity-60'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => {
                          if (bulkActionType) {
                            setSelectedBulkTicketIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== ticket.MaintenanceItemID)
                                : [...prev, ticket.MaintenanceItemID]
                            )
                          }
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Checkbox when bulk action is active */}
                          {bulkActionType && (
                            <div className="shrink-0 flex items-center justify-center pt-0.5">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600'
                                  : 'bg-white border-slate-300'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 shrink-0 flex items-center justify-center text-sm text-amber-600">
                            🔧
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-snug break-words">
                              {ticket.IssueTitle}
                            </p>
                            <p className="text-[10px] text-slate-505 mt-0.5">
                              แจ้งเมื่อ: {formatLiffTime(ticket.ReportDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-1 border-t border-slate-200/60 pt-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                            ticket.CarStatusDescription === 'อยู่ระหว่างการซ่อม'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            {ticket.CarStatusDescription}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-slate-400">
                              #{ticket.MaintenanceItemID}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditTicket(ticket)}
                              className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold px-3 py-1 rounded-xl text-[10px] flex items-center gap-1 transition active:scale-95"
                            >
                              <span>📝 อัปเดต</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartDetailEdit(ticket)}
                              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold px-3 py-1 rounded-xl text-[10px] flex items-center gap-1 transition active:scale-95"
                            >
                              <span>✏️ แก้ไข</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                    })}
                  </div>
                </div>
              )}

              {/* Add Incident Button */}
              {selectedCar && pendingTickets.length > 0 && !showAddIncidentForm && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-2.5 animate-fade-in-up">
                  <span className="text-xl">⚙️</span>
                  <p className="text-xs font-bold text-slate-700">มีรายการแจ้งซ่อมค้างอยู่ ต้องการแจ้งเหตุใหม่เพิ่มเติมหรือไม่?</p>
                  <button
                    type="button"
                    onClick={() => setShowAddIncidentForm(true)}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md hover:from-emerald-600 hover:to-teal-600 transition duration-200 active:scale-[0.98] flex items-center justify-center gap-1.5 text-xs"
                  >
                    <span>➕ เพิ่มเหตุ</span>
                  </button>
                </div>
              )}

              {(!selectedCar || pendingTickets.length === 0 || showAddIncidentForm) && (
                <>
                  {/* Card 2: Driver & Incident Info */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">👤 ชื่อ-นามสกุล คนขับ</label>
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="ดึงจากสัญญาเช่าอัตโนมัติเมื่อเลือกรถ..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 วันเวลาเกิดเหตุ <span className="text-rose-555">*</span></label>
                  <input
                    type="datetime-local"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Card 2.5: Repair Status Selection (REQUIRED FIELD) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">
                    <span className="text-rose-555">*</span> สถานะใบแจ้งซ่อม
                  </label>
                  <select
                    value={initialCarStatus}
                    onChange={(e) => setInitialCarStatus(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
                  >
                    <option value="" disabled>เลือกสถานะใบแจ้งซ่อม</option>
                    <option value="STILL_WORK">รถยังขับใช้งานได้อยู่</option>
                    <option value="IN_MAINTENANCE">รถอยู่ระหว่างซ่อม</option>
                  </select>
                </div>
              </div>

              {/* Card 3: Description & Speech-to-Text (REQUIRED FIELD) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600">
                    💬 2. อาการรถเสีย / รายละเอียดความเสียหาย <span className="text-rose-555">*</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleSpeechInput}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xxs font-bold border transition ${
                      isRecording 
                        ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    <span>{isRecording ? '🛑 กำลังรับเสียง...' : '🎙️ กดเพื่อพูดแทนการพิมพ์'}</span>
                  </button>
                </div>

                {speechError && <p className="text-xxs text-rose-500 mb-2">{speechError}</p>}

                <textarea
                  rows={3}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  required
                  placeholder="ระบุอาการ เช่น ยางหลังรั่ว, รถโดนชนท้าย หรือกดไมค์ด้านบนแล้วพูดอธิบาย..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition resize-none"
                />
              </div>

              {/* Card 4: Location Selection (Master Location) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">
                    📍 3. เลือกสถานที่ / พิกัดปัจจุบัน (ศูนย์บริการ/อู่/สาขา)
                  </label>
                  <select
                    value={serviceLocation}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-855 focus:outline-none focus:border-indigo-500 transition"
                  >
                    <option value="">-- ไม่ระบุ / นอกสถานที่ --</option>
                    {locationOptions.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card 5: Problem Type, Insurance & Claim No (OPTIONAL FIELDS) */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="border-l-4 border-indigo-500 pl-3">
                  <h3 className="text-xs font-bold text-slate-605">ประเภทปัญหา & ประกันภัย (ถ้าทราบข้อมูล)</h3>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-705">ประเภทของปัญหา</label>
                    <select
                      value={problemType}
                      onChange={(e) => setProblemType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="ACCIDENT">อุบัติเหตุ</option>
                      <option value="PRODUCT">ผลิตภัณฑ์</option>
                      <option value="SUPPLIER_REPAIR">งานซ่อมจาก Supplier</option>
                      <option value="OTHER_2">อื่นๆ</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-705">ฝ่ายผิด</label>
                    <select
                      value={faultParty}
                      onChange={(e) => setFaultParty(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกฝ่ายผิด</option>
                      <option value="DRIVER">คนขับ</option>
                      <option value="COUNTERPART">คู่กรณี</option>
                      <option value="OTHER">อื่นๆ</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-705">กรณีรถ</label>
                    <select
                      value={carCase}
                      onChange={(e) => setCarCase(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">เลือกกรณีรถ</option>
                      <option value="DAMAGE_LIGHT">เคสซ่อมเบา</option>
                      <option value="DAMAGE_HEAVY">เคสซ่อมหนัก</option>
                      <option value="DAMAGE_TOTAL">ความเสียหายรุนแรง ไม่คุ้มค่าต่อการซ่อม</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-705">ประกันภัย</label>
                    <select
                      value={insurance}
                      onChange={(e) => setInsurance(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                    >
                      <option value="">ไม่ระบุ / ไม่มีประกันภัย</option>
                      <option value="ICARE_INSURANCE">ไอแคร์ ประกันภัย</option>
                      <option value="MUANGTHAI_INSURANCE">เมืองไทย ประกันภัย</option>
                      <option value="NO_INSURANCE">ไม่มีประกันภัย</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold block mb-1 text-slate-705">เลขที่ใบเคลม (ใส่หรือไม่ใส่ก็ได้)</label>
                    <input
                      type="text"
                      value={claimNo}
                      onChange={(e) => setClaimNo(e.target.value)}
                      placeholder="ระบุเลขที่ใบเคลม (ถ้ามี)..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Card 6: Camera Snap Photos & Document Attachments */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <label className="text-xs font-bold text-slate-600 block">
                    📎 แนบรูปภาพ หรือ เอกสารที่เกี่ยวข้อง (ถ้ามี)
                  </label>
                  <span className="text-xxs font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {attachments.length} ไฟล์
                  </span>
                </div>

                {/* Quick Upload Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition active:scale-98 text-xs font-bold text-slate-705">
                    <span>📸 ถ่ายรูป/แนบรูป</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'image')}
                      className="hidden"
                    />
                  </label>

                  <label className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition active:scale-98 text-xs font-bold text-slate-705">
                    <span>📄 แนบไฟล์เอกสาร</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'document')}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Attachments List */}
                {attachments.length > 0 && (
                  <div className="space-y-2 mt-2 max-h-56 overflow-y-auto pr-1">
                    {attachments.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-xs hover:border-slate-250 transition"
                      >
                        <div className="flex items-center gap-2 overflow-hidden mr-2">
                          {file.type === 'image' ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                              <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0 flex items-center justify-center text-lg text-indigo-600">
                              📄
                            </div>
                          )}
                          <div className="overflow-hidden">
                            <p className="font-bold text-slate-855 truncate leading-snug">{file.name}</p>
                            <p className="text-xxs text-slate-400 font-mono">{file.fileSize || 'Unknown Size'}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveAttachment(file.id, e)}
                          className="bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 p-1.5 rounded-lg border border-slate-200 transition shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 disabled:from-slate-200 disabled:to-slate-350 disabled:text-slate-400 text-white font-bold py-4 px-6 rounded-2xl shadow-md hover:from-indigo-700 hover:to-blue-700 transition duration-200 active:scale-[0.98] flex items-center justify-center"
                    >
                      {submitting ? '⏳ กำลังส่งข้อมูล...' : '✅ ส่งข้อมูลแจ้งเหตุ'}
                    </button>
                  </div>
                </>
              )}

            </form>
          )
        )}

        {/* TAB 2: MY TICKETS / REPAIR HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in-up">
            
            {/* Search Box inside Tab 2 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
              <h3 className="text-xs font-bold text-slate-600 block mb-2">📋 ค้นหาประวัติงานซ่อม</h3>
              <p className="text-xxs text-slate-555 mb-3">
                เลือกและดูสถานะความคืบหน้าของตั๋วแจ้งซ่อมทั้งหมดของรถคันปัจจุบัน
              </p>

              {selectedCar ? (
                <div className="flex items-center justify-between bg-slate-50 border border-emerald-300 rounded-2xl p-3">
                  <div>
                    <p className="text-base font-bold text-slate-800">{selectedCar.RegisterNo}</p>
                    <p className="text-xs text-slate-500 font-mono">VIN: {selectedCar.VinNo}</p>
                    <p className="text-xxs text-slate-655 mt-1">โครงการ: <span className="font-bold text-emerald-700">{selectedCar.Project}</span> | รุ่น: {selectedCar.Model}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCar(null)
                      setVehicleHistory([])
                    }}
                    className="bg-white hover:bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition border border-slate-200 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3.5 py-1 transition">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setShowCarDropdown(true)
                      }}
                      onFocus={() => setShowCarDropdown(true)}
                      placeholder="พิมพ์ค้นหาเลขทะเบียนจริง หรือ VIN..."
                      className="bg-transparent text-sm w-full py-2.5 focus:outline-none text-slate-800 placeholder-slate-400"
                    />
                    {loadingCars && <span className="text-xs text-slate-400 animate-pulse">ค้นหา...</span>}
                  </div>

                  {/* Dropdown search results */}
                  {showCarDropdown && searchTerm && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden max-h-56">
                      {dbCars.length > 0 ? (
                        dbCars.map((car, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectCar(car)}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between text-slate-800"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{car.RegisterNo}</p>
                              <p className="text-xxs text-slate-550 font-mono">VIN: {car.VinNo}</p>
                            </div>
                            <span className="text-xxs font-bold text-slate-655 bg-slate-150 px-2 py-1 rounded">
                              {car.Project}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="p-4 text-center text-xs text-slate-400">ไม่พบข้อมูลทะเบียนรถในฐานข้อมูล</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedCar && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">ประวัติการซ่อม ({vehicleHistory.length} เคส)</h4>
                  {loadingHistory && <span className="text-xxs text-slate-400 animate-pulse">กำลังโหลดประวัติ...</span>}
                </div>

                {vehicleHistory.length > 0 ? (
                  vehicleHistory.map((ticket) => (
                    <div key={ticket.MaintenanceItemID} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
                      
                      {/* Ticket header status */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-xs font-bold text-slate-800 leading-snug break-words">{ticket.IssueTitle}</p>
                          <p className="text-xxs text-slate-400 mt-1">แจ้งเมื่อ: {formatLiffTime(ticket.ReportDate)}</p>
                        </div>
                        <span className={`px-2.5 py-1 text-xxs font-bold rounded-full border shrink-0 ${
                          ticket.CarStatusDescription === 'ซ่อมเสร็จ'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : ticket.CarStatusDescription === 'อยู่ระหว่างการซ่อม'
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          {ticket.CarStatusDescription}
                        </span>
                      </div>

                      {/* Ticket Detail */}
                      <div className="text-xxs text-slate-500 grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-semibold block text-slate-400">อู่ที่เข้าซ่อม:</span>
                          <span className="font-bold text-slate-700">{ticket.ServiceLocation || '-'}</span>
                        </div>
                        <div>
                          <span className="font-semibold block text-slate-400">รหัสใบแจ้งซ่อม:</span>
                          <span className="font-mono text-slate-700">#{ticket.MaintenanceItemID}</span>
                        </div>
                      </div>

                      {/* Timeline logs */}
                      <div className="border-t border-slate-100/80 pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xxs font-bold text-amber-600">📋 ประวัติการติดตามผลล่าสุด:</p>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditTicket(ticket)}
                              className="text-[10px] font-bold text-indigo-655 hover:text-indigo-855 flex items-center gap-0.5"
                            >
                              <span>➕ ปรับสถานะ / เปิดหน้าเต็ม</span>
                            </button>
                          </div>
                        </div>
                        
                        {ticket.followUps && ticket.followUps.length > 0 ? (
                          <div className="space-y-3 pl-2.5 border-l-2 border-slate-150 ml-1 py-1 max-h-44 overflow-y-auto pr-1">
                            {ticket.followUps.map((log) => (
                              <div key={log.MaintenanceFollowUpID} className="relative text-xxs">
                                <span className="absolute -left-[14.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 border border-white" />
                                <div className="flex justify-between text-slate-400">
                                  <span>{formatLiffTime(log.FollowUpDate)}</span>
                                  <span className="font-bold">{log.CreateUserName}</span>
                                </div>
                                <p className="text-xs font-semibold text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  {log.FollowUpDetail}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xxs text-slate-400 italic">ยังไม่มีบันทึกการติดตามความคืบหน้า</p>
                        )}

                        {/* Inline Quick Add Follow-up Form */}
                        <div className="mt-3 border-t border-slate-100 pt-3.5 flex gap-2">
                          <input
                            type="text"
                            value={quickLogs[ticket.MaintenanceItemID] || ''}
                            onChange={(e) => setQuickLogs(prev => ({
                              ...prev,
                              [ticket.MaintenanceItemID]: e.target.value
                            }))}
                            placeholder="พิมพ์บันทึกการติดตามความคืบหน้าเพิ่ม..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition"
                          />
                          <button
                            type="button"
                            disabled={savingQuickLogId === ticket.MaintenanceItemID || !(quickLogs[ticket.MaintenanceItemID] || '').trim()}
                            onClick={() => handleSaveQuickFollowUp(ticket.MaintenanceItemID)}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-150 disabled:text-slate-400 text-white font-bold px-3 py-2 rounded-xl text-xxs transition active:scale-95 shrink-0"
                          >
                            {savingQuickLogId === ticket.MaintenanceItemID ? '⏳ บันทึก...' : '💾 บันทึก'}
                          </button>
                        </div>
                      </div>

                    </div>
                  ))
                ) : (
                  !loadingHistory && (
                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
                      <span className="text-2xl">🎉</span>
                      <p className="text-xs font-bold text-slate-505 mt-2">ไม่พบประวัติการซ่อมบำรุงในระบบของรถคันนี้</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: UPDATE LOCATION */}
        {activeTab === 'contact' && (
          <div className="space-y-4 animate-fade-in-up">
            
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-center">
              <span className="text-3xl">📍</span>
              <h3 className="text-xs font-bold text-slate-600 mt-2">อัปเดตสถานที่นำส่งซ่อม</h3>
              <p className="text-xxs text-slate-500 mt-1">
                เปลี่ยนตำแหน่งหรือสถานที่นำส่งซ่อมของรถยนต์คันที่กำลังดำเนินการอยู่
              </p>
            </div>

            {/* Car Search Block (REAL DB SEARCH) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
              <label className="text-xs font-bold text-slate-600 block mb-2">🚗 ค้นหารถยนต์เพื่ออัปเดตสถานที่ <span className="text-rose-550">*</span></label>
              
              {selectedCar ? (
                <div className="flex items-center justify-between bg-slate-50 border border-emerald-300 rounded-2xl p-3">
                  <div>
                    <p className="text-base font-bold text-slate-800">{selectedCar.RegisterNo}</p>
                    <p className="text-xs text-slate-500 font-mono">VIN: {selectedCar.VinNo}</p>
                    <p className="text-xxs text-slate-655 mt-1">โครงการ: <span className="font-bold text-emerald-700">{selectedCar.Project}</span> | รุ่น: {selectedCar.Model}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCar(null)
                      setVehicleHistory([])
                    }}
                    className="bg-white hover:bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition border border-slate-200 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3.5 py-1 transition">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setShowCarDropdown(true)
                      }}
                      onFocus={() => setShowCarDropdown(true)}
                      placeholder="พิมพ์ค้นหาเลขทะเบียนจริง หรือ VIN..."
                      className="bg-transparent text-sm w-full py-2.5 focus:outline-none text-slate-800 placeholder-slate-400"
                    />
                    {loadingCars && <span className="text-xs text-slate-400 animate-pulse">ค้นหา...</span>}
                  </div>

                  {/* Dropdown search results */}
                  {showCarDropdown && searchTerm && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden max-h-56">
                      {dbCars.length > 0 ? (
                        dbCars.map((car, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectCar(car)}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between text-slate-800"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{car.RegisterNo}</p>
                              <p className="text-xxs text-slate-550 font-mono">VIN: {car.VinNo}</p>
                            </div>
                            <span className="text-xxs font-bold text-slate-655 bg-slate-150 px-2 py-1 rounded">
                              {car.Project}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="p-4 text-center text-xs text-slate-400">ไม่พบข้อมูลทะเบียนรถในฐานข้อมูล</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedCar && (
              <form onSubmit={handleUpdateLocation} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in-up">
                {/* Select Maintenance Ticket */}
                {pendingTickets.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">📝 เลือกงานซ่อมที่ต้องการเปลี่ยนสถานที่</label>
                    <select
                      value={selectedMaintId}
                      onChange={(e) => {
                        const mId = Number(e.target.value)
                        setSelectedMaintId(mId)
                        const t = vehicleHistory.find(x => x.MaintenanceItemID === mId)
                        const matchedLoc = locationOptions.find(o => o.code === t?.ServiceLocationCode || o.name === t?.ServiceLocation)
                        setSelectedLocCode(matchedLoc ? matchedLoc.code : (t?.ServiceLocationCode || ''))
                        setLocSearchTerm(matchedLoc ? matchedLoc.name : (t?.ServiceLocation || ''))
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
                    >
                      {pendingTickets.map((t) => (
                        <option key={t.MaintenanceItemID} value={t.MaintenanceItemID}>
                          [{t.CarStatusDescription}] {t.IssueTitle.slice(0, 30)}... (#{t.MaintenanceItemID})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Searchable Location Selection */}
                <div className="relative">
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">📍 เลือกสถานที่ / พิกัดศูนย์บริการ / อู่ใหม่</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3.5 py-1.5 transition">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                      type="text"
                      value={locSearchTerm}
                      onChange={(e) => {
                        setLocSearchTerm(e.target.value)
                        setShowLocDropdown(true)
                        const matched = locationOptions.find(o => o.name === e.target.value)
                        setSelectedLocCode(matched ? matched.code : '')
                      }}
                      onFocus={() => setShowLocDropdown(true)}
                      onBlur={() => setTimeout(() => setShowLocDropdown(false), 200)}
                      placeholder="พิมพ์ค้นหาชื่อสถานที่ / อู่..."
                      className="bg-transparent text-sm w-full py-2 focus:outline-none text-slate-800 placeholder-slate-400 font-bold"
                    />
                    {selectedLocCode && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocCode('')
                          setLocSearchTerm('')
                        }}
                        className="text-slate-400 hover:text-slate-600 transition mr-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Location list dropdown */}
                  {showLocDropdown && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden max-h-56 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocCode('')
                          setLocSearchTerm('')
                          setShowLocDropdown(false)
                        }}
                        className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 active:bg-slate-100 transition text-xs font-bold text-slate-500"
                      >
                        -- ไม่ระบุ / นอกสถานที่ --
                      </button>
                      {locationOptions
                        .filter(opt => opt.name.toLowerCase().includes(locSearchTerm.toLowerCase()))
                        .map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => {
                              setSelectedLocCode(opt.code)
                              setLocSearchTerm(opt.name)
                              setShowLocDropdown(false)
                            }}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition text-sm text-slate-800 font-semibold"
                          >
                            {opt.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingLocation}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-350 disabled:text-slate-450 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition duration-150 active:scale-[0.98] flex items-center justify-center text-xs"
                  >
                    {updatingLocation ? '⏳ กำลังอัปเดตสถานที่...' : '💾 บันทึกเปลี่ยนสถานที่'}
                  </button>
                </div>
              </form>
            )}

          </div>
        )}

        {/* TAB 4: MOBILE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4 animate-fade-in-up">
            
            {/* Header section */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-center">
              <span className="text-3xl">📊</span>
              <h3 className="text-xs font-bold text-slate-600 mt-2">ภาพรวมระบบซ่อมบำรุง</h3>
              <p className="text-xxs text-slate-500 mt-1">
                สถิติคลังรถยนต์แจ้งซ่อม คิวยอดสะสม และไทม์ไลน์บันทึกล่าสุด
              </p>
            </div>

            {/* Car Search Block (REAL DB SEARCH) inside Tab 4 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
              <label className="text-xs font-bold text-slate-600 block mb-2">🚗 ค้นหารถยนต์เพื่อดูสถิติ/รายละเอียด <span className="text-rose-550">*</span></label>
              
              {selectedCar ? (
                <div className="flex items-center justify-between bg-slate-50 border border-emerald-300 rounded-2xl p-3">
                  <div>
                    <p className="text-base font-bold text-slate-800">{selectedCar.RegisterNo}</p>
                    <p className="text-xs text-slate-500 font-mono">VIN: {selectedCar.VinNo}</p>
                    <p className="text-xxs text-slate-655 mt-1">โครงการ: <span className="font-bold text-emerald-700">{selectedCar.Project}</span> | รุ่น: {selectedCar.Model}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCar(null)
                      setVehicleHistory([])
                    }}
                    className="bg-white hover:bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition border border-slate-200 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3.5 py-1 transition">
                    <span className="text-slate-400 mr-2">🔍</span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setShowCarDropdown(true)
                      }}
                      onFocus={() => setShowCarDropdown(true)}
                      placeholder="พิมพ์ค้นหาเลขทะเบียนจริง หรือ VIN..."
                      className="bg-transparent text-sm w-full py-2.5 focus:outline-none text-slate-800 placeholder-slate-400"
                    />
                    {loadingCars && <span className="text-xs text-slate-400 animate-pulse">ค้นหา...</span>}
                  </div>

                  {/* Dropdown search results */}
                  {showCarDropdown && searchTerm && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden max-h-56">
                      {dbCars.length > 0 ? (
                        dbCars.map((car, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              handleSelectCar(car)
                              setActiveTab('history') // Transition directly to Tab 2
                            }}
                            className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between text-slate-800"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{car.RegisterNo}</p>
                              <p className="text-xxs text-slate-550 font-mono">VIN: {car.VinNo}</p>
                            </div>
                            <span className="text-xxs font-bold text-slate-655 bg-slate-150 px-2 py-1 rounded">
                              {car.Project}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="p-4 text-center text-xs text-slate-400">ไม่พบข้อมูลทะเบียนรถในฐานข้อมูล</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {loadingMobileDashboard && !mobileDashboardData ? (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <span className="text-xs text-slate-500 animate-pulse">กำลังโหลดสรุปสถิติ...</span>
              </div>
            ) : (
              mobileDashboardData && (
                <>
                  {/* KPI grid (3 columns) */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-center">
                      <span className="text-lg block">🔴</span>
                      <span className="text-[10px] font-bold text-amber-700 block mt-1">กำลังซ่อม</span>
                      <span className="text-lg font-black text-amber-800 block mt-0.5">
                        {mobileDashboardData.stats?.in_maintenance || 0} <span className="text-[9px] font-normal text-amber-600">คัน</span>
                      </span>
                    </div>

                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 text-center">
                      <span className="text-lg block">🟡</span>
                      <span className="text-[10px] font-bold text-rose-700 block mt-1">รอเข้าซ่อม</span>
                      <span className="text-lg font-black text-rose-800 block mt-0.5">
                        {mobileDashboardData.stats?.waiting || 0} <span className="text-[9px] font-normal text-rose-600">คัน</span>
                      </span>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 text-center">
                      <span className="text-lg block">🟢</span>
                      <span className="text-[10px] font-bold text-emerald-700 block mt-1">ซ่อมเสร็จ</span>
                      <span className="text-lg font-black text-emerald-800 block mt-0.5">
                        {mobileDashboardData.stats?.complete || 0} <span className="text-[9px] font-normal text-emerald-600">เคส</span>
                      </span>
                    </div>
                  </div>

                  {/* Stuck Vehicles list (Top 5) */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-1">
                      <span>⚠️</span> รถยนต์ที่จอดค้างซ่อมนานสุด (Top 5)
                    </h4>
                    
                    <div className="space-y-2">
                      {mobileDashboardData.longestRepairs?.slice(0, 5).map((item: any) => (
                        <button
                          key={item.MaintenanceItemID}
                          type="button"
                          onClick={() => handleViewTicketDetail(item.RegisterNo, item.MaintenanceItemID)}
                          className="w-full text-left bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-2xl p-3 flex items-center justify-between gap-3 transition active:scale-98"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-250">
                                {item.RegisterNo || 'ไม่มีทะเบียน'}
                              </span>
                              <span className="text-[9px] text-slate-450 font-mono">#{item.MaintenanceItemID}</span>
                            </div>
                            <p className="text-[10px] font-semibold text-slate-700 truncate mt-1">
                              {item.IssueTitle}
                            </p>
                            <p className="text-[9px] text-indigo-650 font-bold mt-0.5">
                              อู่: {locationOptions.find(o => o.code === item.ServiceLocationCode)?.name || item.ServiceLocationCode || 'ไม่ระบุ'}
                            </p>
                          </div>
                          
                          <div className="text-right shrink-0 bg-white border border-slate-150 px-2.5 py-1.5 rounded-xl shadow-xxs">
                            <span className="text-[9px] font-bold text-slate-400 block leading-none">สะสม</span>
                            <span className={`text-sm font-black block mt-0.5 ${
                              item.DaysActive >= 10 ? 'text-rose-600' : 'text-slate-700'
                            }`}>
                              {item.DaysActive} วัน
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Workshop load queues */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span>📍</span> จำนวนคิวรถค้างซ่อมแยกตามสถานที่
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-0.5">กดที่ชื่อสถานที่ เพื่อดูเลขทะเบียนรถยนต์ที่ค้างอยู่</p>
                    </div>

                    <div className="space-y-2">
                      {mobileDashboardData.locations?.map((loc: any) => {
                        const isExpanded = expandedLocationCode === loc.LocationCode
                        const cars = getVehiclesAtLocation(loc.LocationCode)
                        
                        return (
                          <div key={loc.LocationCode} className="border border-slate-150 rounded-2xl overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setExpandedLocationCode(isExpanded ? null : loc.LocationCode)}
                              className="w-full text-left p-3.5 bg-slate-50 hover:bg-slate-100/80 transition flex items-center justify-between gap-3 text-slate-800"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-bold">{loc.LocationName || 'ไม่ระบุ / นอกสถานที่'}</span>
                                <span className="text-[9px] text-slate-400 block mt-0.5">
                                  {isExpanded ? '▼ ปิดรายละเอียด' : '▶ คลิกแสดงทะเบียนรถ'}
                                </span>
                              </div>
                              <div className="bg-white border border-slate-200 px-3 py-1 rounded-xl shrink-0 text-center min-w-[44px]">
                                <span className="text-xs font-black block text-slate-800">{loc.Count}</span>
                                <span className="text-[8px] text-slate-400 block leading-none uppercase">คัน</span>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="bg-white px-3.5 py-2.5 border-t border-slate-150 space-y-2.5 animate-fade-in">
                                {cars.length > 0 ? (
                                  cars.map((car: any) => (
                                    <button
                                      key={car.MaintenanceItemID}
                                      type="button"
                                      onClick={() => handleViewTicketDetail(car.RegisterNo, car.MaintenanceItemID)}
                                      className="w-full text-left flex justify-between items-center text-[10px] border-b border-slate-100 last:border-0 pb-2 pt-1.5 hover:bg-slate-50 transition active:scale-98"
                                    >
                                      <div className="min-w-0 flex-1 pr-2">
                                        <p className="font-bold text-slate-900 flex items-center gap-1">
                                          🚗 <span className="underline decoration-indigo-300 font-black">{car.RegisterNo || 'ไม่มีทะเบียน'}</span>
                                        </p>
                                        <p className="text-[9px] text-slate-500 truncate mt-0.5">{car.IssueTitle}</p>
                                      </div>
                                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0">
                                        จอด {car.DaysActive} วัน
                                      </span>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-[9px] text-slate-400 italic text-center py-1">ไม่มีประวัติรถคงค้าง ณ สถานที่นี้</p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Live updates Timeline (Top 5) */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
                      📋 อัปเดตล่าสุดของศูนย์/อู่ (Recent Follow-ups)
                    </h4>
                    
                    <div className="space-y-4 pl-3.5 border-l border-slate-200 py-1 ml-1.5">
                      {mobileDashboardData.followUps?.slice(0, 5).map((log: any) => (
                        <div key={log.MaintenanceFollowUpID} className="relative text-[10px]">
                          <span className="absolute -left-[19.5px] top-1 w-2 h-2 rounded-full bg-indigo-500 border border-white" />
                          <div className="flex justify-between text-slate-400 text-[9px]">
                            <span>{formatLiffTime(log.FollowUpDate || log.CreateDate)}</span>
                            <span className="font-bold">{log.CreateUserName}</span>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => handleViewTicketDetail(log.RegisterNo, log.MaintenanceItemID)}
                            className="w-full text-left bg-slate-50 border border-slate-150 hover:border-indigo-300 rounded-xl p-2.5 mt-1.5 transition active:scale-98"
                          >
                            <p className="font-bold text-[9px] text-slate-500 flex items-center gap-1.5">
                              🚗 <span className="text-indigo-650 font-black underline">{log.RegisterNo}</span>
                              <span className="text-slate-400 font-normal">({log.IssueTitle?.slice(0, 15)}...)</span>
                            </p>
                            <p className="text-[10px] font-medium text-slate-750 leading-relaxed mt-0.5 break-words">
                              {log.FollowUpDetail}
                            </p>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )
            )}

          </div>
        )}

      </div>

      {/* BOTTOM TAB NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex justify-around items-center z-50 shadow-lg">
        <button
          onClick={() => setActiveTab('report')}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'report' ? 'text-indigo-650' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg">🚨</span>
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">แจ้งเหตุ</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'history' ? 'text-indigo-650' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg">📋</span>
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">ติดตามงาน</span>
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'contact' ? 'text-indigo-650' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg">📍</span>
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">อัปเดตสถานที่</span>
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'dashboard' ? 'text-indigo-650' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg">📊</span>
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">ภาพรวม</span>
        </button>
      </nav>

      {/* Tailwind Animation utilities injected locally */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes scaleUp {
          from {
            transform: scale(0.85);
          }
          to {
            transform: scale(1);
          }
        }
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-scale-up {
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .animate-slide-up {
          animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.2s ease-out forwards;
        }
        .text-xxs {
          font-size: 10px;
        }
      `}</style>
    </div>
  )
}
