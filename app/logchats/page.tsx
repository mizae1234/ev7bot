'use client'

import React, { useState, useEffect } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface ChatLog {
  id: number
  sourceType: string
  sourceId: string | null
  userName: string | null
  userMessage: string
  botReply: string
  createdAt: string
}

function LogChatsContent() {
  const [passcode, setPasscode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [logs, setLogs] = useState<ChatLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState('all')
  const [users, setUsers] = useState<{ userName: string | null; sourceId: string | null }[]>([])
  const [selectedUser, setSelectedUser] = useState('all')
  const [loading, setLoading] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null)
  const [usageData, setUsageData] = useState<any>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [activeView, setActiveView] = useState<'logs' | 'costs'>('costs')

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
        if (data.role === 'SUPER_ADMIN') {
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

  // 3. Fetch logs when authenticated
  useEffect(() => {
    if (isAuthenticated && passcode && liffUserId && userRole === 'SUPER_ADMIN') {
      fetchLogs()
    }
  }, [isAuthenticated, page, sourceType, selectedUser, liffUserId, userRole])

  // Debounced search trigger
  useEffect(() => {
    if (!isAuthenticated || !passcode || !liffUserId || userRole !== 'SUPER_ADMIN') return
    const timer = setTimeout(() => {
      setPage(1)
      fetchLogs()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Polling logic
  useEffect(() => {
    if (!isAuthenticated || !passcode || !refreshInterval || !liffUserId || userRole !== 'SUPER_ADMIN') return
    const interval = setInterval(() => {
      fetchLogs()
    }, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [isAuthenticated, passcode, refreshInterval, page, search, sourceType, selectedUser, liffUserId, userRole])

  // Fetch usage/cost data
  useEffect(() => {
    if (isAuthenticated && passcode && liffUserId && userRole === 'SUPER_ADMIN') {
      fetchUsage()
    }
  }, [isAuthenticated, passcode, liffUserId, userRole])

  const fetchUsage = async () => {
    setUsageLoading(true)
    try {
      const params = new URLSearchParams({ passcode, userId: liffUserId || '' })
      const res = await fetch(`/api/chat-logs/usage?${params}`)
      if (res.ok) {
        const data = await res.json()
        setUsageData(data)
      }
    } catch (err) {
      console.error('Failed to fetch usage', err)
    } finally {
      setUsageLoading(false)
    }
  }

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        passcode,
        userId: liffUserId || '',
        page: String(page),
        limit: '20',
        search,
        sourceType,
        user: selectedUser !== 'all' ? selectedUser : '',
      })
      const res = await fetch(`/api/chat-logs?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false)
          sessionStorage.removeItem('logchats_passcode')
          setError('รหัสผ่านไม่ถูกต้อง')
        } else if (res.status === 403) {
          setError('คุณไม่มีสิทธิ์เข้าถึง (ต้องการสิทธิ์ Super Admin)')
        } else {
          setError('เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
        return
      }
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
      setTotalPages(data.totalPages || 1)
      if (data.users) {
        setUsers(data.users)
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

  const formatDateTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Bangkok',
      })
    } catch {
      return dateStr
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

  // 5. Restrict access strictly to SUPER_ADMIN
  if (userRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 text-center">
        <span className="text-5xl mb-4">🔑</span>
        <h1 className="text-xl font-bold text-zinc-100 mb-2">เข้าถึงเฉพาะ Super Admin</h1>
        <p className="text-sm text-zinc-500 max-w-sm">คุณไม่มีสิทธิ์เข้าใช้งานระบบประวัติการแชท</p>
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
            <span className="inline-block text-4xl mb-3">💬</span>
            <h1 className="text-xl font-bold text-zinc-100">ระบบตรวจสอบการสนทนา</h1>
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
                💬 Chat Logs
              </h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-md font-bold">
                Admin Only
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              ประวัติการถามตอบระหว่างผู้ใช้และ Butter Line Bot / Web Chat
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            <button
              onClick={() => {
                sessionStorage.removeItem('logchats_passcode')
                setIsAuthenticated(false)
                setPasscode('')
                setLogs([])
              }}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-all"
            >
              ออกจากระบบ 🚪
            </button>
            <a 
              href="/users"
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-855 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-100 transition-all"
            >
              👥 จัดการสิทธิ์
            </a>
            <a 
              href="/issues"
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-855 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-100 transition-all"
            >
              🐞 ระบบแจ้งบัค
            </a>
            <a 
              href="/tasks"
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-zinc-855 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-100 transition-all"
            >
              📋 จัดการภารกิจ
            </a>
            <a 
              href="/dashboard"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-100 border border-zinc-800 transition-all"
            >
              ← แดชบอร์ด EV7
            </a>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('costs')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
              activeView === 'costs'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            💰 AI Cost Tracking
          </button>
          <button
            onClick={() => setActiveView('logs')}
            className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
              activeView === 'logs'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            💬 Chat Logs
          </button>
        </div>

        {/* ═══════ AI Cost Tracking Dashboard ═══════ */}
        {activeView === 'costs' && (
          <div className="space-y-4 animate-fade-in">
            {/* Summary Cards */}
            {usageData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* This Month */}
                  <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-5 shadow-lg">
                    <p className="text-[11px] text-zinc-500 font-semibold mb-1">ค่าใช้จ่ายเดือนนี้</p>
                    <p className="text-2xl font-extrabold text-amber-400">฿{usageData.thisMonth.totalCostTHB?.toFixed(2) || '0.00'}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {((usageData.thisMonth.totalTokens || 0) / 1000).toFixed(1)}K tokens · {usageData.thisMonth.questions || 0} คำถาม
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">≈ ${usageData.thisMonth.totalCost?.toFixed(4) || '0.0000'} USD</p>
                  </div>

                  {/* Today */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                    <p className="text-[11px] text-zinc-500 font-semibold mb-1">วันนี้</p>
                    <p className="text-2xl font-extrabold text-emerald-400">฿{usageData.today.totalCostTHB?.toFixed(2) || '0.00'}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {((usageData.today.totalTokens || 0) / 1000).toFixed(1)}K tokens · {usageData.today.questions || 0} คำถาม
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">≈ ${usageData.today.totalCost?.toFixed(4) || '0.0000'} USD</p>
                  </div>

                  {/* Last 7 Days */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                    <p className="text-[11px] text-zinc-500 font-semibold mb-1">7 วันที่ผ่านมา</p>
                    <p className="text-2xl font-extrabold text-sky-400">฿{usageData.last7Days.totalCostTHB?.toFixed(2) || '0.00'}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {((usageData.last7Days.totalTokens || 0) / 1000).toFixed(1)}K tokens · {usageData.last7Days.questions || 0} คำถาม
                    </p>
                    <p className="text-[9px] text-zinc-600 mt-0.5">≈ ${usageData.last7Days.totalCost?.toFixed(4) || '0.0000'} USD</p>
                  </div>
                </div>

                {/* Model Breakdown (This Month) */}
                {usageData.thisMonth.modelBreakdown && Object.keys(usageData.thisMonth.modelBreakdown).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(usageData.thisMonth.modelBreakdown).map(([model, data]: [string, any]) => {
                      const pricing = usageData.pricing?.models?.[model]
                      const isLite = model.includes('lite')
                      return (
                        <div key={model} className={`rounded-xl border ${isLite ? 'border-emerald-500/20' : 'border-purple-500/20'} bg-zinc-900/40 p-3`}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${isLite ? 'bg-emerald-500/15 text-emerald-400' : 'bg-purple-500/15 text-purple-400'}`}>
                              {model}
                            </span>
                            <span className="text-[9px] text-zinc-600">{data.count} คำถาม</span>
                          </div>
                          <div className="flex items-baseline gap-3">
                            <span className={`text-sm font-bold ${isLite ? 'text-emerald-400' : 'text-purple-400'}`}>
                              ฿{(data.costUSD * (usageData.pricing?.exchangeRate || 34)).toFixed(2)}
                            </span>
                            <span className="text-[9px] text-zinc-600">
                              ${data.costUSD.toFixed(6)}
                            </span>
                          </div>
                          {pricing && (
                            <p className="text-[8px] text-zinc-600 mt-1">
                              rate: in ${pricing.input}/1M · out ${pricing.output}/1M
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Pricing Info */}
                <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-500 px-1">
                  <span className="text-amber-500/70">⚡</span>
                  {usageData.pricing?.models && Object.entries(usageData.pricing.models).slice(0, 2).map(([model, p]: [string, any]) => (
                    <span key={model} className="text-zinc-500">
                      <span className="text-zinc-400 font-mono text-[9px]">{model.replace('gemini-', '')}</span>
                      {' '}in ${p.input} · out ${p.output}
                    </span>
                  ))}
                  <span className="text-zinc-700">|</span>
                  <span><span className="text-zinc-400 font-semibold">{usageData.pricing?.exchangeRate} บาท/USD</span></span>
                  <button onClick={fetchUsage} className="ml-auto text-[10px] text-zinc-600 hover:text-emerald-400 transition">🔄 รีเฟรช</button>
                </div>

                {/* Recent Logs Table */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-300">📊 คำถามล่าสุด {usageData.recentLogs?.length || 0} รายการ</h3>
                    <span className="text-[10px] text-zinc-600">เฉพาะที่มีข้อมูล Token</span>
                  </div>
                  <div className="divide-y divide-zinc-800/50 max-h-[600px] overflow-y-auto">
                    {usageData.recentLogs?.length > 0 ? (
                      usageData.recentLogs.map((log: any) => (
                        <div key={log.id} className="px-4 py-3 hover:bg-zinc-800/30 transition flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-zinc-400">{log.userName || 'Unknown'}</span>
                              {log.modelName && (
                                <span className={`text-[8px] font-mono px-1 rounded ${
                                  log.modelName.includes('lite') ? 'bg-emerald-500/15 text-emerald-500' : 'bg-purple-500/15 text-purple-400'
                                }`}>{log.modelName.replace('gemini-', '')}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-zinc-400 truncate">{log.userMessage}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-[9px] text-zinc-600">
                                in {(log.inputTokens || 0).toLocaleString()} · out {(log.outputTokens || 0).toLocaleString()} · {(log.totalTokens || 0).toLocaleString()} tokens
                              </span>
                              {log.responseTimeMs && (
                                <span className="text-[9px] text-zinc-700">{log.responseTimeMs}ms</span>
                              )}
                              <span className="text-[9px] text-zinc-600">
                                {new Date(log.createdAt).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-xs font-bold ${
                              (log.costTHB || 0) > 0.5 ? 'text-rose-400' :
                              (log.costTHB || 0) > 0.1 ? 'text-amber-400' :
                              'text-emerald-400'
                            }`}>
                              ฿{(log.costTHB || 0).toFixed(4)}
                            </span>
                            <p className="text-[8px] text-zinc-600">${(log.costUSD || 0).toFixed(6)}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <p className="text-xs text-zinc-600">ยังไม่มีข้อมูล Token — ข้อมูลจะเริ่มปรากฏหลังจาก DB schema ถูกอัปเดต</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : usageLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-xs text-zinc-600">ไม่สามารถโหลดข้อมูลค่าใช้จ่ายได้</p>
              </div>
            )}
          </div>
        )}

        {activeView === 'logs' && (
        <>
        {/* ═══════ Original Chat Logs Section ═══════ */}

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900">
          <div>
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ค้นหาคำสำคัญ</label>
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้ใช้, ข้อความ, คำตอบ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">เลือกผู้ใช้</label>
            <select
              value={selectedUser}
              onChange={(e) => {
                setPage(1)
                setSelectedUser(e.target.value)
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            >
              <option value="all">ทั้งหมด</option>
              {users.map((u, idx) => {
                const value = u.sourceId || u.userName || ''
                const label = u.userName 
                  ? `${u.userName}${u.sourceId ? ` (${u.sourceId.substring(0, 8)})` : ''}`
                  : `ID: ${u.sourceId ? u.sourceId.substring(0, 15) : 'ไม่ระบุ'}`
                return (
                  <option key={idx} value={value}>
                    {label}
                  </option>
                )
              })}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ช่องทางการถาม</label>
            <select
              value={sourceType}
              onChange={(e) => {
                setPage(1)
                setSourceType(e.target.value)
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            >
              <option value="all">ทั้งหมด</option>
              <option value="line">LINE Bot</option>
              <option value="web">Web Chat</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">รีเฟรชอัตโนมัติ</label>
            <select
              value={refreshInterval || 'none'}
              onChange={(e) => {
                const val = e.target.value
                setRefreshInterval(val === 'none' ? null : parseInt(val))
              }}
              className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-800 bg-zinc-950/70 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all"
            >
              <option value="none">ปิดการใช้งาน</option>
              <option value="5">ทุกๆ 5 วินาที</option>
              <option value="15">ทุกๆ 15 วินาที</option>
              <option value="30">ทุกๆ 30 วินาที</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="space-y-4">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center font-medium">
              {error}
            </div>
          )}

          {loading && logs.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-500">กำลังดึงข้อมูลประวัติการคุย...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-zinc-900 bg-zinc-900/10 text-zinc-500 text-sm">
              📭 ไม่พบประวัติการสนทนาตามคำค้นหา
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className="rounded-2xl border border-zinc-900 bg-zinc-900/20 hover:border-zinc-800/80 p-5 space-y-4 transition-all duration-200"
                >
                  {/* Meta header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900/60 pb-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold tracking-wider ${
                        log.sourceType === 'line' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : log.sourceType.endsWith('broadcast')
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {log.sourceType.toUpperCase()}
                      </span>
                      <span className="font-semibold text-zinc-350">
                        👤 {log.userName || 'ไม่ระบุชื่อ'}
                      </span>
                      {log.sourceId && (
                        <span className="text-[10px] text-zinc-650">
                          (ID: {log.sourceId})
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      🕒 {formatDateTime(log.createdAt)}
                    </span>
                  </div>

                  {/* Message body */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User prompt */}
                    <div className="space-y-1">
                      <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider">ข้อความผู้ใช้</span>
                      <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-900/40 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed">
                        {log.userMessage}
                      </div>
                    </div>

                    {/* Bot reply */}
                    <div className="space-y-1">
                      <span className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider">คำตอบจาก Butter 🧈</span>
                      <div className="p-3.5 rounded-2xl bg-emerald-950/10 border border-emerald-900/15 text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {log.botReply}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                itemsPerPage={20}
              />
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}

export default function LogChatsPage() {
  return (
    <AuthGuard>
      <LogChatsContent />
    </AuthGuard>
  )
}
