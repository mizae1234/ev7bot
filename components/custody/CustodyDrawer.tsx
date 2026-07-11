'use client'
import React, { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { CardData } from './KanbanCard'

interface CustodyDrawerProps {
  card: CardData | null
  onClose: () => void
  onRefresh?: () => Promise<void>
}

export function CustodyDrawer({ card, onClose, onRefresh }: CustodyDrawerProps) {
  const [followUpNotes, setFollowUpNotes] = useState<Record<number, string>>({})
  const [submittingIds, setSubmittingIds] = useState<Record<number, boolean>>({})

  if (!card) return null

  const tickets = card.tickets || []

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
      
      // Fallback if split failed
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
                    <span>คิวงานซ่อมทั้งหมด: {tickets.length || 1} รายการ</span>
                    <span>•</span>
                    <span>สะสมรวม: {card.ageingDays} วัน</span>
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
                    <div>
                      <span className="text-zinc-400 block mb-0.5">เลขที่สัญญา:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{card.contractNo}</span>
                    </div>
                    {card.mainVehicleRegisterNo && (
                      <div className="col-span-2 border-t border-zinc-150 dark:border-zinc-800/60 pt-2 mt-1">
                        <span className="text-zinc-400 block mb-0.5">รถทดแทนของคัน:</span>
                        <a 
                          href={`/vehicle/${card.mainVehicleRegisterNo}`}
                          target="_blank"
                          className="font-bold text-amber-700 dark:text-amber-450 hover:underline inline-flex items-center gap-1"
                        >
                          🚗 {card.mainVehicleRegisterNo} <span className="font-mono text-[11px] font-normal text-zinc-500 dark:text-zinc-400">({card.mainVehicleVin})</span>
                        </a>
                      </div>
                    )}
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
                  ) : !['STILL_WORK', 'COMPLETE', 'READY_PICKUP_MAINTENANCE'].includes(card.carStatusCode || '') && card.vehicleStatus !== 'ON_RENT' ? (
                    <div className="flex items-center justify-between text-xs bg-rose-50/50 text-rose-800 p-4 rounded-2xl border border-rose-100/30 dark:bg-rose-950/20 dark:text-rose-300">
                      <div>
                        <span className="block font-bold text-rose-600 dark:text-rose-400 mb-0.5">⚠️ ไม่มีรถทดแทน</span>
                        <span>สัญญาลูกค้าจอดซ่อมสะสมยังไม่มีรถทดแทน</span>
                      </div>
                      <Badge variant="danger">ขอรถทดแทน</Badge>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs bg-zinc-50 text-zinc-600 p-4 rounded-2xl border border-zinc-200/50 dark:bg-zinc-950/20 dark:text-zinc-400">
                      <div>
                        <span className="block font-bold text-zinc-700 dark:text-zinc-300 mb-0.5">🟢 ไม่ต้องการรถทดแทน</span>
                        <span>สัญญายังอยู่ระหว่างการใช้งาน / รถหลักขับวิ่งงานได้ปกติ</span>
                      </div>
                      <Badge variant="default">ไม่ต้องใช้</Badge>
                    </div>
                  )}
                </div>

                {/* 📋 รายการแจ้งซ่อมค้างทั้งหมด */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">📋 รายการแจ้งซ่อมที่รอซ่อม/กำลังซ่อม ({tickets.length || 1})</h3>
                  <div className="space-y-4">
                    {tickets.length > 0 ? (
                      tickets.map((t, idx) => {
                        const isDrivable = t.carStatusCode === 'STILL_WORK' || t.carStatusCode === 'COMPLETE' || t.carStatusCode === 'READY_PICKUP_MAINTENANCE'
                        return (
                          <div 
                            key={t.maintenanceId} 
                            className="bg-zinc-50/60 border border-zinc-200/80 p-4 rounded-2xl dark:bg-zinc-950/25 dark:border-zinc-800 space-y-3.5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition duration-150"
                          >
                            {/* Title & Ticket ID */}
                            <div className="flex justify-between items-start gap-4">
                              <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                🔧 {t.issueTitle}
                              </h4>
                              <span className="font-mono text-xs font-bold text-zinc-400">#{t.maintenanceId}</span>
                            </div>

                            {/* Drivability Badge & Location */}
                            <div className="flex flex-wrap gap-2 text-[10px]">
                              {isDrivable ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300">
                                  🟢 ขับใช้งานได้ปกติ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-300 animate-pulse">
                                  🔴 งดใช้งานชั่วคราว
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400">
                                📍 {t.location || 'ไม่ระบุสถานที่'}
                              </span>
                            </div>

                            {/* Sub-info list */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-zinc-500 pt-1">
                              <div>
                                <span className="text-zinc-400 block mb-0.5">บริษัทประกัน / เลขเคลม:</span>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{t.insuranceCode} / {t.claimNumber}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block mb-0.5">วันที่เกิดอุบัติเหตุ:</span>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatDateOnly(t.incidentDate)}</span>
                              </div>
                              <div>
                                <span className="text-zinc-400 block mb-0.5">วันที่เปิดเคสแจ้งเคลม:</span>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatDateOnly(t.reportDate)}</span>
                              </div>
                              {t.startDate && (
                                <div>
                                  <span className="text-zinc-400 block mb-0.5">วันที่เริ่มซ่อม:</span>
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{formatDateOnly(t.startDate)}</span>
                                </div>
                              )}
                            </div>

                            {/* Follow-up Note */}
                            {t.latestFollowUpDetail && (
                              <div className="bg-white border border-zinc-150 p-3.5 rounded-xl dark:bg-zinc-900 dark:border-zinc-800 text-[11px] space-y-1.5">
                                <p className="text-zinc-700 dark:text-zinc-300 font-semibold italic">
                                  💬 ความคืบหน้าล่าสุด: "{t.latestFollowUpDetail}"
                                </p>
                                {t.latestFollowUpDate && (
                                  <p className="text-[9px] text-zinc-400">อัปเดตล่าสุด: {formatDateTimeOnly(t.latestFollowUpDate)}</p>
                                )}
                              </div>
                            )}

                            {/* Follow-up Note Form inside each Ticket Card */}
                            <div className="border-t border-zinc-200/60 pt-3.5 mt-1 space-y-2">
                              <span className="text-[10px] font-bold text-zinc-400 block">💬 เพิ่มบันทึกความคืบหน้า:</span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="พิมพ์บันทึกความคืบหน้า..."
                                  value={followUpNotes[t.maintenanceId] || ''}
                                  onChange={(e) => setFollowUpNotes(prev => ({ ...prev, [t.maintenanceId]: e.target.value }))}
                                  className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl transition duration-150 disabled:opacity-50 inline-flex items-center gap-1 shadow-sm"
                                >
                                  {submittingIds[t.maintenanceId] ? '⏳ บันทึก...' : '💾 บันทึก'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-2xl dark:bg-zinc-950 dark:border-zinc-800 text-xs text-zinc-500 text-center">
                        ไม่มีข้อมูลใบงานซ่อมคงค้าง
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="bg-zinc-50 px-6 py-4 border-t border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 space-y-2">
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
