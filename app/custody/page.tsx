'use client'
import React, { useState } from 'react'
import useSWR from 'swr'
import { Badge } from '@/components/ui/Badge'
import { LoginProfile } from '@/components/ui/LoginProfile'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

interface CardData {
  maintenanceId: number
  inventoryItemId: number
  registerNo: string
  vin: string
  model: string
  project: string
  projectType: string | null
  issueTitle: string
  location: string
  reportDate: string | null
  startDate: string | null
  finishDate: string | null
  insuranceCode: string
  claimNumber: string
  contractNo: string
  customerName: string
  customerPhone: string
  replacementVin: string | null
  replacementRegisterNo: string | null
  latestFollowUpDetail: string | null
  latestFollowUpDate: string | null
  ageingDays: number
}

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
  }
}

export default function CustodyPage() {
  const { data, error, mutate, isValidating } = useSWR<KanbanResponse>('/api/vehicle-custody', fetcher)
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [followUpText, setFollowUpText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const board = data?.board
  const isLoading = !data && !error

  const filterCards = (cards: CardData[] = []) => {
    if (!search.trim()) return cards
    return cards.filter(
      (c) =>
        c.registerNo.toLowerCase().includes(search.toLowerCase()) ||
        c.vin.toLowerCase().includes(search.toLowerCase()) ||
        c.model.toLowerCase().includes(search.toLowerCase()) ||
        c.customerName.toLowerCase().includes(search.toLowerCase()) ||
        c.location.toLowerCase().includes(search.toLowerCase())
    )
  }

  const handleCardClick = (card: CardData) => {
    setSelectedCard(card)
    setFollowUpText('')
    setSubmitError(null)
  }

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard || !followUpText.trim()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/vehicle-custody', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maintenanceId: selectedCard.maintenanceId,
          followUpDetail: followUpText,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'เกิดข้อผิดพลาดในการบันทึก')
      }

      setFollowUpText('')
      // Refresh SWR data
      const updatedData = await mutate()
      
      // Update selected card state to show the new follow-up
      if (updatedData?.board) {
        const allCards = [
          ...updatedData.board.column1.cards,
          ...updatedData.board.column2.cards,
          ...updatedData.board.column3.cards,
        ]
        const matched = allCards.find((c) => c.maintenanceId === selectedCard.maintenanceId)
        if (matched) {
          setSelectedCard(matched)
        }
      }
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Bangkok',
      }) + ' น.'
    } catch {
      return dateStr
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-zinc-900 pb-12 dark:bg-zinc-950 dark:text-zinc-50">
      {/* HEADER SECTION */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center p-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-all dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent dark:from-white dark:to-zinc-400">
                📋 บอร์ดติดตามงานซ่อมและการควบคุมรถทดแทน
              </h1>
              <p className="text-xs text-zinc-500">
                กระดานแสดงภาระงานและการถือครองรถยนต์ในแต่ละฝ่ายปฏิบัติงานแบบเรียลไทม์
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <LoginProfile />
            <button
              onClick={() => mutate()}
              disabled={isLoading || isValidating}
              className="flex items-center gap-1.5 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold py-1.5 px-3 rounded-xl shadow-sm transition-all duration-200 disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
      </header>

      {/* FILTER & SEARCH */}
      <div className="mx-auto max-w-7xl px-4 mt-6 sm:px-6 lg:px-8">
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
      <main className="mx-auto max-w-7xl px-4 mt-6 sm:px-6 lg:px-8">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* COLUMN 1: Claims Queue */}
            <div className="flex flex-col rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/40 min-h-[500px]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{board.column1.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-bold dark:bg-rose-950/40 dark:text-rose-400">
                  {filterCards(board.column1.cards).length}
                </span>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-1">
                {filterCards(board.column1.cards).length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">ไม่มีเคสค้างในขั้นตอนนี้</div>
                ) : (
                  filterCards(board.column1.cards).map((card) => (
                    <div
                      key={card.maintenanceId}
                      onClick={() => handleCardClick(card)}
                      className="cursor-pointer group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-rose-400/50 dark:hover:border-rose-500/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          🚗 {card.registerNo}
                        </span>
                        <span className="text-[10px] text-zinc-400">SLA: {card.ageingDays} วัน</span>
                      </div>
                      <div className="text-xs text-zinc-500 mb-2">
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">รุ่น:</span> {card.model} <br />
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">โครงการ:</span> {card.project}
                      </div>
                      <div className="bg-rose-50/70 border border-rose-100/50 p-2.5 rounded-lg text-xs text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/20 dark:text-rose-300">
                        <span className="font-bold">เคสแจ้งเคลม:</span> {card.issueTitle}
                      </div>
                      {card.latestFollowUpDetail ? (
                        <div className="mt-2 text-[11px] text-zinc-500 line-clamp-2 italic border-t pt-2 border-zinc-100 dark:border-zinc-800">
                          💬 {card.latestFollowUpDetail}
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] text-zinc-400 border-t pt-2 border-zinc-100 dark:border-zinc-800 italic">
                          ➕ ยังไม่มีบันทึกติดตามผล (กดเพื่ออัปเดต)
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 2: Workshop Repair & Replacement */}
            <div className="flex flex-col rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/40 min-h-[500px]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{board.column2.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold dark:bg-amber-950/40 dark:text-amber-400">
                  {filterCards(board.column2.cards).length}
                </span>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-1">
                {filterCards(board.column2.cards).length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">ไม่มีเคสค้างในขั้นตอนนี้</div>
                ) : (
                  filterCards(board.column2.cards).map((card) => (
                    <div
                      key={card.maintenanceId}
                      onClick={() => handleCardClick(card)}
                      className="cursor-pointer group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-amber-400/50 dark:hover:border-amber-500/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          🛠️ {card.registerNo}
                        </span>
                        <span className="text-[10px] text-zinc-400">ซ่อมสะสม: {card.ageingDays} วัน</span>
                      </div>
                      <div className="text-xs text-zinc-500 mb-2">
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">รุ่น:</span> {card.model} <br />
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">อู่/สถานที่:</span> <span className="text-amber-700 dark:text-amber-400 font-semibold">{card.location}</span>
                      </div>
                      
                      {/* REPLACEMENT STATUS BOX */}
                      <div className="mb-2">
                        {card.replacementVin ? (
                          <div className="bg-emerald-50/70 border border-emerald-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/20 dark:text-emerald-300 font-medium">
                            🟢 มีรถทดแทน: {card.replacementRegisterNo || card.replacementVin}
                          </div>
                        ) : (
                          <div className="bg-rose-50/70 border border-rose-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/20 dark:text-rose-300 font-bold animate-pulse">
                            ⚠️ ต้องการรถทดแทนด่วน!
                          </div>
                        )}
                      </div>

                      {card.latestFollowUpDetail ? (
                        <div className="mt-2 text-[11px] text-zinc-500 line-clamp-2 italic border-t pt-2 border-zinc-100 dark:border-zinc-800">
                          💬 {card.latestFollowUpDetail}
                        </div>
                      ) : (
                        <div className="mt-2 text-[10px] text-zinc-400 border-t pt-2 border-zinc-100 dark:border-zinc-800 italic">
                          ➕ ยังไม่มีบันทึกอู่ (กดเพื่ออัปเดต)
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 3: Operations Handover */}
            <div className="flex flex-col rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900/40 min-h-[500px]">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{board.column3.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950/40 dark:text-emerald-400">
                  {filterCards(board.column3.cards).length}
                </span>
              </div>
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] pr-1">
                {filterCards(board.column3.cards).length === 0 ? (
                  <div className="text-center py-8 text-zinc-400 text-xs">ไม่มีเคสค้างในขั้นตอนนี้</div>
                ) : (
                  filterCards(board.column3.cards).map((card) => (
                    <div
                      key={card.maintenanceId}
                      onClick={() => handleCardClick(card)}
                      className="cursor-pointer group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 hover:border-emerald-400/50 dark:hover:border-emerald-500/50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          ✅ {card.registerNo}
                        </span>
                        <span className="text-[10px] text-zinc-400">เสร็จแล้ว: {card.ageingDays} วัน</span>
                      </div>
                      <div className="text-xs text-zinc-500 mb-2">
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">รุ่น:</span> {card.model} <br />
                        <span className="font-semibold text-zinc-600 dark:text-zinc-400">ลูกค้า:</span> {card.customerName}
                      </div>

                      {card.replacementVin && (
                        <div className="mb-2 bg-amber-50/70 border border-amber-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/20 dark:text-amber-300 font-medium">
                          🔄 สลับรถคืน: {card.replacementRegisterNo || card.replacementVin}
                        </div>
                      )}

                      <div className="bg-emerald-50/70 border border-emerald-100/50 p-2.5 rounded-lg text-xs text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/20 dark:text-emerald-300">
                        <span className="font-bold">สถานะ:</span> ซ่อมเสร็จแล้ว รอประสานส่งมอบคืน
                      </div>
                      
                      {card.latestFollowUpDetail && (
                        <div className="mt-2 text-[11px] text-zinc-500 line-clamp-2 italic border-t pt-2 border-zinc-100 dark:border-zinc-800">
                          💬 {card.latestFollowUpDetail}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {/* DETAIL DRAWER / OVERLAY */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <div className="absolute inset-0 overflow-hidden">
            {/* Backdrop overlay */}
            <div
              onClick={() => setSelectedCard(null)}
              className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm transition-opacity"
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="pointer-events-auto w-screen max-w-md">
                <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl dark:bg-zinc-900">
                  {/* Drawer Header */}
                  <div className="bg-zinc-50 px-6 py-5 border-b border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100" id="slide-over-title">
                        🚗 รายละเอียด ทะเบียน {selectedCard.registerNo}
                      </h2>
                      <p className="text-xs text-zinc-500">ID เคสซ่อม: #{selectedCard.maintenanceId}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCard(null)}
                      className="rounded-xl p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Drawer Body */}
                  <div className="flex-1 px-6 py-6 space-y-6">
                    {/* Vehicle info block */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ข้อมูลทั่วไป</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-xl dark:bg-zinc-950">
                        <div>
                          <span className="text-zinc-400 block">รุ่นรถ:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedCard.model}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block">เลขตัวถัง (VIN):</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedCard.vin}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block">โครงการ:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedCard.project}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block">อู่ / พิกัดที่จอด:</span>
                          <span className="font-semibold text-amber-700 dark:text-amber-400">{selectedCard.location}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rent & Customer info block */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ข้อมูลสัญญาและการถือครอง</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-xl dark:bg-zinc-950">
                        <div>
                          <span className="text-zinc-400 block">ลูกค้าปัจจุบัน:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedCard.customerName}</span>
                        </div>
                        <div>
                          <span className="text-zinc-400 block">เบอร์โทรศัพท์:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedCard.customerPhone}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-zinc-400 block">เลขที่สัญญา:</span>
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selectedCard.contractNo}</span>
                        </div>
                      </div>
                    </div>

                    {/* Replacement car info */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">สถานะรถทดแทน</h3>
                      {selectedCard.replacementVin ? (
                        <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                          <div>
                            <span className="block text-emerald-600 dark:text-emerald-400 font-semibold">จัดรถทดแทนแล้ว</span>
                            <span>ทะเบียน: {selectedCard.replacementRegisterNo || selectedCard.replacementVin}</span>
                          </div>
                          <Badge variant="success">มีรถทดแทน</Badge>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs bg-rose-50 text-rose-800 p-4 rounded-xl border border-rose-100/30 dark:bg-rose-950/20 dark:text-rose-400">
                          <div>
                            <span className="block font-bold">⚠️ ยังไม่มีรถทดแทน</span>
                            <span>ต้องการด่วนสำหรับสัญญาลูกค้า</span>
                          </div>
                          <Badge variant="danger">ขารถทดแทน</Badge>
                        </div>
                      )}
                    </div>

                    {/* Timeline dates block */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">วันที่เหตุการณ์สำคัญ</h3>
                      <div className="space-y-2 text-xs bg-zinc-50 p-4 rounded-xl dark:bg-zinc-950">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">วันที่แจ้ง/เปิดเคส (Report Date):</span>
                          <span className="font-semibold">{formatDateTime(selectedCard.reportDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">วันที่เริ่มซ่อม (Start Date):</span>
                          <span className="font-semibold">{formatDateTime(selectedCard.startDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">วันที่ซ่อมเสร็จ (Finish Date):</span>
                          <span className="font-semibold">{formatDateTime(selectedCard.finishDate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* ADD NEW FOLLOW-UP FORM */}
                    <form onSubmit={handleAddFollowUp} className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">📝 เพิ่มบันทึก Next to do (ก้าวถัดไป)</h3>
                      <div>
                        <textarea
                          rows={3}
                          required
                          value={followUpText}
                          onChange={(e) => setFollowUpText(e.target.value)}
                          placeholder="พิมพ์ระบุขั้นตอนถัดไปหรือบันทึกติดตามงาน เช่น 'ประกันอนุมัติแล้ว เริ่มเบิกกันชนหน้า', 'นัดหมายลูกค้าสลับรถคืนวันที่...'"
                          className="block w-full rounded-xl border-zinc-200 text-xs focus:border-indigo-500 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950"
                        />
                      </div>
                      {submitError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400">⚠️ {submitError}</p>
                      )}
                      <button
                        type="submit"
                        disabled={submitting || !followUpText.trim()}
                        className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-4 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {submitting ? '⏳ กำลังบันทึก...' : '💾 บันทึกความคืบหน้า'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
