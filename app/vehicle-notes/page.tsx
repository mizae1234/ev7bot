'use client'

import React, { useState, useEffect } from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AuthGuard } from '@/components/ui/AuthGuard'
import { LoginProfile } from '@/components/ui/LoginProfile'

interface VehicleNote {
  VehicleNoteID: number
  InventoryItemID: number
  NoteDetail: string
  CreateDate: string
  CreateUserID: number | null
  CreateUserName: string
  RegisterNo: string | null
  VinNo: string
  Model: string
  ProjectType: string
  StatusName: string | null
  SubStatusName: string | null
  CurrentLocation: string | null
  IsActive: boolean
}

function formatDateTh(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Bangkok'
    })
  } catch {
    return String(dateStr)
  }
}

function VehicleNotesContent() {
  const [notes, setNotes] = useState<VehicleNote[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchNotes()
  }, [page])

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchNotes()
      } else {
        setPage(1) // this will trigger the fetch due to first useEffect
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchNotes = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/vehicle/notes?page=${page}&limit=20&search=${encodeURIComponent(search)}`)
      if (!res.ok) {
        throw new Error('ไม่สามารถโหลดข้อมูลบันทึกตัวรถได้')
      }
      const data = await res.json()
      if (data.success) {
        setNotes(data.vehicleNotes || [])
        if (data.pagination) {
          setTotal(data.pagination.total)
          setTotalPages(data.pagination.totalPages)
        }
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch (err: any) {
      console.error('[Fetch Vehicle Notes Error]', err)
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-indigo-600 dark:from-zinc-100 dark:to-indigo-400 tracking-tight">
                📝 ประวัติการบันทึกข้อมูลรถ (Vehicle Notes)
              </h1>
              <a 
                href="/dashboard" 
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850 text-zinc-500 dark:text-zinc-400 transition-all shadow-sm"
              >
                🏠 Dashboard
              </a>
            </div>
            <p className="text-xs text-zinc-500 mt-1 dark:text-zinc-450">
              ประวัติข้อความโน้ตและสถานะล่าสุดของรถยนต์ในระบบ ค้นหาตามทะเบียน เลขตัวถัง หรือเนื้อหาโน้ตได้
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LoginProfile />
          </div>
        </div>

        {/* Filters / Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-md">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              🔍
            </span>
            <input
              type="text"
              placeholder="ค้นหาตาม ทะเบียนรถ, VIN, หรือข้อความโน้ต..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-850 dark:text-zinc-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs font-semibold text-zinc-450 hover:text-zinc-700 dark:hover:text-zinc-250 bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-xl transition-all"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* Loading Spinner */}
        {loading && !notes.length && (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="text-center py-10 text-rose-500 font-medium">
            ⚠️ {error}
          </div>
        )}

        {/* Data List */}
        {!loading && !error && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <p className="text-xs text-zinc-500 dark:text-zinc-455 font-bold">
                พบข้อมูลทั้งหมด {total} รายการ
              </p>
            </div>

            {notes.length > 0 ? (
              notes.map((note) => (
                <div 
                  key={note.VehicleNoteID} 
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {/* Vehicle Header Info */}
                  <div className="pb-3.5 border-b border-zinc-150 dark:border-zinc-800/60">
                    <a
                      href={`/vehicle/${encodeURIComponent(note.RegisterNo || note.VinNo)}`}
                      className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-indigo-650 dark:hover:text-indigo-400 hover:underline transition-colors tracking-tight block"
                    >
                      {note.RegisterNo || 'ยังไม่มีทะเบียน'}
                    </a>
                    <div className="font-mono text-[11px] text-zinc-450 dark:text-zinc-550 mt-0.5">
                      VIN: {note.VinNo}
                    </div>

                    <div className="text-[11px] text-zinc-550 dark:text-zinc-450 mt-2 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span>
                        โครงการ: <span className="font-bold text-emerald-600 dark:text-emerald-450">{note.ProjectType || '-'}</span>
                        <span className="mx-2 text-zinc-300 dark:text-zinc-700">|</span>
                        รุ่น: <span className="font-bold text-zinc-800 dark:text-zinc-200">{note.Model || '-'}</span>
                      </span>

                      {/* Badges */}
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {note.StatusName && (
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-rose-50 border border-rose-150 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-455">
                            {note.StatusName}
                          </span>
                        )}
                        {note.SubStatusName && (
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400">
                            {note.SubStatusName}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Location */}
                    {note.CurrentLocation && (
                      <div className="text-[11px] text-zinc-550 dark:text-zinc-455 mt-1.5 font-medium flex items-center gap-1">
                        <span>📍 สถานที่ปัจจุบัน:</span>
                        <span className="font-extrabold text-zinc-850 dark:text-zinc-150">
                          {note.CurrentLocation}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Note Text */}
                  <div className="mt-4 space-y-1">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                      📝 ข้อความบันทึก
                    </span>
                    <div className="bg-zinc-50/50 dark:bg-zinc-950/30 p-4 rounded-xl border border-zinc-150/60 dark:border-zinc-850/60 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {note.NoteDetail}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-450 dark:text-zinc-555 mt-3.5 pt-3 border-t border-zinc-100/60 dark:border-zinc-850/60">
                    <span>
                      👤 ผู้บันทึก: <span className="text-zinc-700 dark:text-zinc-300 font-bold">{note.CreateUserName}</span>
                    </span>
                    <span className="font-mono">
                      📅 วันที่บันทึก: {formatDateTh(note.CreateDate)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl py-20 text-center text-zinc-450 font-medium">
                ไม่พบข้อมูลบันทึกตัวรถ
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center pt-4">
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
    </main>
  )
}

export default function VehicleNotesPage() {
  return (
    <AuthGuard>
      <VehicleNotesContent />
    </AuthGuard>
  )
}
