'use client'
import React from 'react'

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
}

interface KanbanCardProps {
  card: CardData
  onClick: () => void
  accentColorClass: string
  hoverBorderClass: string
  icon: string
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

export function KanbanCard({ card, onClick, accentColorClass, hoverBorderClass, icon }: KanbanCardProps) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer group relative rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 ${hoverBorderClass}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-1.5 items-start">
          <span className={`text-sm font-bold text-zinc-800 dark:text-zinc-100 transition-colors ${accentColorClass}`}>
            {icon} {card.registerNo}
          </span>
          {card.vehicleSubStatusName && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100/50 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30">
              🏷️ {card.vehicleSubStatusName}
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-400">
          {card.finishDate ? 'เสร็จแล้ว' : card.startDate ? 'ซ่อมสะสม' : 'SLA'}: {card.ageingDays} วัน
        </span>
      </div>
      <div className="text-xs text-zinc-500 mb-2">
        <span className="font-semibold text-zinc-600 dark:text-zinc-400">รุ่น:</span> {card.model} <br />
        {card.finishDate ? (
          <>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">ลูกค้า:</span> {card.customerName}
          </>
        ) : (
          <>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">อู่/สถานที่:</span>{' '}
            <span className="font-semibold text-amber-700 dark:text-amber-400">{card.location}</span>
          </>
        )}
      </div>

      {/* REPLACEMENT STATUS OR CUSTODY HIGHLIGHT */}
      <div className="mb-2">
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
          <div className="bg-rose-50/70 border border-rose-100/50 px-2.5 py-1.5 rounded-lg text-[11px] text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/20 dark:text-rose-300 font-bold animate-pulse">
            ⚠️ ต้องการรถทดแทนด่วน!
          </div>
        )}
      </div>

      {card.latestFollowUpDetail ? (
        <div className="mt-2 text-[11px] text-zinc-500 line-clamp-2 italic border-t pt-2 border-zinc-100 dark:border-zinc-800">
          💬 {card.latestFollowUpDetail}
          {card.latestFollowUpDate && (
            <span className="block mt-1 text-[9px] text-zinc-400 font-normal not-italic">
              (อัปเดต: {formatDateTimeOnly(card.latestFollowUpDate)})
            </span>
          )}
        </div>
      ) : (
        <div className="mt-2 text-[10px] text-zinc-400 border-t pt-2 border-zinc-100 dark:border-zinc-800 italic">
          ➕ ยังไม่มีบันทึกติดตามผล (กดเพื่ออัปเดต)
        </div>
      )}
    </div>
  )
}
