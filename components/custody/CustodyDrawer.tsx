'use client'
import React from 'react'
import { Badge } from '@/components/ui/Badge'
import { CardData } from './KanbanCard'

interface CustodyDrawerProps {
  card: CardData | null
  onClose: () => void
  onFollowUpSubmit?: (text: string) => Promise<void>
  submitting?: boolean
  error?: string | null
}

export function CustodyDrawer({ card, onClose }: CustodyDrawerProps) {
  if (!card) return null

  const formatDateOnly = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      const datePart = dateStr.split(/[T ]/)[0]
      const [year, month, day] = datePart.split('-').map(Number)
      
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
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop overlay */}
        <div
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm transition-opacity"
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-none w-screen max-w-lg">
            <div className="pointer-events-auto h-full flex flex-col bg-white shadow-2xl dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
              {/* Drawer Header */}
              <div className="bg-zinc-50/80 backdrop-blur px-6 py-5 border-b border-zinc-200 dark:bg-zinc-950/80 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50" id="slide-over-title">
                      🚗 ทะเบียน {card.registerNo}
                    </h2>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      {card.vehicleSubStatusName || 'ไม่ระบุสถานะ'}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 flex gap-2">
                    <span>เคสซ่อม: #{card.maintenanceId}</span>
                    <span>•</span>
                    <span>สะสม: {card.ageingDays} วัน</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-all duration-200"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* 📌 อาการเสีย / ข้อมูลแจ้งซ่อม */}
                <div className="bg-rose-50/30 border border-rose-100/50 p-4 rounded-2xl dark:bg-rose-950/10 dark:border-rose-900/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">🚨 อาการชำรุด / ปัญหาที่แจ้ง</span>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    {card.issueTitle}
                  </p>
                </div>

                {/* 🛠️ ข้อมูลทั่วไปของตัวรถ */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ข้อมูลทั่วไป</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50/55 border border-zinc-100 p-4 rounded-2xl dark:bg-zinc-950/35 dark:border-zinc-800/50">
                    <div>
                      <span className="text-zinc-400 block mb-0.5">รุ่นรถ:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.model}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-0.5">เลขตัวถัง (VIN):</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300 select-all">{card.vin}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-0.5">โครงการ:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.project}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-0.5">อู่ / พิกัดที่ซ่อม:</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">{card.location}</span>
                    </div>
                  </div>
                </div>

                {/* 💼 ข้อมูลการประกันภัยและเคลม */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ข้อมูลประกันภัยและเคลม</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50/55 border border-zinc-100 p-4 rounded-2xl dark:bg-zinc-950/35 dark:border-zinc-800/50">
                    <div>
                      <span className="text-zinc-400 block mb-0.5">บริษัทประกัน / เคลม:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.insuranceCode}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-0.5">เลขเคลม (Claim No.):</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.claimNumber}</span>
                    </div>
                  </div>
                </div>

                {/* 🤝 ข้อมูลลูกค้าและสัญญา */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ข้อมูลการถือครองสัญญา</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs bg-zinc-50/55 border border-zinc-100 p-4 rounded-2xl dark:bg-zinc-950/35 dark:border-zinc-800/50">
                    <div>
                      <span className="text-zinc-400 block mb-0.5">ลูกค้าปัจจุบัน:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.customerName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block mb-0.5">เบอร์โทรศัพท์:</span>
                      {card.customerPhone && card.customerPhone !== '-' ? (
                        <a 
                          href={`tel:${card.customerPhone}`}
                          className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                        >
                          📞 {card.customerPhone}
                        </a>
                      ) : (
                        <span className="font-semibold text-zinc-500">-</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-400 block mb-0.5">เลขที่สัญญา:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.contractNo}</span>
                    </div>
                  </div>
                </div>

                {/* 🔄 สถานะรถทดแทน (Replacement) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">รถทดแทนสำรอง (Replacement)</h3>
                  {card.replacementVin ? (
                    <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 p-4 rounded-2xl border border-emerald-100/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <div>
                        <span className="block text-emerald-600 dark:text-emerald-400 font-bold mb-0.5">🟢 ผูกรถทดแทนเรียบร้อย</span>
                        <span className="font-semibold">ทะเบียน: {card.replacementRegisterNo || card.replacementVin}</span>
                      </div>
                      <Badge variant="success">มีรถทดแทน</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs bg-rose-50/50 text-rose-800 p-4 rounded-2xl border border-rose-100/30 dark:bg-rose-950/20 dark:text-rose-300">
                      <div>
                        <span className="block font-bold text-rose-600 dark:text-rose-400 mb-0.5">⚠️ ต้องการรถทดแทนด่วน</span>
                        <span>สัญญาลูกค้าจอดซ่อมสะสมยังไม่มีรถทดแทน</span>
                      </div>
                      <Badge variant="danger">ขารถทดแทน</Badge>
                    </div>
                  )}
                </div>

                {/* 📅 ไทม์ไลน์เหตุการณ์สำคัญ (Timeline) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ไทม์ไลน์เหตุการณ์สำคัญ</h3>
                  <div className="relative pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 space-y-5 text-xs">
                    {/* Event 1 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-zinc-400 border-4 border-white dark:border-zinc-900" />
                      <div>
                        <span className="font-semibold block text-zinc-700 dark:text-zinc-300">📅 วันที่เปิดเคสแจ้งเคลม (Report Date)</span>
                        <span className="text-zinc-500">{formatDateOnly(card.reportDate)}</span>
                      </div>
                    </div>
                    {/* Event 2 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-red-400 border-4 border-white dark:border-zinc-900" />
                      <div>
                        <span className="font-semibold block text-zinc-700 dark:text-zinc-300">💥 วันที่เกิดอุบัติเหตุ/รถเสีย (Incident Date)</span>
                        <span className="text-zinc-500">{formatDateOnly(card.incidentDate)}</span>
                      </div>
                    </div>
                    {/* Event 3 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-amber-400 border-4 border-white dark:border-zinc-900" />
                      <div>
                        <span className="font-semibold block text-zinc-700 dark:text-zinc-300">🔧 วันที่เริ่มเข้าซ่อม (Start Date)</span>
                        <span className="text-zinc-500">{formatDateOnly(card.startDate)}</span>
                      </div>
                    </div>
                    {/* Event 4 */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-400 border-4 border-white dark:border-zinc-900" />
                      <div>
                        <span className="font-semibold block text-zinc-700 dark:text-zinc-300">🎉 วันที่ซ่อมเสร็จสิ้น (Finish Date)</span>
                        <span className="text-zinc-500">{formatDateOnly(card.finishDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 💬 บันทึก Next to do (ความคืบหน้าล่าสุด) */}
                {card.latestFollowUpDetail && (
                  <div className="space-y-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">💬 บันทึกความคืบหน้าล่าสุด (Next to do)</h3>
                    <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 dark:bg-zinc-950 dark:border-zinc-800 text-xs space-y-2">
                      <p className="text-zinc-700 dark:text-zinc-300 font-semibold italic">"{card.latestFollowUpDetail}"</p>
                      {card.latestFollowUpDate && (
                        <p className="text-[10px] text-zinc-400">อัปเดตล่าสุด: {formatDateTimeOnly(card.latestFollowUpDate)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 space-y-2">
                <a
                  href={`/maintenance/${card.maintenanceId}/edit`}
                  className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors duration-200"
                >
                  📝 ไปหน้าบันทึกประวัติการซ่อมบำรุง
                </a>
                <a
                  href={`/vehicle/${card.registerNo}`}
                  className="w-full inline-flex items-center justify-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-xs font-bold py-2.5 px-4 rounded-xl transition-colors duration-200"
                >
                  🚗 ไปหน้าโปรไฟล์ข้อมูลรถ
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
