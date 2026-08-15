'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/ui/AuthGuard'

interface ScannedItem {
  AuditItemID: number
  VinNo: string
  ScanTime: string
  ScanMethod: string
  DetectedStatus: 'MATCHED' | 'MISMATCH' | 'NOT_IN_SYSTEM'
  PreviousLocation?: string
  PreviousLocationName?: string
  CreatedBy: string
  Notes?: string
  RegisterNo?: string
  Model?: string
  Exterior_Color?: string
  VehicleStatus?: string
  VehicleStatusType?: string
  StatusTypeName?: string
  ProjectType?: string
  AuditRow?: string
  AuditSlot?: string
  SlotPosition?: number | null
}

interface AuditSession {
  AuditSessionID: number
  AuditDate: string
  Location: string
  LocationName?: string
  Status: string
  CreatedBy: string
}

// Color scheme per status
function getStatusColor(status: string) {
  switch (status) {
    case 'MATCHED':
      return {
        bg: 'bg-emerald-500/15',
        border: 'border-emerald-500/40',
        text: 'text-emerald-300',
        dot: 'bg-emerald-400',
        label: 'ตรงพิกัด'
      }
    case 'MISMATCH':
      return {
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/40',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
        label: 'ผิดพิกัด'
      }
    case 'NOT_IN_SYSTEM':
      return {
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/40',
        text: 'text-rose-300',
        dot: 'bg-rose-400',
        label: 'ไม่มีในระบบ'
      }
    default:
      return {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        text: 'text-slate-400',
        dot: 'bg-slate-500',
        label: '-'
      }
  }
}

const ROW_OPTIONS = Array.from({ length: 20 }, (_, i) => `แถว ${i + 1}`)

export default function ParkingMapPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<AuditSession | null>(null)
  const [items, setItems] = useState<ScannedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<ScannedItem | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/audit/session?id=${sessionId}`)
        if (!res.ok) throw new Error('Fetch failed')
        const data = await res.json()
        setSession(data.session)
        setItems(data.items || [])
      } catch (err) {
        console.error('Failed to fetch session', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sessionId])

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-slate-400 text-sm animate-pulse">กำลังโหลดผังจอด...</div>
        </div>
      </AuthGuard>
    )
  }

  if (!session) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="text-rose-400 text-sm">ไม่พบข้อมูล session</div>
        </div>
      </AuthGuard>
    )
  }

  // Build parking grid data
  // Group items by row -> slot
  const gridData: Record<string, Record<string, ScannedItem[]>> = {}
  let maxSlotPerRow: Record<string, number> = {}

  // Items with Row + Slot
  const parkedItems = items.filter(item => item.AuditRow && item.AuditSlot)
  // Items with Row but no Slot (outside slot)
  const outsideItems = items.filter(item => item.AuditRow && !item.AuditSlot)
  // Items with no Row at all
  const unassignedItems = items.filter(item => !item.AuditRow)

  // Populate gridData
  for (const item of parkedItems) {
    const row = item.AuditRow!
    const slot = item.AuditSlot!

    if (!gridData[row]) gridData[row] = {}
    if (!gridData[row][slot]) gridData[row][slot] = []
    gridData[row][slot].push(item)

    const slotNum = parseInt(slot)
    if (!isNaN(slotNum)) {
      maxSlotPerRow[row] = Math.max(maxSlotPerRow[row] || 0, slotNum)
    }
  }

  // Find the global max slot count for consistent grid height
  const globalMaxSlot = Math.max(...Object.values(maxSlotPerRow).map(n => n), 0)
  // Find which rows have data
  const activeRows = ROW_OPTIONS.filter(row => gridData[row] || outsideItems.some(i => i.AuditRow === row))

  // Format date
  const auditDate = new Date(session.AuditDate).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  })

  // Summary counts
  const matchedCount = items.filter(i => i.DetectedStatus === 'MATCHED').length
  const mismatchCount = items.filter(i => i.DetectedStatus === 'MISMATCH').length
  const notInSystemCount = items.filter(i => i.DetectedStatus === 'NOT_IN_SYSTEM').length

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/60">
          <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/audit/${sessionId}`)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold transition"
              >
                ← กลับ
              </button>
              <div>
                <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                  📍 ผังจอดรถ
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  รอบ {auditDate} • {session.LocationName || session.Location} • {items.length} คัน
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-400/80"></div>
                <span className="text-[10px] text-slate-400 font-bold">ตรงพิกัด ({matchedCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-400/80"></div>
                <span className="text-[10px] text-slate-400 font-bold">ผิดพิกัด ({mismatchCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-rose-400/80"></div>
                <span className="text-[10px] text-slate-400 font-bold">ไม่มีในระบบ ({notInSystemCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-slate-700 border border-slate-600"></div>
                <span className="text-[10px] text-slate-400 font-bold">ว่าง</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Area */}
        <div className="max-w-[1800px] mx-auto px-6 py-6">
          {activeRows.length === 0 ? (
            <div className="text-center py-20 text-slate-500 text-sm">
              ยังไม่มีข้อมูลแถว/ช่อง ให้แสดง
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              {/* Grid: Columns = แถว (vertical), Rows = ช่อง (horizontal) */}
              <div className="inline-flex" style={{ minWidth: 'fit-content' }}>
                {/* Slot labels column */}
                <div className="flex flex-col gap-0.5 pt-6 pr-0.5">
                  {Array.from({ length: globalMaxSlot }, (_, i) => (
                    <div
                      key={`label-${i}`}
                      className="h-[34px] flex items-center justify-center text-[8px] font-bold text-slate-600 w-6"
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>

                {/* Each แถว as a vertical column, with double-park gap between */}
                {activeRows.map((row) => {
                  const rowOutside = outsideItems.filter(i => i.AuditRow === row)
                  
                  // Separate normal cars and double-parked cars
                  const normalCars: Record<string, ScannedItem[]> = {}
                  const doubleParkedCars: Record<string, ScannedItem[]> = {}

                  if (gridData[row]) {
                    for (const [slot, cars] of Object.entries(gridData[row])) {
                      for (const car of cars) {
                        if (car.SlotPosition === 1) {
                          if (!doubleParkedCars[slot]) doubleParkedCars[slot] = []
                          doubleParkedCars[slot].push(car)
                        } else {
                          if (!normalCars[slot]) normalCars[slot] = []
                          normalCars[slot].push(car)
                        }
                      }
                    }
                  }

                  const hasDoubleParked = Object.keys(doubleParkedCars).length > 0

                  return (
                    <React.Fragment key={row}>
                      {/* Normal row column */}
                      <div className="flex flex-col gap-0.5">
                        <div className="text-center text-[8px] font-black text-indigo-400 uppercase tracking-wider h-5 flex items-center justify-center bg-indigo-500/5 border border-indigo-500/10 rounded mx-0.5">
                          {row}
                        </div>

                        {Array.from({ length: globalMaxSlot }, (_, slotIdx) => {
                          const slotNum = String(slotIdx + 1)
                          const carsInSlot = normalCars[slotNum] || []

                          if (carsInSlot.length === 0) {
                            return (
                              <div key={`${row}-${slotNum}`} className="w-[64px] h-[34px] bg-slate-900/40 border border-slate-800/30 rounded flex items-center justify-center mx-0.5">
                                <span className="text-[7px] text-slate-700">—</span>
                              </div>
                            )
                          }

                          const car = carsInSlot[0]
                          const sc = getStatusColor(car.DetectedStatus)

                          return (
                            <button key={`${row}-${slotNum}`} onClick={() => setSelectedItem(car)} className={`w-[64px] h-[34px] ${sc.bg} border ${sc.border} rounded p-1 text-left transition hover:brightness-125 cursor-pointer relative mx-0.5`}>
                              <div className={`text-[8px] font-black ${sc.text} truncate leading-tight`}>{car.RegisterNo || '—'}</div>
                              <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            </button>
                          )
                        })}

                        <div className="text-center text-[7px] text-slate-600 font-bold mt-0.5">
                          {Object.values(normalCars).flat().length}
                          {rowOutside.length > 0 && `+${rowOutside.length}`}
                        </div>
                      </div>

                      {/* Double-park column between this row and next */}
                      {hasDoubleParked && (
                        <div className="flex flex-col gap-0.5">
                          <div className="h-5 flex items-center justify-center">
                            <span className="text-[10px]">🚗</span>
                          </div>
                          {Array.from({ length: globalMaxSlot }, (_, slotIdx) => {
                            const slotNum = String(slotIdx + 1)
                            const dpCars = doubleParkedCars[slotNum]
                            if (!dpCars || dpCars.length === 0) {
                              return <div key={`dp-${row}-${slotNum}`} className="w-[40px] h-[34px]" />
                            }
                            const car = dpCars[0]
                            const sc = getStatusColor(car.DetectedStatus)
                            return (
                              <button key={`dp-${row}-${slotNum}`} onClick={() => setSelectedItem(car)} className={`w-[40px] h-[34px] ${sc.bg} border ${sc.border} border-dashed rounded p-0.5 text-left transition hover:brightness-125 cursor-pointer relative ring-1 ring-amber-500/30`} title={`ซ้อนคัน: ${car.RegisterNo || car.VinNo}`}>
                                <div className={`text-[7px] font-black ${sc.text} truncate leading-tight`}>{car.RegisterNo?.split('-')[1] || '—'}</div>
                                <div className={`absolute top-0.5 right-0.5 w-1 h-1 rounded-full ${sc.dot}`} />
                              </button>
                            )
                          })}
                          <div className="text-center text-[6px] text-amber-500/50 font-bold mt-0.5">{Object.values(doubleParkedCars).flat().length}</div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>
          )}

          {/* Outside Slot Section */}
          {outsideItems.length > 0 && (
            <div className="mt-8 border-t border-slate-800/50 pt-6">
              <h2 className="text-sm font-black text-rose-300 mb-3">🚫 จอดนอกช่อง ({outsideItems.length} คัน)</h2>
              <div className="flex flex-wrap gap-2">
                {outsideItems.map(item => {
                  const sc = getStatusColor(item.DetectedStatus)
                  return (
                    <button
                      key={item.AuditItemID}
                      onClick={() => setSelectedItem(item)}
                      className={`${sc.bg} border ${sc.border} rounded-lg px-3 py-2 text-left transition hover:brightness-125 cursor-pointer`}
                    >
                      <div className={`text-[10px] font-black ${sc.text}`}>
                        {item.RegisterNo || item.VinNo}
                      </div>
                      <div className="text-[8px] text-slate-500 font-medium">
                        {item.AuditRow} • {item.Model || '—'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Unassigned Section */}
          {unassignedItems.length > 0 && (
            <div className="mt-6 border-t border-slate-800/50 pt-6">
              <h2 className="text-sm font-black text-slate-400 mb-3">📋 ไม่ระบุแถว ({unassignedItems.length} คัน)</h2>
              <div className="flex flex-wrap gap-2">
                {unassignedItems.map(item => {
                  const sc = getStatusColor(item.DetectedStatus)
                  return (
                    <button
                      key={item.AuditItemID}
                      onClick={() => setSelectedItem(item)}
                      className={`${sc.bg} border ${sc.border} rounded-lg px-3 py-2 text-left transition hover:brightness-125 cursor-pointer`}
                    >
                      <div className={`text-[10px] font-black ${sc.text}`}>
                        {item.RegisterNo || item.VinNo}
                      </div>
                      <div className="text-[8px] text-slate-500 font-medium">
                        {item.Model || '—'}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail Popup */}
        {selectedItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setSelectedItem(null)}
          >
            <div
              className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-sm font-black text-slate-200">
                  🚗 {selectedItem.RegisterNo || 'ไม่มีทะเบียน'}
                </h3>
                <button onClick={() => setSelectedItem(null)} className="text-slate-500 hover:text-slate-300 text-lg font-bold">×</button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">VIN</span>
                  <span className="font-mono text-slate-300 text-[10px]">{selectedItem.VinNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Model</span>
                  <span className="text-slate-300 font-bold">{selectedItem.Model || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">สี</span>
                  <span className="text-slate-300">{selectedItem.Exterior_Color || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ตำแหน่ง</span>
                  <span className="text-indigo-300 font-bold">
                    {selectedItem.AuditRow || '—'}{selectedItem.AuditSlot ? ` ช่อง ${selectedItem.AuditSlot}` : ' (นอกช่อง)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">สถานะ</span>
                  <span className={`font-bold ${getStatusColor(selectedItem.DetectedStatus).text}`}>
                    {getStatusColor(selectedItem.DetectedStatus).label}
                  </span>
                </div>
                {selectedItem.PreviousLocationName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">พิกัดเดิม</span>
                    <span className="text-amber-300">{selectedItem.PreviousLocationName}</span>
                  </div>
                )}
                {selectedItem.StatusTypeName && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">ประเภท</span>
                    <span className="text-slate-300">{selectedItem.StatusTypeName}</span>
                  </div>
                )}
                {selectedItem.SlotPosition === 1 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">การจอด</span>
                    <span className="text-amber-400 font-bold">🚗🚗 ซ้อนคัน</span>
                  </div>
                )}
                {selectedItem.Notes && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">หมายเหตุ</span>
                    <span className="text-cyan-300">{selectedItem.Notes}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">เช็กโดย</span>
                  <span className="text-slate-300">{selectedItem.CreatedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">เวลา</span>
                  <span className="text-slate-300">
                    {new Date(selectedItem.ScanTime).toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'UTC'
                    })}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition mt-2"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
