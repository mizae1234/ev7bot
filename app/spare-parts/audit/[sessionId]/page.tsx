'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface ScannedItem {
  AuditItemID: number
  AuditSessionID: number
  SKU: string
  PartName: string | null
  Quantity: number
  ScanTime: string
  CreatedBy: string
}

function getThaiDateTime(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    })
  } catch {
    return dateStr
  }
}

import CameraScanner from '@/components/ui/CameraScanner'

function SparePartsScanningInterface() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<any>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [loading, setLoading] = useState(true)

  const [sku, setSku] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [scanning, setScanning] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  const [catalog, setCatalog] = useState<{SKU: string, PartName: string}[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const [creatorName, setCreatorName] = useState('พนักงานตรวจเช็ก')
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchSessionData = async () => {
    try {
      const res = await fetch(`/api/spare-parts/audit/session?id=${sessionId}`)
      if (!res.ok) throw new Error('Failed to fetch session')
      const data = await res.json()
      setSession(data.session)
      setItems(data.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessionData()

    const fetchCatalog = async () => {
      try {
        const res = await fetch('/api/spare-parts')
        if (res.ok) {
          const data = await res.json()
          setCatalog(data.parts || [])
        }
      } catch (e) {
        console.error('Failed to fetch catalog', e)
      }
    }
    fetchCatalog()

    try {
      const profileStr = localStorage.getItem('liff_profile')
      if (profileStr) {
        const profile = JSON.parse(profileStr)
        if (profile?.displayName) {
          setCreatorName(profile.displayName.replace(' (Dev Mode)', ''))
        }
      }
    } catch (e) {
      console.error('Failed to read profile', e)
    }

    // Auto-focus input for barcode scanner
    setTimeout(() => {
      inputRef.current?.focus()
    }, 500)
  }, [sessionId])

  // Split out the core submission logic to support both manual and camera scanning
  const submitScan = async (scannedSku: string, scannedQty: number) => {
    if (!scannedSku.trim()) return

    setScanning(true)
    try {
      const res = await fetch('/api/spare-parts/audit/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: parseInt(sessionId),
          sku: scannedSku.trim(),
          quantity: scannedQty,
          createdBy: creatorName
        })
      })

      const data = await res.json()
      if (res.ok) {
        fetchSessionData()
        setSku('')
        setQuantity(1)
        setShowSuggestions(false)
        inputRef.current?.focus()
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึก')
        if (data.notFound) {
          inputRef.current?.focus()
        }
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    } finally {
      setScanning(false)
    }
  }

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    await submitScan(sku, quantity)
  }

  const handleCameraScan = async (decodedText: string) => {
    // Keep camera open like a real scanner gun
    await submitScan(decodedText, 1) // default 1 for camera scan
  }

  const handleUpdateQuantity = async (itemId: number, currentQty: number, delta: number) => {
    handleSetQuantity(itemId, currentQty + delta)
  }

  const handleSetQuantity = async (itemId: number, newQty: number) => {
    if (newQty <= 0) {
      handleDelete(itemId)
      return
    }

    // Optimistically update UI
    setItems(prev => prev.map(item => item.AuditItemID === itemId ? { ...item, Quantity: newQty } : item))

    try {
      const res = await fetch('/api/spare-parts/audit/item', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditItemId: itemId, quantity: newQty })
      })
      if (!res.ok) {
        alert('ปรับปรุงจำนวนไม่สำเร็จ')
        fetchSessionData()
      }
    } catch (e) {
      alert('Network error')
      fetchSessionData()
    }
  }

  const handleDelete = async (itemId: number) => {
    if (!confirm('ยืนยันการลบรายการนี้ (รีเซ็ตเป็น 0)?')) return

    try {
      const res = await fetch(`/api/spare-parts/audit/item?id=${itemId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchSessionData()
      } else {
        alert('ลบไม่สำเร็จ')
      }
    } catch (e) {
      alert('Network error')
    }
  }

  const handleFinish = async () => {
    if (!confirm('ยืนยันการจบการตรวจเช็ก?')) return
    
    try {
      const res = await fetch('/api/spare-parts/audit/session', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: parseInt(sessionId), status: 'COMPLETED' })
      })
      if (res.ok) {
        router.push('/spare-parts/audit')
      } else {
        alert('บันทึกไม่สำเร็จ')
      }
    } catch (e) {
      alert('Network error')
    }
  }

  if (loading) return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-emerald-400">Loading...</div>
  if (!session) return <div className="min-h-screen bg-slate-900 flex justify-center items-center text-rose-400">Session not found</div>

  const isCompleted = session.Status === 'COMPLETED'
  const totalItems = items.reduce((sum, item) => sum + item.Quantity, 0)

  const filteredSuggestions = sku.trim() && showSuggestions 
    ? catalog.filter(p => p.SKU.toLowerCase().includes(sku.toLowerCase()) || (p.PartName && p.PartName.toLowerCase().includes(sku.toLowerCase()))).slice(0, 15)
    : []

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24">
      
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-teal-500/20 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/spare-parts/audit')}
            className="text-slate-400 hover:text-white"
          >
            ← กลับ
          </button>
          <div className="text-center flex-1">
            <h1 className="text-base font-bold text-emerald-400">
              {session.LocationName || session.Location}
            </h1>
            <p className="text-[10px] text-slate-400">
              {getThaiDateTime(session.AuditDate)}
            </p>
          </div>
          {isCompleted ? (
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">เสร็จสิ้น</span>
          ) : (
            <button
              onClick={handleFinish}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition"
            >
              จบงาน
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Scanner Form */}
        {!isCompleted && (
          <form onSubmit={handleScan} className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-xl">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[11px] font-bold text-slate-400">สแกนรหัสอะไหล่ (SKU)</label>
                </div>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value)
                      setShowSuggestions(true)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="พิมพ์รหัส หรือ ยิงบาร์โค้ด..."
                    className="w-full bg-slate-800 border-2 border-slate-700 focus:border-emerald-500 rounded-lg pl-3 pr-12 py-3 text-lg font-mono text-emerald-300 placeholder:text-slate-600 transition outline-none relative z-10"
                    autoFocus
                  />
                  {!showCamera && (
                    <button 
                      type="button" 
                      onClick={() => setShowCamera(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 rounded-lg transition flex items-center justify-center z-20"
                      title="เปิดกล้องสแกน"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                        <circle cx="12" cy="13" r="3"></circle>
                      </svg>
                    </button>
                  )}

                  {filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-60 overflow-y-auto">
                      {filteredSuggestions.map(p => (
                        <div 
                          key={p.SKU}
                          className="px-3 py-2.5 border-b border-slate-700/50 hover:bg-slate-700 cursor-pointer flex flex-col justify-center"
                          onClick={() => {
                            setSku(p.SKU)
                            setShowSuggestions(false)
                          }}
                        >
                          <div className="font-mono font-bold text-emerald-300 text-sm">{p.SKU}</div>
                          <div className="text-xs text-slate-400 truncate">{p.PartName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">จำนวนชิ้น</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2.5 text-center text-base font-bold text-slate-200 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={scanning || !sku.trim()}
                  className="flex-[2] bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-2.5 rounded-lg shadow-lg transition disabled:opacity-50 text-sm"
                >
                  {scanning ? 'บันทึก...' : 'บันทึก (Enter)'}
                </button>
              </div>
            </div>
          </form>
        )}

        {showCamera && (
          <CameraScanner 
            onScan={handleCameraScan} 
            onClose={() => setShowCamera(false)} 
          />
        )}

        {/* List of scanned items */}
        <div>
          <div className="flex justify-between items-end mb-3 px-1">
            <h2 className="text-sm font-bold text-slate-400">รายการที่สแกนแล้ว</h2>
            <div className="text-xs font-bold bg-slate-800 px-2 py-1 rounded text-teal-300">
              รวม: {totalItems} ชิ้น
            </div>
          </div>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.AuditItemID} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 flex flex-col shadow-sm gap-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-emerald-300 truncate">
                        {item.SKU}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {item.PartName || 'ไม่พบในข้อมูลหลัก'}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {getThaiDateTime(item.ScanTime)} • {item.CreatedBy}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isCompleted && (
                      <button
                        onClick={() => handleUpdateQuantity(item.AuditItemID, item.Quantity, -1)}
                        className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-lg"
                      >
                        -
                      </button>
                    )}
                    {isCompleted ? (
                      <div className="w-12 text-center font-bold text-lg">{item.Quantity}</div>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        className="w-14 text-center font-bold text-lg bg-slate-900 border border-slate-700 rounded-lg py-1 text-slate-100 outline-none focus:border-emerald-500 transition"
                        value={item.Quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setItems(prev => prev.map(it => it.AuditItemID === item.AuditItemID ? { ...it, Quantity: val } : it));
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          handleSetQuantity(item.AuditItemID, val);
                        }}
                      />
                    )}
                    {!isCompleted && (
                      <button
                        onClick={() => handleUpdateQuantity(item.AuditItemID, item.Quantity, 1)}
                        className="w-8 h-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-lg"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-center py-10 text-slate-500 text-sm bg-slate-900/50 rounded-xl border border-dashed border-slate-700">
                ยังไม่มีการสแกนอะไหล่ในรอบนี้
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SparePartsScanningPage() {
  return (
    <AuthGuard>
      <SparePartsScanningInterface />
    </AuthGuard>
  )
}
