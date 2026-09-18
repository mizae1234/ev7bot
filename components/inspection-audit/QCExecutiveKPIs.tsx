import React from 'react'

export interface QCKPIMetrics {
  total: number
  passed: number
  failed: number
  avgBattery: number | null
}

interface QCExecutiveKPIsProps {
  kpis: QCKPIMetrics
  isToday: boolean
}

export const QCExecutiveKPIs: React.FC<QCExecutiveKPIsProps> = ({ kpis, isToday }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {/* Card 1: Total Inspected */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 flex items-center justify-center text-base sm:text-lg shrink-0">
          🚗
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate">
            {isToday ? 'ตรวจวันนี้' : 'ตรวจตามตัวกรอง'}
          </p>
          <p className="text-base sm:text-lg font-black text-slate-900 leading-tight">
            {kpis.total} <span className="text-[11px] font-normal text-slate-500">คัน</span>
          </p>
        </div>
      </div>

      {/* Card 2: Passed QC */}
      <div className="bg-white border border-emerald-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-emerald-50/40 to-transparent">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-base sm:text-lg shrink-0">
          🟢
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-emerald-700 font-bold uppercase tracking-wider truncate">
            ผ่าน QC (พร้อมส่ง)
          </p>
          <p className="text-base sm:text-lg font-black text-emerald-800 leading-tight">
            {kpis.passed} <span className="text-[11px] font-normal text-emerald-600">คัน</span>
          </p>
        </div>
      </div>

      {/* Card 3: Failed QC */}
      <div className="bg-white border border-rose-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-rose-50/40 to-transparent">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-base sm:text-lg shrink-0">
          🔴
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-rose-700 font-bold uppercase tracking-wider truncate">
            ไม่ผ่าน (ต้องแก้ไข)
          </p>
          <p className="text-base sm:text-lg font-black text-rose-800 leading-tight">
            {kpis.failed} <span className="text-[11px] font-normal text-rose-600">คัน</span>
          </p>
        </div>
      </div>

      {/* Card 4: Average Battery HV SoC */}
      <div className="bg-white border border-amber-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-center gap-3 bg-gradient-to-br from-amber-50/40 to-transparent">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-base sm:text-lg shrink-0">
          🔋
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] text-amber-700 font-bold uppercase tracking-wider truncate">
            แบตเตอรี่ HV เฉลี่ย
          </p>
          <p className="text-base sm:text-lg font-black text-amber-900 leading-tight font-mono">
            {kpis.avgBattery != null ? `${kpis.avgBattery}%` : '-'}
          </p>
        </div>
      </div>
    </div>
  )
}
