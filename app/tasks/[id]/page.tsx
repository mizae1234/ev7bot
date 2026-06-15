'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface TaskNote {
  id: number
  vehicleRef: string | null
  assigneeName: string
  taskDetail: string
  dueDate: string | null
  status: string
  createUserId: string | null
  createUserName: string | null
  createdAt: string
  completedAt: string | null
  alertTarget: string
  groupId: string | null
  assigneeLineUserId: string | null
  lastAlertedAt: string | null
}

function TaskDetailContent() {
  const params = useParams()
  const router = useRouter()
  const taskId = params.id as string

  const [passcode, setPasscode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [task, setTask] = useState<TaskNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

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
        if (data.role === 'USER' || data.role === 'ADMIN' || data.role === 'SUPER_ADMIN') {
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

  // 3. Fetch task details when authenticated
  useEffect(() => {
    if (isAuthenticated && passcode && liffUserId && (userRole === 'USER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
      fetchTask()
    }
  }, [isAuthenticated, liffUserId, userRole, taskId])

  const fetchTask = async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        passcode,
        userId: liffUserId || '',
        id: taskId
      })
      const res = await fetch(`/api/tasks?${queryParams.toString()}`)
      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false)
          sessionStorage.removeItem('logchats_passcode')
          setError('รหัสผ่านไม่ถูกต้อง')
        } else if (res.status === 403) {
          setError('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')
        } else {
          setError('ไม่พบภารกิจหรือเกิดข้อผิดพลาดในการโหลดข้อมูล')
        }
        return
      }
      const data = await res.json()
      if (data.tasks && data.tasks.length > 0) {
        setTask(data.tasks[0])
      } else {
        setError('ไม่พบภารกิจรหัสนี้ในระบบ')
      }
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

  const handleCompleteTask = async () => {
    if (!task) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, action: 'resolve', passcode, userId: liffUserId })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถแก้ไขสถานะได้'}`)
      } else {
        await fetchTask()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendReminder = async () => {
    if (!task) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/tasks/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, passcode, userId: liffUserId })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถส่งข้อความเตือนได้'}`)
      } else {
        alert('ส่งข้อความเตือนเรียบร้อยแล้วค่ะ! 🔔💛')
        await fetchTask()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(false)
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

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Bangkok',
      })
    } catch {
      return dateStr
    }
  }

  const getDueDateBadge = (dueDateStr: string | null, status: string) => {
    if (status === 'COMPLETED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
          ✅ เสร็จเรียบร้อย
        </span>
      )
    }
    if (!dueDateStr) return <span className="text-zinc-500">-</span>

    try {
      const nowParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(new Date())
      const nowY = Number(nowParts.find(p => p.type === 'year')?.value ?? 0)
      const nowM = Number(nowParts.find(p => p.type === 'month')?.value ?? 0)
      const nowD = Number(nowParts.find(p => p.type === 'day')?.value ?? 0)
      const bkkTodayMidnight = new Date(nowY, nowM - 1, nowD)

      const due = new Date(dueDateStr)
      const dueParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      }).formatToParts(due)
      const dueY = Number(dueParts.find(p => p.type === 'year')?.value ?? 0)
      const dueM = Number(dueParts.find(p => p.type === 'month')?.value ?? 0)
      const dueD = Number(dueParts.find(p => p.type === 'day')?.value ?? 0)
      const bkkDueMidnight = new Date(dueY, dueM - 1, dueD)

      const diffTime = bkkDueMidnight.getTime() - bkkTodayMidnight.getTime()
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

      if (diffDays < 0) {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold">
            🚨 เกินกำหนด ({Math.abs(diffDays)} วัน)
          </span>
        )
      } else if (diffDays === 0) {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
            📅 ครบกำหนดวันนี้
          </span>
        )
      } else {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 font-bold">
            ⏳ อีก {diffDays} วัน
          </span>
        )
      }
    } catch {
      return <span className="text-zinc-400">{formatDateShort(dueDateStr)}</span>
    }
  }

  // Access Control check
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">กำลังตรวจสอบระดับสิทธิ์เข้าใช้งาน...</p>
        </div>
      </div>
    )
  }

  if (userRole !== 'USER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 text-center">
        <span className="text-5xl mb-4">🛡️</span>
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">ไม่ได้รับอนุญาตให้เข้าถึง</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้</p>
        <a href="/dashboard" className="mt-6 px-4 py-2 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-bold text-zinc-950 transition-all shadow-md">
          กลับหน้าหลักแดชบอร์ด
        </a>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <form 
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-md"
        >
          <div className="text-center mb-6">
            <span className="inline-block text-4xl mb-3">📋</span>
            <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">ดูรายละเอียดภารกิจ</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-450 mt-1">กรุณากรอกรหัสผ่านเพื่อเข้าชมข้อมูล</p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="รหัสผ่าน"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 text-zinc-800 dark:text-zinc-200 text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-xs text-rose-500 text-center font-medium">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-md transition-all active:scale-[0.98]"
            >
              ยืนยันรหัสผ่าน
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 flex flex-col justify-start items-center p-4 pt-12 md:pt-20">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xl backdrop-blur-md overflow-hidden">
        
        {/* Banner mimic LINE Flex Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 text-zinc-950 flex justify-between items-center">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">📋 รายละเอียดภารกิจ</h2>
            <p className="text-[10px] text-zinc-950/75 font-semibold mt-0.5">รหัสอ้างอิง ID #{taskId}</p>
          </div>
          <span className="text-xs font-black bg-zinc-950 text-amber-500 px-2.5 py-1 rounded-full shadow-md">
            EV7 Team
          </span>
        </div>

        {/* Body content */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-16 px-6 space-y-4">
            <p className="text-rose-500 dark:text-rose-400 text-sm font-semibold">{error}</p>
            <button
              onClick={() => router.push('/tasks')}
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-350 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
            >
              ← ไปที่หน้ารวมภารกิจ
            </button>
          </div>
        ) : task ? (
          <div className="p-6 space-y-6">
            
            {/* Meta Cards Row */}
            <div className="flex justify-between items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-zinc-450 dark:text-zinc-400">สถานะ:</span>
                {task.status === 'COMPLETED' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    เสร็จสิ้น
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                    รอดำเนินการ
                  </span>
                )}
              </div>
              
              {/* Overdue Check */}
              <div>{getDueDateBadge(task.dueDate, task.status)}</div>
            </div>

            {/* Main Task Description */}
            <div className="bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-5 space-y-1.5">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">รายละเอียดภารกิจ</span>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-relaxed whitespace-pre-wrap">{task.taskDetail}</p>
            </div>

            {/* Info Fields list */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">🚗 รถยนต์ / VIN:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {task.vehicleRef ? (
                    <span className="px-2.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                      {task.vehicleRef}
                    </span>
                  ) : (
                    <span className="text-zinc-450 dark:text-zinc-500">- (ทั่วไป)</span>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">👤 ผู้รับผิดชอบ:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{task.assigneeName}</span>
              </div>

              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">📅 กำหนดเสร็จ:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatDateShort(task.dueDate)}</span>
              </div>

              <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">✍️ บันทึกโดย:</span>
                <span className="font-bold text-zinc-600 dark:text-zinc-400">
                  {task.createUserName || 'LINE Bot'} ({formatDateTime(task.createdAt)})
                </span>
              </div>

              {task.completedAt && (
                <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                  <span className="text-emerald-600 dark:text-emerald-450 font-semibold">✅ วันเสร็จสิ้น:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatDateTime(task.completedAt)}</span>
                </div>
              )}

              {task.alertTarget && task.alertTarget !== 'NONE' && (
                <>
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">📢 ช่องทางแจ้งเตือน:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {task.alertTarget === 'GROUP' ? 'กลุ่มไลน์' : 'แชทส่วนตัว'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-2.5 border-b border-zinc-200 dark:border-zinc-850">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">🔔 เตือนล่าสุดเมื่อ:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {task.lastAlertedAt ? formatDateTime(task.lastAlertedAt) : 'ยังไม่เคยส่งเตือน'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5 pt-4">
              {task.status === 'PENDING' && task.alertTarget && task.alertTarget !== 'NONE' && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                <button
                  onClick={handleSendReminder}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-2xl border border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>🔔 ส่งข้อความเตือนไปยัง LINE</>
                  )}
                </button>
              )}

              {task.status === 'PENDING' && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                <button
                  onClick={handleCompleteTask}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>✅ บันทึกเสร็จสิ้นงาน</>
                  )}
                </button>
              )}

              <button
                onClick={() => router.push('/tasks')}
                className="w-full py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/85 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1"
              >
                📋 รายการภารกิจทั้งหมดของทีม →
              </button>
            </div>

          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function TaskDetailPage() {
  return (
    <AuthGuard>
      <TaskDetailContent />
    </AuthGuard>
  )
}
