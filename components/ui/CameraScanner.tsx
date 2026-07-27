'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface CameraScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
}

export default function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isArmed, setIsArmed] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  
  const isArmedRef = useRef(false)

  // Sync state to ref for the callback
  useEffect(() => {
    isArmedRef.current = isArmed
  }, [isArmed])

  useEffect(() => {
    let mounted = true
    let isStarted = false

    if (typeof window !== 'undefined' && !scannerRef.current) {
      const html5QrCode = new Html5Qrcode('reader')
      scannerRef.current = html5QrCode

      html5QrCode.start(
        { facingMode: 'environment' }, 
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.0,
        },
        (text) => {
          if (mounted && isStarted && isArmedRef.current) {
            // Trigger pulled and barcode found!
            isArmedRef.current = false
            setIsArmed(false)
            setLastScanned(text)
            
            // Play a success beep sound if possible
            try {
              const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq') 
              audio.play().catch(() => {})
            } catch(e) {}
            
            // Trigger parent callback (does not close camera anymore)
            onScan(text)

            // Clear success message after 2 seconds
            setTimeout(() => {
              if (mounted) setLastScanned(null)
            }, 2000)
          }
        },
        (error) => {}
      ).then(() => {
        isStarted = true
      }).catch((err) => {
        if (mounted) {
          setErrorMsg('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้องบนเบราว์เซอร์')
        }
      })
    }

    return () => {
      mounted = false
      if (scannerRef.current && isStarted) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear()
        }).catch(console.error)
      }
      scannerRef.current = null
    }
  }, [onScan])

  const handleTrigger = () => {
    setIsArmed(true)
    setLastScanned(null)
    // Auto disarm after 5 seconds if no barcode found to save battery
    setTimeout(() => {
      if (isArmedRef.current) {
        setIsArmed(false)
      }
    }, 5000)
  }

  return (
    <div className="flex flex-col items-center p-2 mb-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden relative shadow-lg">
        <div className="flex justify-between items-center p-3 bg-slate-100 border-b border-slate-200">
          <h3 className="text-black font-bold text-sm">📷 กล้องสแกน</h3>
          <button 
            onClick={onClose}
            className="text-rose-500 font-bold hover:text-rose-600 text-sm flex items-center gap-1 bg-rose-50 px-2 py-1 rounded"
          >
            ✕ ปิด
          </button>
        </div>
        
        {errorMsg ? (
          <div className="p-8 text-center text-rose-600 font-bold text-sm">
            {errorMsg}
          </div>
        ) : (
          <div className="relative">
            <div id="reader" className="w-full bg-slate-900 min-h-[250px] flex items-center justify-center"></div>
            
            {/* Overlay Frame / Trigger Status */}
            <div className={`absolute inset-0 border-4 pointer-events-none transition-colors duration-300 ${isArmed ? 'border-amber-500' : lastScanned ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent'}`}></div>
            
            {lastScanned && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-in slide-in-from-top-4 fade-in duration-300 whitespace-nowrap text-sm">
                ✅ สแกนสำเร็จ: {lastScanned}
              </div>
            )}
          </div>
        )}
      </div>
      
      {!errorMsg && (
        <div className="mt-4 flex flex-col items-center gap-3 w-full">
          <button 
            onClick={handleTrigger}
            disabled={isArmed}
            className={`w-20 h-20 rounded-full flex items-center justify-center font-bold text-white text-base shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all ${
              isArmed 
                ? 'bg-amber-500 scale-95 shadow-[0_0_20px_rgba(245,158,11,0.6)]' 
                : 'bg-rose-500 hover:bg-rose-600 active:scale-95 shadow-[0_0_20px_rgba(225,29,72,0.6)]'
            }`}
          >
            {isArmed ? 'กำลังหา...' : 'กดยิง!'}
          </button>
          <p className="text-slate-400 text-xs font-medium text-center px-4">
            {isArmed ? 'เล็งบาร์โค้ดให้อยู่ในกรอบ...' : 'เล็งบาร์โค้ดแล้วกดปุ่มแดง (ข้อมูลจะขึ้นด้านล่าง)'}
          </p>
        </div>
      )}
    </div>
  )
}
