'use client'

import React, { useState, useEffect, useRef } from 'react'

export interface DbCar {
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

interface VehicleSearchWithScannerProps {
  onSelectCar: (car: DbCar) => void
  placeholder?: string
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

export function VehicleSearchWithScanner({
  onSelectCar,
  placeholder = 'พิมพ์ค้นหาเลขทะเบียนจริง หรือ VIN...'
}: VehicleSearchWithScannerProps) {
  // State for manual search input
  const [searchTerm, setSearchTerm] = useState('')
  const [dbCars, setDbCars] = useState<DbCar[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Scanner modal states
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scanningLoading, setScanningLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debounced search for manual input
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const trimmed = searchTerm.trim()
      if (trimmed.length >= 2) {
        setLoading(true)
        try {
          const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(trimmed)}`)
          if (res.ok) {
            const data = await res.json()
            setDbCars(data || [])
          }
        } catch (e) {
          console.error('[VehicleSearchWithScanner] Search error:', e)
        } finally {
          setLoading(false)
        }
      } else {
        setDbCars([])
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [searchTerm])

  // Camera stream controls
  const startCamera = async () => {
    setIsScannerOpen(true)
    setScanningLoading(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
    } catch (err: any) {
      console.error('[VehicleSearchWithScanner] Camera start failed:', err)
      alert('ไม่สามารถเปิดกล้องได้: ' + err.message)
      setIsScannerOpen(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsScannerOpen(false)
  }

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Analyze and search vehicle using scanned text
  const processScannedText = async (text: string) => {
    const cleanedText = text.trim().replace(/\s+/g, '')
    if (!cleanedText) return

    try {
      const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(cleanedText)}`)
      if (!res.ok) throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูลรถ')
      
      const foundCars: DbCar[] = await res.json()
      if (foundCars && foundCars.length > 0) {
        playBeep('success')
        if (foundCars.length === 1) {
          // Exactly one match, auto-select
          onSelectCar(foundCars[0])
          stopCamera()
        } else {
          // Multiple matches found, show the list and let the user select
          setDbCars(foundCars)
          setSearchTerm(cleanedText)
          setShowDropdown(true)
          stopCamera()
        }
      } else {
        playBeep('warning')
        alert(`❌ ไม่พบข้อมูลรถคันนี้ในระบบ (คำที่วิเคราะห์ได้: "${cleanedText}")`)
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการค้นหาข้อมูลรถ: ' + err.message)
    }
  }

  // Capture frame from video and send to OCR API
  const captureFrame = async () => {
    if (!videoRef.current || !streamRef.current) return
    const video = videoRef.current
    if (video.readyState < 2) {
      alert('กล้องยังไม่พร้อมทำงาน กรุณารอสักครู่')
      return
    }

    setScanningLoading(true)
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

      // Send to OCR API route
      const res = await fetch('/api/audit/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: imgData })
      })

      if (!res.ok) throw new Error('การวิเคราะห์ข้อมูลล้มเหลว')
      const data = await res.json()
      const resultText = data.result

      if (resultText === 'NOT_FOUND' || !resultText) {
        playBeep('warning')
        alert('❌ ไม่พบเลข VIN หรือป้ายทะเบียนที่ชัดเจนในกรอบ กรุณาเล็งใหม่และกดถ่ายใหม่อีกครั้ง')
        return
      }

      await processScannedText(resultText)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการวิเคราะห์: ' + err.message)
    } finally {
      setScanningLoading(false)
    }
  }

  // Handle Photo Upload change
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanningLoading(true)
    try {
      const base64Image = await compressImage(file)

      const ocrRes = await fetch('/api/audit/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image })
      })

      if (!ocrRes.ok) throw new Error('การวิเคราะห์รูปภาพล้มเหลว')
      const ocrData = await ocrRes.json()
      const resultText = ocrData.result

      if (resultText === 'NOT_FOUND' || !resultText) {
        playBeep('warning')
        alert('❌ ไม่พบเลข VIN หรือป้ายทะเบียนที่ชัดเจนในภาพ กรุณาถ่ายใหม่อีกครั้ง หรือพิมพ์ค้นหาด้วยตัวเอง')
        return
      }

      await processScannedText(resultText)
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการสแกนไฟล์: ' + err.message)
    } finally {
      setScanningLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <div className="relative">
        <div className="flex items-center bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl px-3.5 py-1 transition w-full">
          <span className="text-slate-400 mr-2 text-sm">🔍</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder={placeholder}
            className="bg-transparent text-sm w-full py-2.5 pr-10 focus:outline-none text-slate-800 placeholder-slate-400"
          />
          {loading && <span className="text-xs text-slate-400 animate-pulse mr-2">ค้นหา...</span>}
          
          <button
            type="button"
            onClick={startCamera}
            className="absolute right-3.5 text-slate-400 hover:text-indigo-600 transition flex items-center justify-center p-1 rounded-full hover:bg-slate-100"
            title="สแกนด้วยกล้อง"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showDropdown && searchTerm && (
          <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-lg z-20 overflow-hidden max-h-56">
            {dbCars.length > 0 ? (
              dbCars.map((car, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectCar(car)
                    setShowDropdown(false)
                  }}
                  className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 active:bg-slate-100 transition flex items-center justify-between text-slate-800"
                >
                  <div>
                    <p className="font-bold text-slate-900">{car.RegisterNo}</p>
                    <p className="text-xxs text-slate-500 font-mono">VIN: {car.VinNo}</p>
                  </div>
                  <span className="text-xxs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
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

      {/* SCANNER VIEWPORT MODAL */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 flex flex-col font-sans text-slate-100">
          <div className="safe-top bg-slate-900 border-b border-slate-800 px-4 py-4 flex items-center justify-between shadow-md">
            <div>
              <h2 className="text-sm font-black text-slate-200">สแกนทะเบียน / เลขตัวถังรถ (VIN)</h2>
              <p className="text-[10px] text-slate-400">เล็งตัวอักษรให้อยู่ในกรอบสแกน</p>
            </div>
            <button
              type="button"
              onClick={stopCamera}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition"
            >
              ✕ ปิดกล้อง
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
            {/* Viewfinder Stream */}
            <div className="relative aspect-[4/3] w-full max-w-sm bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Scan Overlay Laser Frame */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                <div className="w-[85%] h-[35%] border-2 border-cyan-400 rounded-xl relative flex justify-center items-center shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                  <div className="absolute left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-bounce" style={{ animationDuration: '2.5s' }} />
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cyan-300 rounded-tl-md" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cyan-300 rounded-tr-md" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cyan-300 rounded-bl-md" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cyan-300 rounded-br-md" />
                </div>
                <span className="text-[10px] text-cyan-300/90 font-bold bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full mt-4 uppercase tracking-wider">จัดตัวเลขหรือข้อความให้อยู่ในกรอบ</span>
              </div>

              {scanningLoading && (
                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                  <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm font-bold text-slate-100">กำลังสแกนและวิเคราะห์ด้วย AI...</p>
                  <p className="text-xs text-slate-400 mt-1">กรุณารอสักครู่ ระบบกำลังแกะตัวหนังสือ</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border-t border-slate-800 p-5 space-y-4 max-w-sm mx-auto w-full pb-8">
            <button
              type="button"
              onClick={captureFrame}
              disabled={scanningLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-900 text-white font-black text-sm py-4 px-4 rounded-2xl transition duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-98"
            >
              {scanningLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>⏳ กำลังวิเคราะห์ข้อความด้วย AI...</span>
                </>
              ) : (
                <>
                  <span className="text-lg">⚡</span>
                  <span>กดปุ่มนี้เพื่อสแกนด้วย AI</span>
                </>
              )}
            </button>

            {/* Photo Upload fallback */}
            <div className="relative w-full">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={scanningLoading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                ref={fileInputRef}
              />
              <button
                type="button"
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-3 px-4 rounded-xl transition flex items-center justify-center gap-2"
              >
                <span>📷</span>
                <span>ถ่ายรูปส่งวิเคราะห์ (หรือเลือกจากแกลเลอรี)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
