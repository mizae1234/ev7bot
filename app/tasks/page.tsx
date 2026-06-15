'use client'

import React, { useState, useEffect } from 'react'
import { Pagination } from '@/components/ui/Pagination'
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
}

function TasksContent() {
  const [passcode, setPasscode] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState('')
  const [tasks, setTasks] = useState<TaskNote[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [summary, setSummary] = useState({ pending: 0, completed: 0, total: 0 })
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Modals / Create / Edit Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskNote | null>(null)
  const [formVehicleRef, setFormVehicleRef] = useState('')
  const [formAssigneeName, setFormAssigneeName] = useState('')
  const [formTaskDetail, setFormTaskDetail] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formError, setFormError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

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

  // 3. Fetch tasks when authenticated and role is valid
  useEffect(() => {
    if (isAuthenticated && passcode && liffUserId && (userRole === 'USER' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN')) {
      // If URL has search query for ID, e.g. /tasks?id=12
      const params = new URLSearchParams(window.location.search)
      const queryId = params.get('id')
      if (queryId) {
        setSearch(`ID: ${queryId}`)
      }
      fetchTasks(queryId || undefined)
    }
  }, [isAuthenticated, page, statusFilter, liffUserId, userRole])

  // Debounced search trigger
  useEffect(() => {
    if (!isAuthenticated || !passcode || !liffUserId || (userRole !== 'USER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) return
    const timer = setTimeout(() => {
      setPage(1)
      fetchTasks()
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchTasks = async (exactId?: string) => {
    setLoading(true)
    try {
      let searchQuery = search
      let singleId: string | undefined = undefined

      if (exactId) {
        singleId = exactId
      } else if (search.startsWith('ID:')) {
        singleId = search.replace('ID:', '').trim()
      }

      const params = new URLSearchParams({
        passcode,
        userId: liffUserId || '',
        page: String(page),
        limit: '20',
        status: statusFilter,
      })

      if (singleId) {
        params.append('id', singleId)
      } else if (searchQuery) {
        params.append('search', searchQuery)
      }

      const res = await fetch(`/api/tasks?${params.toString()}`)
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
      setTasks(data.tasks || [])
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

  const handleCompleteTask = async (id: number) => {
    setActionLoading(id)
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'resolve', passcode, userId: liffUserId })
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถแก้ไขสถานะได้'}`)
      } else {
        await fetchTasks()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteTask = async (id: number) => {
    if (!confirm(`คุณต้องการลบงานรหัส #${id} ใช่หรือไม่?`)) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/tasks?id=${id}&passcode=${passcode}&userId=${liffUserId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถลบงานได้'}`)
      } else {
        await fetchTasks()
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setActionLoading(null)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingTask(null)
    setFormVehicleRef('')
    setFormAssigneeName('')
    setFormTaskDetail('')
    setFormDueDate('')
    setFormError('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (task: TaskNote) => {
    setEditingTask(task)
    setFormVehicleRef(task.vehicleRef || '')
    setFormAssigneeName(task.assigneeName || '')
    setFormTaskDetail(task.taskDetail || '')
    setFormDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
    setFormError('')
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTaskDetail.trim()) {
      setFormError('กรุณากรอกรายละเอียดภารกิจ')
      return
    }

    setFormSubmitting(true)
    setFormError('')

    try {
      const payload = {
        passcode,
        userId: liffUserId,
        vehicleRef: formVehicleRef || null,
        assigneeName: formAssigneeName || 'ยังไม่ทราบผู้รับผิดชอบ',
        taskDetail: formTaskDetail,
        dueDate: formDueDate || null
      }

      let res
      if (editingTask) {
        res = await fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingTask.id, action: 'edit' })
        })
      } else {
        res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
      } else {
        setIsModalOpen(false)
        await fetchTasks()
      }
    } catch (err) {
      setFormError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setFormSubmitting(false)
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
        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
            🚨 เกินกำหนด ({Math.abs(diffDays)} วัน)
          </span>
        )
      } else if (diffDays === 0) {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
            📅 ครบกำหนดวันนี้
          </span>
        )
      } else if (diffDays <= 2) {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/5 text-amber-500 border border-amber-500/10">
            ⏳ อีก {diffDays} วัน
          </span>
        )
      } else {
        return (
          <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
            ⏳ อีก {diffDays} วัน
          </span>
        )
      }
    } catch {
      return <span className="text-zinc-400">{formatDateShort(dueDateStr)}</span>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            ⏳ รอดำเนินการ
          </span>
        )
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✅ เสร็จสิ้น
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

  // 5. Restrict access strictly to USER, ADMIN or SUPER_ADMIN
  if (userRole !== 'USER' && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 text-center">
        <span className="text-5xl mb-4">🛡️</span>
        <h1 className="text-xl font-bold text-zinc-100 mb-2">ไม่ได้รับอนุญาตให้เข้าถึง</h1>
        <p className="text-sm text-zinc-500 max-w-sm">คุณไม่มีสิทธิ์เข้าใช้งานระบบจัดการภารกิจและโน้ตทีม</p>
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
            <span className="inline-block text-4xl mb-3">📋</span>
            <h1 className="text-xl font-bold text-zinc-100">ระบบจัดการภารกิจ & โน้ตทีม</h1>
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
                📋 Tasks & Notes Manager
              </h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-md font-bold">
                {userRole === 'USER' ? 'User View' : 'Admin Panel'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              ระบบจัดการภารกิจ ติดตามงานค้าง และจดโน้ตของทีมจาก LINE Bot
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
              <button
                onClick={handleOpenCreateModal}
                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-[0.98]"
              >
                ➕ เพิ่มภารกิจใหม่
              </button>
            )}
            <button
              onClick={() => {
                sessionStorage.removeItem('logchats_passcode')
                setIsAuthenticated(false)
                setPasscode('')
                setTasks([])
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
            {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
              <a 
                href="/issues"
                className="text-xs font-bold px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 transition-all"
              >
                🐞 แจ้งปัญหาบอท
              </a>
            )}
            <a 
              href="/dashboard"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold transition-all shadow-md"
            >
              ← แดชบอร์ด EV7
            </a>
          </div>
        </div>

        {/* Summary Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-900 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">งานทั้งหมด</span>
            <span className="text-2xl font-extrabold text-zinc-100 mt-2">{summary.total}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-amber-500/80 font-bold uppercase tracking-wider">⏳ รอดำเนินการ</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-2">{summary.pending}</span>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex flex-col justify-between">
            <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-wider">✅ เสร็จสิ้นแล้ว</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-2">{summary.completed}</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900">
          <div className="md:col-span-2">
            <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ค้นหาคำสำคัญ</label>
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้รับผิดชอบ, รายละเอียดงาน, ทะเบียนรถ/VIN หรือระบุ ID: รหัสงาน..."
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
              <option value="PENDING">รอดำเนินการ</option>
              <option value="COMPLETED">เสร็จสิ้น</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-rose-500 text-sm font-medium">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-850 rounded-2xl text-zinc-500 text-sm">
            ไม่พบรายการภารกิจค้างหรือโน้ตงานใดๆ ในขณะนี้
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div 
                key={task.id}
                className={`bg-zinc-900/20 border ${search.includes(String(task.id)) ? 'border-amber-500' : 'border-zinc-900 hover:border-zinc-800/80'} rounded-2xl p-5 md:p-6 transition-all duration-200 backdrop-blur-sm shadow-sm`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-zinc-900/60">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">📌 ID #{task.id}</span>
                      {getStatusBadge(task.status)}
                      {getDueDateBadge(task.dueDate, task.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500">
                      <span>👤 ผู้รับผิดชอบ: <span className="text-zinc-300 font-semibold">{task.assigneeName}</span></span>
                      {task.vehicleRef && (
                        <>
                          <span>•</span>
                          <span className="font-bold text-[11px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">🚗 รถ: {task.vehicleRef}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-zinc-500 space-y-0.5">
                    <div>📅 บันทึกเมื่อ: {formatDateTime(task.createdAt)} ({task.createUserName || 'LINE Bot'})</div>
                    {task.completedAt && (
                      <div className="text-emerald-500/80 font-medium">✅ เสร็จสิ้น: {formatDateTime(task.completedAt)}</div>
                    )}
                  </div>
                </div>

                <div className="py-4 text-sm text-zinc-200 leading-relaxed font-bold">
                  {task.taskDetail}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-900/40 text-[11px]">
                  <div className="text-zinc-500">
                    {task.dueDate && (
                      <span>📅 กำหนดส่ง: <span className="text-zinc-350 font-bold">{formatDateShort(task.dueDate)}</span></span>
                    )}
                  </div>

                  {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditModal(task)}
                        disabled={actionLoading === task.id}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 transition-all font-bold disabled:opacity-50"
                      >
                        ✏️ แก้ไข
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        disabled={actionLoading === task.id}
                        className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/60 text-rose-500 hover:text-rose-400 transition-all font-bold disabled:opacity-50"
                      >
                        🗑️ ลบ
                      </button>
                      {task.status === 'PENDING' && (
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={actionLoading === task.id}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all font-bold shadow-md disabled:opacity-50"
                        >
                          {actionLoading === task.id ? 'กำลังบันทึก...' : '✅ เสร็จสิ้นงาน'}
                        </button>
                      )}
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

      {/* Add / Edit Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <form 
            onSubmit={handleFormSubmit}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5"
          >
            <div>
              <h3 className="text-lg font-bold text-zinc-100">
                {editingTask ? `✏️ แก้ไขภารกิจ #${editingTask.id}` : '➕ เพิ่มภารกิจใหม่'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                ระบุรายละเอียดงานและมอบหมายบุคคลรับผิดชอบ
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">รายละเอียดงาน *</label>
                <textarea
                  rows={3}
                  placeholder="เช่น ส่งเอกสาร ทอ-3791, เข้าไปเคลียร์ของอู่ศาลายา..."
                  value={formTaskDetail}
                  onChange={(e) => setFormTaskDetail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-zinc-850 bg-zinc-950/40 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ผู้รับผิดชอบ</label>
                  <input
                    type="text"
                    placeholder="เช่น พี่วิทยา, สมหญิง"
                    value={formAssigneeName}
                    onChange={(e) => setFormAssigneeName(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-zinc-855 bg-zinc-950/40 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">ทะเบียนรถ / VIN</label>
                  <input
                    type="text"
                    placeholder="เช่น ทอ-3791"
                    value={formVehicleRef}
                    onChange={(e) => setFormVehicleRef(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs rounded-xl border border-zinc-855 bg-zinc-950/40 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 font-bold mb-1.5 uppercase tracking-wider">กำหนดส่งเสร็จสิ้น</label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs rounded-xl border border-zinc-855 bg-zinc-950/40 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {formError && (
                <p className="text-xs text-rose-500 text-center font-medium">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={formSubmitting}
                className="px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 rounded-xl transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md disabled:opacity-50"
              >
                {formSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกภารกิจ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default function TasksPage() {
  return (
    <AuthGuard>
      <TasksContent />
    </AuthGuard>
  )
}
