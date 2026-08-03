'use client'

import React, { useState, useEffect } from 'react'

interface SearchVehicle {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project: string
  Status: string
  StatusType: string
  CurrentLocation: string
}

interface AuditedVehicle {
  inspectionId: number
  vinNo: string
  registerNo: string | null
  model: string | null
  status: string
  inspectionDate: string
  inspectorName?: string
  assessmentResult?: string
  itemCount?: number
}

interface AuditVehicleListProps {
  sessionStatus: 'OPEN' | 'CLOSED'
  auditedVehicles: AuditedVehicle[]
  activeVin: string | undefined
  onSelectVehicle: (vehicle: AuditedVehicle) => void
  onAddVehicle: (vehicle: SearchVehicle) => void
}

export function AuditVehicleList({
  sessionStatus,
  auditedVehicles,
  activeVin,
  onSelectVehicle,
  onAddVehicle,
}: AuditVehicleListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchVehicle[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Debounce search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/vehicles/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 400)

    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Input Box */}
      {sessionStatus === 'OPEN' ? (
        <div className="relative mb-4 flex-none">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            ค้นหาและเพิ่มรถเข้าตรวจ
          </label>
          <input
            type="text"
            placeholder="พิมพ์ ทะเบียนรถ หรือ VIN เพื่อเพิ่มรถ..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />

          {/* Autocomplete Dropdown */}
          {showDropdown && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
              {searching ? (
                <div className="p-3 text-center text-xs text-slate-400">กำลังดึงข้อมูล...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(vehicle => (
                  <div
                    key={vehicle.InventoryItemID}
                    onClick={() => {
                      onAddVehicle(vehicle)
                      setSearchQuery('')
                      setShowDropdown(false)
                    }}
                    className="p-3 hover:bg-slate-50 cursor-pointer text-xs flex justify-between items-center transition"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{vehicle.RegisterNo || 'ไม่มีป้ายทะเบียน'}</p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">{vehicle.VinNo}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[9px] font-medium">
                      {vehicle.Model}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-slate-400">ไม่พบทะเบียนรถคันนี้ในระบบ</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500 font-medium flex-none">
          รอบตรวจสอบนี้ถูกปิดลงแล้ว ไม่สามารถเพิ่มรถได้
        </div>
      )}

      {/* List Header */}
      <div className="flex justify-between items-center border-b border-slate-150 pb-2 mb-2 flex-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          รถที่ลงตรวจในรอบ ({auditedVehicles.length})
        </span>
      </div>

      {/* List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-2">
        {auditedVehicles.length > 0 ? (
          auditedVehicles.map(item => {
            const isActive = activeVin === item.vinNo
            
            // Map assessment label & styling
            const resVal = item.assessmentResult
            const resLabel = resVal === 'NORMAL' ? 'ปกติ' : resVal === 'NEED_REPAIR' ? 'ต้องส่งเข้าซ่อม' : 'รอผลการตรวจ'

            return (
              <div
                key={item.vinNo}
                onClick={() => onSelectVehicle(item)}
                className={`p-3.5 rounded-xl cursor-pointer transition flex flex-col gap-1.5 border ${
                  isActive
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                    : 'hover:bg-slate-50 border-transparent active:bg-slate-100 bg-white'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{item.registerNo || 'ทะเบียน -'}</h4>
                    <p className="text-[9px] font-mono text-slate-400 mt-0.5">{item.vinNo}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                    resVal === 'NORMAL'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : resVal === 'NEED_REPAIR'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-500/10 text-slate-600 border-slate-200'
                  }`}>
                    <span>{resVal === 'NORMAL' ? '✅' : resVal === 'NEED_REPAIR' ? '⚠️' : '⏳'}</span>
                    {resLabel}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1.5 border-t border-slate-100/60">
                  <span>ผู้ตรวจ: <strong className="text-slate-700 font-semibold">{item.inspectorName || '-'}</strong></span>
                  <span>ข้อที่ตรวจ: <strong className="text-slate-800 font-mono font-bold">{item.itemCount ?? 25}/25</strong></span>
                </div>
              </div>
            )
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 font-medium">
            ยังไม่มีรถยนต์ถูกลงทะเบียนตรวจในรอบนี้
          </div>
        )}
      </div>
    </div>
  )
}
