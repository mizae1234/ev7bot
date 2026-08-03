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
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-450 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
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
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pr-1">
        {auditedVehicles.length > 0 ? (
          auditedVehicles.map(item => {
            const isActive = activeVin === item.vinNo
            return (
              <div
                key={item.vinNo}
                onClick={() => onSelectVehicle(item)}
                className={`p-3.5 rounded-xl cursor-pointer transition flex justify-between items-center border ${
                  isActive
                    ? 'bg-indigo-50 border-indigo-250 shadow-sm'
                    : 'hover:bg-slate-50 border-transparent active:bg-slate-100'
                }`}
              >
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">{item.registerNo || 'ทะเบียน -'}</h4>
                  <p className="text-[9px] font-mono text-slate-400 mt-0.5">{item.vinNo}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">ผู้ตรวจ: {item.inspectorName || '-'}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-extrabold">
                  ✓ ตรวจแล้ว
                </span>
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
