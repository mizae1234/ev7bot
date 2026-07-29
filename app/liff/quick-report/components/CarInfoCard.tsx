'use client'

import React from 'react'

interface DbCar {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project: string
  Status?: string
  StatusType?: string
  StatusName?: string
  SubStatusName?: string
  CurrentLocation?: string | null
}

interface CarInfoCardProps {
  car: DbCar
  carDetails?: any
  locationMap: Map<string, string>
  onDeselect: () => void
  /** If true, show a compact card without status badges, location, etc. */
  compact?: boolean
  activeContractNo?: string
}

/** Returns the Tailwind badge class for a given Thai status name */
function getStatusBadgeClass(name: string): string {
  if (name.includes('ว่าง') || name.includes('พร้อม') || name.includes('ไม่ได้ใช้งาน')) {
    return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  } else if (name.includes('ใช้งาน')) {
    return 'bg-blue-50 border-blue-200 text-blue-700'
  } else if (name.includes('จอดรอ') || name.includes('รอซ่อม')) {
    return 'bg-amber-50 border-amber-200 text-amber-700'
  } else if (name.includes('ระหว่างซ่อม') || name.includes('กำลังซ่อม') || name.includes('เข้าซ่อม')) {
    return 'bg-rose-50 border-rose-200 text-rose-700'
  } else if (name.includes('เสร็จ') || name.includes('สำเร็จ')) {
    return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  }
  return 'bg-slate-100 border-slate-200 text-slate-600'
}

export default function CarInfoCard({ car, carDetails, locationMap, onDeselect, compact = false, activeContractNo }: CarInfoCardProps) {
  const currentLocationCode = carDetails?.CurrentLocation || car.CurrentLocation
  const currentLocationName = currentLocationCode
    ? (locationMap.get(currentLocationCode) || currentLocationCode)
    : null

  return (
    <div className="flex items-center justify-between bg-slate-50 border border-emerald-300 rounded-2xl p-3">
      <div>
        <p className="text-base font-bold text-slate-800">
          <a
            href={`/vehicle/${encodeURIComponent(car.RegisterNo)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-indigo-650 inline-flex items-center gap-1"
            title="ดูรายละเอียดเพิ่มเติม"
          >
            {car.RegisterNo}
            <span className="text-[10px] font-normal text-indigo-400/80">(ดูรายละเอียด ↗)</span>
          </a>
        </p>
        <p className="text-xs text-slate-500 font-mono">VIN: {car.VinNo}</p>

        {compact ? (
          /* Dashboard tab: simple one-liner */
          <p className="text-xxs text-slate-655 mt-1">
            โครงการ: <span className="font-bold text-emerald-700">{car.Project}</span> | รุ่น: {car.Model}
          </p>
        ) : (
          /* Full version with status badges */
          <>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-xxs text-slate-655">
                โครงการ: <span className="font-bold text-emerald-700">{car.Project}</span> | รุ่น: {car.Model}
              </span>

              {/* Active Contract */}
              {activeContractNo && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded border bg-blue-50 border-blue-200 text-blue-700">
                  สัญญา: {activeContractNo}
                </span>
              )}

              {/* Status Badge */}
              {carDetails?.StatusName && (() => {
                const name = carDetails.SubStatusName || carDetails.StatusName
                const badgeClass = getStatusBadgeClass(name)
                return (
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded border ${badgeClass}`}>
                    {name}
                  </span>
                )
              })()}

              {/* StatusType Badge */}
              {carDetails?.StatusType && (
                <span className="px-1.5 py-0.5 text-[8px] font-mono font-bold rounded border bg-indigo-50 border-indigo-200 text-indigo-600">
                  {carDetails.StatusType.replace(/_/g, ' ')}
                </span>
              )}

              {/* Replacement Vehicle Badge */}
              {carDetails?.MainVehicleRegisterNo && (
                <span className="px-1.5 py-0.5 text-[8px] font-bold rounded border bg-amber-50 border-amber-250 text-amber-700">
                  ทดแทนของคัน: {carDetails.MainVehicleRegisterNo}
                </span>
              )}
            </div>

            {/* Current Location */}
            {currentLocationName && (
              <div className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
                <span>📍 สถานที่ปัจจุบัน:</span>
                <span className="font-bold text-slate-800">{currentLocationName}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Deselect button */}
      <button
        type="button"
        onClick={onDeselect}
        className="bg-white hover:bg-slate-100 p-2 rounded-full text-slate-400 hover:text-slate-600 transition border border-slate-200 shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
