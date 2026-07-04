'use client'
import React, { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { CardData } from './KanbanCard'

interface CustodyDrawerProps {
  card: CardData | null
  onClose: () => void
  onFollowUpSubmit: (text: string) => Promise<void>
  submitting: boolean
  error: string | null
}

export function CustodyDrawer({ card, onClose, onFollowUpSubmit, submitting, error }: CustodyDrawerProps) {
  const [followUpText, setFollowUpText] = useState('')

  if (!card) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUpText.trim()) return
    await onFollowUpSubmit(followUpText)
    setFollowUpText('')
  }

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Backdrop overlay */}
        <div
          onClick={onClose}
          className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm transition-opacity"
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="pointer-events-none w-screen max-w-md">
            <div className="pointer-events-auto h-full flex flex-col overflow-y-scroll bg-white shadow-xl dark:bg-zinc-900">
              {/* Drawer Header */}
              <div className="bg-zinc-50 px-6 py-5 border-b border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100" id="slide-over-title">
                    🚗 รายละเอียด ทะเบียน {card.registerNo}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-zinc-500">ID เคสซ่อม: #{card.maintenanceId}</span>
                    {card.vehicleSubStatusName && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                        {card.vehicleSubStatusName}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
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
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.model}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">เลขตัวถัง (VIN):</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.vin}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">โครงการ:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.project}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">อู่ / พิกัดที่จอด:</span>
                      <span className="font-semibold text-amber-700 dark:text-amber-400">{card.location}</span>
                    </div>
                  </div>
                </div>

                {/* Rent & Customer info block */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">ข้อมูลสัญญาและการถือครอง</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-50 p-4 rounded-xl dark:bg-zinc-950">
                    <div>
                      <span className="text-zinc-400 block">ลูกค้าปัจจุบัน:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.customerName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block">เบอร์โทรศัพท์:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.customerPhone}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-zinc-400 block">เลขที่สัญญา:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{card.contractNo}</span>
                    </div>
                  </div>
                </div>

                {/* Replacement car info */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">สถานะรถทดแทน</h3>
                  {card.replacementVin ? (
                    <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100/30 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <div>
                        <span className="block text-emerald-600 dark:text-emerald-400 font-semibold">จัดรถทดแทนแล้ว</span>
                        <span>ทะเบียน: {card.replacementRegisterNo || card.replacementVin}</span>
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
                      <span className="font-semibold">{formatDateOnly(card.reportDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">วันที่เริ่มซ่อม (Start Date):</span>
                      <span className="font-semibold">{formatDateOnly(card.startDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">วันที่ซ่อมเสร็จ (Finish Date):</span>
                      <span className="font-semibold">{formatDateOnly(card.finishDate)}</span>
                    </div>
                  </div>
                </div>

                {/* ADD NEW FOLLOW-UP FORM */}
                <form onSubmit={handleSubmit} className="space-y-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
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
                  {error && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400">⚠️ {error}</p>
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
  )
}
