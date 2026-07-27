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

  useEffect(() => {
    let mounted = true
    let isStarted = false

    if (typeof window !== 'undefined' && !scannerRef.current) {
      const html5QrCode = new Html5Qrcode('reader')
      scannerRef.current = html5QrCode

      html5QrCode.start(
        { facingMode: 'environment' }, // Auto-select rear camera
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.0,
        },
        (text) => {
          if (mounted && isStarted) {
            html5QrCode.stop().then(() => {
              html5QrCode.clear()
              onScan(text)
            }).catch(console.error)
          }
        },
        (error) => {
          // Ignore frequent scanning errors
        }
      ).then(() => {
        isStarted = true
      }).catch((err) => {
        if (mounted) {
          setErrorMsg('ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้องบนเบราว์เซอร์')
          console.error(err)
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
        
        {errorMsg ? (
          <div className="p-8 text-center text-rose-600 font-bold">
            {errorMsg}
          </div>
        ) : (
          <div id="reader" className="w-full bg-slate-900 min-h-[300px] flex items-center justify-center"></div>
        )}
      </div>
      
      {!errorMsg && (
        <p className="text-slate-400 mt-6 text-sm font-medium animate-pulse text-center">
          หันกล้องมือถือ (กล้องหลัง) ไปที่บาร์โค้ด<br/>ระบบจะสแกนให้อัตโนมัติโดยไม่ต้องกดปุ่มถ่าย
        </p>
      )}
    </div>
  )
}
