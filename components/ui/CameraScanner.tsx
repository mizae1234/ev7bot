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
  const onScanRef = useRef(onScan)

  // Sync state to ref for the callback
  useEffect(() => {
    isArmedRef.current = isArmed
  }, [isArmed])

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    let mounted = true
    let startPromise: Promise<any> | null = null
    let localScanner: Html5Qrcode | null = null

    if (typeof window !== 'undefined' && !scannerRef.current) {
      localScanner = new Html5Qrcode('reader')
      scannerRef.current = localScanner

      startPromise = localScanner.start(
        { facingMode: 'environment' }, 
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.0,
        },
        (text) => {
          if (mounted && isArmedRef.current) {
            // Trigger pulled and barcode found!
            isArmedRef.current = false
            setIsArmed(false)
            setLastScanned(text)
            
            // Play a success beep sound if possible
            try {
              const audio = new Audio('data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq') 
              audio.play().catch(() => {})
            } catch(e) {}
            
            // Trigger parent callback
            onScanRef.current(text)

            // Clear success message after 2 seconds
            setTimeout(() => {
              if (mounted) setLastScanned(null)
            }, 2000)
          }
        },
        (error) => {}
      )
      
      startPromise.catch((err) => {
        if (mounted) {
          const errStr = String(err).toLowerCase()
          if (errStr.includes('notallowed') || errStr.includes('permission')) {
            setErrorMsg(
              'ไม่สามารถเปิดกล้องได้เนื่องจากถูกปิดกั้นสิทธิ์\n\n' +
              'วิธีแก้ไข:\n' +
              '📱 iOS (Safari/LINE): ไปที่ Settings > Safari > Camera > เลือก Allow (อนุญาต)\n' +
              '📱 Android (Chrome): แตะไอคอนแม่กุญแจ 🔒 บนแถบเว็บ > สิทธิ์ > กล้อง > เลือก อนุญาต'
            )
          } else {
            setErrorMsg('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบว่ามีกล้องและเบราว์เซอร์รองรับ (' + errStr + ')')
          }
        }
      })
    }

    return () => {
      mounted = false
      if (startPromise && localScanner) {
        startPromise.then(() => {
          localScanner!.stop().then(() => {
            localScanner!.clear()
          }).catch(console.error)
        }).catch(() => {})
      }
      scannerRef.current = null
    }
  }, [])

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
    <div className="flex flex-col items-center mb-4 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
      <div className="w-full max-w-md bg-black relative">
        <div className="flex justify-between items-center px-3 py-2 bg-slate-800 border-b border-slate-700 absolute top-0 left-0 right-0 z-20 opacity-90">
          <h3 className="text-white font-bold text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            กล้องสแกน
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-300 hover:text-white font-bold text-xs bg-slate-700/50 px-2 py-1 rounded transition"
          >
            ✕ ปิด
          </button>
        </div>
        
        {errorMsg ? (
          <div className="p-6 pt-12 pb-8 text-center text-rose-400 text-xs mt-4">
            <div className="bg-slate-800/80 p-4 rounded-xl border border-rose-500/30 whitespace-pre-wrap leading-relaxed text-left">
              {errorMsg}
            </div>
          </div>
        ) : (
          <div className="relative pt-8 bg-black">
            {/* Cropping wrapper to make the camera appear shorter without breaking aspect ratio math */}
            <div className="w-full h-[220px] overflow-hidden relative">
              <div className="absolute top-1/2 left-0 w-full -translate-y-1/2">
                <div id="reader" className="w-full"></div>
              </div>
            </div>
            
            {/* Overlay Frame / Trigger Status */}
            <div className={`absolute top-8 bottom-0 left-0 right-0 border-4 pointer-events-none transition-colors duration-300 z-10 ${isArmed ? 'border-amber-500' : lastScanned ? 'border-emerald-500 bg-emerald-500/10' : 'border-transparent'}`}></div>
            
            {lastScanned && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-3 py-1.5 rounded-full font-bold shadow-lg animate-in slide-in-from-top-4 fade-in duration-300 whitespace-nowrap text-xs z-20">
                ✅ สำเร็จ: {lastScanned}
              </div>
            )}

            {/* Floating Trigger Button */}
            <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center z-20">
              <button 
                onClick={handleTrigger}
                disabled={isArmed}
                className={`px-8 py-2.5 rounded-full font-bold text-white text-sm shadow-[0_4px_15px_rgba(0,0,0,0.5)] border border-white/20 backdrop-blur-sm transition-all ${
                  isArmed 
                    ? 'bg-amber-500/90 scale-95 shadow-[0_0_20px_rgba(245,158,11,0.6)]' 
                    : 'bg-rose-600/90 hover:bg-rose-500 active:scale-95 shadow-[0_0_20px_rgba(225,29,72,0.6)]'
                }`}
              >
                {isArmed ? 'กำลังหาบาร์โค้ด...' : 'กดยิง!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
