'use client'

import React from 'react'

interface FilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  selectedLocation: string
  onLocationChange: (v: string) => void
  selectedAssessment: string
  onAssessmentChange: (v: string) => void
  selectedDocStatus: string
  onDocStatusChange: (v: string) => void
  startDate: string
  onStartDateChange: (v: string) => void
  endDate: string
  onEndDateChange: (v: string) => void
  locations: Array<{ code: string; name: string }>
  onReset: () => void
}

export default function FilterBar({
  search, onSearchChange,
  selectedLocation, onLocationChange,
  selectedAssessment, onAssessmentChange,
  selectedDocStatus, onDocStatusChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  locations,
  onReset,
}: FilterBarProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
          <span>🔍</span> ค้นหาและกรองข้อมูล
        </h4>
        <button
          onClick={onReset}
          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition active:scale-95"
        >
          ล้างตัวกรองทั้งหมด ✖
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Search text */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500">คำค้นหา</label>
          <input
            type="text"
            placeholder="ทะเบียน, VIN, ลูกค้า, ผู้ตรวจ..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        {/* Location filter */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500">สถานที่คืนรถ</label>
          <select
            value={selectedLocation}
            onChange={e => onLocationChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
          >
            <option value="">-- ทั้งหมด --</option>
            {locations.map(loc => (
              <option key={loc.code} value={loc.code}>{loc.name}</option>
            ))}
          </select>
        </div>

        {/* Assessment filter */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500">ผลการประเมินรถ</label>
          <select
            value={selectedAssessment}
            onChange={e => onAssessmentChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
          >
            <option value="">-- ทั้งหมด --</option>
            <option value="ปกติ">ปกติ (Normal)</option>
            <option value="ต้องส่งเข้าซ่อม">ต้องส่งเข้าซ่อม (Needs Repair)</option>
            <option value="รอผลการตรวจ">รอผลการตรวจ (Pending)</option>
          </select>
        </div>

        {/* Document Status filter */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500">สถานะเอกสาร</label>
          <select
            value={selectedDocStatus}
            onChange={e => onDocStatusChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
          >
            <option value="">-- ทั้งหมด --</option>
            <option value="DRAFT">ฉบับร่าง (DRAFT)</option>
            <option value="SUBMIT">เสร็จสมบูรณ์ (SUBMIT)</option>
          </select>
        </div>

        {/* Date Start */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500">ตั้งแต่วันที่</label>
          <input
            type="date"
            value={startDate}
            onChange={e => onStartDateChange(e.target.value)}
            className="w-full px-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
          />
        </div>

        {/* Date End */}
        <div className="space-y-1">
          <label className="text-[9px] font-bold text-slate-500">ถึงวันที่</label>
          <input
            type="date"
            value={endDate}
            onChange={e => onEndDateChange(e.target.value)}
            className="w-full px-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
          />
        </div>
      </div>
    </div>
  )
}
