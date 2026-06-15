'use client'

import React, { useState, useEffect } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface SystemIssue {
  id: number
  lineUserId: string | null
  displayName: string | null
  description: string
  status: string
  sourceType: string | null
  sourceId: string | null
  createdAt: string
  resolvedAt: string | null
}

function IssuesContent() {
  const [passcode, setPasscode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<SystemIssue[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [summary, setSummary] = useState({ open: 0, resolved: 0, cancelled: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Auth / Role States
  const [userRole, setUserRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [liffUserId, setLiffUserId] = useState<string | null>(null)

  // 1. Authenticate role via user's LINE ID in AuthGuard cache
  useEffect(() => {
    const cachedProfile = localStorage.getItem('liff_profile')
    if (cachedProfile) {
      try {
        const profile = JSON.parse(cachedProfile)
        if (profile.userId) {
          setLiffUserId(profile.userId)
          fetchRole(profile.userId)
          return
        }
      } catch (e) {
        console.error('Failed to parse liff_profile', e)
      }
    }
    setRoleLoading(false)
  }, [])

  const fetchRole = async (uid: string) => {
    try {
      const res = await fetch(`/api/auth/role?userId=${uid}`)
      if (res.ok) {
        const data = await res.json()
        setUserRole(data.role)
        if (data.role === 'ADMIN' || data.role === 'SUPER_ADMIN') {
          setPasscode('ev7admin')
          setIsAuthenticated(true)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('logchats_passcode', 'ev7admin')
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch user role', err)
    } finally {
      setRoleLoading(false)
    }
  }

  // 2. Passcode cache initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('logchats_passcode')
      if (cached) {
        setPasscode(cached)
        setIsAuthenticated(true)
      }
    }
  }, [])

  // 3. Fetch issues when authenticated and role is valid
  useEffect(() => {
    if (isAuthenticated && passcode && liffUserId && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
      fetchIssues()
    }
  }, [isAuthenticated, page, statusFilter, liffUserId, userRole])

  // Debounced search trigger
  useEffect(() => {
    if (!isAuthenticated || !passcode || !liffUserId || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) return
    const timer = setTimeout(() => {
      setPage(1)
      fetchIssues()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchIssues = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        passcode,
        userId: liffUserId || '',
        page: String(page),
        limit: '20',
        search,
        status: statusFilter,
      })
      const res = await fetch(`/api/system-issues?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false)
          sessionStorage.removeItem('logchats_passcode')
          setError('รหัสผ่านไม่ถูกต้อง')
        } else if (res.status === 403) {
          setError('คุณไม่มีสิทธิ์เข้าถึง (ต้องการสิทธิ์ Admin หรือ Super Admin)')
        } else {
          setError('เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
        return
      }
      const data = await res.json()
      setIssues(data.issues || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.summary) {
        setSummary(data.summary)
      }
      setError('')
    } catch (err) {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (passcode === 'ev7admin') {
      setIsAuthenticated(true)
      setError('')
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('logchats_passcode', passcode)
      }
    } else {
      setError('รหัสผ่านไม่ถูกต้อง')
    }
  }

  const handleAction = async (id: number, action: 'resolve' | 'cancel') => {
    if (action === 'cancel' && !confirm('คุณต้องการยกเลิกการแจ้งปัญหานี้ใช่หรือไม่?')) return
    setActionLoading(id)
    try {
      const res = await fetch('/api/system-issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, passcode, userId: liffUserId })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถดำเนินการได้'}`)
      } else {
        await fetchIssues()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
      })
    } catch {
      return dateStr
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            ⏳ รอดำเนินการ
          </span>
        )
      case 'RESOLVED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✅ แก้ไขแล้ว
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
            🚫 ยกเลิกแล้ว
          </span>
        )
    }
  }

  // 4. Access Control check during role loading
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 font-medium animate-pulse">กำลังตรวจสอบระดับสิทธิ์เข้าใช้งาน...</p>
        </div>
      </div>
    )
  }

  // 5. Restrict access strictly to ADMIN or SUPER_ADMIN
  if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 text-center">
        <span className="text-5xl mb-4">🛡️</span>
        <h1 className="text-xl font-bold text-zinc-100 mb-2">เข้าถึงเฉพาะผู้ดูแลระบบ (Admin)</h1>
        <p className="text-sm text-zinc-500 max-w-sm">คุณไม่มีสิทธิ์เข้าใช้งานระบบจัดการปัญหาและแจ้งบัค</p>
        <a href="/dashboard" className="mt-6 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white transition-all shadow-md">
          กลับหน้าหลักแดชบอร์ด
        </a>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <form 
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-md"
        >
          <div className="text-center mb-6">
            <span className="inline-block text-4xl mb-3">🐞</span>
            <h1 className="text-xl font-bold text-zinc-100">ระบบประวัติการแจ้งปัญหา</h1>
            <p className="text-xs text-zinc-500 mt-1">กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="รหัสผ่าน"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-800 bg-zinc-950/50 text-zinc-200 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-rose-500 text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98]"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 pb-12">
      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-emerald-400 tracking-tight">
                🐞 Bug & Issue Reports
              </h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-md font-bold">
                Admin Panel
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              รายการแจ้งบัคหรือปัญหาการใช้งานระบบจาก LINE Bot
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            <button
              onClick={() => {
                sessionStorage.removeItem('logchats_passcode')
                setIsAuthenticated(false)
                setPasscode('')
                setIssues([])
              }}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-all"
            >
              ออกจากระบบ 🚪
            </button>
            {userRole === 'SUPER_ADMIN' && (
              <>
                <a 
                  href="/users"
                  className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition-all"
                >
                  👥 จัดการสิทธิ์
                </a>
                <a 
                  href="/logchats"
                  className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition-all"
                >
                  💬 ประวัติคุย LINE
                </a>
              </>
            )}
            <a 
              href="/tasks"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition-all"
            >
              📋 จัดการภารกิจ
            </a>
            <a 
              href="/dashboard"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold transition-all shadow-md"
            >
              ← แดชบอร์ด EV7
            </a>
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">ทั้งหมด</span>
            <span className="text-2xl font-extrabold text-zinc-100 mt-2">{summary.total}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">⏳ รอดำเนินการ</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-2">{summary.open}</span>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-wider">✅ แก้ไขเสร็จสิ้น</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-2">{summary.resolved}</span>
          </div>
          <div className="bg-zinc-900/10 border border-zinc-800/40 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">🚫 ยกเลิกแล้ว</span>
            <span className="text-2xl font-extrabold text-zinc-500 mt-2">{summary.cancelled}</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900">
          <div className="md:col-span-2">
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ค้นหาคำสำคัญ</label>
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้แจ้ง, ปัญหา หรือ LINE User ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">สถานะ</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1)
                setStatusFilter(e.target.value)
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            >
              <option value="all">ทั้งหมด</option>
              <option value="OPEN">รอดำเนินการ</option>
              <option value="RESOLVED">แก้ไขแล้ว</option>
              <option value="CANCELLED">ยกเลิกแล้ว</option>
            </select>
          </div>
        </div>

        {/* Issues List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-rose-500 text-sm font-medium">{error}</div>
        ) : issues.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-850 rounded-2xl text-zinc-500 text-sm">
            ไม่พบรายการแจ้งปัญหาใดๆ ในขณะนี้
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <div 
                key={issue.id}
                className="bg-zinc-900/20 border border-zinc-900 hover:border-zinc-800/80 rounded-2xl p-5 md:p-6 transition-all duration-200 backdrop-blur-sm shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-zinc-900/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100"># {issue.id}</span>
                      {getStatusBadge(issue.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                      <span>👤 ผู้รายงาน: <span className="text-zinc-300 font-semibold">{issue.displayName || 'ไม่ระบุชื่อ'}</span></span>
                      {issue.lineUserId && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-zinc-650 bg-zinc-950/45 px-1.5 py-0.5 rounded">ID: {issue.lineUserId}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-zinc-500 space-y-0.5">
                    <div>📅 แจ้งเมื่อ: {formatDateTime(issue.createdAt)}</div>
                    {issue.resolvedAt && (
                      <div className="text-emerald-500/80 font-medium">✅ เสร็จสิ้น: {formatDateTime(issue.resolvedAt)}</div>
                    )}
                  </div>
                </div>

                <div className="py-4 text-sm text-zinc-200 leading-relaxed font-medium">
                  {issue.description}
                </div>

                {/* Footer Metadata & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-900/40 text-[11px]">
                  <div className="text-zinc-500">
                    📂 แหล่งที่มา: {' '}
                    <span className="font-semibold text-zinc-400 capitalize">{issue.sourceType || 'แชทส่วนตัว'}</span>
                    {issue.sourceId && (
                      <span className="font-mono text-[10px] bg-zinc-950/30 px-1.5 py-0.5 rounded ml-1 text-zinc-500">ID: {issue.sourceId}</span>
                    )}
                  </div>

                  {issue.status === 'OPEN' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(issue.id, 'cancel')}
                        disabled={actionLoading === issue.id}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 transition-all font-bold disabled:opacity-50"
                      >
                        🚫 ยกเลิก
                      </button>
                      <button
                        onClick={() => handleAction(issue.id, 'resolve')}
                        disabled={actionLoading === issue.id}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all font-bold shadow-md disabled:opacity-50"
                      >
                        {actionLoading === issue.id ? 'กำลังบันทึก...' : '✅ แก้ไขเสร็จสิ้น'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pt-4">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={(p) => setPage(p)}
                  totalItems={total}
                  itemsPerPage={20}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default function IssuesPage() {
  return (
    <AuthGuard>
      <IssuesContent />
    </AuthGuard>
  )
}
