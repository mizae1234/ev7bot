'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { LoginProfile } from '@/components/ui/LoginProfile'
import { CardData } from '@/components/custody/KanbanCard'
import { KanbanColumn } from '@/components/custody/KanbanColumn'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface ColumnData {
  id: string
  title: string
  cards: CardData[]
}

interface KanbanResponse {
  board?: {
    column1: ColumnData
    column2: ColumnData
    column3: ColumnData
    column4: ColumnData
  }
}

export default function CustodyPage() {
  const { data, error, mutate, isValidating } = useSWR<KanbanResponse>('/api/vehicle-custody', fetcher)
  const [search, setSearch] = useState('')

  const board = data?.board
  const isLoading = !data && !error

  const filterCards = (cards: CardData[] = []) => {
    if (!search.trim()) return cards
    return cards.filter(
      (c) =>
        (c.registerNo || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.vin || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.model || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.project || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.customerName || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.location || '').toLowerCase().includes(search.toLowerCase())
    )
  }

  const handleRefresh = async () => {
    await mutate()
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 pb-12 dark:bg-zinc-950 dark:text-zinc-50">
      {/* HEADER SECTION */}
      <div className="mx-auto max-w-[95rem] px-4 pt-6 pb-2 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent dark:from-white dark:to-zinc-400">
            📋 บอร์ดติดตามงานซ่อมและการควบคุมรถทดแทน
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            กระดานแสดงภาระงานและการถือครองรถยนต์ในแต่ละฝ่ายปฏิบัติงานแบบเรียลไทม์ (กดที่ตัวการ์ดเพื่อขยายดูรายละเอียดเพิ่มเติม)
          </p>
        </div>
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isLoading || isValidating}
            className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold py-1.5 px-3 rounded-xl shadow-xs transition-all duration-200 disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin text-indigo-500' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            รีเฟรชบอร์ด
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="mx-auto max-w-[95rem] px-4 mt-6 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="pointer-events-none absolute inset-y-0 left-6 flex items-center">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="ค้นหาทะเบียนรถ, เลข VIN, รุ่น, อู่ หรือชื่อลูกค้า..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-xl border-zinc-200 bg-zinc-50 py-2.5 pl-12 pr-4 text-sm focus:border-indigo-500 focus:bg-white focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-indigo-500"
          />
        </div>
      </div>

      {/* KANBAN BOARD */}
      <main className="mx-auto max-w-[95rem] px-4 mt-6 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <span className="ml-3 text-zinc-500 text-sm">กำลังโหลดข้อมูลบอร์ดคัมบัง...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
            ⚠️ ไม่สามารถดึงข้อมูลบอร์ดติดตามได้: {error.message}
          </div>
        ) : board ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
            <KanbanColumn
              title={board.column4.title}
              cards={filterCards(board.column4.cards)}
              headerColorClass="text-indigo-700 dark:text-indigo-400"
              badgeColorClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400"
              accentColorClass="group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
              hoverBorderClass="hover:border-indigo-400/50 dark:hover:border-indigo-500/50"
              icon="✨"
              onRefresh={handleRefresh}
              isExpandable={false}
            />

            <KanbanColumn
              title={board.column1.title}
              cards={filterCards(board.column1.cards)}
              headerColorClass="text-blue-700 dark:text-blue-400"
              badgeColorClass="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
              accentColorClass="group-hover:text-blue-600 dark:group-hover:text-blue-400"
              hoverBorderClass="hover:border-blue-400/50 dark:hover:border-blue-500/50"
              icon="🚗"
              onRefresh={handleRefresh}
            />

            <KanbanColumn
              title={board.column2.title}
              cards={filterCards(board.column2.cards)}
              headerColorClass="text-amber-700 dark:text-amber-400"
              badgeColorClass="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
              accentColorClass="group-hover:text-amber-600 dark:group-hover:text-amber-400"
              hoverBorderClass="hover:border-amber-400/50 dark:hover:border-amber-500/50"
              icon="🛠️"
              onRefresh={handleRefresh}
              showReplacementFilter={true}
            />

            <KanbanColumn
              title={board.column3.title}
              cards={filterCards(board.column3.cards)}
              headerColorClass="text-emerald-700 dark:text-emerald-400"
              badgeColorClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
              accentColorClass="group-hover:text-emerald-600 dark:group-hover:text-emerald-400"
              hoverBorderClass="hover:border-emerald-400/50 dark:hover:border-emerald-500/50"
              icon="✅"
              onRefresh={handleRefresh}
              isExpandable={false}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}
