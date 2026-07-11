'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { LoginProfile } from '@/components/ui/LoginProfile'
import { AuthGuard } from '@/components/ui/AuthGuard'

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
  StatusName?: string | null
  SubStatusName?: string | null
  MainVehicleRegisterNo?: string | null
  MainVehicleVin?: string | null
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

interface MaintenanceFollowUpInfo {
  MaintenanceFollowUpID: number
  MaintenanceItemID: number
  FollowUpDate: string | null
  FollowUpDetail: string | null
  IsActive: boolean
  CreateDate: string
  CreateUserID: number | null
  UpdateDate: string | null
  UpdateUserID: number | null
  CreateUserName?: string | null
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
  followUps?: MaintenanceFollowUpInfo[]
  DriverName?: string | null
  RootCauseFound?: string | null
  FixAction?: string | null
  LastFollowUpDate?: string | null
  ParentMaintenanceItemID?: number | string | null
  CreateDate?: string | null
  UpdateDate?: string | null
  CreateUserID?: number | null
  UpdateUserID?: number | null
  CreateUserName?: string | null
  UpdateUserName?: string | null
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
    const d = new Date(dateStr)
    const day = d.getUTCDate()
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
    const month = months[d.getUTCMonth()]
    const year = d.getUTCFullYear() + 543
    return `${day} ${month} ${year}`
  } catch {
    return dateStr
  }
}

function getStatusInfo(code: string, customLabel?: string | null): { label: string; color: string; bg: string; icon: string } {
  const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    PRODUCTION: { label: 'ผลิต', color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300', icon: '🏭' },
    AVAILABLE: { label: 'พร้อมส่ง', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', icon: '✅' },
    ON_RENT: { label: 'ปล่อยรถแล้ว', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-300', icon: '🚗' },
    MAINTENANCE: { label: 'ซ่อม', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', icon: '🔧' },
    REPLACEMENT: { label: 'รถทดแทน', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-300', icon: '🔄' },
    WAITING_FOR_GR: { label: 'รอ GR', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300', icon: '📦' },
  }
  const base = map[code] || { label: code, color: 'text-zinc-700', bg: 'bg-zinc-100 border-zinc-300', icon: '📋' }
  if (customLabel) {
    return { ...base, label: customLabel }
  }
  return base
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

function VehicleDetailContent() {
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

  const { car, currentRent, rentHistory = [], maintenance = [], returns = [] } = data
  const statusInfo = getStatusInfo(
    car.StatusCode,
    car.StatusCode === 'AVAILABLE' && car.SubStatusName ? car.SubStatusName : car.StatusName
  )
  const activeMaint = maintenance.find(m => m.IsActive && m.CarStatusCode !== 'COMPLETE')

  // Consolidate all follow-ups from all maintenance items
  const allFollowUps = (maintenance || [])
    .flatMap(m => (m.followUps || []).map(f => ({
      ...f,
      maintId: m.MaintenanceItemID,
      issueTitle: m.IssueTitle
    })))
    .sort((a, b) => new Date(b.FollowUpDate || b.CreateDate || '').getTime() - new Date(a.FollowUpDate || a.CreateDate || '').getTime())

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-emerald-50/30 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900/40 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-lg bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="flex items-center gap-1 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors text-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Dashboard
            </a>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <a href="/maintenance/dashboard" className="text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 transition-colors text-sm">
              🔧 ซ่อมบำรุง
            </a>
            <span className="text-zinc-300 dark:text-zinc-700">|</span>
            <h1 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">🚗 ข้อมูลรถ {car.RegisterNo || car.VinNo}</h1>
          </div>
          <LoginProfile />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* ── Car Info Card ── */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 dark:from-emerald-700 dark:to-emerald-800 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 dark:text-emerald-200 text-xs font-medium">
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

          <div className="grid grid-cols-2 gap-px bg-zinc-100 dark:bg-zinc-800">
            <InfoCell label="รุ่น" value={car.Model} />
            <InfoCell label="VIN" value={car.VinNo} mono />
            <InfoCell label="Project" value={`${car.Project || '-'} / ${car.ProjectType || '-'}`} />
            <InfoCell label="บริษัท" value={car.Company} />
            <InfoCell label="สีภายนอก" value={car.Exterior_Color || '-'} />
            <InfoCell label="สีภายใน" value={car.Interior_Color || '-'} />
          </div>

          {car.MainVehicleRegisterNo && (
            <div className="bg-amber-50/50 dark:bg-amber-950/10 px-5 py-3.5 border-t border-zinc-200/60 dark:border-zinc-800/85 flex items-center justify-between text-xs animate-fade-in">
              <span className="font-medium text-amber-800 dark:text-amber-300">🔄 เป็นรถทดแทนของคัน:</span>
              <a 
                href={`/vehicle/${car.MainVehicleRegisterNo}`}
                className="font-bold text-amber-950 dark:text-amber-250 hover:underline flex items-center gap-1 bg-amber-100/50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg border border-amber-200/30 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/30"
              >
                🚗 {car.MainVehicleRegisterNo} <span className="font-mono font-normal text-amber-800/80 dark:text-amber-400/80 text-[10.5px]">({car.MainVehicleVin})</span>
              </a>
            </div>
          )}
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
                <div key={i} className={`rounded-xl border p-3 ${r.IsActive ? 'border-blue-300 bg-blue-50/30 dark:border-blue-800/40 dark:bg-blue-950/20' : 'border-zinc-200 bg-zinc-50/30 dark:border-zinc-800/40 dark:bg-zinc-900/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">สัญญาเช่า {r.ContractNo}</span>
                    {!!r.IsActive && <span className="text-xs font-bold text-blue-600 dark:text-blue-450">สัญญาปัจจุบัน</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">ลูกค้า: <span className="text-zinc-700 dark:text-zinc-300">{r.FirstName} {r.LastName}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">ประเภท: <span className="text-zinc-700 dark:text-zinc-300">{r.ContractType || '-'}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">เบอร์โทร: <span className="text-zinc-700 dark:text-zinc-300">{r.PhoneNo || '-'}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">วันนัดส่งมอบ: <span className="text-zinc-700 dark:text-zinc-300">{formatDate(r.ExpectedReleaseDate)}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">วันส่งมอบจริง: <span className="text-zinc-700 dark:text-zinc-300">{formatDate(r.ReleaseDate)}</span></span>
                    {r.ContractCancellationDate && (
                      <span className="text-zinc-500 dark:text-zinc-400 col-span-2 text-red-500 dark:text-red-400 font-medium">วันยกเลิกสัญญา: <span>{formatDate(r.ContractCancellationDate)}</span></span>
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
                <InfoItem label="ผู้สร้าง / ผู้แก้ไข" value={`${activeMaint.CreateUserName || '-'} / ${activeMaint.UpdateUserName || '-'}`} />
              </div>
              {activeMaint.FollowUpDetail && (
                <div className="bg-amber-50/60 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200/80 dark:border-amber-900/50">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-bold mb-1">📝 ติดตามล่าสุด</p>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed">{activeMaint.FollowUpDetail}</p>
                </div>
              )}
              {activeMaint.followUps && activeMaint.followUps.length > 0 && (
                <div className="bg-zinc-50/80 dark:bg-zinc-950/40 rounded-xl p-3 border border-zinc-250 dark:border-zinc-800 space-y-2.5">
                  <p className="text-xs text-zinc-800 dark:text-zinc-200 font-bold mb-1">📋 ประวัติการติดตาม (Follow Up Logs)</p>
                  <div className="space-y-3 border-l-2 border-zinc-300 dark:border-zinc-700 pl-3.5 ml-1">
                    {activeMaint.followUps.map((f, fi) => (
                      <div key={fi} className="relative text-xs">
                        <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-850 shadow-sm" />
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 font-semibold mb-1">
                          <span>{formatDate(f.FollowUpDate || f.CreateDate)}</span>
                          <span>โดย {f.CreateUserName || `User ${f.CreateUserID || '-'}`}</span>
                        </div>
                        <p className="text-zinc-900 dark:text-zinc-100 font-semibold leading-relaxed">{f.FollowUpDetail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeMaint.replacements.length > 0 && (
                <div className="bg-purple-50/60 dark:bg-purple-950/20 rounded-xl p-3 border border-purple-200/80 dark:border-purple-900/50">
                  <p className="text-xs text-purple-700 dark:text-purple-400 font-bold mb-2">🔄 รถทดแทน</p>
                  {activeMaint.replacements.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-800 dark:text-zinc-200 font-mono font-semibold">{r.VinNo}</span>
                      <span className="text-zinc-500 dark:text-zinc-450">{formatDate(r.ReplacementStartDate)} — {formatDate(r.ReplacementReturnDate)}</span>
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
                  <div key={i} className={`rounded-xl border p-3 ${m.IsActive && m.CarStatusCode !== 'COMPLETE' ? 'border-amber-300 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/20' : 'border-zinc-200 bg-zinc-50/30 dark:border-zinc-800/40 dark:bg-zinc-900/30'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        ID: <span className="font-mono font-bold text-zinc-500 dark:text-zinc-400 text-xs">{m.MaintenanceItemID}</span> | {m.IssueTitle || 'ไม่ระบุอาการ'}
                      </span>
                      <span className={`text-xs font-bold ${repairStatus.color}`}>{repairStatus.label}</span>
                    </div>
                    {m.IsActive && m.CarStatusCode !== 'COMPLETE' && (() => {
                      let nextToDo = ''
                      let bgColor = ''
                      let textColor = ''
                      if (m.CarStatusCode === 'WAITING_FOR_MAINTENANCE' || m.CarStatusCode === 'IN_MAINTENANCE') {
                        nextToDo = '📌 Next to do : อู่เร่งซ่อมรถ , EV7 ติดตามการซ่อมรถ'
                        bgColor = 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40'
                        textColor = 'text-amber-700 dark:text-amber-400'
                      } else if (m.CarStatusCode === 'STILL_WORK') {
                        nextToDo = '📌 Next to do : EV7/ICI ติดตามลูกค้าเข้าซ่อม'
                        bgColor = 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40'
                        textColor = 'text-blue-700 dark:text-blue-400'
                      } else if (m.CarStatusCode === 'READY_PICKUP_MAINTENANCE') {
                        nextToDo = '📌 Next to do : EV7 ติดตามลูกค้าเข้ารับรถ'
                        bgColor = 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40'
                        textColor = 'text-orange-700 dark:text-orange-400'
                      }
                      return nextToDo ? (
                        <div className={`rounded-lg border px-3 py-2 mb-1 ${bgColor}`}>
                          <p className={`text-xs font-bold ${textColor}`}>{nextToDo}</p>
                        </div>
                      ) : null
                    })()}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal">วันเกิดเหตุ: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.IncidentDate)}</span></span>
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal">วันแจ้ง: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.ReportDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">ประเภท: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.ProblemTypeDescription || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">ฝ่ายผิด: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.FaultParty || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">สถานที่: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.ServiceLocation || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">กรณีรถ: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.CarCase || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">ประกัน: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.Insurance || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">เริ่มซ่อม: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.MaintenanceStartDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">ซ่อมเสร็จ: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.MaintenanceFinishDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">วันรับรถคืน: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.MaintenanceReturnDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">คนขับ (Driver): <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.DriverName || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">สาเหตุที่พบ: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.RootCauseFound || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">การแก้ไข: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.FixAction || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">วันติดตามล่าสุด: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.LastFollowUpDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">ใบสั่งซ่อมหลัก ID: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.ParentMaintenanceItemID || '-'}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">วันที่สร้าง: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.CreateDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">วันที่อัปเดต: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(m.UpdateDate)}</span></span>
                      <span className="text-zinc-550 dark:text-zinc-400 font-normal">ผู้สร้าง/แก้ไข: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{m.CreateUserName || '-'} / {m.UpdateUserName || '-'}</span></span>
                    </div>
                    {m.FollowUpDetail && (
                      <div className="mt-2 text-xs bg-zinc-100 dark:bg-zinc-955/40 p-2 rounded-lg text-zinc-700 dark:text-zinc-300 border border-zinc-200/40 dark:border-zinc-800/40">
                        <strong>หมายเหตุ:</strong> {m.FollowUpDetail}
                      </div>
                    )}
                    {m.followUps && m.followUps.length > 0 && (
                      <div className="mt-3 bg-zinc-50/80 dark:bg-zinc-950/40 p-3 rounded-lg border border-zinc-250 dark:border-zinc-800">
                        <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider mb-2">📋 ประวัติการติดตาม ({m.followUps.length} รายการ)</p>
                        <div className="space-y-3 border-l-2 border-zinc-300 dark:border-zinc-700 pl-3.5 ml-1">
                          {m.followUps.map((f, fi) => (
                            <div key={fi} className="relative text-[11px] leading-relaxed">
                              <span className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-zinc-500 dark:bg-zinc-400 border border-white dark:border-zinc-850 shadow-sm" />
                              <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 font-semibold">
                                <span>{formatDate(f.FollowUpDate || f.CreateDate)}</span>
                                <span>โดย {f.CreateUserName || `User ${f.CreateUserID || '-'}`}</span>
                              </div>
                              <p className="text-zinc-900 dark:text-zinc-100 font-semibold mt-1">{f.FollowUpDetail}</p>
                            </div>
                          ))}
                        </div>
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
                <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/30 p-3">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">ลูกค้า: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{r.CustomerName || '-'}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">สัญญา: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{r.ContractNo || '-'}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">วันรับคืน: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{formatDate(r.ReturnDate)}</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">เลขไมล์: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{r.Mileage?.toLocaleString() || '-'} km</span></span>
                    <span className="text-zinc-500 dark:text-zinc-400">จอดที่: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{r.ParkLocation || '-'}</span></span>
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

export default function VehicleDetailPage() {
  return (
    <AuthGuard>
      <VehicleDetailContent />
    </AuthGuard>
  )
}

// ─── Sub Components ────────────────────────────────────────────────

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-white dark:bg-zinc-900 px-4 py-3">
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-zinc-800 dark:text-zinc-200 ${mono ? 'font-mono text-xs' : ''}`}>{value || '-'}</p>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-400 dark:text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{value}</p>
    </div>
  )
}

function SectionCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const borderMap: Record<string, string> = {
    blue: 'border-l-blue-500 dark:border-l-blue-500',
    amber: 'border-l-amber-500 dark:border-l-amber-500',
    zinc: 'border-l-zinc-400 dark:border-l-zinc-500',
  }
  return (
    <div className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm overflow-hidden border-l-4 ${borderMap[color] || 'border-l-zinc-400'}`}>
      <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{title}</h3>
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
