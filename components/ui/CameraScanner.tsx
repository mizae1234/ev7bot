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
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center p-4 pt-10">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative shadow-2xl">
        <div className="flex justify-between items-center p-4 bg-slate-100 border-b border-slate-200">
          <h3 className="text-black font-bold text-sm">📷 สแกนบาร์โค้ดด้วยกล้อง</h3>
          <button 
            onClick={onClose}
            className="text-rose-500 font-bold hover:text-rose-600 text-lg"
          >
            ✕ ปิด
          </button>
        </div>
        
        {errorMsg ? (
          <div className="p-8 text-center text-rose-600 font-bold">
            {errorMsg}
          </div>
        ) : (
          <div className="relative">
            <div id="reader" className="w-full bg-slate-900 min-h-[300px] flex items-center justify-center"></div>
            
            {/* Overlay Frame / Trigger Status */}
            <div className={`absolute inset-0 border-4 pointer-events-none transition-colors duration-300 ${isArmed ? 'border-amber-500' : lastScanned ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent'}`}></div>
            
            {lastScanned && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-in slide-in-from-top-4 fade-in duration-300 whitespace-nowrap">
                ✅ สแกนสำเร็จ: {lastScanned}
              </div>
            )}
          </div>
        )}
      </div>
      
      {!errorMsg && (
        <div className="mt-8 flex flex-col items-center gap-6">
          <button 
            onClick={handleTrigger}
            disabled={isArmed}
            className={`w-28 h-28 rounded-full flex items-center justify-center font-bold text-white text-xl shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all ${
              isArmed 
                ? 'bg-amber-500 scale-95 shadow-[0_0_30px_rgba(245,158,11,0.6)]' 
                : 'bg-rose-500 hover:bg-rose-600 active:scale-95 shadow-[0_0_30px_rgba(225,29,72,0.6)]'
            }`}
          >
            {isArmed ? 'กำลังสแกน...' : 'กดสแกน'}
          </button>
          <p className="text-slate-400 text-sm font-medium text-center bg-slate-900/50 px-4 py-2 rounded-lg">
            {isArmed ? 'เล็งบาร์โค้ดให้อยู่ในกรอบ...' : 'เล็งกล้องไปที่บาร์โค้ด แล้วกดปุ่มสีแดง'}
          </p>
        </div>
      )}
    </div>
  )
}
