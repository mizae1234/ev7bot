'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface AuditSession {
  inspectionSessionId: number
  sessionName: string
  sessionDate: string
  location: string
  locationName?: string
  status: 'OPEN' | 'CLOSED'
  notes?: string
  createdBy: string
  inspectionCount: number
}

function getThaiDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    })
  } catch {
    return String(dateStr)
  }
}

export default function InspectionAuditPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<AuditSession[]>([])
  const [locations, setLocations] = useState<Array<{ code: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Auth User Profile State
  const [profile, setProfile] = useState<{ userId: string; displayName: string } | null>(null)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('liff_profile')
      if (cached) {
        setProfile(JSON.parse(cached))
      }
    }
  }, [])

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sessRes, locRes] = await Promise.all([
        fetch('/api/inspection/session'),
        fetch('/api/liff/locations')
      ])

      if (!sessRes.ok) throw new Error('ไม่สามารถดึงรอบการตรวจสภาพรถได้')
      
      const sessData = await sessRes.json()
      const locData = locRes.ok ? await locRes.json() : []

      setSessions(sessData.sessions || [])
      setLocations(Array.isArray(locData) ? locData : [])
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Handle Form Submission
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionName || !sessionDate || !selectedLocation) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/inspection/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName,
          sessionDate,
          location: selectedLocation,
          notes,
          lineUserId: profile?.userId,
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'สร้างรอบการตรวจไม่สำเร็จ')
      }

      // Success
      setIsModalOpen(false)
      // Reset form
      setSessionName('')
      setSessionDate(new Date().toISOString().split('T')[0])
      setSelectedLocation('')
      setNotes('')
      // Refresh list
      fetchData()
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
        
        {/* Navigation / Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 transition active:scale-95 text-xs flex items-center gap-1 shadow-sm font-medium"
              >
                <span>⬅</span> แดชบอร์ด
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  🔍 Inspection Audit Sessions
                </h1>
                <p className="text-[10px] text-slate-500 font-medium">จัดการรอบการตรวจสอบสภาพรถยนต์ไฟฟ้าประจำลานจอด</p>
              </div>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 flex items-center gap-1.5 shadow-sm"
            >
              <span>➕</span>
              สร้างรอบตรวจสภาพใหม่
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          {error && (
            <div className="p-4 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="px-5 py-4">ชื่อรอบตรวจสอบสภาพ (Session Name)</th>
                    <th className="px-5 py-4">ลานจอดรถ</th>
                    <th className="px-5 py-4">วันที่ตรวจสอบ</th>
                    <th className="px-5 py-4 text-center">รถที่ตรวจแล้ว (คัน)</th>
                    <th className="px-5 py-4 text-center">สถานะรอบ</th>
                    <th className="px-5 py-4">ผู้เปิดรอบ</th>
                    <th className="px-5 py-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          กำลังโหลดรอบการตรวจสภาพ...
                        </div>
                      </td>
                    </tr>
                  ) : sessions.length > 0 ? (
                    sessions.map((session) => {
                      const isClosed = session.status === 'CLOSED'
                      return (
                        <tr
                          key={session.inspectionSessionId}
                          onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                          className="hover:bg-slate-50 transition duration-150 cursor-pointer active:bg-slate-100"
                        >
                          {/* Session Name */}
                          <td className="px-5 py-4.5 font-bold text-slate-900 text-sm">
                            {session.sessionName}
                            {session.notes && (
                              <p className="text-[10px] text-slate-400 font-normal mt-0.5 max-w-sm truncate">{session.notes}</p>
                            )}
                          </td>

                          {/* Location */}
                          <td className="px-5 py-4.5 font-medium text-slate-600">
                            {session.locationName || session.location || '-'}
                          </td>

                          {/* Date */}
                          <td className="px-5 py-4.5 font-medium text-slate-600">
                            {getThaiDate(session.sessionDate)}
                          </td>

                          {/* Inspection Count */}
                          <td className="px-5 py-4.5 text-center font-mono font-bold text-slate-900 text-sm">
                            {session.inspectionCount}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                              isClosed
                                ? 'bg-slate-100 text-slate-500 border-slate-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {session.status}
                            </span>
                          </td>

                          {/* Creator */}
                          <td className="px-5 py-4.5 font-medium text-slate-500">
                            {session.createdBy || '-'}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4.5 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[10px] font-bold transition active:scale-95"
                            >
                              เข้าสเปซตรวจ ➡️
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-medium">
                        ยังไม่มีข้อมูลรอบการตรวจสภาพรถยนต์ในระบบ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  กำลังโหลดรอบการตรวจสภาพ...
                </div>
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => {
                const isClosed = session.status === 'CLOSED'
                return (
                  <div
                    key={session.inspectionSessionId}
                    onClick={() => router.push(`/dashboard/inspection-audit/${session.inspectionSessionId}`)}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm active:bg-slate-50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{session.sessionName}</h4>
                        <p className="text-[11px] text-slate-500 mt-1">
                          📍 {session.locationName || session.location || '-'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          📅 {getThaiDate(session.sessionDate)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider ${
                        isClosed
                          ? 'bg-slate-100 text-slate-500 border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {session.status}
                      </span>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                      <span>ตรวจแล้ว: <strong className="text-slate-900 font-mono">{session.inspectionCount}</strong> คัน</span>
                      <span className="text-[10px] text-indigo-600 font-bold">เข้าห้องตรวจ ➡️</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 font-medium bg-white border border-slate-200 rounded-2xl">
                ยังไม่มีข้อมูลรอบการตรวจสภาพรถยนต์ในระบบ
              </div>
            )}
          </div>
        </div>

        {/* Create Session Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 animate-fade-in space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">➕ สร้างรอบตรวจสภาพรถใหม่</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-4 text-xs">
                {/* Session Name */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">ชื่อรอบการตรวจสภาพ</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ตรวจสภาพรถประจำสัปดาห์ / ไตรมาส 3 ลานพระประแดง"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>

                {/* Location Select */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">สถานที่ตรวจสอบ / ลานจอด</label>
                  <select
                    required
                    value={selectedLocation}
                    onChange={e => setSelectedLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-750 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  >
                    <option value="">-- เลือกสถานที่ --</option>
                    {locations.map(loc => (
                      <option key={loc.code} value={loc.code}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">วันที่ตรวจเช็ค</label>
                  <input
                    type="date"
                    required
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-600">บันทึกเพิ่มเติม (Notes)</label>
                  <textarea
                    rows={3}
                    placeholder="รายละเอียดเพิ่มเติมของรอบตรวจ..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold transition active:scale-95"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition active:scale-95 shadow-sm"
                  >
                    {submitting ? 'กำลังสร้าง...' : 'สร้างรอบใหม่'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AuthGuard>
  )
}
