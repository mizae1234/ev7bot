'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { getStatusThaiLabel } from '@/lib/audit-status'
import StatusHierarchyChart from '@/components/audit/StatusHierarchyChart'
import Script from 'next/script'
import * as XLSX from 'xlsx'

interface AuditSession {
  AuditSessionID: number
  AuditDate: string
  Location: string
  LocationName?: string
  Status: 'DRAFT' | 'COMPLETED' | 'CANCELED'
  CreatedBy: string
  CreateDate: string
  Notes: string
}

interface ScannedItem {
  AuditItemID: number
  VinNo: string
  ScanTime: string
  ScanMethod: 'OCR' | 'BARCODE' | 'MANUAL'
  DetectedStatus: 'MATCHED' | 'MISMATCH' | 'NOT_IN_SYSTEM'
  PreviousLocation?: string
  PreviousLocationName?: string
  IsConfirmed: boolean
  CreatedBy: string
  Notes?: string
  RegisterNo?: string
  Model?: string
  Exterior_Color?: string
  VehicleStatus?: string
  VehicleStatusType?: string
  StatusTypeName?: string
}

interface VehiclePreview {
  VinNo: string
  RegisterNo: string
  Model: string
  Exterior_Color: string
  Status: string
  StatusType?: string
  CurrentLocation: string
  StockLocation: string
  CurrentLocationName?: string
  StockLocationName?: string
}

function playBeep(type: 'success' | 'warning' | 'error' = 'success') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const audioCtx = new AudioContextClass()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    
    oscillator.type = 'sine'
    if (type === 'success') {
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.12)
    } else if (type === 'warning') {
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime) // A4
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime)
      oscillator.start()
      oscillator.stop(audioCtx.currentTime + 0.2)
      
      // Double beep for warning
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator()
        const gain2 = audioCtx.createGain()
        osc2.connect(gain2)
        gain2.connect(audioCtx.destination)
        osc2.type = 'sine'
        osc2.frequency.setValueAtTime(440, audioCtx.currentTime)
        gain2.gain.setValueAtTime(0.2, audioCtx.currentTime)
        osc2.start()
        osc2.stop(audioCtx.currentTime + 0.2)
      }, 250)
    }
  } catch (e) {
    console.error('Audio beep failed', e)
  }
}

function ScanSessionContent() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<AuditSession | null>(null)
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Scanning state
  const [ocrLoading, setOcrLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showPermissionHelp, setShowPermissionHelp] = useState(false)

  // Live text scanner (OCR) state
  const [isOcrScannerOpen, setIsOcrScannerOpen] = useState(false)
  const ocrVideoRef = useRef<HTMLVideoElement>(null)
  const ocrStreamRef = useRef<MediaStream | null>(null)

  // Manual search state
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchVehicles, setSearchVehicles] = useState<VehiclePreview[]>([])
  const [searching, setSearching] = useState(false)

  // Preview state
  const [previewVehicle, setPreviewVehicle] = useState<VehiclePreview | null>(null)
  const [previewMode, setPreviewMode] = useState<'OCR' | 'BARCODE' | 'MANUAL'>('OCR')
  const [previewNotes, setPreviewNotes] = useState('')
  const [savingItem, setSavingItem] = useState(false)

  // Filter state for scanned items list
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'MATCHED' | 'MISMATCH' | 'NOT_IN_SYSTEM'>('ALL')

  // Operator
  const [operatorName, setOperatorName] = useState('พนักงานตรวจเช็ก')

  const fetchSessionDetails = async () => {
    try {
      const res = await fetch(`/api/audit/session?id=${sessionId}`)
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลรายละเอียดรอบตรวจได้')
      const data = await res.json()
      setSession(data.session)
      setScannedItems(data.items || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessionDetails()
    
    // Retrieve displayName
    try {
      const profileStr = localStorage.getItem('liff_profile')
      if (profileStr) {
        const profile = JSON.parse(profileStr)
        if (profile?.displayName) {
          setOperatorName(profile.displayName.replace(' (Dev Mode)', ''))
        }
      }
    } catch (e) {
      console.error(e)
    }

    return () => {
      if (ocrStreamRef.current) {
        ocrStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [sessionId])

  const startOcrScanner = async () => {
    setIsOcrScannerOpen(true)
    setPreviewVehicle(null)
    
    try {
      // Check permission status first (if supported)
      if (navigator.permissions) {
        try {
          const permStatus = await navigator.permissions.query({ name: 'camera' as PermissionName })
          if (permStatus.state === 'denied') {
            setIsOcrScannerOpen(false)
            setShowPermissionHelp(true)
            return
          }
        } catch (_) {
          // permissions.query not supported for camera in some browsers, continue anyway
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      ocrStreamRef.current = stream
      
      if (ocrVideoRef.current) {
        ocrVideoRef.current.srcObject = stream
        ocrVideoRef.current.play()
      }
    } catch (err: any) {
      console.error('Failed to open camera for OCR:', err)
      setIsOcrScannerOpen(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('Permission')) {
        setShowPermissionHelp(true)
      } else {
        alert('ไม่สามารถเปิดกล้องได้: ' + err.message)
      }
    }
  }

  const stopOcrScanner = () => {
    if (ocrStreamRef.current) {
      ocrStreamRef.current.getTracks().forEach(track => track.stop())
      ocrStreamRef.current = null
    }
    setIsOcrScannerOpen(false)
  }

  const captureOcrFrame = async () => {
    if (!ocrVideoRef.current || !ocrStreamRef.current) return
    const video = ocrVideoRef.current
    if (video.readyState < 2) {
      alert('กล้องยังไม่พร้อมทำงาน กรุณารอสักครู่')
      return
    }

    setOcrLoading(true)
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const vw = video.videoWidth
      const vh = video.videoHeight
      
      // Crop central 85% width and 35% height of the video frame
      const cropW = Math.round(vw * 0.85)
      const cropH = Math.round(vh * 0.35)
      const cropX = Math.round((vw - cropW) / 2)
      const cropY = Math.round((vh - cropH) / 2)

      canvas.width = cropW
      canvas.height = cropH
      
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
      const imgData = canvas.toDataURL('image/jpeg', 0.8)

      // Send to our API route (which uses the cheap gemini-3.1-flash-lite)
      const res = await fetch('/api/audit/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: imgData })
      })

      if (!res.ok) throw new Error('การประมวลผลสแกนล้มเหลว')
      const data = await res.json()
      const resultText = data.result

      if (resultText === 'NOT_FOUND' || !resultText) {
        playBeep('warning')
        alert('❌ ไม่พบเลข VIN หรือป้ายทะเบียนที่ชัดเจนในกรอบ กรุณาเล็งใหม่และกดถ่ายใหม่อีกครั้ง')
        return
      }

      playBeep('success')
      setSearchKeyword(resultText) // Put the result text directly into the main search box!
      stopOcrScanner()
      
      // Auto search the database with the result text
      handleSearchWithVin(resultText, 'OCR')
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการวิเคราะห์: ' + err.message)
    } finally {
      setOcrLoading(false)
    }
  }

  const handleSearchWithVin = async (vin: string, method: 'OCR' | 'BARCODE' | 'MANUAL' = 'MANUAL') => {
    const cleanedVin = vin.trim().replace(/\s+/g, '')
    setSearching(true)
    try {
      const res = await fetch(`/api/audit/item?keyword=${encodeURIComponent(cleanedVin)}`)
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดการสืบค้นข้อมูลรถ')
      const data = await res.json()
      const foundVehicles: VehiclePreview[] = data.vehicles || []
      
      if (foundVehicles.length === 0) {
        playBeep('warning')
        setPreviewVehicle({
          VinNo: cleanedVin.length > 10 ? cleanedVin : '',
          RegisterNo: cleanedVin.length <= 10 ? cleanedVin : '',
          Model: 'ไม่พบข้อมูลรถในฐานข้อมูลหลัก',
          Exterior_Color: '-',
          Status: 'UNKNOWN',
          CurrentLocation: '-',
          StockLocation: '-'
        })
        setPreviewMode(method)
      } else {
        playBeep('success')
        setPreviewVehicle(foundVehicles[0])
        setPreviewMode(method)
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSearching(false)
    }
  }

function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      let width = img.width
      let height = img.height
      
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve(dataUrl)
    }
    img.onerror = (err) => {
      reject(err)
    }
  })
}

  // Call OCR API
  const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setOcrLoading(true)
    setPreviewVehicle(null)
    try {
      // 1. Compress and convert file to base64
      const base64Image = await compressImage(file)

      // 2. Call OCR API
      const ocrRes = await fetch('/api/audit/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      })

      if (!ocrRes.ok) throw new Error('การประมวลผลสแกนล้มเหลว')
      const ocrData = await ocrRes.json()
      const resultText = ocrData.result

      if (resultText === 'NOT_FOUND' || !resultText) {
        playBeep('warning')
        alert('❌ ไม่พบเลข VIN หรือป้ายทะเบียนที่ชัดเจน กรุณาถ่ายใหม่อีกครั้ง หรือใช้ช่องค้นหาแบบพิมพ์เองด้านล่าง')
        return
      }

      // 3. Search database with the detected string
      const searchRes = await fetch(`/api/audit/item?keyword=${encodeURIComponent(resultText)}`)
      if (!searchRes.ok) throw new Error('เกิดข้อผิดพลาดการสืบค้นข้อมูลรถ')
      const searchData = await searchRes.json()

      const foundVehicles: VehiclePreview[] = searchData.vehicles || []
      if (foundVehicles.length === 0) {
        // Vehicle not in inventory system, create dummy preview
        playBeep('warning')
        setPreviewVehicle({
          VinNo: resultText.length > 10 ? resultText : '',
          RegisterNo: resultText.length <= 10 ? resultText : '',
          Model: 'ไม่พบข้อมูลรถในฐานข้อมูลหลัก',
          Exterior_Color: '-',
          Status: 'UNKNOWN',
          CurrentLocation: '-',
          StockLocation: '-'
        })
        setPreviewMode('OCR')
      } else {
        // Found matching vehicles
        playBeep('success')
        setPreviewVehicle(foundVehicles[0])
        setPreviewMode('OCR')
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setShowPermissionHelp(true)
      } else {
        alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
      }
    } finally {
      setOcrLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = '' // Clear input
    }
  }

  // Handle Manual Search
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchKeyword.trim()) return

    setSearching(true)
    setSearchVehicles([])
    setPreviewVehicle(null)
    try {
      const res = await fetch(`/api/audit/item?keyword=${encodeURIComponent(searchKeyword)}`)
      if (!res.ok) throw new Error('ค้นหาข้อมูลล้มเหลว')
      const data = await res.json()
      const list = data.vehicles || []
      
      if (list.length === 0) {
        playBeep('warning')
        alert('❌ ไม่พบข้อมูลรถคันนี้ในระบบ')
      } else if (list.length === 1) {
        playBeep('success')
        setPreviewVehicle(list[0])
        setPreviewMode('MANUAL')
        setSearchKeyword('')
      } else {
        setSearchVehicles(list)
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSearching(false)
    }
  }

  // Autocomplete / Typeahead Search Effect
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const trimmed = searchKeyword.trim()
      if (trimmed.length >= 2) {
        setSearching(true)
        try {
          const res = await fetch(`/api/audit/item?keyword=${encodeURIComponent(trimmed)}`)
          if (res.ok) {
            const data = await res.json()
            setSearchVehicles(data.vehicles || [])
          }
        } catch (e) {
          console.error(e)
        } finally {
          setSearching(false)
        }
      } else {
        setSearchVehicles([])
      }
    }, 250) // 250ms debounce

    return () => clearTimeout(delayDebounce)
  }, [searchKeyword])

  // Save item checked in DB
  const handleSaveAuditItem = async (force = false) => {
    if (!previewVehicle || !session) return

    const expectedLoc = session.Location
    const currentLoc = previewVehicle.CurrentLocation || ''
    
    let detectedStatus: 'MATCHED' | 'MISMATCH' | 'NOT_IN_SYSTEM' = 'MATCHED'
    if (previewVehicle.Status === 'UNKNOWN') {
      detectedStatus = 'NOT_IN_SYSTEM'
    } else if (currentLoc.trim() !== expectedLoc.trim()) {
      detectedStatus = 'MISMATCH'
    }

    setSavingItem(true)
    try {
      const res = await fetch('/api/audit/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditSessionID: parseInt(sessionId),
          vinNo: previewVehicle.VinNo || previewVehicle.RegisterNo, // Fallback if no VIN
          createdBy: operatorName,
          method: previewMode,
          detectedStatus,
          previousLocation: currentLoc || '-',
          isConfirmed: true,
          notes: previewNotes,
          forceSave: force,
          vehicleStatus: previewVehicle.Status || null,
          vehicleStatusType: previewVehicle.StatusType || null
        })
      })

      const data = await res.json()
      
      if (data.isDuplicate) {
        playBeep('warning')
        const confirmRetry = window.confirm(
          `⚠️ แจ้งเตือนสแกนซ้ำ:\nรถคันนี้ถูกบันทึกไปแล้วในรอบนี้โดย "${data.existingRecord.createdBy}" เมื่อเวลา ${new Date(data.existingRecord.scanTime).toLocaleTimeString('th-TH', { timeZone: 'UTC' })}\n\nคุณต้องการบันทึกทับและอัปเดตเวลาล่าสุดใช่หรือไม่?`
        )
        if (confirmRetry) {
          handleSaveAuditItem(true) // Retry forcing save
        }
        return
      }

      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')

      // Clear preview and notes
      setPreviewVehicle(null)
      setPreviewNotes('')
      // Refresh list
      fetchSessionDetails()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSavingItem(false)
    }
  }

  // Close audit session
  const handleCloseSession = async () => {
    if (!session) return
    const confirmClose = window.confirm('คุณตรวจเช็ครถครบเรียบร้อยแล้ว และต้องการเสร็จสิ้นการทำ Stock Audit ในรอบนี้ใช่หรือไม่?')
    if (!confirmClose) return

    try {
      const res = await fetch('/api/audit/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.AuditSessionID,
          status: 'COMPLETED'
        })
      })

      if (!res.ok) throw new Error('ปิดรอบตรวจเช็กไม่สำเร็จ')
      fetchSessionDetails()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-sm text-slate-400 font-medium">กำลังโหลดข้อมูลรอบตรวจเช็ก...</div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="text-4xl mb-4">⚠️</div>
        <div className="text-sm text-rose-300 font-medium mb-4">{error || 'ไม่พบข้อมูลรอบตรวจเช็ก'}</div>
        <button
          onClick={() => router.push('/audit')}
          className="bg-slate-800 hover:bg-slate-700 text-slate-100 px-6 py-2 rounded-xl text-sm font-bold transition"
        >
          กลับหน้าหลัก Audit
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 font-sans pb-16 flex flex-col">
      {/* Session Title Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-indigo-500/20 shadow-md sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/audit')}
            className="text-slate-400 hover:text-slate-200 text-sm font-bold flex items-center gap-1"
          >
            ← ย้อนกลับ
          </button>
          <div className="text-center">
            <h1 className="text-sm font-bold text-slate-100">{session.LocationName || session.Location}</h1>
            <p className="text-[10px] text-slate-400">{new Date(session.AuditDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>
          </div>
          <div>
            {session.Status === 'DRAFT' ? (
              <button
                onClick={handleCloseSession}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition"
              >
                🏁 เสร็จสิ้น
              </button>
            ) : (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-1 rounded">
                เช็กเสร็จสิ้น
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-md w-full mx-auto px-4 py-6 space-y-6">
        {/* Session Stats Summary Card */}
        <div className="bg-slate-800/40 border border-slate-800/80 rounded-2xl p-4 shadow-lg backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
            <span className="text-xs font-black text-slate-300 uppercase tracking-wider">📊 สรุปผลการตรวจเช็กในรอบนี้</span>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
              ทั้งหมด {scannedItems.length} คัน
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Matched */}
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl py-2 px-1 flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-emerald-400">ตรงพิกัด</span>
              <span className="text-lg font-black text-emerald-300 mt-0.5">
                {scannedItems.filter(item => item.DetectedStatus === 'MATCHED').length}
              </span>
            </div>
            {/* Mismatched */}
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl py-2 px-1 flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-amber-400">ผิดพิกัด</span>
              <span className="text-lg font-black text-amber-300 mt-0.5">
                {scannedItems.filter(item => item.DetectedStatus === 'MISMATCH').length}
              </span>
            </div>
            {/* Not in system */}
            <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl py-2 px-1 flex flex-col justify-center items-center">
              <span className="text-[10px] font-bold text-rose-400">ไม่มีในระบบ</span>
              <span className="text-lg font-black text-rose-300 mt-0.5">
                {scannedItems.filter(item => item.DetectedStatus === 'NOT_IN_SYSTEM').length}
              </span>
            </div>
          </div>
        </div>

        {/* Status Hierarchy Chart */}
        {scannedItems.length > 0 && (
          <StatusHierarchyChart items={scannedItems} />
        )}

        {/* Only allow scanning if the session is DRAFT */}
        {session.Status === 'DRAFT' && (
          <div className="space-y-4">
            {/* Live Camera Scanner Box */}
            {isOcrScannerOpen ? (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4 relative overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-cyan-400 animate-pulse">📷 เล็งตัวหนังสือให้ตรงกรอบ...</span>
                  <button
                    type="button"
                    onClick={stopOcrScanner}
                    className="text-rose-400 hover:text-rose-300 text-xs font-bold px-3 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg transition"
                    disabled={ocrLoading}
                  >
                    ✕ ปิดกล้อง
                  </button>
                </div>
                
                {/* Live Camera Viewfinder */}
                <div className="relative aspect-[4/3] w-full bg-black rounded-xl overflow-hidden border border-slate-800">
                  <video
                    ref={ocrVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Custom Target Laser Frame Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                    <div className="w-[85%] h-[35%] border-2 border-cyan-400 rounded-xl relative flex justify-center items-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                      <div className="absolute left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-bounce" style={{ animationDuration: '2.5s' }} />
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-300 rounded-tl-md" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-300 rounded-tr-md" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-300 rounded-bl-md" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-300 rounded-br-md" />
                    </div>
                    <span className="text-[10px] text-cyan-300/80 font-bold bg-slate-950/80 px-2.5 py-1 rounded-full mt-3 uppercase tracking-wider">จัดข้อความให้อยู่ในกรอบ</span>
                  </div>
                </div>

                {/* Big Action Button to Capture and Analyze with Gemini */}
                <button
                  type="button"
                  onClick={captureOcrFrame}
                  disabled={ocrLoading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-900 text-white font-black text-sm py-3.5 px-4 rounded-xl transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  {ocrLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>⏳ กำลังวิเคราะห์ข้อความด้วย AI... กรุณารอสักครู่</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">⚡</span>
                      <span>กดปุ่มนี้เพื่อสแกนด้วย AI</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* 1A. Live Scanner Button */}
                <button
                  type="button"
                  onClick={startOcrScanner}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-sm py-4 px-4 rounded-2xl transition duration-200 shadow-md hover:shadow-lg flex flex-col items-center justify-center gap-1.5"
                >
                  <span className="text-xl">🎥</span>
                  <span>เปิดกล้องแสกนสด</span>
                  <span className="text-[9px] text-emerald-100 font-normal">ส่องตัวอักษรเพื่อแกะเลข</span>
                </button>

                {/* 1B. Camera Upload Button (Fast Capture Input) */}
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleOcrFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={ocrLoading}
                    ref={fileInputRef}
                  />
                  <button
                    type="button"
                    className="w-full h-full bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-black text-sm py-4 px-4 rounded-2xl transition duration-200 shadow-md hover:shadow-lg flex flex-col items-center justify-center gap-1.5"
                  >
                    {ocrLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                        <span className="text-[10px] text-slate-400">กำลังวิเคราะห์ภาพ...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xl">📷</span>
                        <span>ถ่ายรูปส่งวิเคราะห์</span>
                        <span className="text-[9px] text-slate-400 font-normal">แสกนตัวอักษรโดย AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Manual Input Search (Autocomplete as you type) */}
            <form onSubmit={handleManualSearch} className="relative">
              <input
                type="text"
                placeholder="พิมพ์ทะเบียนรถ หรือเลข VIN..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition"
              />
              {searching && (
                <div className="absolute right-3.5 top-3 flex items-center">
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </form>

            {/* Dropdown Options for Manual search (if multiple cars match) */}
            {searchVehicles.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1 max-h-40 overflow-y-auto">
                <div className="text-[10px] text-slate-400 font-bold px-2 py-1 uppercase tracking-wider">โปรดเลือกตัวเลือกรถที่ต้องการ:</div>
                {searchVehicles.map((car) => (
                  <div
                    key={car.VinNo}
                    onClick={() => {
                      setPreviewVehicle(car)
                      setPreviewMode('MANUAL')
                      setSearchVehicles([])
                    }}
                    className="hover:bg-slate-800 p-2 rounded-lg cursor-pointer text-xs flex justify-between items-center transition"
                  >
                    <div>
                      <span className="font-bold text-slate-200">{car.RegisterNo || 'ไม่มีทะเบียน'}</span>
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({car.VinNo})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{car.Model}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Preview Card (Stage 1: Preview-First before saving) */}
        {previewVehicle && (
          <div className="bg-slate-800/60 border-2 border-cyan-500/40 rounded-2xl p-5 shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-300 backdrop-blur-sm">
            <div className="flex justify-between items-start border-b border-slate-700 pb-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block mb-0.5">ผลการสแกน (ตรวจสอบก่อนบันทึก)</span>
                <h3 className="text-lg font-black text-slate-100">{previewVehicle.RegisterNo || 'ยังไม่มีทะเบียน'}</h3>
                <span className="text-xs text-slate-400 font-mono block mt-1">VIN: {previewVehicle.VinNo || '-'}</span>
              </div>
              <button
                onClick={() => setPreviewVehicle(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">รุ่นรถ (Model)</span>
                <span className="font-bold text-slate-300">{previewVehicle.Model}</span>
              </div>
              <div>
                <span className="text-slate-500 block">สีภายนอก (Color)</span>
                <span className="font-bold text-slate-300">{previewVehicle.Exterior_Color || '-'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">สถานะปัจจุบันในระบบ</span>
                <span className="font-bold text-slate-300">{previewVehicle.Status || 'UNKNOWN'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">พิกัดเดิมในระบบ</span>
                <span className="font-bold text-slate-300">
                  {previewVehicle.CurrentLocationName || previewVehicle.StockLocationName || previewVehicle.CurrentLocation || previewVehicle.StockLocation || '-'}
                </span>
              </div>
            </div>

            {/* Check location mismatch and show badge */}
            <div className="pt-2">
              {(() => {
                const currentLoc = previewVehicle.CurrentLocation || previewVehicle.StockLocation || ''
                const expectedLoc = session.Location
                
                if (previewVehicle.Status === 'UNKNOWN') {
                  return (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                      <span>⚠️</span> ไม่พบข้อมูลรถยนต์คันนี้ในฐานข้อมูลหลัก
                    </div>
                  )
                } else if (currentLoc.trim() === expectedLoc.trim()) {
                  return (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl p-3 text-xs font-semibold flex items-center gap-2">
                      <span>✅</span> รถคันนี้อยู่ตรงตามพิกัดสถานที่ในระบบ
                    </div>
                  )
                } else {
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3 text-xs font-semibold space-y-1">
                      <div className="flex items-center gap-2">
                        <span>⚠️</span> รถคันนี้อยู่ผิดพิกัดสถานที่!
                      </div>
                      <div className="text-[10px] text-amber-400 font-medium">
                        พิกัดเดิมในระบบคือ "{previewVehicle.CurrentLocationName || previewVehicle.StockLocationName || currentLoc || '-'}" แต่สแกนเจอที่ "{session.LocationName || expectedLoc}"
                      </div>
                    </div>
                  )
                }
              })()}
            </div>

            {/* Optional scan notes */}
            <input
              type="text"
              placeholder="เขียนบันทึกเพิ่มเติมสำหรับรถคันนี้ (ถ้ามี)..."
              value={previewNotes}
              onChange={(e) => setPreviewNotes(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-400 transition"
            />

            {/* Confirm Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreviewVehicle(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-650 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition"
              >
                ยกเลิก (ไม่บันทึก)
              </button>
              <button
                type="button"
                onClick={() => handleSaveAuditItem(false)}
                disabled={savingItem}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold text-xs py-2.5 rounded-xl transition disabled:opacity-50"
              >
                {savingItem ? 'กำลังบันทึก...' : '➕ ยืนยันและบันทึกพิกัด'}
              </button>
            </div>
          </div>
        )}

        {/* 4. Scanned List (Progress log) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">รถที่เช็กในรอบนี้แล้ว ({scannedItems.length} คัน)</h2>
            {scannedItems.length > 0 && (
              <button
                onClick={() => {
                  const detectStatusThai: Record<string, string> = {
                    'MATCHED': 'ตรงพิกัด',
                    'MISMATCH': 'ผิดพิกัด',
                    'NOT_IN_SYSTEM': 'ไม่มีในระบบ'
                  }
                  const rows = scannedItems.map((item, idx) => ({
                    'ลำดับ': scannedItems.length - idx,
                    'ทะเบียน': item.RegisterNo || '-',
                    'VinNo': item.VinNo,
                    'รุ่น': item.Model || '-',
                    'สี': item.Exterior_Color || '-',
                    'สถานะรถ': item.VehicleStatus ? getStatusThaiLabel(item.StatusTypeName || item.VehicleStatusType || item.VehicleStatus) : '-',
                    'ผลตรวจ': detectStatusThai[item.DetectedStatus] || item.DetectedStatus,
                    'พิกัดก่อนหน้า': item.PreviousLocationName || item.PreviousLocation || '-',
                    'วิธีสแกน': item.ScanMethod,
                    'เวลาสแกน': new Date(item.ScanTime).toLocaleString('th-TH', { timeZone: 'UTC' }),
                    'ผู้บันทึก': item.CreatedBy,
                    'หมายเหตุ': item.Notes || ''
                  }))

                  const locationName = session?.LocationName || session?.Location || 'audit'
                  const auditDateStr = session?.AuditDate ? new Date(session.AuditDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '-'
                  const exportTime = new Date().toLocaleString('th-TH')
                  const matchedCount = scannedItems.filter(i => i.DetectedStatus === 'MATCHED').length
                  const mismatchCount = scannedItems.filter(i => i.DetectedStatus === 'MISMATCH').length

                  // Build sheet with header info rows
                  const headerRows = [
                    ['รายงาน Stock Audit'],
                    ['สถานที่ตรวจ', locationName],
                    ['วันที่ตรวจ', auditDateStr],
                    ['ผู้ตรวจ', session?.CreatedBy || '-'],
                    ['จำนวนรถทั้งหมด', scannedItems.length, '', 'ตรงพิกัด', matchedCount, '', 'ผิดพิกัด', mismatchCount],
                    ['วันที่ Export', exportTime],
                    [], // blank row separator
                  ]

                  const ws = XLSX.utils.aoa_to_sheet(headerRows)
                  XLSX.utils.sheet_add_json(ws, rows, { origin: `A${headerRows.length + 1}` })

                  // Auto-size title merge
                  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]

                  const wb = XLSX.utils.book_new()
                  XLSX.utils.book_append_sheet(wb, ws, 'Audit Detail')
                  const dateStr = session?.AuditDate ? new Date(session.AuditDate).toISOString().split('T')[0] : 'export'
                  XLSX.writeFile(wb, `audit_${locationName}_${dateStr}.xlsx`)
                }}
                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 px-3 py-1 rounded-lg transition flex items-center gap-1"
              >
                📥 Export Excel
              </button>
            )}
          </div>

          {/* Filter Pills */}
          {scannedItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: 'ALL' as const, label: 'ทั้งหมด', count: scannedItems.length, activeClass: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' },
                { key: 'MATCHED' as const, label: '✅ ตรงพิกัด', count: scannedItems.filter(i => i.DetectedStatus === 'MATCHED').length, activeClass: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' },
                { key: 'MISMATCH' as const, label: '⚠️ ผิดพิกัด', count: scannedItems.filter(i => i.DetectedStatus === 'MISMATCH').length, activeClass: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
                { key: 'NOT_IN_SYSTEM' as const, label: '❌ ไม่มีในระบบ', count: scannedItems.filter(i => i.DetectedStatus === 'NOT_IN_SYSTEM').length, activeClass: 'bg-rose-500/20 border-rose-500/40 text-rose-300' },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterStatus(f.key)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition ${
                    filterStatus === f.key
                      ? f.activeClass
                      : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f.label} {f.count}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const filtered = filterStatus === 'ALL' ? scannedItems : scannedItems.filter(i => i.DetectedStatus === filterStatus)

            if (filtered.length === 0 && scannedItems.length > 0) {
              return (
                <div className="bg-slate-800/10 border border-slate-800/50 rounded-2xl py-8 text-center text-slate-500 text-xs font-medium">
                  ไม่มีรายการที่ตรงกับตัวกรอง
                </div>
              )
            }

            if (filtered.length === 0) {
              return (
                <div className="bg-slate-800/10 border border-slate-800/50 rounded-2xl py-12 text-center text-slate-500 text-xs font-medium">
                  ยังไม่มีการบันทึกรายการรถในรอบนี้
                </div>
              )
            }

            return (
            <div className="space-y-3">
              {filtered.map((item, idx) => {
                const scanTimeStr = new Date(item.ScanTime).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC'
                }) + ' น.'
                
                return (
                  <div
                    key={item.AuditItemID}
                    className="bg-slate-800/20 border border-slate-800 rounded-xl p-3 flex justify-between items-center transition hover:bg-slate-800/30"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500">#{scannedItems.length - idx}</span>
                        <span className="text-sm font-bold text-slate-200">{item.RegisterNo || 'ไม่มีทะเบียน'}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          item.DetectedStatus === 'MATCHED'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : item.DetectedStatus === 'MISMATCH'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}>
                          {item.DetectedStatus === 'MATCHED' ? 'ตรงพิกัด' : item.DetectedStatus === 'MISMATCH' ? 'ผิดพิกัด' : 'ไม่มีในระบบ'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        Model: {item.Model || 'ไม่ระบุ'} • VIN: <span className="font-mono text-[9px] text-slate-500">{item.VinNo}</span>
                      </div>
                      {item.VehicleStatus && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            🚗 {getStatusThaiLabel(item.StatusTypeName || item.VehicleStatusType || item.VehicleStatus)}
                          </span>
                        </div>
                      )}
                      {item.DetectedStatus === 'MISMATCH' && (
                        <div className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                          📍 พิกัดเดิม: {item.PreviousLocationName || item.PreviousLocation || '-'}
                        </div>
                      )}
                      {item.Notes && (
                        <div className="text-[10px] text-cyan-400 italic font-medium">
                          📝 {item.Notes}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-[10px] text-slate-500 font-medium">
                      <div>🕒 {scanTimeStr}</div>
                      <div>👤 {item.CreatedBy}</div>
                      <div className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider mt-0.5">{item.ScanMethod}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            )
          })()}
        </div>
      </div>

      {/* Permission Denied Help Modal */}
      {showPermissionHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-rose-300 flex items-center gap-2">🔒 ไม่สามารถเข้าถึงกล้องได้</h3>
              <button
                onClick={() => setShowPermissionHelp(false)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              แอปไม่ได้รับอนุญาตให้เข้าถึงกล้องถ่ายรูป กรุณาเปิดสิทธิ์ตามขั้นตอนด้านล่าง:
            </p>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">สำหรับ Android (LINE)</p>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>ไปที่ <span className="font-bold text-slate-100">ตั้งค่า (Settings)</span> ของมือถือ</li>
                <li>เลือก <span className="font-bold text-slate-100">แอป (Apps)</span> → ค้นหา <span className="font-bold text-emerald-300">LINE</span></li>
                <li>กดเข้า <span className="font-bold text-slate-100">สิทธิ์ (Permissions)</span></li>
                <li>เปิดสิทธิ์ <span className="font-bold text-amber-300">กล้อง (Camera)</span> และ <span className="font-bold text-amber-300">ไฟล์ (Storage)</span></li>
                <li>กลับมาเปิดหน้านี้ใหม่แล้วลองอีกครั้ง</li>
              </ol>
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
              <p className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">สำหรับ iPhone (Safari / LINE)</p>
              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>ไปที่ <span className="font-bold text-slate-100">ตั้งค่า → LINE</span></li>
                <li>เปิดสิทธิ์ <span className="font-bold text-amber-300">กล้อง (Camera)</span></li>
                <li>กลับมาเปิดหน้านี้ใหม่</li>
              </ol>
            </div>

            <div className="pt-1 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPermissionHelp(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm py-2.5 rounded-xl transition"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => { setShowPermissionHelp(false); window.location.reload() }}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold text-sm py-2.5 rounded-xl transition"
              >
                🔄 รีโหลดหน้า
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ScanSessionPage() {
  return (
    <AuthGuard>
      <ScanSessionContent />
    </AuthGuard>
  )
}
