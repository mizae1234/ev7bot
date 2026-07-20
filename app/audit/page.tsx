'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface AuditSession {
  AuditSessionID: number
  AuditDate: string
  Location: string
  LocationName?: string
  Status: 'DRAFT' | 'COMPLETED' | 'CANCELED'
  CreatedBy: string
  CreateDate: string
  CheckedCount: number
}

function getThaiDate(dateStr: string): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return dateStr
  }
}

function AuditDashboard() {
  const router = useRouter()
  const [sessions, setSessions] = useState<AuditSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Dynamic Locations State
  const [locations, setLocations] = useState<Array<{ StatusCode: string, StatusName: string }>>([])
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0])
  const [location, setLocation] = useState('')
  const [customLocation, setCustomLocation] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Fetch all audit sessions
  const fetchSessions = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audit/session')
      if (!res.ok) throw new Error('ไม่สามารถดึงข้อมูลประวัติการตรวจเช็กได้')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  // Fetch master locations from DB
  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/audit/locations')
      if (res.ok) {
        const data = await res.json()
        setLocations(data.locations || [])
      }
    } catch (e) {
      console.error('Failed to fetch locations', e)
    }
  }

  useEffect(() => {
    fetchSessions()
    fetchLocations()
    
    // Seed creator name from LIFF profile cache
    try {
      const profileStr = localStorage.getItem('liff_profile')
      if (profileStr) {
        const profile = JSON.parse(profileStr)
        if (profile?.displayName) {
          // Clean "(Dev Mode)" suffix if present
          setCreatedBy(profile.displayName.replace(' (Dev Mode)', ''))
        }
      }
    } catch (e) {
      console.error('Failed to read profile', e)
    }
  }, [])

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalLocation = location === 'custom' ? customLocation : location
    if (!finalLocation) {
      alert('กรุณาระบุหรือเลือกสถานที่ตรวจเช็ก')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/audit/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: targetDate,
          location: finalLocation,
          createdBy: createdBy || 'พนักงานตรวจเช็ก',
          notes
        })
      })

      if (!res.ok) throw new Error('สร้างรอบตรวจเช็กไม่สำเร็จ')
      const data = await res.json()
      
      router.push(`/audit/${data.auditSessionId}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 font-sans pb-16">
      {/* Premium Header */}
      <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-indigo-500/20 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2">
              📋 Stock Audit System
            </h1>
            <p className="text-xs text-indigo-300 mt-0.5">ระบบตรวจสอบและบันทึกพิกัดตำแหน่งรถยนต์ไฟฟ้า</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition duration-200 shadow-md hover:shadow-lg flex items-center gap-1.5"
          >
            <span>➕</span> เริ่มตรวจเช็กใหม่
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/40 border border-indigo-500/10 rounded-2xl p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-black text-cyan-400">{sessions.length}</div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">รอบตรวจทั้งหมด</div>
          </div>
          <div className="bg-slate-800/40 border border-indigo-500/10 rounded-2xl p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-black text-amber-400">
              {sessions.filter(s => s.Status === 'DRAFT').length}
            </div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">กำลังดำเนินการ</div>
          </div>
          <div className="bg-slate-800/40 border border-indigo-500/10 rounded-2xl p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-black text-emerald-400">
              {sessions.reduce((acc, curr) => acc + curr.CheckedCount, 0)}
            </div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">รถที่สแกนแล้ว</div>
          </div>
        </div>

        {/* Sessions List */}
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">ประวัติการทำ Stock Audit</h2>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
              <div className="text-sm text-slate-400 font-medium">กำลังโหลดรายการรอบตรวจเช็ก...</div>
            </div>
          ) : error ? (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl p-4 text-sm text-center">
              ❌ {error}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-slate-800/20 border border-slate-800 rounded-2xl py-16 text-center text-slate-400">
              <div className="text-3xl mb-3">📭</div>
              <div className="text-sm font-medium">ยังไม่มีประวัติการทำ Stock Audit</div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-cyan-400 hover:text-cyan-300 text-xs font-bold underline"
              >
                กดตรงนี้เพื่อเริ่มรอบตรวจสอบครั้งแรก
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.AuditSessionID}
                  onClick={() => router.push(`/audit/${session.AuditSessionID}`)}
                  className="bg-slate-800/30 hover:bg-slate-800/50 border border-indigo-500/10 hover:border-cyan-500/30 rounded-2xl p-5 transition duration-200 cursor-pointer shadow-sm hover:shadow-md backdrop-blur-sm flex items-center justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-100">{session.LocationName || session.Location}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        session.Status === 'DRAFT'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {session.Status === 'DRAFT' ? 'กำลังดำเนินงาน' : 'เสร็จสิ้น'}
                      </span>
                    </div>
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1">📅 {getThaiDate(session.AuditDate)}</span>
                      <span className="flex items-center gap-1">👤 {session.CreatedBy}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-200">{session.CheckedCount} คัน</div>
                      <div className="text-[10px] text-slate-500">สแกนเสร็จสิ้น</div>
                    </div>
                    <span className="text-slate-500 text-lg">➔</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-slate-100">📋 สร้างรอบตรวจเช็กใหม่</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">วันที่ตรวจเช็ก</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">สถานที่ / พื้นที่จอด</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition font-medium"
                  required
                >
                  <option value="">เลือกพิกัดสถานที่...</option>
                  {locations.map((loc) => (
                    <option key={loc.StatusCode} value={loc.StatusCode}>{loc.StatusName}</option>
                  ))}
                  <option value="custom">+ พิมพ์ระบุสถานที่เอง</option>
                </select>
              </div>

              {location === 'custom' && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-bold text-slate-400 block">ระบุพิกัดสถานที่เอง</label>
                  <input
                    type="text"
                    placeholder="เช่น ลานจอดชั่วคราว C"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition"
                    required
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">พนักงานผู้บันทึก</label>
                <input
                  type="text"
                  placeholder="ใส่ชื่อหรือรหัสของคุณ"
                  value={createdBy}
                  onChange={(e) => setCreatedBy(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">บันทึกช่วยจำ (Notes)</label>
                <textarea
                  placeholder="ใส่ข้อมูลบันทึกช่วยจำเพิ่มเติม..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-cyan-400 transition h-16 resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm py-2.5 rounded-xl transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-bold text-sm py-2.5 rounded-xl transition disabled:opacity-50"
                >
                  {submitting ? 'กำลังสร้างรอบ...' : 'สร้างรอบเช็คอิน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AuditPage() {
  return (
    <AuthGuard>
      <AuditDashboard />
    </AuthGuard>
  )
}
