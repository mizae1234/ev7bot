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

interface GroupedVehicleNotes {
  InventoryItemID: number
  RegisterNo: string | null
  VinNo: string
  Model: string
  ProjectType: string
  StatusName: string | null
  SubStatusName: string | null
  CurrentLocation: string | null
  notes: {
    VehicleNoteID: number
    NoteDetail: string
    CreateDate: string
    CreateUserID: number | null
    CreateUserName: string
  }[]
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

  // Group notes by InventoryItemID while maintaining chronological order of vehicles
  const getGroupedNotes = (): GroupedVehicleNotes[] => {
    const grouped: GroupedVehicleNotes[] = []
    const map = new Map<number, GroupedVehicleNotes>()

    for (const note of notes) {
      let group = map.get(note.InventoryItemID)
      if (!group) {
        group = {
          InventoryItemID: note.InventoryItemID,
          RegisterNo: note.RegisterNo,
          VinNo: note.VinNo,
          Model: note.Model,
          ProjectType: note.ProjectType,
          StatusName: note.StatusName,
          SubStatusName: note.SubStatusName,
          CurrentLocation: note.CurrentLocation,
          notes: []
        }
        map.set(note.InventoryItemID, group)
        grouped.push(group)
      }
      group.notes.push({
        VehicleNoteID: note.VehicleNoteID,
        NoteDetail: note.NoteDetail,
        CreateDate: note.CreateDate,
        CreateUserID: note.CreateUserID,
        CreateUserName: note.CreateUserName
      })
    }
    return grouped
  }

  const groupedVehicles = getGroupedNotes()

  return (
    <main className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950/30 pb-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-indigo-600 dark:from-zinc-100 dark:to-indigo-400 tracking-tight font-sans">
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

        {/* Data List (Grouped by Vehicle) */}
        {!loading && !error && (
          <div className="space-y-6">
            <div className="flex justify-between items-center px-1">
              <p className="text-xs text-zinc-500 dark:text-zinc-450 font-bold">
                พบข้อความบันทึกทั้งหมด {total} รายการ
              </p>
            </div>

            {groupedVehicles.length > 0 ? (
              <div className="space-y-6">
                {groupedVehicles.map((group) => (
                  <div 
                    key={group.InventoryItemID} 
                    className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 shadow-sm hover:shadow-md transition-all duration-200 space-y-5"
                  >
                    {/* Main Vehicle Header Info (Only once per car) */}
                    <div className="pb-4 border-b border-zinc-150 dark:border-zinc-800/60">
                      <a
                        href={`/vehicle/${encodeURIComponent(group.RegisterNo || group.VinNo)}`}
                        className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 hover:text-indigo-655 dark:hover:text-indigo-400 hover:underline transition-colors tracking-tight block"
                      >
                        {group.RegisterNo || 'ยังไม่มีทะเบียน'}
                      </a>
                      <div className="font-mono text-[11px] text-zinc-450 dark:text-zinc-550 mt-0.5">
                        VIN: {group.VinNo}
                      </div>

                      <div className="text-[11px] text-zinc-550 dark:text-zinc-450 mt-2 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>
                          โครงการ: <span className="font-bold text-emerald-650 dark:text-emerald-450">{group.ProjectType || '-'}</span>
                          <span className="mx-2 text-zinc-300 dark:text-zinc-700">|</span>
                          รุ่น: <span className="font-bold text-zinc-800 dark:text-zinc-200">{group.Model || '-'}</span>
                        </span>

                        {/* Badges */}
                        <span className="inline-flex flex-wrap items-center gap-1">
                          {group.StatusName && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-50 border border-rose-150 text-rose-700 dark:bg-rose-955/40 dark:border-rose-900/50 dark:text-rose-455">
                              {group.StatusName}
                            </span>
                          )}
                          {group.SubStatusName && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-50 border border-indigo-150 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400">
                              {group.SubStatusName}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Location */}
                      {group.CurrentLocation && (
                        <div className="text-[11px] text-zinc-550 dark:text-zinc-455 mt-1.5 font-medium flex items-center gap-1">
                          <span>📍 สถานที่ปัจจุบัน:</span>
                          <span className="font-extrabold text-zinc-850 dark:text-zinc-150">
                            {group.CurrentLocation}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline Chat of Notes for this car */}
                    <div className="relative border-l border-zinc-200 dark:border-zinc-800 ml-3 md:ml-4 pl-5 md:pl-6 space-y-4 pt-1 pb-1">
                      {group.notes.map((n) => (
                        <div key={n.VehicleNoteID} className="relative space-y-1.5">
                          {/* Tiny timeline dot */}
                          <span className="absolute -left-[24.5px] md:-left-[28.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white dark:border-zinc-900 shadow-sm" />
                          
                          {/* Note Meta Info */}
                          <div className="flex flex-wrap items-center justify-between text-[10px] text-zinc-450 dark:text-zinc-500 font-semibold">
                            <span className="font-mono">📅 {formatDateTh(n.CreateDate)}</span>
                            <span className="text-zinc-650 dark:text-zinc-400">👤 ผู้บันทึก: <span className="font-bold text-zinc-800 dark:text-zinc-300">{n.CreateUserName}</span></span>
                          </div>

                          {/* Message/Note Detail Content */}
                          <div className="bg-zinc-50/50 dark:bg-zinc-950/30 p-3.5 rounded-xl border border-zinc-150/60 dark:border-zinc-850/60 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed font-sans shadow-xxs">
                            {n.NoteDetail}
                          </div>
                        </div>
                      ))}
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
