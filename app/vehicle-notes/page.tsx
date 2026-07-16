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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/60 pb-6 dark:border-zinc-800/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-indigo-600 dark:from-zinc-100 dark:to-indigo-400 tracking-tight">
                📝 ประวัติการบันทึกข้อมูลรถ (Vehicle Notes)
              </h1>
              <a 
                href="/dashboard" 
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-850 text-zinc-500 dark:text-zinc-400 transition-all"
              >
                🏠 Dashboard
              </a>
            </div>
            <p className="text-xs text-zinc-500 mt-1 dark:text-zinc-450">
              ประวัติข้อความโน้ตและบันทึกทั่วไปทั้งหมดของรถยนต์ในระบบ สามารถค้นหาตามทะเบียนหรือเลขตัวถังได้
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
          <div className="rounded-2xl border border-zinc-200/80 bg-white/70 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/60 overflow-hidden">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold">
                พบข้อมูลทั้งหมด {total} รายการ
              </p>
            </div>

            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-semibold bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th className="py-3 px-6 w-44">วันที่บันทึก</th>
                    <th className="py-3 px-4 w-44">ทะเบียน / VIN</th>
                    <th className="py-3 px-4 w-48">รุ่นรถ</th>
                    <th className="py-3 px-4">รายละเอียดบันทึก (Note)</th>
                    <th className="py-3 px-6 w-48">ผู้บันทึก</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {notes.length > 0 ? (
                    notes.map((note) => (
                      <tr 
                        key={note.VehicleNoteID}
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors duration-150"
                      >
                        <td className="py-4 px-6 text-zinc-450 font-mono">
                          {formatDateTh(note.CreateDate)}
                        </td>
                        <td className="py-4 px-4">
                          <a
                            href={`/vehicle/${encodeURIComponent(note.RegisterNo || note.VinNo)}`}
                            className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                          >
                            {note.RegisterNo || 'ไม่ระบุทะเบียน'}
                          </a>
                          <div className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{note.VinNo}</div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                          {note.Model}
                        </td>
                        <td className="py-4 px-4 whitespace-pre-wrap leading-relaxed text-zinc-900 dark:text-zinc-100">
                          {note.NoteDetail}
                        </td>
                        <td className="py-4 px-6 font-medium text-zinc-650 dark:text-zinc-350">
                          👤 {note.CreateUserName}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-zinc-450 font-medium">
                        ไม่พบข้อมูลบันทึกตัวรถ
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card List */}
            <div className="block md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note.VehicleNoteID} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={`/vehicle/${encodeURIComponent(note.RegisterNo || note.VinNo)}`}
                        className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
                      >
                        🚗 {note.RegisterNo || 'ไม่ระบุทะเบียน'}
                      </a>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {formatDateTh(note.CreateDate)}
                      </span>
                    </div>

                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      VIN: {note.VinNo} • {note.Model}
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-850 text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                      {note.NoteDetail}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-450">
                      <span>👤 {note.CreateUserName}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 text-center text-zinc-450 font-medium text-xs">
                  ไม่พบข้อมูลบันทึกตัวรถ
                </div>
              )}
            </div>
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
