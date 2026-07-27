'use client'

import React, { useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface CameraScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
}

export default function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    // Only run on client and avoid double initialization in React Strict Mode
    if (typeof window !== 'undefined' && !scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        'reader',
        { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        false
      )

      scannerRef.current.render(
        (text) => {
          // On successful scan
          if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error)
          }
          onScan(text)
        },
        (error) => {
          // Ignore scanning errors
        }
      )
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((error) => console.error('Failed to clear scanner', error))
        scannerRef.current = null
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-4">
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
        
        {/* The div where html5-qrcode injects the camera stream */}
        <div id="reader" className="w-full bg-white text-slate-800 min-h-[300px] flex items-center justify-center"></div>
      </div>
      
      <p className="text-slate-400 mt-6 text-sm font-medium animate-pulse text-center">
        หันกล้องไปที่บาร์โค้ด (เช่น GI-xxx) เพื่อสแกน...
      </p>
    </div>
  )
}
