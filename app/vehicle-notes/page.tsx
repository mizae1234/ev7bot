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

        {/* Data List (Log Timeline) */}
        {!loading && !error && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
              <p className="text-xs text-zinc-500 dark:text-zinc-450 font-bold">
                พบข้อมูลทั้งหมด {total} รายการ
              </p>
            </div>

            {notes.length > 0 ? (
              <div className="relative border-l-2 border-indigo-100 dark:border-zinc-800 ml-4 md:ml-6 pl-6 md:pl-8 space-y-6">
                {notes.map((note) => (
                  <div key={note.VehicleNoteID} className="relative">
                    {/* Timeline Dot */}
                    <span className="absolute -left-[31px] md:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-zinc-950 shadow-sm" />
                    
                    {/* Note Card */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-3.5">
                      {/* Top bar: Time and Author */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-zinc-450 dark:text-zinc-500 pb-2 border-b border-zinc-100 dark:border-zinc-850">
                        <span className="font-mono">📅 {formatDateTh(note.CreateDate)}</span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-350">👤 ผู้บันทึก: <span className="font-bold text-zinc-850 dark:text-zinc-250">{note.CreateUserName}</span></span>
                      </div>

                      {/* Compact Vehicle Info Tag */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                        <a
                          href={`/vehicle/${encodeURIComponent(note.RegisterNo || note.VinNo)}`}
                          className="font-mono font-black text-indigo-650 hover:text-indigo-850 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline flex items-center gap-1"
                        >
                          🚗 {note.RegisterNo || 'ยังไม่มีทะเบียน'}
                        </a>
                        <span className="text-zinc-300 dark:text-zinc-750 font-normal">|</span>
                        <span className="text-zinc-500 dark:text-zinc-400 text-[11px] font-mono">VIN: {note.VinNo}</span>
                        <span className="text-zinc-300 dark:text-zinc-750 font-normal">|</span>
                        <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                          โครงการ: <span className="font-bold text-emerald-600 dark:text-emerald-450">{note.ProjectType || '-'}</span>
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-750 font-normal">|</span>
                        <span className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                          รุ่น: <span className="font-bold text-zinc-700 dark:text-zinc-300">{note.Model || '-'}</span>
                        </span>
                        
                        {/* Status & Substatus Badges */}
                        {note.StatusName && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 border border-rose-100 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-455">
                            {note.StatusName}
                          </span>
                        )}
                        {note.SubStatusName && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-755 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400">
                            {note.SubStatusName}
                          </span>
                        )}
                        {note.CurrentLocation && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-50 border border-zinc-200 text-zinc-650 dark:bg-zinc-950/40 dark:border-zinc-800 dark:text-zinc-400 flex items-center gap-0.5">
                            📍 {note.CurrentLocation}
                          </span>
                        )}
                      </div>

                      {/* Note Content */}
                      <div className="bg-zinc-50/50 dark:bg-zinc-950/30 p-4 rounded-xl border border-zinc-150/60 dark:border-zinc-850/60 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans">
                        {note.NoteDetail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
