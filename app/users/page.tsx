'use client'

import React, { useState, useEffect } from 'react'
import { Pagination } from '@/components/ui/Pagination'

interface RegisteredUser {
  id: number
  lineUserId: string
  displayName: string | null
  pictureUrl: string | null
  statusMessage: string | null
  system: string
  isActive: boolean
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'
  registeredAt: string
  updatedAt: string
}

export default function UserManagementPage() {
  const [passcode, setPasscode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [summary, setSummary] = useState({ totalSuperAdmin: 0, totalAdmin: 0, totalUser: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null) // lineUserId
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('logchats_passcode')
      if (cached) {
        setPasscode(cached)
        setIsAuthenticated(true)
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && passcode) {
      fetchUsers()
    }
  }, [isAuthenticated, page, roleFilter, statusFilter])

  // Debounced search trigger
  useEffect(() => {
    if (!isAuthenticated || !passcode) return
    const timer = setTimeout(() => {
      setPage(1)
      fetchUsers()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        passcode,
        page: String(page),
        limit: '20',
        search,
        role: roleFilter,
        status: statusFilter,
      })
      const res = await fetch(`/api/admin/users?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false)
          sessionStorage.removeItem('logchats_passcode')
          setError('รหัสผ่านไม่ถูกต้อง')
        } else {
          setError('เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
        return
      }
      const data = await res.json()
      setUsers(data.users || [])
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

  const handleRoleChange = async (lineUserId: string, newRole: string) => {
    setActionLoading(lineUserId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, role: newRole, passcode })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถแก้ไขสิทธิ์ได้'}`)
      } else {
        await fetchUsers()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStatusToggle = async (lineUserId: string, currentActive: boolean) => {
    setActionLoading(lineUserId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId, isActive: !currentActive, passcode })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถแก้ไขสถานะได้'}`)
      } else {
        await fetchUsers()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
            🔑 Super Admin
          </span>
        )
      case 'ADMIN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
            🛡️ Admin
          </span>
        )
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700/60">
            👤 User
          </span>
        )
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <form 
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-md"
        >
          <div className="text-center mb-6">
            <span className="inline-block text-4xl mb-3">👥</span>
            <h1 className="text-xl font-bold text-zinc-100">จัดการสิทธิ์ / ผู้ใช้</h1>
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
                👥 User Management
              </h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-md font-bold">
                Admin Settings
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              จัดการบทบาทหน้าที่และสิทธิ์การเข้าใช้งานของบัญชี LINE
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            <button
              onClick={() => {
                sessionStorage.removeItem('logchats_passcode')
                setIsAuthenticated(false)
                setPasscode('')
                setUsers([])
              }}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-all"
            >
              ออกจากระบบ 🚪
            </button>
            <a 
              href="/issues"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition-all"
            >
              🐞 ระบบแจ้งบัค
            </a>
            <a 
              href="/logchats"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition-all"
            >
              💬 ประวัติคุย LINE
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
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">สมาชิกทั้งหมด</span>
            <span className="text-2xl font-extrabold text-zinc-100 mt-2">{summary.total}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">🔑 Super Admin</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-2">{summary.totalSuperAdmin}</span>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-wider">🛡️ Admin</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-2">{summary.totalAdmin}</span>
          </div>
          <div className="bg-zinc-900/10 border border-zinc-800/45 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">👤 User ทั่วไป</span>
            <span className="text-2xl font-extrabold text-zinc-400 mt-2">{summary.totalUser}</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900">
          <div className="md:col-span-2">
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ค้นหาผู้ใช้งาน</label>
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ใช้ หรือ LINE User ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">สิทธิ์</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setPage(1)
                setRoleFilter(e.target.value)
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            >
              <option value="all">ทั้งหมด</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="USER">User</option>
            </select>
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
              <option value="active">เปิดใช้งาน</option>
              <option value="inactive">ระงับการใช้งาน</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-rose-500 text-sm font-medium">{error}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-850 rounded-2xl text-zinc-500 text-sm">
            ไม่พบรายชื่อผู้ใช้งานใดๆ ในขณะนี้
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <div 
                key={user.id}
                className={`bg-zinc-900/20 border ${user.isActive ? 'border-zinc-900 hover:border-zinc-800/80' : 'border-rose-950/40 opacity-70'} rounded-2xl p-5 md:p-6 transition-all duration-200 backdrop-blur-sm shadow-sm`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* User Profile */}
                  <div className="flex items-center gap-4">
                    {user.pictureUrl ? (
                      <img 
                        src={user.pictureUrl} 
                        alt={user.displayName || 'LINE User'} 
                        className="w-12 h-12 rounded-full object-cover border border-zinc-800"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150'
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold border border-zinc-700">
                        {user.displayName ? user.displayName.substring(0, 2).toUpperCase() : 'LN'}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-zinc-100 text-base">{user.displayName || 'ผู้ใช้ LINE'}</span>
                        {getRoleBadge(user.role)}
                        {!user.isActive && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25">
                            🚫 ระงับการใช้
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                        <span className="truncate max-w-[200px] md:max-w-xs">{user.lineUserId}</span>
                        <button
                          onClick={() => handleCopyId(user.lineUserId)}
                          className="text-[10px] bg-zinc-950/45 px-1.5 py-0.5 rounded border border-zinc-850 hover:bg-zinc-900 hover:text-zinc-300 active:scale-95 transition-all"
                        >
                          {copiedId === user.lineUserId ? 'คัดลอกแล้ว! ✅' : 'คัดลอก 📋'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex flex-wrap items-center gap-4 justify-between md:justify-end border-t border-zinc-900/60 md:border-none pt-4 md:pt-0">
                    <div className="text-[11px] text-zinc-500">
                      📅 ลงทะเบียนเมื่อ: <span className="text-zinc-400 font-medium">{formatDateTime(user.registeredAt)}</span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {/* Role drop-down */}
                      <select
                        value={user.role}
                        disabled={actionLoading === user.lineUserId}
                        onChange={(e) => handleRoleChange(user.lineUserId, e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all cursor-pointer font-bold disabled:opacity-50"
                      >
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SUPER_ADMIN">Super Admin</option>
                      </select>

                      {/* Active toggle */}
                      <button
                        onClick={() => handleStatusToggle(user.lineUserId, user.isActive)}
                        disabled={actionLoading === user.lineUserId}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95 ${
                          user.isActive
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                        }`}
                      >
                        {user.isActive ? 'ระงับการใช้งาน 🚫' : 'เปิดการใช้งาน 🟢'}
                      </button>
                    </div>
                  </div>
                </div>

                {user.statusMessage && (
                  <div className="mt-3.5 text-xs text-zinc-500 bg-zinc-950/20 px-3 py-2 rounded-xl border border-zinc-950 max-w-2xl italic">
                    💬 {user.statusMessage}
                  </div>
                )}
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
