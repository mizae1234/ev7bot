'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { VehicleSearchWithScanner } from '@/components/vehicle/VehicleSearchWithScanner'
import type { InspectionItemData, InspectionData, InspectionListItem } from '@/lib/inspection/types'
import InspectionChecklist from './InspectionChecklist'
import InspectionHistory from './InspectionHistory'

interface SelectedCar {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project?: string
  Status?: string
}

interface InspectionTabProps {
  getLineUserId: () => string | null
  sharedSelectedCar?: SelectedCar | null  // รถที่เลือกจาก tab อื่น
}

type TabView = 'search' | 'checklist'

export default function InspectionTab({ getLineUserId, sharedSelectedCar }: InspectionTabProps) {
  // ---- Core state ----
  const [view, setView] = useState<TabView>('search')
  const [selectedCar, setSelectedCar] = useState<SelectedCar | null>(null)

  // ---- Inspection data ----
  const [inspectionId, setInspectionId] = useState<number | null>(null)
  const [inspectionDetail, setInspectionDetail] = useState<InspectionData | null>(null)
  const [saving, setSaving] = useState(false)

  // ---- History ----
  const [historyList, setHistoryList] = useState<InspectionListItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // ---- Alert ----
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showAlert = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type })
    setTimeout(() => setAlertMsg(null), 3000)
  }, [])

  // ---- Fetch history for a vehicle ----
  const fetchHistory = useCallback(async (vinNo: string) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/inspection?vinNo=${encodeURIComponent(vinNo)}&type=RETURN`)
      if (res.ok) {
        const data = await res.json()
        setHistoryList(data.inspections || [])
      }
    } catch (err) {
      console.error('Failed to fetch inspection history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // ---- Auto-load shared car from parent ----
  useEffect(() => {
    if (sharedSelectedCar && sharedSelectedCar.VinNo) {
      // ถ้ารถเปลี่ยน (VIN ต่างจากที่เลือกอยู่) → load ใหม่
      if (!selectedCar || selectedCar.VinNo !== sharedSelectedCar.VinNo) {
        setSelectedCar(sharedSelectedCar)
        setInspectionId(null)
        setInspectionDetail(null)
        fetchHistory(sharedSelectedCar.VinNo)
        setView('checklist')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedSelectedCar?.VinNo])

  // ---- Handle car selection (from local search) ----
  const handleSelectCar = useCallback(async (car: SelectedCar) => {
    setSelectedCar(car)
    setInspectionId(null)
    setInspectionDetail(null)
    await fetchHistory(car.VinNo)
    setView('checklist')
  }, [fetchHistory])

  // ---- Save inspection (create or update) ----
  const handleSave = useCallback(async (data: {
    items: InspectionItemData[]
    mileage: number | null
    remark: string | null
  }) => {
    if (!selectedCar) return
    setSaving(true)

    try {
      const payload: any = {
        vinNo: selectedCar.VinNo,
        registerNo: selectedCar.RegisterNo,
        inspectionType: 'RETURN',
        inspectionDate: new Date().toISOString().slice(0, 10),
        mileage: data.mileage,
        remark: data.remark,
        items: data.items,
        lineUserId: getLineUserId(),
      }

      if (inspectionId) {
        payload.inspectionId = inspectionId
      }

      const res = await fetch('/api/inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'บันทึกไม่สำเร็จ')
      }

      const result = await res.json()
      setInspectionId(result.inspectionId)
      showAlert('บันทึกฉบับร่างเรียบร้อย ✅')

      await fetchHistory(selectedCar.VinNo)
    } catch (err: any) {
      showAlert(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedCar, inspectionId, getLineUserId, fetchHistory, showAlert])

  // ---- Complete inspection ----
  const handleComplete = useCallback(async () => {
    if (!inspectionId) {
      showAlert('กรุณาบันทึกฉบับร่างก่อน', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/inspection/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          items: [],
          lineUserId: getLineUserId(),
        }),
      })

      if (!res.ok) throw new Error('อัปเดตไม่สำเร็จ')

      showAlert('ยืนยันตรวจสภาพเสร็จสิ้น ✅')
      setView('search')
      setSelectedCar(null)
      setInspectionId(null)
    } catch (err: any) {
      showAlert(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }, [inspectionId, getLineUserId, showAlert])

  // ---- Load inspection detail (for viewing existing) ----
  const handleViewDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/inspection/${id}`)
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ')
      const data = await res.json()
      setInspectionDetail(data.inspection)
      setInspectionId(id)
      setView('checklist')
    } catch (err: any) {
      showAlert(err.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }, [showAlert])

  // ---- Render ----

  return (
    <div className="space-y-4 pb-4">
      {/* Alert toast */}
      {alertMsg && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-3 rounded-2xl text-sm font-medium shadow-lg border transition-all ${
          alertMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          {alertMsg.text}
        </div>
      )}

      {/* Back button */}
      {view === 'checklist' && (
        <button
          type="button"
          onClick={() => { setView('search'); setSelectedCar(null); setInspectionId(null); setInspectionDetail(null) }}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition"
        >
          <span>←</span> ย้อนกลับ
        </button>
      )}

      {/* ===== VIEW: SEARCH ===== */}
      {view === 'search' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            🔍 ค้นหารถที่ต้องการบันทึกคืน
          </h3>
          <VehicleSearchWithScanner
            onSelectCar={(car: any) => handleSelectCar(car)}
            placeholder="ค้นหาทะเบียน หรือ เลข VIN"
          />
        </div>
      )}

      {/* ===== VIEW: CHECKLIST ===== */}
      {view === 'checklist' && selectedCar && (
        <>
          {/* Car info */}
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-2.5 shadow-sm flex items-center gap-3">
            <span className="text-lg">🚗</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{selectedCar.RegisterNo}</p>
              <p className="text-[11px] text-slate-500">{selectedCar.Model} • {selectedCar.VinNo}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
              🔄 คืนรถ
            </span>
          </div>

          {/* Checklist form */}
          <InspectionChecklist
            inspectionId={inspectionId}
            existingItems={inspectionDetail?.items || []}
            existingPhotos={inspectionDetail?.photos || []}
            mileage={inspectionDetail?.mileage}
            remark={inspectionDetail?.remark}
            status={inspectionDetail?.status || 'DRAFT'}
            disabled={inspectionDetail?.status === 'COMPLETED'}
            onSave={handleSave}
            onComplete={handleComplete}
            saving={saving}
          />

          {/* History */}
          <InspectionHistory
            inspections={historyList}
            loading={loadingHistory}
            onSelect={handleViewDetail}
          />
        </>
      )}
    </div>
  )
}
