'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoginProfile } from '@/components/ui/LoginProfile'

// ─── Types ─────────────────────────────────────────────────────────

interface CarInfo {
  InventoryItemID: number
  VinNo: string
  MotorNo: string
  RegisterNo: string
  Model: string
  Project: string
  ProjectType: string
  Company: string
  StatusCode: string
  StatusType: string
  Exterior_Color: string
  Interior_Color: string
  IsActive: boolean
}

interface RentInfo {
  ContractNo: string
  ContractType: string
  FirstName: string
  LastName: string
  PhoneNo: string
  ExpectedReleaseDate: string
  ReleaseDate: string
  ContractCancellationDate: string | null
  IsActive?: boolean
}

interface ReplacementInfo {
  VinNo: string
  ReplacementStartDate: string
  ReplacementReturnDate: string | null
  Location: string
  Remark: string
}

interface MaintenanceInfo {
  MaintenanceItemID: number
  ReportDate: string
  IncidentDate: string | null
  MaintenanceStartDate: string | null
  MaintenanceFinishDate: string | null
  MaintenanceReturnDate: string | null
  CarStatusCode: string
  CarStatusDescription: string
  IssueTitle: string
  ProblemTypeDescription: string
  FaultParty: string
  CarCase: string
  ServiceLocation: string
  Insurance: string
  FollowUpDetail: string
  IsActive: boolean
  replacements: ReplacementInfo[]
  DriverName?: string | null
  RootCauseFound?: string | null
  FixAction?: string | null
  LastFollowUpDate?: string | null
  ParentMaintenanceItemID?: number | string | null
  CreateDate?: string | null
  UpdateDate?: string | null
  CreateUserID?: number | null
  UpdateUserID?: number | null
}

interface ReturnInfo {
  CustomerName: string
  ContractNo: string
  ReceiveDate: string
  ReturnDate: string
  Mileage: number
  ParkLocation: string
}

interface VehicleData {
  car: CarInfo
  currentRent: RentInfo | null
  rentHistory: RentInfo[]
  maintenance: MaintenanceInfo[]
  returns: ReturnInfo[]
}

// ─── Helper Functions ──────────────────────────────────────────────

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch {
    return dateStr
  }
}

function getStatusInfo(code: string): { label: string; color: string; bg: string; icon: string } {
  const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    PRODUCTION: { label: 'ผลิต', color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300', icon: '🏭' },
    AVAILABLE: { label: 'พร้อมส่ง', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: '✅' },
    ON_RENT: { label: 'ปล่อยรถแล้ว', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-300', icon: '🚗' },
    MAINTENANCE: { label: 'ซ่อม', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', icon: '🔧' },
    REPLACEMENT: { label: 'รถทดแทน', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-300', icon: '🔄' },
    WAITING_FOR_GR: { label: 'รอ GR', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300', icon: '📦' },
  }
  return map[code] || { label: code, color: 'text-zinc-700', bg: 'bg-zinc-100 border-zinc-300', icon: '📋' }
}

function getRepairStatusInfo(code: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    COMPLETE: { label: 'ซ่อมเสร็จ', color: 'text-emerald-600' },
    IN_MAINTENANCE: { label: 'กำลังซ่อม', color: 'text-amber-600' },
    WAITING_FOR_MAINTENANCE: { label: 'รอซ่อม', color: 'text-red-600' },
    STILL_WORK: { label: 'ยังใช้งานอยู่', color: 'text-blue-600' },
  }
  return map[code] || { label: code, color: 'text-zinc-600' }
}

// ─── Page Component ────────────────────────────────────────────────

export default function VehicleDetailPage() {
  const params = useParams()
  const registerNo = decodeURIComponent(params.registerNo as string)

  const [data, setData] = useState<VehicleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/vehicle/${encodeURIComponent(registerNo)}`)
        if (!res.ok) {
          const err = await res.json()
          setError(err.error || 'ไม่พบข้อมูลรถ')
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError('ไม่สามารถโหลดข้อมูลได้')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [registerNo])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} registerNo={registerNo} />
  if (!data) return null

  const { car, currentRent, rentHistory = [], maintenance, returns } = data
  const statusInfo = getStatusInfo(car.StatusCode)
  const activeMaint = maintenance.find(m => m.IsActive && m.CarStatusCode !== 'COMPLETE')

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-white/80 border-b border-zinc-200/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 transition-colors text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Dashboard
            </a>
            <span className="text-zinc-300">|</span>
            <h1 className="text-sm font-bold text-zinc-800">🚗 ข้อมูลรถ {car.RegisterNo || car.VinNo}</h1>
          </div>
          <LoginProfile />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ── Car Info Card ── */}
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-medium">
                  {car.RegisterNo ? 'ทะเบียน' : 'เลข VIN (ยังไม่มีทะเบียน)'}
                </p>
                <h2 className="text-2xl font-extrabold text-white tracking-wide">
                  {car.RegisterNo || car.VinNo || '-'}
                </h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.icon} {statusInfo.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-zinc-100">
            <InfoCell label="รุ่น" value={car.Model} />
            <InfoCell label="VIN" value={car.VinNo} mono />
            <InfoCell label="Project" value={`${car.Project || '-'} / ${car.ProjectType || '-'}`} />
            <InfoCell label="บริษัท" value={car.Company} />
            <InfoCell label="สีภายนอก" value={car.Exterior_Color || '-'} />
            <InfoCell label="สีภายใน" value={car.Interior_Color || '-'} />
          </div>
        </div>

        {/* ── Current Rent ── */}
        {currentRent && (
          <SectionCard title="📋 สัญญาเช่าปัจจุบัน" color="blue">
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="ลูกค้า" value={`${currentRent.FirstName} ${currentRent.LastName}`} />
              <InfoItem label="เลขสัญญา" value={currentRent.ContractNo} />
              <InfoItem label="เบอร์โทร" value={currentRent.PhoneNo || '-'} />
              <InfoItem label="ประเภทสัญญา" value={currentRent.ContractType || '-'} />
              <InfoItem label="วันนัดส่งมอบ" value={formatDate(currentRent.ExpectedReleaseDate)} />
              <InfoItem label="วันส่งมอบจริง" value={formatDate(currentRent.ReleaseDate)} />
            </div>
          </SectionCard>
        )}

        {/* ── Rent History ── */}
        {rentHistory.length > 0 && (
          <SectionCard title={`📋 ประวัติการปล่อยเช่า (${rentHistory.length} รายการ)`} color="zinc">
            <div className="space-y-3">
              {rentHistory.map((r, i) => (
                <div key={i} className={`rounded-xl border p-3 ${r.IsActive ? 'border-blue-300 bg-blue-50/30' : 'border-zinc-200 bg-zinc-50/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-zinc-800">สัญญาเช่า {r.ContractNo}</span>
                    {r.IsActive && <span className="text-xs font-bold text-blue-600">สัญญาปัจจุบัน</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-zinc-500">ลูกค้า: <span className="text-zinc-700">{r.FirstName} {r.LastName}</span></span>
                    <span className="text-zinc-500">ประเภท: <span className="text-zinc-700">{r.ContractType || '-'}</span></span>
                    <span className="text-zinc-500">เบอร์โทร: <span className="text-zinc-700">{r.PhoneNo || '-'}</span></span>
                    <span className="text-zinc-500">วันนัดส่งมอบ: <span className="text-zinc-700">{formatDate(r.ExpectedReleaseDate)}</span></span>
                    <span className="text-zinc-500">วันส่งมอบจริง: <span className="text-zinc-700">{formatDate(r.ReleaseDate)}</span></span>
                    {r.ContractCancellationDate && (
                      <span className="text-zinc-500 col-span-2 text-red-500">วันยกเลิกสัญญา: <span>{formatDate(r.ContractCancellationDate)}</span></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Active Maintenance ── */}
        {activeMaint && (
          <SectionCard title="🔧 งานซ่อมปัจจุบัน" color="amber">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${getRepairStatusInfo(activeMaint.CarStatusCode).color}`}>
                  ● {getRepairStatusInfo(activeMaint.CarStatusCode).label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="วันที่เกิดเหตุ" value={formatDate(activeMaint.IncidentDate)} />
                <InfoItem label="วันที่รับแจ้ง" value={formatDate(activeMaint.ReportDate)} />
                <InfoItem label="ประกัน" value={activeMaint.Insurance || '-'} />
                <InfoItem label="ประเภทของปัญหา" value={activeMaint.ProblemTypeDescription || '-'} />
                <InfoItem label="ฝ่ายผิด" value={activeMaint.FaultParty || '-'} />
                <InfoItem label="เรื่องที่แจ้ง" value={activeMaint.IssueTitle || '-'} />
                <InfoItem label="กรณีรถ" value={activeMaint.CarCase || '-'} />
                <InfoItem label="สถานที่ซ่อม" value={activeMaint.ServiceLocation || '-'} />
                <InfoItem label="วันเริ่มซ่อม" value={formatDate(activeMaint.MaintenanceStartDate)} />
                <InfoItem label="ซ่อมเสร็จ" value={formatDate(activeMaint.MaintenanceFinishDate)} />
                <InfoItem label="สถานะใบแจ้งซ่อม" value={activeMaint.CarStatusDescription || '-'} />
                <InfoItem label="คนขับ (Driver)" value={activeMaint.DriverName || '-'} />
                <InfoItem label="สาเหตุที่พบ (Root Cause)" value={activeMaint.RootCauseFound || '-'} />
                <InfoItem label="การแก้ไข (Fix Action)" value={activeMaint.FixAction || '-'} />
                <InfoItem label="วันติดตามล่าสุด" value={formatDate(activeMaint.LastFollowUpDate)} />
                <InfoItem label="ใบสั่งซ่อมหลัก ID" value={activeMaint.ParentMaintenanceItemID?.toString() || '-'} />
                <InfoItem label="วันที่สร้าง" value={formatDate(activeMaint.CreateDate)} />
                <InfoItem label="วันที่อัปเดต" value={formatDate(activeMaint.UpdateDate)} />
                <InfoItem label="ผู้สร้าง / ผู้แก้ไข (ID)" value={`${activeMaint.CreateUserID || '-'} / ${activeMaint.UpdateUserID || '-'}`} />
              </div>
              {activeMaint.FollowUpDetail && (
                <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
                  <p className="text-xs text-amber-600 font-medium mb-1">📝 ติดตามล่าสุด</p>
                  <p className="text-sm text-zinc-700">{activeMaint.FollowUpDetail}</p>
                </div>
              )}
              {activeMaint.replacements.length > 0 && (
                <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100">
                  <p className="text-xs text-purple-600 font-medium mb-2">🔄 รถทดแทน</p>
                  {activeMaint.replacements.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-700 font-mono">{r.VinNo}</span>
                      <span className="text-zinc-500">{formatDate(r.ReplacementStartDate)} — {formatDate(r.ReplacementReturnDate)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* ── Maintenance History ── */}
        {maintenance.length > 0 && (
          <SectionCard title={`🔧 ประวัติซ่อม (${maintenance.length} รายการ)`} color="zinc">
            <div className="space-y-3">
              {maintenance.map((m, i) => {
                const repairStatus = getRepairStatusInfo(m.CarStatusCode)
                return (
                  <div key={i} className={`rounded-xl border p-3 ${m.IsActive && m.CarStatusCode !== 'COMPLETE' ? 'border-amber-300 bg-amber-50/30' : 'border-zinc-200 bg-zinc-50/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-zinc-800">
                        ID: <span className="font-mono font-bold text-zinc-550 text-xs">{m.MaintenanceItemID}</span> | {m.IssueTitle || 'ไม่ระบุอาการ'}
                      </span>
                      <span className={`text-xs font-bold ${repairStatus.color}`}>{repairStatus.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-zinc-500">วันเกิดเหตุ: <span className="text-zinc-700">{formatDate(m.IncidentDate)}</span></span>
                      <span className="text-zinc-500">วันแจ้ง: <span className="text-zinc-700">{formatDate(m.ReportDate)}</span></span>
                      <span className="text-zinc-500">ประเภท: <span className="text-zinc-700">{m.ProblemTypeDescription || '-'}</span></span>
                      <span className="text-zinc-500">ฝ่ายผิด: <span className="text-zinc-700">{m.FaultParty || '-'}</span></span>
                      <span className="text-zinc-500">สถานที่: <span className="text-zinc-700">{m.ServiceLocation || '-'}</span></span>
                      <span className="text-zinc-500">กรณีรถ: <span className="text-zinc-700">{m.CarCase || '-'}</span></span>
                      <span className="text-zinc-500">ประกัน: <span className="text-zinc-700">{m.Insurance || '-'}</span></span>
                      <span className="text-zinc-500">เริ่มซ่อม: <span className="text-zinc-700">{formatDate(m.MaintenanceStartDate)}</span></span>
                      <span className="text-zinc-500">ซ่อมเสร็จ: <span className="text-zinc-700">{formatDate(m.MaintenanceFinishDate)}</span></span>
                      <span className="text-zinc-500">วันรับรถคืน: <span className="text-zinc-700">{formatDate(m.MaintenanceReturnDate)}</span></span>
                      <span className="text-zinc-500">คนขับ (Driver): <span className="text-zinc-700">{m.DriverName || '-'}</span></span>
                      <span className="text-zinc-500">สาเหตุที่พบ: <span className="text-zinc-700">{m.RootCauseFound || '-'}</span></span>
                      <span className="text-zinc-500">การแก้ไข: <span className="text-zinc-700">{m.FixAction || '-'}</span></span>
                      <span className="text-zinc-500">วันติดตามล่าสุด: <span className="text-zinc-700">{formatDate(m.LastFollowUpDate)}</span></span>
                      <span className="text-zinc-500">ใบสั่งซ่อมหลัก ID: <span className="text-zinc-700">{m.ParentMaintenanceItemID || '-'}</span></span>
                      <span className="text-zinc-500">วันที่สร้าง: <span className="text-zinc-700">{formatDate(m.CreateDate)}</span></span>
                      <span className="text-zinc-500">วันที่อัปเดต: <span className="text-zinc-700">{formatDate(m.UpdateDate)}</span></span>
                      <span className="text-zinc-500">ผู้สร้าง/แก้ไข (ID): <span className="text-zinc-700">{m.CreateUserID || '-'} / {m.UpdateUserID || '-'}</span></span>
                    </div>
                    {m.FollowUpDetail && (
                      <div className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg text-zinc-600 dark:text-zinc-300">
                        <strong>หมายเหตุ:</strong> {m.FollowUpDetail}
                      </div>
                    )}
                    {m.replacements.length > 0 && (
                      <div className="mt-2 text-xs text-purple-600">
                        🔄 รถทดแทน: {m.replacements.map(r => r.VinNo).join(', ')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* ── Return History ── */}
        {returns.length > 0 && (
          <SectionCard title={`📦 ประวัติรับคืน (${returns.length} รายการ)`} color="zinc">
            <div className="space-y-2">
              {returns.map((r, i) => (
                <div key={i} className="rounded-xl border border-zinc-200 bg-zinc-50/30 p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-zinc-500">ลูกค้า: <span className="text-zinc-700">{r.CustomerName || '-'}</span></span>
                    <span className="text-zinc-500">สัญญา: <span className="text-zinc-700">{r.ContractNo || '-'}</span></span>
                    <span className="text-zinc-500">วันรับคืน: <span className="text-zinc-700">{formatDate(r.ReturnDate)}</span></span>
                    <span className="text-zinc-500">เลขไมล์: <span className="text-zinc-700">{r.Mileage?.toLocaleString() || '-'} km</span></span>
                    <span className="text-zinc-500">จอดที่: <span className="text-zinc-700">{r.ParkLocation || '-'}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-zinc-400 py-4">
          🧈 Butter • EV7 Tracking System
        </div>
      </main>
    </div>
  )
}

// ─── Sub Components ────────────────────────────────────────────────

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-zinc-800 ${mono ? 'font-mono text-xs' : ''}`}>{value || '-'}</p>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-medium text-zinc-700">{value}</p>
    </div>
  )
}

function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const borderMap: Record<string, string> = {
    blue: 'border-l-blue-500',
    amber: 'border-l-amber-500',
    zinc: 'border-l-zinc-400',
  }
  return (
    <div className={`bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden border-l-4 ${borderMap[color] || 'border-l-zinc-400'}`}>
      <div className="px-5 py-3 border-b border-zinc-100">
        <h3 className="text-sm font-bold text-zinc-800">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-zinc-500">กำลังโหลดข้อมูลรถ...</p>
      </div>
    </div>
  )
}

function ErrorState({ message, registerNo }: { message: string; registerNo: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 flex items-center justify-center">
      <div className="text-center space-y-3 max-w-sm px-4">
        <div className="text-4xl">🚗❌</div>
        <h2 className="text-lg font-bold text-zinc-800">ไม่พบข้อมูลรถ</h2>
        <p className="text-sm text-zinc-500">{message}</p>
        <p className="text-xs text-zinc-400">ค้นหา: &quot;{registerNo}&quot;</p>
        <a href="/dashboard" className="inline-block mt-2 text-sm text-emerald-600 font-medium hover:underline">
          ← กลับ Dashboard
        </a>
      </div>
    </div>
  )
}
