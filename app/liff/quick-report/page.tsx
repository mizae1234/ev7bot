'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import GuideTab from './GuideTab'
import CarInfoCard from './components/CarInfoCard'
import { VehicleNotesSection } from '@/components/vehicle/VehicleNotesSection'
import { VehicleSearchWithScanner } from '@/components/vehicle/VehicleSearchWithScanner'
import InspectionTab from './inspection/InspectionTab'

interface DbCar {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project: string
  Status?: string
  StatusType?: string
  StatusName?: string
  SubStatusName?: string
  CurrentLocation?: string | null
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
  CreateDate?: string
  UpdateDate?: string
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
  CreateDate?: string
  CreateUserName?: string
  UpdateUserName?: string
  MaintenanceFinishDate?: string
  followUps: FollowUpLog[]
  attachments?: any[]
  replacements?: any[]
}

const isMaintComplete = (ticket: any): boolean => {
  if (!ticket) return false
  if (ticket.IsActive === false || ticket.IsActive === 0) {
    return true
  }
  const status = ticket.CarStatusCode
  const desc = ticket.CarStatusDescription
  if (status === 'COMPLETE') {
    return true
  }
  if (desc === 'ปิดเคส' || desc === 'ปิดงาน') {
    return true
  }
  return false
}

// locationOptions is now fetched dynamically from the /api/maintenance/locations API
const ImagePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isImage, setIsImage] = useState(false)

  useEffect(() => {
    console.log('🔍 [ImagePreview] Processing file:', file.name, 'type:', file.type, 'size:', file.size)
    const isImg = file.type.startsWith('image/')
    setIsImage(isImg)
    
    if (isImg) {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          console.log('🔍 [ImagePreview] FileReader loaded base64 for:', file.name)
          setPreviewUrl(e.target.result as string)
        }
      }
      reader.onerror = (err) => {
        console.error('🔍 [ImagePreview] FileReader error:', err)
        setIsImage(false)
      }
      reader.readAsDataURL(file)
    } else {
      console.log('🔍 [ImagePreview] File is not an image, showing doc icon:', file.name)
    }
  }, [file])

  const fileSizeText = (file.size / (1024 * 1024)).toFixed(2) + ' MB'

  return (
    <div className="relative group flex items-center gap-2.5 border border-slate-200 bg-white p-2 rounded-2xl text-xs overflow-hidden shadow-sm">
      <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-100 shrink-0 bg-slate-50 flex items-center justify-center text-lg">
        {isImage && previewUrl ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xl">📄</span>
        )}
      </div>
      <div className="overflow-hidden flex-1 pr-5">
        <p className="font-bold text-slate-800 truncate leading-snug">{file.name}</p>
        <p className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">{fileSizeText}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1/2 -translate-y-1/2 right-2 text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition"
      >
        ✕
      </button>
    </div>
  )
}

export default function QuickReportPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'report' | 'history' | 'chat' | 'contact' | 'dashboard' | 'guide' | 'inspection'>('report')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [currentUserFullName, setCurrentUserFullName] = useState<string>('')

  // Search and selection
  const [selectedCar, setSelectedCar] = useState<DbCar | null>(null)
  const [selectedCarDetails, setSelectedCarDetails] = useState<any>(null)

  // Refs for focusing back on inputs after selecting mentions
  const editFollowUpRef = useRef<HTMLTextAreaElement>(null)
  const quickLogRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // Form Fields
  const [contractorName, setContractorName] = useState('')
  const [driverName, setDriverName] = useState('')
  const [activeContractNo, setActiveContractNo] = useState('')
  const [incidentDate, setIncidentDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
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
  const [locationOptions, setLocationOptions] = useState<{ code: string; name: string }[]>([])

  // Mentions
  const [mentionUsers, setMentionUsers] = useState<{ id: any; name: string; fullName: string }[]>([])
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionCursorPos, setMentionCursorPos] = useState(0)
  const [activeMentionField, setActiveMentionField] = useState<'followUp' | 'quickLog'>('followUp')
  const [activeQuickLogId, setActiveQuickLogId] = useState<number | null>(null)

  // Fetch mention list on mount
  useEffect(() => {
    const fetchMentions = async () => {
      try {
        const res = await fetch('/api/users/mention-list')
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) setMentionUsers(data)
        }
      } catch (err) {
        console.error('Failed to fetch mention users:', err)
      }
    }
    fetchMentions()
  }, [])

  // Fetch Location options from EV_MsSubStatus
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/maintenance/locations')
        if (res.ok) {
          const data = await res.json()
          setLocationOptions(data.locations || [])
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err)
      }
    }
    fetchLocations()
  }, [])

  // Auth checking effect
  useEffect(() => {
    const checkAuthStatus = async () => {
      const profileStr = localStorage.getItem('liff_profile')
      if (!profileStr) {
        // No local cache, redirect back to /liff to login
        console.log('[Quick Report Auth] No LINE profile found, redirecting to /liff...')
        router.replace('/liff?path=' + encodeURIComponent(window.location.pathname + window.location.search))
        return
      }

      try {
        const profile = JSON.parse(profileStr)
        if (!profile.userId) {
          throw new Error('No userId in cache')
        }

        const res = await fetch(`/api/liff/check-auth?userId=${profile.userId}`)
        if (!res.ok) {
          throw new Error('Auth check failed')
        }
        
        const data = await res.json()
        if (!data.authenticated) {
          console.log('[Quick Report Auth] User is not mapped, redirecting to registration...')
          router.replace('/liff/register?path=' + encodeURIComponent(window.location.pathname + window.location.search))
          return
        }

        // Auth passed!
        setUserRole(data.role || 'USER')
        setCurrentUserFullName(data.ev7UserName || '')
        if (data.spacesCdn) {
          localStorage.setItem('spaces_cdn', data.spacesCdn)
        }
        setAuthChecking(false)
      } catch (err) {
        console.error('[Quick Report Auth Error]', err)
        router.replace('/liff?path=' + encodeURIComponent(window.location.pathname + window.location.search))
      }
    }

    checkAuthStatus()
  }, [router])
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
  const [dbInsuranceOptions, setDbInsuranceOptions] = useState<{ StatusCode: string, StatusName: string }[]>([])
  const [dbProblemTypes, setDbProblemTypes] = useState<{ StatusCode: string, StatusName: string }[]>([])

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
    contractNo: '',
    hasReplacement: false,
    replacementVin: '',
    replacementLocation: '',
    replacementStartDate: '',
  })
  const [editDetailAttachments, setEditDetailAttachments] = useState<File[]>([])
  
  // Replacement Car Search and Selection States
  const [hasReplacement, setHasReplacement] = useState(false)
  const [replacementVin, setReplacementVin] = useState('')
  const [replacementReserved, setReplacementReserved] = useState<any>(null)
  const [replacementLocation, setReplacementLocation] = useState('')
  const [replacementStartDate, setReplacementStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [replacementCars, setReplacementCars] = useState<any[]>([])
  const [loadingReplacementCars, setLoadingReplacementCars] = useState(false)

  const replSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadReplacementCars = async (search: string = '') => {
    setLoadingReplacementCars(true)
    try {
      const res = await fetch(`/api/vehicles/search?replacement=true&q=${encodeURIComponent(search)}`)
      if (res.ok) {
        const data = await res.json()
        setReplacementCars(data)
      }
    } catch (err) {
      console.error('Failed to load replacement cars:', err)
    } finally {
      setLoadingReplacementCars(false)
    }
  }

  const loadReplacementCarsDebounced = useCallback((search: string) => {
    if (replSearchTimerRef.current) clearTimeout(replSearchTimerRef.current)
    replSearchTimerRef.current = setTimeout(() => loadReplacementCars(search), 300)
  }, [])
  const [replCarSearch, setReplCarSearch] = useState('')
  const [editReplCarSearch, setEditReplCarSearch] = useState('')
  const [editDetailDeletedPhotoIds, setEditDetailDeletedPhotoIds] = useState<number[]>([])
  const [savingDetailEdit, setSavingDetailEdit] = useState(false)

  // Beautiful Custom Alert Modal State & Function override
  const [alertConfig, setAlertConfig] = useState<{ show: boolean; message: string; type: 'success' | 'error' | 'warning' | 'info'; title: string } | null>(null)

  const alert = (message: string) => {
    let type: 'success' | 'error' | 'warning' | 'info' = 'warning'
    let title = 'คำแนะนำ'

    const msgLower = message.toLowerCase()
    if (msgLower.includes('สำเร็จ') || msgLower.includes('เรียบร้อย')) {
      type = 'success'
      title = 'สำเร็จ'
    } else if (msgLower.includes('ไม่สำเร็จ') || msgLower.includes('เกิดข้อผิดพลาด') || msgLower.includes('ไม่พบ') || msgLower.includes('ล้มเหลว') || msgLower.includes('ไม่มี') || msgLower.includes('ผิด')) {
      type = 'error'
      title = 'ข้อผิดพลาด'
    } else if (msgLower.includes('กรุณา') || msgLower.includes('ต้อง')) {
      type = 'warning'
      title = 'คำแนะนำ'
    } else {
      type = 'info'
      title = 'แจ้งเตือน'
    }

    setAlertConfig({ show: true, message, type, title })
  }

  // Tab 2 Quick Follow-up States
  const [quickLogs, setQuickLogs] = useState<Record<number, string>>({})
  const [savingQuickLogId, setSavingQuickLogId] = useState<number | null>(null)

  // Tab 3 Update Location States
  const [selectedMaintId, setSelectedMaintId] = useState<number | ''>('')
  const [selectedLocCode, setSelectedLocCode] = useState('')
  const [locSearchTerm, setLocSearchTerm] = useState('')
  const [showLocDropdown, setShowLocDropdown] = useState(false)
  const [updatingLocation, setUpdatingLocation] = useState(false)

  const [isRepossessed, setIsRepossessed] = useState(false)
  const [repossessDate, setRepossessDate] = useState(() => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const date = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${date}`
  })
  const [repossessLocation, setRepossessLocation] = useState('')
  const [repossessRemark, setRepossessRemark] = useState('')
  const [activeRentItemId, setActiveRentItemId] = useState<number | null>(null)

  // Sync selectedLocCode and locSearchTerm when locationOptions, vehicleHistory, selectedMaintId, selectedCar, or selectedCarDetails changes
  useEffect(() => {
    if (locationOptions.length > 0) {
      if (selectedMaintId && selectedMaintId !== 0 && vehicleHistory.length > 0) {
        const currentTicket = vehicleHistory.find((t: any) => Number(t.MaintenanceItemID) === Number(selectedMaintId))
        if (currentTicket) {
          const matchedLoc = locationOptions.find(o => o.code === currentTicket.ServiceLocationCode || o.name === currentTicket.ServiceLocation)
          setSelectedLocCode(matchedLoc ? matchedLoc.code : (currentTicket.ServiceLocationCode || ''))
          setLocSearchTerm(matchedLoc ? matchedLoc.name : (currentTicket.ServiceLocation || ''))
        }
      } else {
        const currentCarLoc = selectedCarDetails?.CurrentLocation || selectedCar?.CurrentLocation
        if (currentCarLoc) {
          const matchedLoc = locationOptions.find(o => o.code === currentCarLoc)
          setSelectedLocCode(matchedLoc ? matchedLoc.code : currentCarLoc)
          setLocSearchTerm(matchedLoc ? matchedLoc.name : currentCarLoc)
        }
      }
    }
  }, [locationOptions, vehicleHistory, selectedMaintId, selectedCar, selectedCarDetails])

  // Tab 4 Mobile Dashboard States
  const [mobileDashboardData, setMobileDashboardData] = useState<any>(null)
  const [loadingMobileDashboard, setLoadingMobileDashboard] = useState(false)
  const [expandedLocationCode, setExpandedLocationCode] = useState<string | null>(null)

  // Quick Check-in State
  const [checkingInId, setCheckingInId] = useState<number | null>(null)

  // Show Add Incident Form State
  const [showAddIncidentForm, setShowAddIncidentForm] = useState(false)

  // Bulk Action States
  const [bulkActionType, setBulkActionType] = useState<'park' | 'start' | 'complete' | 'close_case' | null>(null)
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

  // Close Case Field States
  const [closeFinishDate, setCloseFinishDate] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10) // yyyy-MM-dd
  })
  const [closeFormSubmitted, setCloseFormSubmitted] = useState(false)
  const [closeReturnDate, setCloseReturnDate] = useState('')
  const [closeRootCause, setCloseRootCause] = useState('')
  const [closeFixAction, setCloseFixAction] = useState('')
  const [closeRemark, setCloseRemark] = useState('')
  const [closeAttachments, setCloseAttachments] = useState<File[]>([])
  const [closeCurrentLocation, setCloseCurrentLocation] = useState('')
  const [closeReplacementReturnDate, setCloseReplacementReturnDate] = useState('')
  const [closeReplacementLocation, setCloseReplacementLocation] = useState('')


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

  // Mentions event handlers
  const handleMentionTextChange = (
    text: string,
    selectionStart: number | null,
    field: 'followUp' | 'quickLog',
    ticketId?: number
  ) => {
    if (field === 'followUp') {
      setEditFollowUp(text)
    } else if (field === 'quickLog' && ticketId) {
      setQuickLogs(prev => ({
        ...prev,
        [ticketId]: text
      }))
    }
    
    const selStart = selectionStart ?? text.length
    // Find last '@' before cursor
    const textBeforeCursor = text.slice(0, selStart)
    const lastAtIdx = textBeforeCursor.lastIndexOf('@')
    
    if (lastAtIdx !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1)
      // Check if no whitespace and no other '@' exists between '@' and cursor
      if (!/\s/.test(textAfterAt) && !/@/.test(textAfterAt)) {
        setMentionSearch(textAfterAt)
        setMentionCursorPos(lastAtIdx)
        setShowMentionDropdown(true)
        setActiveMentionField(field)
        if (ticketId) setActiveQuickLogId(ticketId)
        return
      }
    }
    setShowMentionDropdown(false)
  }

  const handleSelectMention = (name: string) => {
    let currentText = ''
    if (activeMentionField === 'followUp') {
      currentText = editFollowUp
    } else if (activeMentionField === 'quickLog' && activeQuickLogId !== null) {
      currentText = quickLogs[activeQuickLogId] || ''
    }

    const beforeAt = currentText.slice(0, mentionCursorPos)
    const afterCursor = currentText.slice(mentionCursorPos + 1 + mentionSearch.length)
    const newText = `${beforeAt}@${name} ${afterCursor}`
    
    if (activeMentionField === 'followUp') {
      setEditFollowUp(newText)
    } else if (activeMentionField === 'quickLog' && activeQuickLogId !== null) {
      const qid = activeQuickLogId
      setQuickLogs(prev => ({
        ...prev,
        [qid]: newText
      }))
    }
    setShowMentionDropdown(false)

    // Calculate cursor position (1 for '@', length of name, and 1 for space)
    const newCursorPos = mentionCursorPos + 1 + name.length + 1

    // Return focus to the input and set selection range
    setTimeout(() => {
      if (activeMentionField === 'followUp' && editFollowUpRef.current) {
        editFollowUpRef.current.focus()
        editFollowUpRef.current.setSelectionRange(newCursorPos, newCursorPos)
      } else if (activeMentionField === 'quickLog' && activeQuickLogId !== null && quickLogRefs.current[activeQuickLogId]) {
        const el = quickLogRefs.current[activeQuickLogId]
        if (el) {
          el.focus()
          el.setSelectionRange(newCursorPos, newCursorPos)
        }
      }
    }, 50)
  }

  // Fetch real details (active driver, history) when selectedCar changes
  const handleSelectCar = async (car: DbCar) => {
    setSelectedCar(car)
    setLoadingHistory(true)
    setVehicleHistory([])
    setShowAddIncidentForm(false)

    try {
      const res = await fetch(`/api/vehicle/${encodeURIComponent(car.RegisterNo)}`)
      if (res.ok) {
        const data = await res.json()
        setDbCarStatuses(data.carStatuses || [])
        setDbInsuranceOptions(data.insuranceOptions || [])
        setDbProblemTypes(data.problemTypes || [])
        if (data.car) {
          setSelectedCarDetails(data.car)
        }
        
        // 1. Set driver name if there is an active rental contract
        if (data.currentRent) {
          const name = `${data.currentRent.FirstName} ${data.currentRent.LastName}`.trim()
          setContractorName(name)
          setDriverName(name)
          setActiveContractNo(data.currentRent.ContractNo || '')
          setActiveRentItemId(data.currentRent.RentItemID ? Number(data.currentRent.RentItemID) : null)
        } else {
          setContractorName('')
          setDriverName('')
          setActiveContractNo('')
          setActiveRentItemId(null)
        }

        // 2. Set maintenance history & prepopulate location states for Tab 3
        if (data.maintenance) {
          setVehicleHistory(data.maintenance)
          const firstPending = data.maintenance.find((t: any) => !isMaintComplete(t))
          setShowAddIncidentForm(!firstPending)
          if (firstPending) {
            setSelectedMaintId(firstPending.MaintenanceItemID)
          } else {
            setSelectedMaintId(0)
          }
        }

        // 3. Check if there is an active replacement reservation
        if (data.replacementReserved) {
          setReplacementReserved(data.replacementReserved)
          setHasReplacement(true)
          setReplacementVin(data.replacementReserved.ReservedReplacementVinNo)
          setReplCarSearch(data.replacementReserved.ReservedReplacementVinNo)
        } else {
          setReplacementReserved(null)
          setHasReplacement(false)
          setReplacementVin('')
          setReplCarSearch('')
        }
      }
    } catch (err) {
      console.error('Error fetching vehicle contract/history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Auto-fill car and tab from search parameters
  useEffect(() => {
    if (authChecking) return

    const parseQueryParams = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const tab = params.get('tab')
        const registerNo = params.get('registerNo')
        const maintId = params.get('maintId')

        if (tab === 'history') {
          setActiveTab('history')
        } else if (tab === 'report') {
          setActiveTab('report')
        } else if (tab === 'chat') {
          setActiveTab('chat')
        }

        if (registerNo) {
          const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(registerNo)}`)
          if (res.ok) {
            const data = await res.json()
            const cars = (Array.isArray(data) ? data : data.cars) || []
            const matchedCar = cars.find((c: any) => c.RegisterNo === registerNo) || cars[0]
            if (matchedCar) {
              setSelectedCar(matchedCar)
              setLoadingHistory(true)
              setVehicleHistory([])
              setShowAddIncidentForm(false)

              // Load history and setup details directly
              const historyRes = await fetch(`/api/vehicle/${encodeURIComponent(matchedCar.RegisterNo)}`)
              if (historyRes.ok) {
                const historyData = await historyRes.json()
                setDbCarStatuses(historyData.carStatuses || [])
                setDbInsuranceOptions(historyData.insuranceOptions || [])
                setDbProblemTypes(historyData.problemTypes || [])
                if (historyData.car) {
                  setSelectedCarDetails(historyData.car)
                }

                const historyList = historyData.maintenance || []
                setVehicleHistory(historyList)

                if (historyData.currentRent) {
                  const name = `${historyData.currentRent.FirstName} ${historyData.currentRent.LastName}`.trim()
                  setContractorName(name)
                  setDriverName(name)
                  setActiveContractNo(historyData.currentRent.ContractNo || '')
                } else {
                  setContractorName('')
                  setDriverName('')
                  setActiveContractNo('')
                }

                // If maintId query parameter is provided, auto-open the edit ticket modal
                if (maintId) {
                  const targetTicket = historyList.find((t: any) => t.MaintenanceItemID === Number(maintId))
                  if (targetTicket) {
                    setEditingTicket(targetTicket)
                    setEditDetailTicket(targetTicket)
                    setEditFollowUp('')
                    setEditDetailFields({
                      carStatusCode: targetTicket.CarStatusCode || '',
                      serviceLocationCode: targetTicket.ServiceLocationCode || '',
                      driverName: targetTicket.DriverName || '',
                      incidentDate: targetTicket.IncidentDate ? targetTicket.IncidentDate.slice(0, 10) : '',
                      issueTitle: targetTicket.IssueTitle || '',
                      problemType: targetTicket.ProblemTypeCode || '',
                      faultParty: targetTicket.FaultPartyCode || '',
                      carCase: targetTicket.CarCaseCode || '',
                      insurance: targetTicket.InsuranceCode || '',
                      claimNumber: targetTicket.ClaimNumber || '',
                      contractNo: targetTicket.ContractNo || (historyData.currentRent ? historyData.currentRent.ContractNo : ''),
                      hasReplacement: targetTicket.replacements && targetTicket.replacements.length > 0 && targetTicket.replacements.some((r: any) => r.IsActive),
                      replacementVin: targetTicket.replacements && targetTicket.replacements.length > 0 ? targetTicket.replacements[0].VinNo : '',
                      replacementLocation: targetTicket.replacements && targetTicket.replacements.length > 0 ? targetTicket.replacements[0].Location : '',
                      replacementStartDate: targetTicket.replacements && targetTicket.replacements.length > 0 && targetTicket.replacements[0].ReplacementStartDate ? targetTicket.replacements[0].ReplacementStartDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
                    })
                  }
                }
              }
              setLoadingHistory(false)
            }
          }
        }
      } catch (err) {
        console.error('Error parsing query params in quick-report:', err)
      }
    }

    parseQueryParams()
  }, [authChecking])

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
          followUpDetail: 'ระบบอัพเดต : นำรถเข้าซ่อมบำรุง (งดใช้งาน)',
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
  const handleSaveBulkAction = async (type: 'park' | 'start' | 'complete' | 'close_case') => {
    // For 'park' (เข้าซ่อม): update ALL pending tickets
    // For 'start'/'complete'/'close_case': update only selected tickets
    const ticketsToProcess = type === 'park' 
      ? pendingTickets 
      : pendingTickets.filter(t => selectedBulkTicketIds.includes(t.MaintenanceItemID))
    
    if (ticketsToProcess.length === 0) {
      alert('กรุณาเลือกรายการใบงานที่ต้องการดำเนินการอย่างน้อย 1 รายการ')
      return
    }

    if (type === 'park' || type === 'start') {
      if (!bulkLocation || !bulkLocation.trim()) {
        alert('กรุณาเลือกสถานที่/อู่ที่ซ่อม')
        return
      }
    }

    if (type === 'close_case') {
      setCloseFormSubmitted(true)
      if (!closeFinishDate) {
        alert('กรุณาระบุวันที่รถซ่อมเสร็จ')
        return
      }
      if (!closeReturnDate) {
        alert('กรุณาระบุวันที่รับรถกลับ')
        return
      }
      if (!closeCurrentLocation) {
        alert('กรุณาระบุสถานที่ปัจจุบัน')
        return
      }
      if (closeAttachments.length === 0) {
        alert('กรุณาแนบหลักฐานการรับรถ หรือหลักฐานการปิดงาน อย่างน้อย 1 ภาพ')
        return
      }

      const hasActiveReplacement = ticketsToProcess
        .flatMap(t => t.replacements || [])
        .some(r => r.IsActive && !r.ReplacementReturnDate)

      if (hasActiveReplacement) {
        if (!closeReplacementReturnDate) {
          alert('กรุณาระบุวันที่คืนรถทดแทน')
          return
        }
        if (!closeReplacementLocation) {
          alert('กรุณาระบุจุดคืนรถทดแทน')
          return
        }
      }
    }

    setSubmittingBulk(true)
    try {
      const locName = locationOptions.find(o => o.code === bulkLocation)?.name || 'ไม่ระบุ / นอกสถานที่'
      
      const promises = ticketsToProcess.map(async (ticket) => {
        const payload: any = {
          maintenanceId: ticket.MaintenanceItemID,
          lineUserId: getLineUserId()
        }

        if (type === 'park') {
          payload.carStatusCode = 'WAITING_FOR_MAINTENANCE'
          payload.serviceLocationCode = bulkLocation
          payload.serviceLocationName = locName
          payload.followUpDetail = `ระบบอัพเดต : เข้าซ่อม ณ สถานที่: ${locName}`
        } else if (type === 'start') {
          payload.carStatusCode = 'IN_MAINTENANCE'
          payload.startDate = bulkStartDate
          payload.serviceLocationCode = bulkLocation
          payload.serviceLocationName = locName
          payload.followUpDetail = `ระบบอัพเดต : เริ่มซ่อม ณ อู่: ${locName} เมื่อวันที่: ${formatLiffTime(bulkStartDate)}`
        } else if (type === 'complete') {
          payload.carStatusCode = 'COMPLETE'
          payload.finishDate = bulkFinishDate
          payload.followUpDetail = `ระบบอัพเดต : ซ่อมเสร็จสิ้น เมื่อวันที่: ${formatLiffTime(bulkFinishDate)}`
          payload.isLastPending = selectedBulkTicketIds.length === pendingTickets.length
        } else if (type === 'close_case') {
          payload.carStatusCode = 'COMPLETE'
          payload.finishDate = closeFinishDate
          payload.returnDate = closeReturnDate
          payload.rootCause = closeRootCause
          payload.fixAction = closeFixAction
          const now = new Date()
          const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
          const closeDateText = `${now.getDate()} ${thMonths[now.getMonth()]} ${now.getFullYear() + 543} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
          payload.followUpDetail = `ระบบอัพเดต : ปิดเคส เมื่อวันที่: ${closeDateText}${closeRemark ? ` | หมายเหตุ: ${closeRemark}` : ''}`
          payload.isLastPending = selectedBulkTicketIds.length === pendingTickets.length
          payload.currentLocation = closeCurrentLocation
          payload.replacementReturnDate = closeReplacementReturnDate
          payload.replacementLocation = closeReplacementLocation
        }

        const res = await fetch('/api/maintenance/update-quick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `อัปเดตใบงาน #${ticket.MaintenanceItemID} ไม่สำเร็จ`)
        }

        // Upload attachments if close_case
        if (type === 'close_case' && closeAttachments.length > 0) {
          const formData = new FormData()
          closeAttachments.forEach((file) => {
            formData.append('files', file)
          })
          formData.append('maintenanceId', String(ticket.MaintenanceItemID))
          formData.append('lineUserId', getLineUserId() || '')
          formData.append('processType', 'MAINTENANCE_COMPLETE')

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })

          if (!uploadRes.ok) {
            const uploadErr = await uploadRes.json()
            throw new Error(`ไม่สามารถอัปโหลดรูปภาพปิดเคสสำหรับใบงาน #${ticket.MaintenanceItemID} ได้: ${uploadErr.error || ''}`)
          }
        }
      })

      await Promise.all(promises)

      alert('บันทึกอัปเดตข้อมูลเรียบร้อยแล้ว')
      setBulkActionType(null)
      setBulkLocation('')
      setSelectedBulkTicketIds([])
      setCloseReturnDate('')
      setCloseRootCause('')
      setCloseFixAction('')
      setCloseRemark('')
      setCloseAttachments([])
      
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
    if ((initialCarStatus === 'WAITING_FOR_MAINTENANCE' || initialCarStatus === 'IN_MAINTENANCE') && !serviceLocation) {
      alert('กรุณาระบุสถานที่/อู่ที่ซ่อม')
      return
    }
    if (!issueDescription.trim()) {
      alert('กรุณาระบุอาการรถเสีย / รายละเอียดความเสียหาย')
      return
    }

    if (hasReplacement) {
      if (!replacementVin) {
        alert('กรุณาเลือกข้อมูลรถทดแทน')
        return
      }
      if (!replacementLocation) {
        alert('กรุณาเลือกสถานที่รับ/คืนรถทดแทน')
        return
      }
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
        contractNo: activeContractNo || null,
        faultPartyCode: faultParty,
        carCaseCode: carCase,
        serviceLocationCode: serviceLocation,
        serviceLocationName: locationOptions.find(o => o.code === serviceLocation)?.name || '',
        location: location ? `${location.lat}, ${location.lng}` : null,
        hasReplacement,
        replacementVin: hasReplacement ? replacementVin : null,
        replacementLocation: hasReplacement ? replacementLocation : null,
        replacementStartDate: hasReplacement ? replacementStartDate : null,
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
    setSelectedCar(null)
    setSelectedCarDetails(null)
    setContractorName('')
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
      } else if (ticket.CarStatusDescription === 'ซ่อมเสร็จ' || ticket.CarStatusDescription === 'ซ่อมเสร็จสิ้น' || ticket.CarStatusDescription === 'ปิดเคส' || ticket.CarStatusDescription === 'ปิดงาน') {
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
          followUpDetail: editFollowUp,
          lineUserId: getLineUserId(),
          deletedAttachmentIds: deletedPhotoIds
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'ไม่สามารถอัปเดตสถานะได้')
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
    const activeRepl = ticket.replacements && ticket.replacements.length > 0
      ? ticket.replacements.find((r: any) => r.IsActive !== false)
      : null

    const hasRepl = !!activeRepl || !!replacementReserved
    const replVin = activeRepl ? activeRepl.VinNo : (replacementReserved ? replacementReserved.ReservedReplacementVinNo : '')
    const replLoc = activeRepl ? (activeRepl.Location || '') : ''
    const replStart = activeRepl && activeRepl.ReplacementStartDate
      ? new Date(activeRepl.ReplacementStartDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)

    setEditReplCarSearch(replVin)
    setEditDetailTicket(ticket)
    setEditDetailFields({
      driverName: ticket.DriverName || '',
      incidentDate: ticket.IncidentDate ? new Date(ticket.IncidentDate).toISOString().slice(0, 10) : '',
      issueTitle: ticket.IssueTitle || '',
      carStatusCode: ticket.CarStatusCode || 'WAITING_FOR_MAINTENANCE',
      serviceLocationCode: ticket.ServiceLocationCode || '',
      problemType: ticket.ProblemTypeCode || 'ACCIDENT',
      faultParty: ticket.FaultPartyCode || '',
      carCase: ticket.CarCaseCode || '',
      insurance: ticket.InsuranceCode || '',
      claimNumber: ticket.ClaimNumber || '',
      contractNo: (ticket as any).ContractNo || activeContractNo || '',
      hasReplacement: hasRepl,
      replacementVin: replVin,
      replacementLocation: replLoc,
      replacementStartDate: replStart
    })
    setEditDetailAttachments([])
    setEditDetailDeletedPhotoIds([])
  }

  const handleSaveDetailEdit = async () => {
    if (!editDetailTicket) return

    if (editDetailFields.hasReplacement) {
      if (!editDetailFields.replacementVin) {
        alert('กรุณาเลือกข้อมูลรถทดแทน')
        return
      }
      if (!editDetailFields.replacementLocation) {
        alert('กรุณาเลือกสถานที่รับ/คืนรถทดแทน')
        return
      }
    }

    if ((editDetailFields.carStatusCode === 'WAITING_FOR_MAINTENANCE' || editDetailFields.carStatusCode === 'IN_MAINTENANCE') && !editDetailFields.serviceLocationCode) {
      alert('กรุณาระบุสถานที่/อู่ที่ซ่อม')
      return
    }

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
          contractNo: editDetailFields.contractNo || null,
          hasReplacement: editDetailFields.hasReplacement,
          replacementVin: editDetailFields.hasReplacement ? editDetailFields.replacementVin : null,
          replacementLocation: editDetailFields.hasReplacement ? editDetailFields.replacementLocation : null,
          replacementStartDate: editDetailFields.hasReplacement ? editDetailFields.replacementStartDate : null,
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'ไม่สามารถบันทึกการแก้ไขได้')
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

    const isDirectInventoryUpdate = 
      isRepossessed ||
      !selectedMaintId || 
      selectedMaintId === 0 || 
      (selectedCar && (selectedCar.Status === 'AVAILABLE' || selectedCar.StatusType === 'REPLACEMENT_AVAILABLE' || pendingTickets.length === 0))

    let targetMaintId = selectedMaintId
    if (!targetMaintId && vehicleHistory.length > 0 && !isDirectInventoryUpdate) {
      targetMaintId = vehicleHistory[0].MaintenanceItemID
    }

    if (!isDirectInventoryUpdate && !targetMaintId) {
      alert('ไม่สามารถอัปเดตสถานที่ได้ เนื่องจากรถคันนี้ไม่มีประวัติใบงานซ่อมในระบบ (กรุณาแจ้งเหตุใหม่เพื่อเปิดเคสก่อน)')
      return
    }

    if (isRepossessed) {
      if (!repossessLocation || !repossessLocation.trim()) {
        alert('กรุณากรอกสถานที่ที่ไปยึดรถ')
        return
      }
      if (!repossessDate) {
        alert('กรุณาเลือกวันที่ที่ไปยึดรถ')
        return
      }
    }

    if (!selectedLocCode || !selectedLocCode.trim()) {
      alert('กรุณาเลือกสถานที่ / อู่')
      return
    }

    setUpdatingLocation(true)
    try {
      const locName = locationOptions.find(o => o.code === selectedLocCode)?.name || 'ไม่ระบุ / นอกสถานที่'
      
      const payload: any = {
        serviceLocationCode: selectedLocCode,
        serviceLocationName: locName,
        lineUserId: getLineUserId()
      }

      if (isDirectInventoryUpdate) {
        payload.inventoryItemId = selectedCar?.InventoryItemID
      } else {
        payload.maintenanceId = targetMaintId
      }

      if (isRepossessed) {
        payload.isRepossessed = true
        payload.repossessDate = repossessDate
        payload.repossessLocation = repossessLocation
        payload.repossessRemark = repossessRemark
        payload.rentItemId = activeRentItemId
        payload.contractNo = activeContractNo
      }

      const res = await fetch('/api/maintenance/update-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error('ไม่สามารถอัปเดตสถานที่ซ่อมได้')
      }

      const result = await res.json()
      alert(result.message || 'อัปเดตสถานที่ปัจจุบันเรียบร้อยแล้ว')
      
      // Reset repossess states on success
      setIsRepossessed(false)
      setRepossessLocation('')
      setRepossessRemark('')

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
        setDbInsuranceOptions(data.insuranceOptions || [])
        setDbProblemTypes(data.problemTypes || [])
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
      // SQL Server stores Bangkok time directly, parse without timezone conversion
      const d = new Date(isoString)
      const day = d.getUTCDate()
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
      const month = months[d.getUTCMonth()]
      const year = d.getUTCFullYear() + 543
      const hour = d.getUTCHours().toString().padStart(2, '0')
      const minute = d.getUTCMinutes().toString().padStart(2, '0')
      return `${day} ${month} ${year} ${hour}:${minute}`
    } catch {
      return isoString
    }
  }

  const formatLiffDate = (isoString: string) => {
    try {
      // SQL Server stores Bangkok time directly, parse without timezone conversion
      const d = new Date(isoString)
      const day = d.getUTCDate()
      const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
      const month = months[d.getUTCMonth()]
      const year = d.getUTCFullYear() + 543
      return `${day} ${month} ${year}`
    } catch {
      return isoString
    }
  }

  const pendingTickets = useMemo(
    () => vehicleHistory.filter(ticket => !isMaintComplete(ticket)),
    [vehicleHistory]
  )

  // Pre-built Map for O(1) location lookups instead of O(n) .find() on every render
  const locationMap = useMemo(
    () => new Map(locationOptions.map(o => [o.code, o.name])),
    [locationOptions]
  )

  // Shared deselect handler used by CarInfoCard across all tabs
  const handleDeselectCar = useCallback(() => {
    setSelectedCar(null)
    setSelectedCarDetails(null)
    setContractorName('')
    setVehicleHistory([])
    setIsRepossessed(false)
    setRepossessLocation('')
    setRepossessRemark('')
    setActiveRentItemId(null)
  }, [])

  // Group vehicles at location from Mobile Dashboard Data
  const getVehiclesAtLocation = (locCode: string) => {
    const repairs = mobileDashboardData?.longestRepairs || []
    return repairs.filter((r: any) => r.ServiceLocationCode === locCode || (locCode === 'ไม่ระบุ' && !r.ServiceLocationCode))
  }

  // ─── RENDER AUTH CHECKING LOADER ──────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-bold">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</p>
        </div>
      </div>
    )
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
              <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 วันที่เกิดเหตุ</label>
              <input
                type="date"
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
                  { StatusCode: 'IN_MAINTENANCE', StatusName: 'รถอยู่ระหว่างซ่อม' }
                ])
                  .filter((st) => st.StatusCode === 'WAITING_FOR_MAINTENANCE' || st.StatusCode === 'STILL_WORK' || st.StatusCode === 'IN_MAINTENANCE')
                  .map((st) => (
                    <option key={st.StatusCode} value={st.StatusCode}>
                      {st.StatusCode === 'WAITING_FOR_MAINTENANCE' ? '🟡' : st.StatusCode === 'IN_MAINTENANCE' ? '🟠' : '🔵'} {st.StatusName}
                    </option>
                  ))}
              </select>
            </div>

            {/* Replacement Car Assignment */}
            {(editDetailFields.carStatusCode === 'WAITING_FOR_MAINTENANCE' || editDetailFields.carStatusCode === 'IN_MAINTENANCE') && (
              <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in-up">
                <div className="flex items-center gap-2.5 bg-slate-50/50 p-3 rounded-2xl border border-slate-150">
                  <input
                    type="checkbox"
                    id="editHasReplacement"
                    checked={editDetailFields.hasReplacement}
                    onChange={(e) => {
                      setEditDetailFields(prev => ({ ...prev, hasReplacement: e.target.checked }))
                      if (e.target.checked) {
                        loadReplacementCars('')
                      } else {
                        setEditDetailFields(prev => ({ ...prev, replacementVin: '' }))
                        setEditReplCarSearch('')
                      }
                    }}
                    className="w-4.5 h-4.5 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="editHasReplacement" className="text-xs font-bold text-slate-700 cursor-pointer">
                    ต้องการรถทดแทนหรือไม่
                  </label>
                </div>

                {editDetailFields.hasReplacement && (
                  <div className="bg-indigo-50/20 p-4 rounded-3xl border border-indigo-100/50 space-y-4 animate-scale-up">
                    {/* Searchable Replacement Car */}
                    <div className="relative">
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">
                        <span className="text-rose-555">*</span> ข้อมูลรถทดแทน
                      </label>
                      <input
                        type="text"
                        placeholder="🔎 ค้นหาทะเบียน หรือ VIN รถทดแทน..."
                        value={editReplCarSearch}
                        onChange={(e) => {
                          setEditReplCarSearch(e.target.value)
                          loadReplacementCarsDebounced(e.target.value)
                        }}
                        onFocus={() => loadReplacementCars(editReplCarSearch)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition font-semibold"
                      />
                      {/* Results dropdown list */}
                      {replacementCars.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50">
                          {replacementCars.map((car) => (
                            <div
                              key={car.InventoryItemID}
                              onClick={() => {
                                setEditDetailFields(prev => ({ ...prev, replacementVin: car.VinNo }))
                                setEditReplCarSearch(`${car.RegisterNo || '-'} (${car.Model || '-'}) [Project: ${car.Project || '-'}]`)
                                setReplacementCars([]) // Hide dropdown
                              }}
                              className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs text-slate-800"
                            >
                              <span className="font-bold text-indigo-650">{car.RegisterNo || '-'}</span> 
                              <span className="text-slate-500"> (VIN: {car.VinNo} | {car.Model || '-'})</span>
                              <div className="text-[10px] text-slate-400 mt-0.5">โครงการ: <span className="font-semibold text-slate-600">{car.Project || '-'}</span></div>
                            </div>
                          ))}
                        </div>
                      )}
                      {editDetailFields.replacementVin && (
                        <div className="mt-1.5 text-xxs font-bold text-emerald-600 flex items-center gap-1">
                          <span>✓ เลือกแล้ว:</span> <span className="font-mono">{editDetailFields.replacementVin}</span>
                        </div>
                      )}
                    </div>

                    {/* Location select */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">
                        <span className="text-rose-555">*</span> สถานที่รับ/คืนรถทดแทน
                      </label>
                      <select
                        value={editDetailFields.replacementLocation}
                        onChange={(e) => setEditDetailFields(prev => ({ ...prev, replacementLocation: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
                      >
                        <option value="">เลือกสถานที่รับ/คืนรถทดแทน</option>
                        {locationOptions.map((loc) => (
                          <option key={loc.code} value={loc.code}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 วันที่ขอรถทดแทน</label>
                      <input
                        type="date"
                        value={editDetailFields.replacementStartDate}
                        onChange={(e) => setEditDetailFields(prev => ({ ...prev, replacementStartDate: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Service Location */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">
                📍 สถานที่นำส่งซ่อม {(editDetailFields.carStatusCode === 'WAITING_FOR_MAINTENANCE' || editDetailFields.carStatusCode === 'IN_MAINTENANCE') && <span className="text-rose-500">*</span>}
              </label>
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
                {dbProblemTypes.length > 0 ? (
                  dbProblemTypes.map(opt => (
                    <option key={opt.StatusCode} value={opt.StatusCode}>{opt.StatusName}</option>
                  ))
                ) : (
                  <>
                    <option value="ACCIDENT">อุบัติเหตุ</option>
                    <option value="PRODUCT">ผลิตภัณฑ์</option>
                    <option value="SUPPLIER_REPAIR">งานซ่อมจาก Supplier</option>
                    <option value="OTHER_2">อื่นๆ</option>
                  </>
                )}
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
                {dbInsuranceOptions.map(opt => (
                  <option key={opt.StatusCode} value={opt.StatusCode}>{opt.StatusName}</option>
                ))}
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
                          <>
                            <div className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm transition">
                              ✕
                            </div>
                            <a
                              href={att.FilePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.FileName}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/60 hover:bg-indigo-600 text-white flex items-center justify-center text-xs shadow-md backdrop-blur-xs transition-all duration-200 hover:scale-105 active:scale-95"
                              title="ดาวน์โหลดรูปภาพ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            </a>
                          </>
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
                  <div className="space-y-2">
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
                      <span>{formatLiffTime(log.CreateDate || log.FollowUpDate)}</span>
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

            {/* Follow-up Note Textarea */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1.5">💬 เพิ่มบันทึกการติดตาม / ดำเนินการล่าสุด</label>
              <div className="relative">
                <textarea
                  ref={editFollowUpRef}
                  rows={4}
                  value={editFollowUp}
                  onChange={(e) => handleMentionTextChange(e.target.value, e.target.selectionStart, 'followUp')}
                  onKeyUp={(e: any) => handleMentionTextChange(e.target.value, e.target.selectionStart, 'followUp')}
                  onClick={(e: any) => handleMentionTextChange(e.target.value, e.target.selectionStart, 'followUp')}
                  placeholder="ระบุรายละเอียด เช่น รถเข้าอู่ทำสีแล้ว, ช่างกำลังถอดชิ้นส่วนตรวจสอบ, หรืออะไหล่มาถึงพร้อมซ่อม..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition resize-none"
                />
                
                {/* Mention Suggestion Dropdown */}
                {showMentionDropdown && activeMentionField === 'followUp' && (() => {
                  const filteredUsers = mentionUsers.filter(u => 
                    u.name.toLowerCase().includes(mentionSearch.toLowerCase()) || 
                    u.fullName.toLowerCase().includes(mentionSearch.toLowerCase())
                  )
                  if (filteredUsers.length === 0) return null
                  
                  return (
                    <div className="absolute left-0 bottom-full mb-2 w-full max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-[9999] py-1">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                        👥 แนะนำรายชื่อเพื่อพูดคุย (Mention)
                      </div>
                      {filteredUsers.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleSelectMention(user.name)}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition"
                        >
                          <span className="text-indigo-600 font-bold">@{user.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{user.fullName}</span>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
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
                          <>
                            <div className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm transition">
                              ✕
                            </div>
                            <a
                              href={att.FilePath}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.FileName}
                              onClick={(e) => e.stopPropagation()}
                              className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/60 hover:bg-indigo-600 text-white flex items-center justify-center text-xs shadow-md backdrop-blur-xs transition-all duration-200 hover:scale-105 active:scale-95"
                              title="ดาวน์โหลดรูปภาพ"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            </a>
                          </>
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
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) {
                    setEditAttachments(prev => [...prev, ...Array.from(e.target.files!)])
                  }
                }}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              
              {editAttachments.length > 0 && (
                <div className="mt-3 text-xs text-slate-600 font-bold space-y-2">
                  <span>📸 เลือกรูปภาพเพิ่มเติมแล้ว {editAttachments.length} รูป:</span>
                  <div className="space-y-2">
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
                  <CarInfoCard car={selectedCar} carDetails={selectedCarDetails} locationMap={locationMap} onDeselect={handleDeselectCar} activeContractNo={activeContractNo} />
                ) : (
                  <VehicleSearchWithScanner onSelectCar={handleSelectCar} />
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
                        disabled={pendingTickets.every(t => ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))}
                        onClick={() => {
                          const nextType = bulkActionType === 'park' ? null : 'park'
                          setBulkActionType(nextType)
                          
                          // Pre-select the location of the first selected ticket if available
                          let initialLocation = ''
                          if (nextType === 'park' && pendingTickets.length > 0) {
                            const ticketWithLoc = pendingTickets.find(t => t.ServiceLocationCode)
                            if (ticketWithLoc) {
                              initialLocation = ticketWithLoc.ServiceLocationCode || ''
                            }
                          }
                          setBulkLocation(initialLocation)
                          
                          setSelectedBulkTicketIds(nextType ? pendingTickets.map(t => t.MaintenanceItemID) : [])
                        }}
                        className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                          pendingTickets.every(t => ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))
                            ? 'opacity-40 cursor-not-allowed bg-amber-50 border-slate-200 text-slate-400'
                            : (bulkActionType === 'park'
                                ? 'bg-amber-100 border-amber-300 text-amber-800'
                                : 'bg-amber-50 hover:bg-amber-100 border-amber-250 text-amber-700')
                        }`}
                      >
                        เข้าซ่อม
                      </button>
                      <button
                        type="button"
                        disabled={pendingTickets.every(t => ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))}
                        onClick={() => {
                          const nextType = bulkActionType === 'start' ? null : 'start'
                          setBulkActionType(nextType)
                          
                          // Pre-select the location of the first selected ticket if available
                          let initialLocation = ''
                          if (nextType === 'start' && pendingTickets.length > 0) {
                            const ticketWithLoc = pendingTickets.find(t => t.ServiceLocationCode)
                            if (ticketWithLoc) {
                              initialLocation = ticketWithLoc.ServiceLocationCode || ''
                            }
                          }
                          setBulkLocation(initialLocation)
                          
                          setSelectedBulkTicketIds(nextType ? pendingTickets.map(t => t.MaintenanceItemID) : [])
                          const now = new Date()
                          setBulkStartDate(now.toISOString().slice(0, 16))
                        }}
                        className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                          pendingTickets.every(t => ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))
                            ? 'opacity-40 cursor-not-allowed bg-rose-50 border-slate-200 text-slate-400'
                            : (bulkActionType === 'start'
                                ? 'bg-rose-100 border-rose-300 text-rose-800'
                                : 'bg-rose-50 hover:bg-rose-100 border-rose-250 text-rose-700')
                        }`}
                      >
                        เริ่มซ่อม
                      </button>
                      <button
                        type="button"
                        disabled={pendingTickets.every(t => t.CarStatusCode === 'READY_PICKUP_MAINTENANCE')}
                        onClick={() => {
                          const nextType = bulkActionType === 'complete' ? null : 'complete'
                          setBulkActionType(nextType)
                          setBulkLocation('')
                          setSelectedBulkTicketIds(nextType ? pendingTickets.map(t => t.MaintenanceItemID) : [])
                          const now = new Date()
                          setBulkFinishDate(now.toISOString().slice(0, 16))
                        }}
                        className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                          pendingTickets.every(t => t.CarStatusCode === 'READY_PICKUP_MAINTENANCE')
                            ? 'opacity-40 cursor-not-allowed bg-emerald-50 border-slate-200 text-slate-400'
                            : (bulkActionType === 'complete'
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-250 text-emerald-700')
                        }`}
                      >
                        ซ่อมเสร็จ
                      </button>
                      {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                        <button
                          type="button"
                          disabled={pendingTickets.length === 0 || pendingTickets.some(t => !['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))}
                          onClick={() => {
                            const nextType = bulkActionType === 'close_case' ? null : 'close_case'
                            setBulkActionType(nextType)
                            setBulkLocation('')
                            const closeableIds = pendingTickets
                              .filter(t => ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))
                              .map(t => t.MaintenanceItemID)
                            setSelectedBulkTicketIds(nextType ? closeableIds : [])
                            const now = new Date()
                            setCloseFormSubmitted(false)
                            // Pre-populate วันที่รถซ่อมเสร็จ from existing ticket data if available
                            const firstCloseable = pendingTickets.find(t => ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))
                            setCloseFinishDate(firstCloseable?.MaintenanceFinishDate ? firstCloseable.MaintenanceFinishDate.slice(0, 10) : now.toISOString().slice(0, 10))
                            setCloseReturnDate('')
                            setCloseRootCause('')
                            setCloseFixAction('')
                            setCloseRemark('')
                            setCloseAttachments([])
                            setCloseCurrentLocation('')
                            setCloseReplacementReturnDate('')
                            setCloseReplacementLocation('')
                          }}
                          className={`font-bold px-2 py-1 rounded-xl text-[10px] transition active:scale-95 whitespace-nowrap border ${
                            pendingTickets.length === 0 || pendingTickets.some(t => !['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || ''))
                              ? 'opacity-40 cursor-not-allowed bg-purple-50 border-slate-200 text-slate-400'
                              : (bulkActionType === 'close_case'
                                  ? 'bg-purple-100 border-purple-300 text-purple-800'
                                  : 'bg-purple-50 hover:bg-purple-100 border-purple-250 text-purple-700')
                          }`}
                        >
                          ปิดเคส
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bulk Action Panels */}
                  {bulkActionType === 'park' && (
                    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-3.5 mb-3 animate-fade-in text-slate-700">
                      <div className="flex items-center justify-between border-b border-amber-150 pb-1.5">
                        <span className="text-xs font-bold text-amber-800">🟡 ระบุสถานที่: เข้าซ่อม</span>
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
                          disabled={submittingBulk}
                          onClick={() => handleSaveBulkAction('park')}
                          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-2 rounded-xl text-xxs transition active:scale-98"
                        >
                          {submittingBulk ? '⏳ กำลังบันทึก...' : '💾 บันทึก เข้าซ่อม'}
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
                          disabled={submittingBulk}
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
                  {bulkActionType === 'close_case' && (() => {
                    const activeReplacement = pendingTickets
                      .filter(t => selectedBulkTicketIds.includes(t.MaintenanceItemID))
                      .flatMap(t => t.replacements || [])
                      .find(r => r.IsActive && !r.ReplacementReturnDate)

                    return (
                      <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-4 space-y-3.5 mb-3 animate-fade-in text-slate-700">
                        <div className="flex items-center justify-between border-b border-purple-150 pb-1.5">
                          <span className="text-xs font-bold text-purple-800">🔮 ระบุรายละเอียด: ปิดเคส</span>
                          <button
                            type="button"
                            onClick={() => setBulkActionType(null)}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                          >
                            ปิด x
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              <span className="text-rose-500">*</span> วันที่รถซ่อมเสร็จ
                            </label>
                            <input
                              type="date"
                              value={closeFinishDate}
                              required
                              onChange={(e) => setCloseFinishDate(e.target.value)}
                              className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none font-bold ${
                                closeFormSubmitted && !closeFinishDate
                                  ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-purple-500'
                              }`}
                            />
                            {closeFormSubmitted && !closeFinishDate && (
                              <span className="text-[9px] text-rose-500 font-bold mt-0.5 block">กรุณาระบุวันที่รถซ่อมเสร็จ</span>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              <span className="text-rose-500">*</span> วันที่รับรถกลับ
                            </label>
                            <input
                              type="date"
                              value={closeReturnDate}
                              required
                              onChange={(e) => setCloseReturnDate(e.target.value)}
                              className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none font-bold ${
                                closeFormSubmitted && !closeReturnDate
                                  ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-purple-500'
                              }`}
                            />
                            {closeFormSubmitted && !closeReturnDate && (
                              <span className="text-[9px] text-rose-500 font-bold mt-0.5 block">กรุณาระบุวันที่รับรถกลับ</span>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              <span className="text-rose-500">*</span> สถานะใบแจ้งซ่อม
                            </label>
                            <select
                              disabled
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none font-bold"
                            >
                              <option value="COMPLETE">ปิดเคส</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">
                              <span className="text-rose-500">*</span> สถานที่ปัจจุบัน
                            </label>
                            <select
                              value={closeCurrentLocation}
                              onChange={(e) => setCloseCurrentLocation(e.target.value)}
                              className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none font-bold ${
                                closeFormSubmitted && !closeCurrentLocation
                                  ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500'
                                  : 'border-slate-200 focus:border-purple-500'
                              }`}
                            >
                              <option value="">-- เลือกสถานที่ปัจจุบัน --</option>
                              {locationOptions.map((opt) => (
                                <option key={opt.code} value={opt.code}>
                                  {opt.name}
                                </option>
                              ))}
                            </select>
                            {closeFormSubmitted && !closeCurrentLocation && (
                              <span className="text-[9px] text-rose-500 font-bold mt-0.5 block">กรุณาเลือกสถานที่ปัจจุบัน</span>
                            )}
                          </div>
                        </div>

                        {activeReplacement && (
                          <div className="bg-slate-100/80 border border-slate-200 rounded-2xl p-4 space-y-3 mt-2 animate-fade-in">
                            <h4 className="text-xs font-bold text-slate-700 border-b border-slate-200 pb-1 text-center">
                              รายละเอียดรถทดแทน
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-700">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">รถทดแทน</label>
                                <input
                                  type="text"
                                  disabled
                                  value={activeReplacement.VinNo || ''}
                                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-400 font-bold focus:outline-none cursor-not-allowed"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">วันที่ขอรถทดแทน</label>
                                <input
                                  type="text"
                                  disabled
                                  value={activeReplacement.ReplacementStartDate ? activeReplacement.ReplacementStartDate.slice(0, 10) : ''}
                                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-400 font-bold focus:outline-none cursor-not-allowed"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                  <span className="text-rose-500">*</span> วันที่คืนรถทดแทน
                                </label>
                                <input
                                  type="date"
                                  value={closeReplacementReturnDate}
                                  onChange={(e) => setCloseReplacementReturnDate(e.target.value)}
                                  className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none font-bold ${
                                    closeFormSubmitted && !closeReplacementReturnDate
                                      ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500'
                                      : 'border-slate-200 focus:border-purple-500'
                                  }`}
                                />
                                {closeFormSubmitted && !closeReplacementReturnDate && (
                                  <span className="text-[9px] text-rose-500 font-bold mt-0.5 block">กรุณาระบุวันที่คืนรถทดแทน</span>
                                )}
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                  <span className="text-rose-500">*</span> จุดคืนรถทดแทน
                                </label>
                                <select
                                  value={closeReplacementLocation}
                                  onChange={(e) => setCloseReplacementLocation(e.target.value)}
                                  className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none font-bold ${
                                    closeFormSubmitted && !closeReplacementLocation
                                      ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500'
                                      : 'border-slate-200 focus:border-purple-500'
                                  }`}
                                >
                                  <option value="">-- เลือกจุดคืนรถทดแทน --</option>
                                  {locationOptions.map((opt) => (
                                    <option key={opt.code} value={opt.code}>
                                      {opt.name}
                                    </option>
                                  ))}
                                </select>
                                {closeFormSubmitted && !closeReplacementLocation && (
                                  <span className="text-[9px] text-rose-500 font-bold mt-0.5 block">กรุณาเลือกจุดคืนรถทดแทน</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">สรุปสาเหตุที่พบ (ภาพรวม)</label>
                          <textarea
                            rows={3}
                            value={closeRootCause}
                            onChange={(e) => setCloseRootCause(e.target.value)}
                            placeholder="สรุปสาเหตุภาพรวมจากทุกรายการแจ้งซ่อม"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-purple-500 resize-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">สรุปการแก้ไข (ภาพรวม)</label>
                          <textarea
                            rows={3}
                            value={closeFixAction}
                            onChange={(e) => setCloseFixAction(e.target.value)}
                            placeholder="สรุปการแก้ไข (ภาพรวม)"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-purple-500 resize-none"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">แนบรูปภาพ/ไฟล์ <span className="text-rose-500">*</span></label>
                          <div className={`border-2 border-dashed rounded-2xl p-4 text-center hover:bg-slate-50 transition ${
                            closeFormSubmitted && closeAttachments.length === 0
                              ? 'border-rose-500 bg-rose-50/10'
                              : 'border-slate-200'
                          }`}>
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <span className="text-2xl text-blue-500">☁️</span>
                              <p className="text-xs font-bold text-slate-700">แนบหลักฐานการรับรถ / ปิดงาน</p>
                              <div className="flex gap-2 w-full max-w-xs mt-1">
                                <div className="relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer transition active:scale-[0.98] text-xs font-bold text-slate-700 shadow-sm overflow-hidden">
                                  <span>📸 ถ่ายรูปสด</span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    capture="environment"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                      console.log('📸 [Camera Input] files selected:', e.target.files)
                                      if (e.target.files) {
                                        const fileArray = Array.from(e.target.files)
                                        console.log('📸 [Camera Input] fileArray:', fileArray)
                                        setCloseAttachments(prev => {
                                          const next = [...prev, ...fileArray]
                                          console.log('📸 [Camera Input] next state:', next)
                                          return next
                                        })
                                      }
                                      e.target.value = ''
                                    }}
                                  />
                                </div>
                                <div className="relative flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer transition active:scale-[0.98] text-xs font-bold text-slate-700 shadow-sm overflow-hidden">
                                  <span>🖼️ คลังภาพ</span>
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => {
                                      console.log('🖼️ [Gallery Input] files selected:', e.target.files)
                                      if (e.target.files) {
                                        const fileArray = Array.from(e.target.files)
                                        console.log('🖼️ [Gallery Input] fileArray:', fileArray)
                                        setCloseAttachments(prev => {
                                          const next = [...prev, ...fileArray]
                                          console.log('🖼️ [Gallery Input] next state:', next)
                                          return next
                                        })
                                      }
                                      e.target.value = ''
                                    }}
                                  />
                                </div>
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1">รองรับการถ่ายรูปสดและการเลือกไฟล์/รูปภาพจากอัลบั้มได้หลายไฟล์</p>
                            </div>
                          </div>
                          {closeFormSubmitted && closeAttachments.length === 0 && (
                            <span className="text-[9px] text-rose-500 font-bold mt-1.5 block text-left">กรุณาแนบหลักฐานการรับรถ หรือหลักฐานการปิดงาน อย่างน้อย 1 ภาพ</span>
                          )}
                          {closeAttachments.length > 0 && (
                            <div className="mt-3 text-xs text-slate-600 font-bold space-y-2">
                              <span>📸 เลือกไฟล์/รูปภาพแล้ว {closeAttachments.length} รายการ:</span>
                              <div className="space-y-2">
                                {closeAttachments.map((f, i) => (
                                  <ImagePreview
                                    key={i}
                                    file={f}
                                    onRemove={() => {
                                      setCloseAttachments(prev => prev.filter((_, idx) => idx !== i))
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Remark</label>
                          <textarea
                            rows={2}
                            value={closeRemark}
                            onChange={(e) => setCloseRemark(e.target.value)}
                            placeholder="ระบุหมายเหตุเพิ่มเติม (ถ้ามี)"
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-855 focus:outline-none focus:border-purple-500 resize-none"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setBulkActionType(null)}
                            className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-655 font-semibold px-4 py-2.5 rounded-xl text-xs transition active:scale-95 flex items-center gap-1.5"
                          >
                            ✕ ยกเลิก
                          </button>
                          <button
                            type="button"
                            disabled={submittingBulk}
                            onClick={() => handleSaveBulkAction('close_case')}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition active:scale-98 flex items-center gap-1.5"
                          >
                            {submittingBulk ? '⏳ กำลังบันทึก...' : '💾 บันทึกและปิดงาน'}
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                  <div className="space-y-2">
                    {/* Select All / Deselect All when bulk action is active */}
                    {bulkActionType && bulkActionType !== 'park' && pendingTickets.length > 1 && (
                      <div className="flex items-center justify-between px-1 py-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          เลือก {selectedBulkTicketIds.length}/{pendingTickets.length} รายการ
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const selectableIds = pendingTickets
                              .filter(t => {
                                const isUnsel = bulkActionType === 'close_case'
                                  ? !['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || '')
                                  : ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(t.CarStatusCode || '')
                                return !isUnsel
                              })
                              .map(t => t.MaintenanceItemID)
                            
                            const allSelectableSelected = selectableIds.length > 0 && selectableIds.every(id => selectedBulkTicketIds.includes(id))
                            if (allSelectableSelected) {
                              setSelectedBulkTicketIds(prev => prev.filter(id => !selectableIds.includes(id)))
                            } else {
                              setSelectedBulkTicketIds(prev => {
                                const next = [...prev]
                                for (const id of selectableIds) {
                                  if (!next.includes(id)) next.push(id)
                                }
                                return next
                              })
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
                      const isUnselectable = bulkActionType === 'close_case'
                        ? !['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(ticket.CarStatusCode || '')
                        : ['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(ticket.CarStatusCode || '')
                      return (
                      <div
                        key={ticket.MaintenanceItemID}
                        className={`bg-slate-50 border rounded-2xl p-3.5 flex flex-col gap-2.5 transition ${
                          bulkActionType
                            ? isUnselectable
                              ? 'border-slate-150 bg-slate-100/40 opacity-40'
                              : isSelected
                              ? 'border-indigo-400 bg-indigo-50/40 shadow-sm'
                              : 'border-slate-200 opacity-60'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => {
                          if (bulkActionType) {
                            if (isUnselectable) return
                            if (bulkActionType === 'park') return // park affects all tickets, no toggling
                            setSelectedBulkTicketIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== ticket.MaintenanceItemID)
                                : [...prev, ticket.MaintenanceItemID]
                            )
                          }
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          {/* Checkbox when bulk action is active (except for park/เข้าซ่อม) */}
                          {bulkActionType && bulkActionType !== 'park' && (
                            <div className="shrink-0 flex items-center justify-center pt-0.5">
                              {isUnselectable ? (
                                <div className="w-5 h-5 rounded-md border border-slate-200 bg-slate-150 flex items-center justify-center text-slate-400 text-[10px] font-bold">
                                  🔒
                                </div>
                              ) : (
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
                              )}
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
                              บันทึกเมื่อ: {ticket.CreateDate ? formatLiffTime(ticket.CreateDate) : formatLiffDate(ticket.ReportDate)}
                              {ticket.CreateUserName && ticket.CreateUserName.trim() && (
                                <span className="text-slate-400"> | โดย: <span className="font-semibold text-slate-600">{ticket.CreateUserName.trim()}</span></span>
                              )}
                            </p>
                            {ticket.MaintenanceFinishDate && (
                              <p className="text-[10px] text-emerald-650 mt-0.5 font-medium flex items-center gap-1">
                                <span>🟢 ซ่อมเสร็จเมื่อ:</span>
                                <span>{formatLiffTime(ticket.MaintenanceFinishDate)}</span>
                                {ticket.UpdateUserName && ticket.UpdateUserName.trim() && (
                                  <span className="text-slate-400"> | โดย: <span className="font-semibold text-emerald-700">{ticket.UpdateUserName.trim()}</span></span>
                                )}
                              </p>
                            )}
                            {ticket.IncidentDate && (
                              <p className="text-[9px] text-slate-400 mt-0.5">📅 เกิดเหตุ: {formatLiffDate(ticket.IncidentDate)}</p>
                            )}
                            {ticket.ServiceLocationCode && (
                              <p className="text-[9px] text-slate-400 mt-0.5">📍 {locationMap.get(ticket.ServiceLocationCode) || ticket.ServiceLocation || '-'}</p>
                            )}
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
                            {!['GARAGE_COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(ticket.CarStatusCode || '') && (
                            <button
                              type="button"
                              onClick={() => handleStartDetailEdit(ticket)}
                              className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold px-3 py-1 rounded-xl text-[10px] flex items-center gap-1 transition active:scale-95"
                            >
                              <span>✏️ แก้ไข</span>
                            </button>
                            )}
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

              {selectedCar && (pendingTickets.length === 0 || showAddIncidentForm) && (
                <>
                  {/* Card 2: Contractor, Driver, Incident Date & Status */}
                  <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">

                    {/* Contractor Name (read-only) */}
                    {contractorName && (
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">📋 ชื่อ-นามสกุล ผู้ทำสัญญา</label>
                        <div className="bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 font-semibold">
                          {contractorName}
                        </div>
                      </div>
                    )}

                    {/* Driver Name (editable) */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">👤 ชื่อ-นามสกุล คนขับ</label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder="ระบุชื่อคนขับ..."
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none placeholder-slate-400 transition"
                      />
                    </div>

                    {/* Incident Date */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 วันที่เกิดเหตุ <span className="text-rose-555">*</span></label>
                      <input
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition"
                      />
                    </div>

                    {/* Status Selection */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1.5">
                        <span className="text-rose-555">*</span> สถานะใบแจ้งซ่อม
                      </label>
                      <select
                        value={initialCarStatus}
                        onChange={(e) => setInitialCarStatus(e.target.value)}
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
                      >
                        <option value="" disabled>เลือกสถานะใบแจ้งซ่อม</option>
                        {(dbCarStatuses.length > 0 ? dbCarStatuses : [
                          { StatusCode: 'WAITING_FOR_MAINTENANCE', StatusName: 'รถจอดรอซ่อม' },
                          { StatusCode: 'STILL_WORK', StatusName: 'รถยังขับใช้งานได้อยู่' },
                          { StatusCode: 'IN_MAINTENANCE', StatusName: 'รถอยู่ระหว่างซ่อม' }
                        ])
                          .filter((st) => st.StatusCode === 'WAITING_FOR_MAINTENANCE' || st.StatusCode === 'STILL_WORK' || st.StatusCode === 'IN_MAINTENANCE')
                          .map((st) => (
                            <option key={st.StatusCode} value={st.StatusCode}>
                              {st.StatusCode === 'WAITING_FOR_MAINTENANCE' ? '🟡' : st.StatusCode === 'IN_MAINTENANCE' ? '🟠' : '🔵'} {st.StatusName}
                            </option>
                          ))
                        }
                      </select>
                    </div>

                    {/* Replacement Car Assignment */}
                    {(initialCarStatus === 'WAITING_FOR_MAINTENANCE' || initialCarStatus === 'IN_MAINTENANCE') && (
                      <div className="col-span-2 space-y-4 pt-2 border-t border-slate-100 animate-fade-in-up">
                        <div className="flex items-center gap-2.5 bg-slate-50/50 p-3 rounded-2xl border border-slate-150">
                          <input
                            type="checkbox"
                            id="hasReplacement"
                            checked={hasReplacement}
                            onChange={(e) => {
                              setHasReplacement(e.target.checked)
                              if (e.target.checked) {
                                loadReplacementCars('')
                              } else {
                                setReplacementVin('')
                                setReplCarSearch('')
                              }
                            }}
                            className="w-4.5 h-4.5 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500"
                          />
                          <label htmlFor="hasReplacement" className="text-xs font-bold text-slate-700 cursor-pointer">
                            ต้องการรถทดแทนหรือไม่
                          </label>
                        </div>

                        {hasReplacement && (
                          <div className="bg-indigo-50/20 p-4 rounded-3xl border border-indigo-100/50 space-y-4 animate-scale-up">
                            {/* Searchable Replacement Car */}
                            <div className="relative">
                              <label className="text-xs font-bold text-slate-600 block mb-1.5">
                                <span className="text-rose-555">*</span> ข้อมูลรถทดแทน
                              </label>
                              <input
                                type="text"
                                placeholder="🔎 ค้นหาทะเบียน หรือ VIN รถทดแทน..."
                                value={replCarSearch}
                                onChange={(e) => {
                                  setReplCarSearch(e.target.value)
                                  loadReplacementCarsDebounced(e.target.value)
                                }}
                                onFocus={() => loadReplacementCars(replCarSearch)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition font-semibold"
                              />
                              {/* Results dropdown list */}
                              {replacementCars.length > 0 && (
                                <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-48 overflow-y-auto z-50">
                                  {replacementCars.map((car) => (
                                    <div
                                      key={car.InventoryItemID}
                                      onClick={() => {
                                        setReplacementVin(car.VinNo)
                                        setReplCarSearch(`${car.RegisterNo || '-'} (${car.Model || '-'}) [Project: ${car.Project || '-'}]`)
                                        setReplacementCars([]) // Hide dropdown
                                      }}
                                      className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs text-slate-800"
                                    >
                                      <span className="font-bold text-indigo-650">{car.RegisterNo || '-'}</span> 
                                      <span className="text-slate-500"> (VIN: {car.VinNo} | {car.Model || '-'})</span>
                                      <div className="text-[10px] text-slate-400 mt-0.5">โครงการ: <span className="font-semibold text-slate-600">{car.Project || '-'}</span></div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {replacementVin && (
                                <div className="mt-1.5 text-xxs font-bold text-emerald-600 flex items-center gap-1">
                                  <span>✓ เลือกแล้ว:</span> <span className="font-mono">{replacementVin}</span>
                                </div>
                              )}
                            </div>

                            {/* Location select */}
                            <div>
                              <label className="text-xs font-bold text-slate-600 block mb-1.5">
                                <span className="text-rose-555">*</span> สถานที่รับ/คืนรถทดแทน
                              </label>
                              <select
                                value={replacementLocation}
                                onChange={(e) => setReplacementLocation(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-3.5 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition font-bold"
                              >
                                <option value="">เลือกสถานที่รับ/คืนรถทดแทน</option>
                                {locationOptions.map((loc) => (
                                  <option key={loc.code} value={loc.code}>
                                    {loc.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Start Date */}
                            <div>
                              <label className="text-xs font-bold text-slate-600 block mb-1.5">📅 วันที่ขอรถทดแทน</label>
                              <input
                                type="date"
                                value={replacementStartDate}
                                onChange={(e) => setReplacementStartDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm text-slate-855 focus:outline-none transition font-semibold"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                    📍 3. เลือกสถานที่ / พิกัดปัจจุบัน (ศูนย์บริการ/อู่/สาขา) {(initialCarStatus === 'WAITING_FOR_MAINTENANCE' || initialCarStatus === 'IN_MAINTENANCE') && <span className="text-rose-500">*</span>}
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
                      {dbProblemTypes.length > 0 ? (
                        dbProblemTypes.map(opt => (
                          <option key={opt.StatusCode} value={opt.StatusCode}>{opt.StatusName}</option>
                        ))
                      ) : (
                        <>
                          <option value="ACCIDENT">อุบัติเหตุ</option>
                          <option value="PRODUCT">ผลิตภัณฑ์</option>
                          <option value="SUPPLIER_REPAIR">งานซ่อมจาก Supplier</option>
                          <option value="OTHER_2">อื่นๆ</option>
                        </>
                      )}
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
                      {dbInsuranceOptions.map(opt => (
                        <option key={opt.StatusCode} value={opt.StatusCode}>{opt.StatusName}</option>
                      ))}
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
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition active:scale-98 text-xs font-bold text-slate-705 overflow-hidden">
                      <span>📸 ถ่ายภาพเลย</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleFileUpload(e, 'image')}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                    </div>

                    <div className="relative flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition active:scale-98 text-xs font-bold text-slate-705 overflow-hidden">
                      <span>🖼️ อัลบั้มรูป</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'image')}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition active:scale-98 text-xs font-bold text-slate-705 w-full block text-center overflow-hidden">
                    <span>📄 แนบไฟล์เอกสาร</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => handleFileUpload(e, 'document')}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                  </div>
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
                <CarInfoCard car={selectedCar} carDetails={selectedCarDetails} locationMap={locationMap} onDeselect={handleDeselectCar} activeContractNo={activeContractNo} />
              ) : (
                <VehicleSearchWithScanner onSelectCar={handleSelectCar} />
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
                          <p className="text-xxs text-slate-400 mt-1">
                            บันทึกเมื่อ: {ticket.CreateDate ? formatLiffTime(ticket.CreateDate) : formatLiffDate(ticket.ReportDate)}
                            {ticket.CreateUserName && ticket.CreateUserName.trim() && (
                              <span> | โดย: <span className="font-semibold text-slate-500">{ticket.CreateUserName.trim()}</span></span>
                            )}
                          </p>
                          {ticket.MaintenanceFinishDate && (
                            <p className="text-xxs text-emerald-650 mt-1 font-medium flex items-center gap-1">
                              <span>🟢 ซ่อมเสร็จเมื่อ:</span>
                              <span>{formatLiffTime(ticket.MaintenanceFinishDate)}</span>
                              {ticket.UpdateUserName && ticket.UpdateUserName.trim() && (
                                <span className="text-slate-400"> | โดย: <span className="font-semibold text-emerald-700">{ticket.UpdateUserName.trim()}</span></span>
                              )}
                            </p>
                          )}
                          {ticket.IncidentDate && (
                            <p className="text-[9px] text-slate-400 mt-0.5">📅 เกิดเหตุ: {formatLiffDate(ticket.IncidentDate)}</p>
                          )}
                          {ticket.ServiceLocationCode && (
                            <p className="text-[9px] text-slate-400 mt-0.5">📍 {locationMap.get(ticket.ServiceLocationCode) || ticket.ServiceLocation || '-'}</p>
                          )}
                        </div>
                        <span className={`px-2.5 py-1 text-xxs font-bold rounded-full border shrink-0 ${
                          (isMaintComplete(ticket) || ticket.CarStatusDescription === 'ซ่อมเสร็จ' || ticket.CarStatusDescription === 'ซ่อมเสร็จสิ้น')
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : (ticket.CarStatusDescription === 'อยู่ระหว่างการซ่อม' || ticket.CarStatusDescription === 'รถอยู่ระหว่างซ่อม')
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
                            {!isMaintComplete(ticket) && (
                            <button
                              type="button"
                              onClick={() => handleStartEditTicket(ticket)}
                              className="text-[10px] font-bold text-indigo-655 hover:text-indigo-855 flex items-center gap-0.5"
                            >
                              <span>➕ ปรับสถานะ / เปิดหน้าเต็ม</span>
                            </button>
                            )}
                          </div>
                        </div>
                        
                        {ticket.followUps && ticket.followUps.length > 0 ? (
                          <div className="space-y-3 pl-2.5 border-l-2 border-slate-150 ml-1 py-1 max-h-44 overflow-y-auto pr-1">
                            {ticket.followUps.map((log) => (
                              <div key={log.MaintenanceFollowUpID} className="relative text-xxs">
                                <span className="absolute -left-[14.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 border border-white" />
                                <div className="flex justify-between text-slate-400">
                                  <span>{formatLiffTime(log.CreateDate || log.FollowUpDate)}</span>
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

                        {/* Inline Quick Add Follow-up Form - hide for completed */}
                        {!isMaintComplete(ticket) && (
                        <div className="mt-3 border-t border-slate-100 pt-3.5 flex gap-2 relative">
                          <input
                            ref={el => { quickLogRefs.current[ticket.MaintenanceItemID] = el }}
                            type="text"
                            value={quickLogs[ticket.MaintenanceItemID] || ''}
                            onChange={(e) => handleMentionTextChange(e.target.value, e.target.selectionStart, 'quickLog', ticket.MaintenanceItemID)}
                            onKeyUp={(e: any) => handleMentionTextChange(e.target.value, e.target.selectionStart, 'quickLog', ticket.MaintenanceItemID)}
                            onClick={(e: any) => handleMentionTextChange(e.target.value, e.target.selectionStart, 'quickLog', ticket.MaintenanceItemID)}
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

                          {/* Mention Suggestion Dropdown for Quick Log */}
                          {showMentionDropdown && activeMentionField === 'quickLog' && activeQuickLogId === ticket.MaintenanceItemID && (() => {
                            const filteredUsers = mentionUsers.filter(u => 
                              u.name.toLowerCase().includes(mentionSearch.toLowerCase()) || 
                              u.fullName.toLowerCase().includes(mentionSearch.toLowerCase())
                            )
                            if (filteredUsers.length === 0) return null
                            
                            return (
                              <div className="absolute left-0 bottom-full mb-2 w-full max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] py-1">
                                <div className="px-3 py-1 text-[9px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                                  👥 แนะนำรายชื่อเพื่อพูดคุย (Mention)
                                </div>
                                {filteredUsers.map(user => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => handleSelectMention(user.name)}
                                    className="w-full text-left px-3 py-2 text-xxs font-semibold text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center transition"
                                  >
                                    <span className="text-indigo-600 font-bold">@{user.name}</span>
                                    <span className="text-[9px] text-slate-450 font-normal">{user.fullName}</span>
                                  </button>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                        )}
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

        {/* TAB 2.5: CHATLOG / VEHICLE NOTES */}
        {activeTab === 'chat' && (
          <div className="space-y-4 animate-fade-in-up">
            
            {/* Search Box inside Tab */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
              <h3 className="text-xs font-bold text-slate-600 block mb-2">💬 ค้นหารถและบันทึกข้อมูลทั่วไป</h3>
              <p className="text-xxs text-slate-555 mb-3">
                เลือกและพิมพ์ประวัติการพบเห็น ข้อสังเกต หรือรูปภาพของรถที่ไม่ได้เข้าใบซ่อมบำรุง
              </p>

              {selectedCar ? (
                <CarInfoCard car={selectedCar} carDetails={selectedCarDetails} locationMap={locationMap} onDeselect={handleDeselectCar} activeContractNo={activeContractNo} />
              ) : (
                <VehicleSearchWithScanner onSelectCar={handleSelectCar} />
              )}
            </div>

            {selectedCar && (
              <VehicleNotesSection
                inventoryItemId={selectedCar.InventoryItemID}
                registerNo={selectedCar.RegisterNo}
                lineUserId={getLineUserId()}
              />
            )}
          </div>
        )}

        {/* TAB 3: UPDATE LOCATION */}
        {activeTab === 'contact' && (
          <div className="space-y-4 animate-fade-in-up">
            
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-center">
              <span className="text-3xl">📍</span>
              <h3 className="text-xs font-bold text-slate-600 mt-2">อัปเดตสถานที่ปัจจุบัน</h3>
              <p className="text-xxs text-slate-500 mt-1">
                เปลี่ยนตำแหน่งหรือสถานที่ปัจจุบันของรถยนต์คันที่กำลังดำเนินการอยู่
              </p>
            </div>

            {/* Car Search Block (REAL DB SEARCH) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
              <label className="text-xs font-bold text-slate-600 block mb-2">🚗 ค้นหารถยนต์เพื่ออัปเดตสถานที่ <span className="text-rose-550">*</span></label>
              
              {selectedCar ? (
                <CarInfoCard car={selectedCar} carDetails={selectedCarDetails} locationMap={locationMap} onDeselect={handleDeselectCar} activeContractNo={activeContractNo} />
              ) : (
                <VehicleSearchWithScanner onSelectCar={handleSelectCar} />
              )}
            </div>

            {selectedCar && (
              <form onSubmit={handleUpdateLocation} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 animate-fade-in-up">
                {/* Select Update Mode */}
                {pendingTickets.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 block">🎯 รูปแบบการอัปเดตสถานที่</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => {
                          if (pendingTickets.length > 0) {
                            setSelectedMaintId(pendingTickets[0].MaintenanceItemID)
                          }
                        }}
                        className={`py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                          selectedMaintId !== 0
                            ? 'bg-white text-indigo-650 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>📝 อัปเดตในใบงานซ่อม</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMaintId(0)
                        }}
                        className={`py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
                          selectedMaintId === 0
                            ? 'bg-white text-indigo-650 shadow-sm border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>🚗 อัปเดตตัวรถโดยตรง</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Select Maintenance Ticket */}
                {pendingTickets.length > 0 && selectedMaintId !== 0 && (
                  <div className="animate-fade-in">
                    <label className="text-xs font-bold text-slate-600 block mb-1.5">📝 เลือกงานซ่อมที่ต้องการเปลี่ยนสถานที่</label>
                    <select
                      value={selectedMaintId}
                      onChange={(e) => {
                        setSelectedMaintId(Number(e.target.value))
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

                {/* Direct Update Note */}
                {pendingTickets.length > 0 && selectedMaintId === 0 && (
                  <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-3 text-xxs text-amber-800 flex items-start gap-2 animate-fade-in">
                    <span className="text-sm leading-none">💡</span>
                    <span>
                      <strong>อัปเดตสถานที่ตัวรถโดยตรง:</strong> การอัปเดตนี้จะมีผลกับสถานที่ปัจจุบันของตัวรถเท่านั้น โดยจะไม่เชื่อมโยงหรือเปลี่ยนแปลงสถานที่ใดๆ ในใบงานซ่อม
                    </span>
                  </div>
                )}

                {/* Repossession UI */}
                {selectedCar && (
                  <div className="space-y-3 animate-fade-in-up">
                    <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-2xl">
                      <input
                        type="checkbox"
                        id="isRepossessed"
                        checked={isRepossessed}
                        onChange={(e) => {
                          setIsRepossessed(e.target.checked)
                          if (!e.target.checked) {
                            setRepossessLocation('')
                            setRepossessRemark('')
                          }
                        }}
                        className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-slate-300 rounded cursor-pointer"
                      />
                      <label htmlFor="isRepossessed" className="text-xs font-bold text-rose-900 select-none cursor-pointer">
                        🚨 เป็นรถยึด (บันทึกข้อมูลยึดคืนรถ)
                      </label>
                    </div>

                    {isRepossessed && (
                      <div className="space-y-3.5 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl animate-fade-in">
                        <div>
                          <label className="text-xxs font-bold text-slate-500 block mb-1">📅 วันที่ยึด <span className="text-rose-500">*</span></label>
                          <input
                            type="date"
                            value={repossessDate}
                            onChange={(e) => setRepossessDate(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xxs font-bold text-slate-500 block mb-1">📍 สถานที่ยึด (Freetext) <span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            value={repossessLocation}
                            onChange={(e) => setRepossessLocation(e.target.value)}
                            placeholder="ระบุสถานที่ยึด เช่น หน้าห้างสรรพสินค้า..."
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-xxs font-bold text-slate-500 block mb-1">📝 หมายเหตุเพิ่มเติม</label>
                          <input
                            type="text"
                            value={repossessRemark}
                            onChange={(e) => setRepossessRemark(e.target.value)}
                            placeholder="หมายเหตุ (ถ้ามี)..."
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Searchable Location Selection */}
                <div className="relative">
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">📍 สถานที่ล่าสุด</label>
                  {selectedCar.Status === 'ON_RENT' && !isRepossessed ? (
                    <div className="flex items-center bg-slate-100 border border-slate-200 rounded-2xl px-3.5 py-3.5">
                      <span className="text-slate-400 mr-2">🔒</span>
                      <span className="text-sm font-bold text-slate-500">Onrent</span>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updatingLocation || (selectedCar.Status === 'ON_RENT' && !isRepossessed)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition duration-150 active:scale-[0.98] flex items-center justify-center text-xs"
                  >
                    {selectedCar.Status === 'ON_RENT' && !isRepossessed ? (
                      '🔒 รถอยู่ระหว่างเช่า (ไม่สามารถแก้ไขได้)'
                    ) : updatingLocation ? (
                      '⏳ กำลังอัปเดตสถานที่...'
                    ) : isRepossessed ? (
                      '💾 บันทึกรายการยึดรถ'
                    ) : (
                      '💾 บันทึกเปลี่ยนสถานที่'
                    )}
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
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm text-center space-y-3">
              <div>
                <span className="text-3xl">📊</span>
                <h3 className="text-xs font-bold text-slate-600 mt-2">ภาพรวมระบบซ่อมบำรุง</h3>
                <p className="text-xxs text-slate-500 mt-1">
                  สถิติคลังรถยนต์แจ้งซ่อม คิวยอดสะสม และไทม์ไลน์บันทึกล่าสุด
                </p>
              </div>
              <div className="pt-1">
                <a
                  href="/maintenance/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-2xl text-[10px] transition border border-indigo-200 shadow-sm"
                >
                  🖥️ ไปที่แดชบอร์ดหลัก (Dashboard)
                </a>
              </div>
            </div>

            {/* Car Search Block (REAL DB SEARCH) inside Tab 4 */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
              <label className="text-xs font-bold text-slate-600 block mb-2">🚗 ค้นหารถยนต์เพื่อดูสถิติ/รายละเอียด <span className="text-rose-550">*</span></label>
              
              {selectedCar ? (
                <CarInfoCard car={selectedCar} carDetails={selectedCarDetails} locationMap={locationMap} onDeselect={handleDeselectCar} activeContractNo={activeContractNo} compact />
              ) : (
                <VehicleSearchWithScanner
                  onSelectCar={(car) => {
                    handleSelectCar(car)
                    setActiveTab('history') // Transition directly to Tab 2
                  }}
                />
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
                  {/* KPI grid (2x2 Layout) */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* 1. รอเข้าซ่อม */}
                    <div className="bg-amber-50/60 border border-amber-200/60 rounded-3xl p-4 text-center shadow-sm">
                      <span className="text-2xl block">🟡</span>
                      <span className="text-[11px] font-extrabold text-amber-850 block mt-1">รอเข้าซ่อม</span>
                      <span className="text-xl font-black text-amber-900 block mt-0.5">
                        {mobileDashboardData.stats?.waiting || 0} <span className="text-xs font-normal text-amber-700">คัน</span>
                      </span>
                    </div>

                    {/* 2. กำลังซ่อม */}
                    <div className="bg-rose-50/60 border border-rose-200/60 rounded-3xl p-4 text-center shadow-sm">
                      <span className="text-2xl block">🔴</span>
                      <span className="text-[11px] font-extrabold text-rose-850 block mt-1">กำลังซ่อม</span>
                      <span className="text-xl font-black text-rose-900 block mt-0.5">
                        {(mobileDashboardData.stats?.in_maintenance || 0) + 
                         (mobileDashboardData.stats?.on_rent_maintenance || 0) + 
                         (mobileDashboardData.stats?.replacement_maintenance || 0)} <span className="text-xs font-normal text-rose-700">คัน</span>
                      </span>
                      <span className="text-[9px] text-rose-500 block mt-0.5 font-semibold">
                        ใช้แล้ว {mobileDashboardData.stats?.in_maintenance || 0} · เช่า {mobileDashboardData.stats?.on_rent_maintenance || 0}
                      </span>
                    </div>

                    {/* 3. ซ่อมเสร็จ รอปล่อย */}
                    <div className="bg-orange-50/60 border border-orange-200/60 rounded-3xl p-4 text-center shadow-sm">
                      <span className="text-2xl block">🟠</span>
                      <span className="text-[11px] font-extrabold text-orange-850 block mt-1">รถซ่อมเสร็จ รอลูกค้ามารับ</span>
                      <span className="text-xl font-black text-orange-900 block mt-0.5">
                        {mobileDashboardData.stats?.ready_pickup || 0} <span className="text-xs font-normal text-orange-700">คัน</span>
                      </span>
                    </div>

                    {/* 4. ซ่อมเสร็จสิ้นสะสม */}
                    <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-3xl p-4 text-center shadow-sm">
                      <span className="text-2xl block">🟢</span>
                      <span className="text-[11px] font-extrabold text-emerald-850 block mt-1">ซ่อมเสร็จสิ้นสะสม</span>
                      <span className="text-xl font-black text-emerald-900 block mt-0.5">
                        {mobileDashboardData.stats?.complete || 0} <span className="text-xs font-normal text-emerald-700">เคส</span>
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
                          onClick={() => {
                            const carObj = {
                              InventoryItemID: 0,
                              RegisterNo: item.RegisterNo,
                              VinNo: item.VinNo || '',
                              Model: item.Model || '',
                              Project: item.Project || ''
                            }
                            handleSelectCar(carObj)
                            setActiveTab('report')
                          }}
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
                              อู่: {locationMap.get(item.ServiceLocationCode) || item.ServiceLocationCode || 'ไม่ระบุ'}
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
                            <span>{formatLiffTime(log.CreateDate || log.FollowUpDate)}</span>
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

        {/* TAB 5: USER MANUAL (GUIDE) */}
        {activeTab === 'guide' && <GuideTab />}

        {/* TAB 6: VEHICLE RETURN CHECKLIST */}
        {activeTab === 'inspection' && (
          <InspectionTab
            getLineUserId={getLineUserId}
            sharedSelectedCar={selectedCar}
            carDetails={selectedCarDetails}
            locationMap={locationMap}
            activeContractNo={activeContractNo}
            setActiveContractNo={setActiveContractNo}
            onDeselect={handleDeselectCar}
            onSelectCar={handleSelectCar}
            currentUserFullName={currentUserFullName}
          />
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
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'chat' ? 'text-indigo-650' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg">💬</span>
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">แชตรถ</span>
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
          onClick={() => setActiveTab('inspection')}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'inspection' ? 'text-indigo-650' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg">🔄</span>
          <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap">รถคืน</span>
        </button>

        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className={`flex flex-col items-center justify-center w-full h-full transition ${
            activeTab === 'dashboard' || activeTab === 'guide' || showMoreMenu
              ? 'text-indigo-650'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <span className="text-lg font-bold tracking-widest leading-none">•••</span>
          <span className="text-[10px] font-bold mt-1.5 whitespace-nowrap">เมนูเพิ่ม</span>
        </button>

        {showMoreMenu && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]" 
              onClick={() => setShowMoreMenu(false)}
            />
            <div className="fixed bottom-20 right-4 z-50 bg-white border border-slate-150 rounded-2xl shadow-xl p-1.5 min-w-[150px] animate-scale-up flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-2.5 w-full px-4 py-3 text-xs font-bold rounded-xl transition ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-650'
                    : 'text-slate-650 hover:bg-slate-50 active:scale-98'
                }`}
              >
                <span className="text-base">📊</span>
                <span>ภาพรวม</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('guide');
                  setShowMoreMenu(false);
                }}
                className={`flex items-center gap-2.5 w-full px-4 py-3 text-xs font-bold rounded-xl transition ${
                  activeTab === 'guide'
                    ? 'bg-indigo-50 text-indigo-650'
                    : 'text-slate-650 hover:bg-slate-50 active:scale-98'
                }`}
              >
                <span className="text-base">📖</span>
                <span>คู่มือ</span>
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Custom Alert Modal */}
      {alertConfig?.show && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-100 animate-scale-up space-y-4 text-center">
            <div className="flex justify-center">
              {alertConfig.type === 'success' && (
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-3xl border border-emerald-100 text-emerald-600">✅</div>
              )}
              {alertConfig.type === 'error' && (
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-3xl border border-rose-100 text-rose-600">❌</div>
              )}
              {alertConfig.type === 'warning' && (
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-3xl border border-amber-100 text-amber-600">⚠️</div>
              )}
              {alertConfig.type === 'info' && (
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-3xl border border-indigo-100 text-indigo-650">ℹ️</div>
              )}
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-800">
                {alertConfig.title}
              </h4>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed whitespace-pre-line">
                {alertConfig.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlertConfig(prev => prev ? { ...prev, show: false } : null)}
              className="w-full bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white font-bold py-3 px-6 rounded-2xl transition text-xs shadow-sm"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

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
