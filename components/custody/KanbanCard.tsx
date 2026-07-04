'use client'
import React, { useState } from 'react'
import { Badge } from '@/components/ui/Badge'

export interface TicketData {
  maintenanceId: number
  issueTitle: string
  reportDate: string | null
  incidentDate: string | null
  startDate: string | null
  finishDate: string | null
  insuranceCode: string
  claimNumber: string
  latestFollowUpDetail: string | null
  latestFollowUpDate: string | null
  carStatusCode?: string
  location?: string
}

export interface CardData {
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
  incidentDate: string | null
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
  vehicleStatus?: string
  vehicleStatusType?: string
  vehicleSubStatusName?: string
  carStatusCode?: string
  activeTicketsCount?: number
  tickets?: TicketData[]
}

interface KanbanCardProps {
  card: CardData
  accentColorClass: string
  hoverBorderClass: string
  icon: string
  onRefresh?: () => Promise<void>
}

export function KanbanCard({ card, accentColorClass, hoverBorderClass, icon, onRefresh }: KanbanCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [followUpNotes, setFollowUpNotes] = useState<Record<number, string>>({})
  const [submittingIds, setSubmittingIds] = useState<Record<number, boolean>>({})

  const tickets = card.tickets || []

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('button') ||
      target.closest('a')
    ) {
      return
    }
    setExpanded(!expanded)
  }

  const handleSaveFollowUp = async (maintId: number) => {
    const detail = followUpNotes[maintId]
    if (!detail || !detail.trim()) return

    setSubmittingIds(prev => ({ ...prev, [maintId]: true }))

    try {
      const res = await fetch('/api/vehicle-custody', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceId: maintId,
          followUpDetail: detail.trim(),
        })
      })

      if (!res.ok) {
        throw new Error('บันทึกความคืบหน้าไม่สำเร็จ')
      }

      setFollowUpNotes(prev => ({ ...prev, [maintId]: '' }))

      if (onRefresh) {
        await onRefresh()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก')
    } finally {
      setSubmittingIds(prev => ({ ...prev, [maintId]: false }))
    }
  }

  const formatDateOnly = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const datePart = dateStr.split(/[T ]/)[0]
      const [year, month, day] = datePart.split('-').map(Number)
      if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr
      
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ]
      
      const BuddhistYear = year + 543
      const thaiMonth = thaiMonths[month - 1]
      
      return `${day} ${thaiMonth} ${BuddhistYear}`
    } catch {
      return dateStr
    }
  }

  const formatDateTimeOnly = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const parts = dateStr.split(/[T ]/)
      const datePart = parts[0]
      const timePart = parts[1] ? parts[1].slice(0, 5) : ''
      
      const [year, month, day] = datePart.split('-').map(Number)
      const thaiMonths = [
        'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
      ]
      const BuddhistYear = year + 543
      const thaiMonth = thaiMonths[month - 1]
      
      return `${day} ${thaiMonth} ${BuddhistYear} ${timePart} น.`
    } catch {
      return dateStr
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={`group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${hoverBorderClass} space-y-3`}
    >
      {/* CARD HEADER (Always Visible) */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1.5 items-start">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-bold text-zinc-800 dark:text-zinc-100 transition-colors ${accentColorClass}`}>
              {icon} {card.registerNo}
            </span>
            {tickets.length > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200/40 dark:bg-amber-950/40 dark:text-amber-300">
                📋 {tickets.length} ใบงาน
              </span>
            )}
          </div>
          {card.vehicleSubStatusName && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100/50 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30">
              🏷️ {card.vehicleSubStatusName}
            </span>
          )}
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-[10px] text-zinc-400">
            {card.finishDate ? 'เสร็จแล้ว' : card.startDate ? 'ซ่อมสะสม' : 'SLA'}: {card.ageingDays} วัน
          </span>
          <button
            type="button"
            className="mt-1 text-[11px] text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold flex items-center gap-0.5"
          >
            {expanded ? '▲ ย่อ' : '▼ ขยาย'}
          </button>
        </div>
      </div>

      {/* CARD BODY (Always Visible) */}
      <div className="text-xs text-zinc-500 space-y-0.5 border-t border-zinc-100 pt-2 dark:border-zinc-800/60">
        <div>
          <span className="font-semibold text-zinc-600 dark:text-zinc-400">โครงการ:</span>{' '}
          <span className="font-bold text-emerald-700 dark:text-emerald-400">{card.project}</span>
        </div>
        <div>
          <span className="font-semibold text-zinc-600 dark:text-zinc-400">รุ่น:</span> {card.model}
        </div>
        {card.finishDate ? (
          <div>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">ลูกค้า:</span> {card.customerName}
          </div>
        ) : (
          <div>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">อู่/สถานที่:</span>{' '}
            <span className="font-semibold text-amber-700 dark:text-amber-400">{card.location}</span>
          </div>
        )}
      </div>

      {/* REPLACEMENT STATUS OR CUSTODY HIGHLIGHT (Always Visible) */}
      <div>
        {card.finishDate ? (
          card.replacementVin && (
            <div className="bg-amber-50/70 border border-amber-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/20 dark:text-amber-300 font-medium">
              🔄 สลับรถคืน: {card.replacementRegisterNo || card.replacementVin}
            </div>
          )
        ) : card.replacementVin ? (
          <div className="bg-emerald-50/70 border border-emerald-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/20 dark:text-emerald-300 font-medium">
            🟢 มีรถทดแทน: {card.replacementRegisterNo || card.replacementVin}
          </div>
        ) : (
          !['STILL_WORK', 'COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(card.carStatusCode || '') && card.vehicleStatus !== 'ON_RENT' && (
            <div className="bg-rose-50/70 border border-rose-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/20 dark:text-rose-300 font-bold animate-pulse">
              ⚠️ ต้องการรถทดแทนด่วน!
            </div>
          )
        )}
      </div>

      {/* COLLAPSED FOLLOW-UP PREVIEW (Visible when Collapsed) */}
      {!expanded && (
        <div className="border-t pt-2 border-zinc-100 dark:border-zinc-800">
          {card.latestFollowUpDetail ? (
            <div className="text-[11px] text-zinc-500 line-clamp-1 italic">
              💬 {card.latestFollowUpDetail}
            </div>
          ) : (
            <div className="text-[10px] text-zinc-400 italic">
              ➕ ยังไม่มีบันทึกติดตามผล (กดขยายเพื่อเพิ่ม)
            </div>
          )}
        </div>
      )}

      {/* EXPANDED DETAILS (Visible when Expanded) */}
      {expanded && (
        <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800 space-y-4 animate-fade-in">
          
          {/* ข้อมูลทั่วไปเพิ่มเติม */}
          <div className="bg-zinc-50/70 border border-zinc-100 p-3 rounded-xl dark:bg-zinc-950/40 dark:border-zinc-850 space-y-1.5 text-[11px] text-zinc-500">
            <div>
              <span className="text-zinc-400">เลขตัวถัง (VIN):</span>{' '}
              <span className="font-mono text-zinc-700 dark:text-zinc-300 select-all">{card.vin}</span>
            </div>
            <div>
              <span className="text-zinc-400">สัญญา:</span>{' '}
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.contractNo}</span>
            </div>
            {card.customerPhone && card.customerPhone !== '-' && (
              <div>
                <span className="text-zinc-400">เบอร์โทรลูกค้า:</span>{' '}
                <a href={`tel:${card.customerPhone}`} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  {card.customerPhone}
                </a>
              </div>
            )}
            <div>
              <span className="text-zinc-400">รถทดแทน:</span>{' '}
              {card.replacementVin ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-450">มี ({card.replacementRegisterNo || card.replacementVin})</span>
              ) : !['STILL_WORK', 'COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(card.carStatusCode || '') && card.vehicleStatus !== 'ON_RENT' ? (
                <span className="font-bold text-rose-600 dark:text-rose-400">⚠️ ต้องการด่วน!</span>
              ) : (
                <span className="text-zinc-400">ไม่ต้องใช้ (รถขับปกติ)</span>
              )}
            </div>
          </div>

          {/* รายการใบงานซ่อมทั้งหมด */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
              📋 ใบงานซ่อม ({tickets.length || 1})
            </span>
            
            {tickets.length > 0 ? (
              tickets.map((t) => {
                const isDrivable = t.carStatusCode === 'STILL_WORK' || t.carStatusCode === 'COMPLETE' || t.carStatusCode === 'READY_PICKUP_MAINTENANCE'
                return (
                  <div
                    key={t.maintenanceId}
                    className="bg-zinc-50/50 border border-zinc-150 p-3 rounded-xl dark:bg-zinc-950/20 dark:border-zinc-800/80 space-y-2 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        🔧 {t.issueTitle}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-zinc-400">#{t.maintenanceId}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-[9px]">
                      {isDrivable ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300">
                          🟢 ขับปกติ
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-300 animate-pulse">
                          🔴 งดใช้งาน
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400">
                        📍 {t.location || 'ไม่ระบุสถานที่'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-1 text-[10px] text-zinc-400 pt-1">
                      <div>
                        <span>เคลม: {t.insuranceCode} / {t.claimNumber}</span>
                      </div>
                      <div>
                        <span>วันเกิดอุบัติเหตุ: {formatDateOnly(t.incidentDate)}</span>
                      </div>
                      <div>
                        <span>วันที่เปิดเคลม: {formatDateOnly(t.reportDate)}</span>
                      </div>
                      {t.startDate && (
                        <div>
                          <span>เริ่มซ่อม: {formatDateOnly(t.startDate)}</span>
                        </div>
                      )}
                    </div>

                    {/* Follow-up Note */}
                    {t.latestFollowUpDetail && (
                      <div className="bg-white border border-zinc-100 p-2.5 rounded-lg dark:bg-zinc-900 dark:border-zinc-800 text-[10px] space-y-1">
                        <p className="text-zinc-600 dark:text-zinc-300 font-medium italic">
                          💬 {t.latestFollowUpDetail}
                        </p>
                        {t.latestFollowUpDate && (
                          <p className="text-[8px] text-zinc-400">อัปเดต: {formatDateTimeOnly(t.latestFollowUpDate)}</p>
                        )}
                      </div>
                    )}

                    {/* Inline Follow-up Note Form */}
                    <div className="border-t border-zinc-200/50 pt-2 mt-1 space-y-1.5">
                      <span className="text-[9px] font-bold text-zinc-400 block">💬 เพิ่มบันทึกความคืบหน้า:</span>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="พิมพ์ข้อความ..."
                          value={followUpNotes[t.maintenanceId] || ''}
                          onChange={(e) => setFollowUpNotes(prev => ({ ...prev, [t.maintenanceId]: e.target.value }))}
                          className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          disabled={submittingIds[t.maintenanceId]}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveFollowUp(t.maintenanceId)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveFollowUp(t.maintenanceId)}
                          disabled={submittingIds[t.maintenanceId] || !(followUpNotes[t.maintenanceId] || '').trim()}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition duration-150 disabled:opacity-50 inline-flex items-center shadow-sm"
                        >
                          {submittingIds[t.maintenanceId] ? '...' : 'บันทึก'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-[11px] text-zinc-400 italic">ไม่มีข้อมูลใบงานคงค้าง</div>
            )}
          </div>

          {/* ไปหน้าโปรไฟล์รถ */}
          <div className="pt-1">
            <a
              href={`/vehicle/${card.registerNo}`}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-[10px] font-bold py-2 px-3 rounded-lg transition-colors duration-150"
            >
              🚗 ไปหน้าโปรไฟล์ข้อมูลรถ
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
