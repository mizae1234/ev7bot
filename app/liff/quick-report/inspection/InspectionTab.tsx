'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { VehicleSearchWithScanner } from '@/components/vehicle/VehicleSearchWithScanner'
import type { InspectionItemData, InspectionData, InspectionListItem } from '@/lib/inspection/types'
import InspectionChecklist from './InspectionChecklist'
import InspectionHistory from './InspectionHistory'
import CarInfoCard from '../components/CarInfoCard'

interface SelectedCar {
  InventoryItemID: number
  VinNo: string
  RegisterNo: string
  Model: string
  Project?: string
  Status?: string
  StatusType?: string
  StatusName?: string
  SubStatusName?: string
  CurrentLocation?: string | null
}

interface InspectionTabProps {
  getLineUserId: () => string | null
  sharedSelectedCar?: SelectedCar | null  // รถที่เลือกจาก tab อื่น
  carDetails?: any
  locationMap: Map<string, string>
  onDeselect: () => void
  activeContractNo?: string
  setActiveContractNo?: (contractNo: string) => void
  onSelectCar?: (car: any) => void
  currentUserFullName?: string
}

type TabView = 'search' | 'checklist'

export default function InspectionTab({
  getLineUserId,
  sharedSelectedCar,
  carDetails,
  locationMap,
  onDeselect,
  activeContractNo,
  setActiveContractNo,
  onSelectCar,
  currentUserFullName,
}: InspectionTabProps) {
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

  // ---- Master Items ----
  const [masterItems, setMasterItems] = useState<any[]>([])

  useEffect(() => {
    async function loadMaster() {
      try {
        const res = await fetch('/api/inspection/master')
        if (res.ok) {
          const data = await res.json()
          setMasterItems(data.masterItems || [])
        }
      } catch (err) {
        console.error('Failed to load master items:', err)
      }
    }
    loadMaster()
  }, [])

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
    } else {
      setSelectedCar(null)
      setInspectionId(null)
      setInspectionDetail(null)
      setView('search')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedSelectedCar?.VinNo])

  // ---- Handle car selection (from local search) ----
  const handleSelectCar = useCallback(async (car: SelectedCar) => {
    if (onSelectCar) {
      onSelectCar(car)
    } else {
      setSelectedCar(car)
      setInspectionId(null)
      setInspectionDetail(null)
      await fetchHistory(car.VinNo)
      setView('checklist')
    }
  }, [fetchHistory, onSelectCar])

  // ---- Load inspection detail (for viewing existing) ----
  const handleViewDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/inspection/${id}`)
      if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ')
      const data = await res.json()
      setInspectionDetail(data.inspection)
      setInspectionId(id)

      // Sync activeContractNo to parent so that accident tickets and other features get the correct contract
      if (setActiveContractNo) {
        const resolvedContract = data.inspection?.contractNo || carDetails?.activeContractNo || activeContractNo || ''
        setActiveContractNo(resolvedContract)
      }

      setView('checklist')
    } catch (err: any) {
      showAlert(err.message || 'เกิดข้อผิดพลาด', 'error')
    }
  }, [showAlert, setActiveContractNo, carDetails, activeContractNo])

  // ---- Save inspection (create or update) ----
  const handleSave = useCallback(async (data: {
    items: InspectionItemData[]
    mileage: number | null
    remark: string | null
    returnDate: string
    parkLocation: string
    inspectorName?: string | null
    inspectorUserId?: number | null
    returnReason?: string | null
    assessmentResult?: string | null
    customerName?: string | null
    customerContact?: string | null
    contractCancellationDate?: string | null
    isPendingChecklist?: boolean
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
        returnDate: data.returnDate,
        parkLocation: data.parkLocation,
        inspectorName: data.inspectorName,
        inspectorUserId: data.inspectorUserId,
        returnReason: data.returnReason,
        carStatus: selectedCar.Status,
        carStatusType: selectedCar.StatusType,
        assessmentResult: data.assessmentResult,
        customerName: data.customerName,
        customerContact: data.customerContact,
        contractCancellationDate: data.contractCancellationDate,
        isPendingChecklist: data.isPendingChecklist,
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
      const resolvedId = result.inspectionId || inspectionId
      setInspectionId(resolvedId)

      if (resolvedId) {
        await handleViewDetail(resolvedId)
      }

      showAlert('บันทึกฉบับร่างเรียบร้อย ✅')

      await fetchHistory(selectedCar.VinNo)
      return resolvedId as number
    } catch (err: any) {
      showAlert(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }, [selectedCar, inspectionId, getLineUserId, fetchHistory, showAlert, handleViewDetail])

  // ---- Complete inspection ----
  const handleComplete = useCallback(async (data: {
    items: InspectionItemData[]
    mileage: number | null
    remark: string | null
    returnDate: string
    parkLocation: string
    inspectorName?: string | null
    inspectorUserId?: number | null
    returnReason?: string | null
    assessmentResult?: string | null
    customerName?: string | null
    customerContact?: string | null
    contractCancellationDate?: string | null
    isPendingChecklist?: boolean
  }) => {
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
          mileage: data.mileage,
          remark: data.remark,
          items: data.items,
          returnDate: data.returnDate,
          parkLocation: data.parkLocation,
          lineUserId: getLineUserId(),
          inspectorName: data.inspectorName,
          inspectorUserId: data.inspectorUserId,
          returnReason: data.returnReason,
          carStatus: selectedCar?.Status,
          carStatusType: selectedCar?.StatusType,
          assessmentResult: data.assessmentResult,
          customerName: data.customerName,
          customerContact: data.customerContact,
          contractCancellationDate: data.contractCancellationDate,
          isPendingChecklist: data.isPendingChecklist,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'อัปเดตไม่สำเร็จ')
      }

      showAlert('ยืนยันตรวจสภาพเสร็จสิ้น ✅')
      
      // Refresh the car details in the parent
      if (onSelectCar && selectedCar) {
        await onSelectCar(selectedCar)
      }

      setInspectionId(null)
      setInspectionDetail(null)

      if (selectedCar) {
        await fetchHistory(selectedCar.VinNo)
      }
    } catch (err: any) {
      showAlert(err.message || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setSaving(false)
    }
  }, [inspectionId, getLineUserId, showAlert, onSelectCar, selectedCar, fetchHistory])



  const handlePhotoUploaded = useCallback((newPhotos: any[]) => {
    setInspectionDetail(prev => {
      if (!prev) return null
      const existingIds = new Set(prev.photos.map(p => p.inspectionPhotoId))
      const filteredNew = newPhotos.filter(p => !existingIds.has(p.inspectionPhotoId))
      return {
        ...prev,
        photos: [...prev.photos, ...filteredNew]
      }
    })
  }, [])

  const handlePhotoDeleted = useCallback((photoId: number) => {
    setInspectionDetail(prev => {
      if (!prev) return null
      return {
        ...prev,
        photos: prev.photos.filter(p => p.inspectionPhotoId !== photoId)
      }
    })
    showAlert('ลบรูปภาพเรียบร้อยแล้ว ✅')
  }, [showAlert])

  // ---- Render ----

  // Check if the selected vehicle is not in an allowable status (ON_RENT, MAINTENANCE with ON_RENT_MAINTENANCE StatusType, or REPLACEMENT with REPLACEMENT_CAR StatusType)
  const isNotAllowedStatus = (() => {
    if (!selectedCar) return false
    // If the inspection is already COMPLETED, let them view it anyway
    if (inspectionDetail?.status === 'COMPLETED') return false
    
    const statusCode = (carDetails?.StatusCode || selectedCar.Status || '').toUpperCase()
    const statusType = (carDetails?.StatusType || selectedCar.StatusType || '').toUpperCase()
    if (!statusCode) return false // Still loading
    
    if (statusCode === 'ON_RENT') {
      return false
    }
    if (statusCode === 'MAINTENANCE' && statusType === 'ON_RENT_MAINTENANCE') {
      return false
    }
    if (statusCode === 'REPLACEMENT' && statusType === 'REPLACEMENT_CAR') {
      return false
    }
    return true
  })()

  // Check if there is an active draft return inspection in the history list
  const hasActiveDraft = useMemo(() => {
    return historyList.some(item => item.status === 'DRAFT' && item.inspectionType === 'RETURN')
  }, [historyList])

  const showDraftSelectionNotice = hasActiveDraft && inspectionId === null

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
          onClick={() => {
            setView('search')
            setSelectedCar(null)
            setInspectionId(null)
            setInspectionDetail(null)
            onDeselect()
          }}
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
          {/* Header Title */}
          <div className="flex items-center justify-between mt-1">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              🔄 บันทึกตรวจสภาพคืนรถ
            </h3>
          </div>

          {/* Shared Car Info Card */}
          <CarInfoCard
            car={selectedCar as any}
            carDetails={carDetails}
            locationMap={locationMap}
            onDeselect={() => {
              setView('search')
              setSelectedCar(null)
              setInspectionId(null)
              setInspectionDetail(null)
              onDeselect()
            }}
            activeContractNo={activeContractNo}
          />

          {/* Warning banner if not allowed status */}
          {isNotAllowedStatus && (() => {
            const statusNameText = carDetails?.SubStatusName || carDetails?.StatusName || selectedCar?.SubStatusName || selectedCar?.StatusName || selectedCar?.Status || 'อื่นๆ'
            return (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-800 text-sm flex items-start gap-3 shadow-sm animate-scale-up">
                <span className="text-xl">⚠️</span>
                <div className="flex-1 space-y-1">
                  <p className="font-bold">ไม่สามารถบันทึกคืนรถได้</p>
                  <p className="text-xs text-rose-600">
                    รถคันนี้อยู่ในสถานะ <span className="font-bold">"{statusNameText}"</span> (ระบบอนุญาตให้บันทึกคืนรถได้เฉพาะรถที่อยู่ในสถานะ "อยู่ระหว่างเช่า", "รถเช่าเข้าซ่อม" หรือ "รถทดแทนใช้งานอยู่" เท่านั้น)
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Draft Selection Notice */}
          {!isNotAllowedStatus && showDraftSelectionNotice && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm flex items-start gap-3 shadow-sm animate-scale-up">
              <span className="text-xl">📝</span>
              <div className="flex-1 space-y-1">
                <p className="font-bold">พบรายการบันทึกฉบับร่างค้างอยู่</p>
                <p className="text-xs text-amber-600">
                  รถคันนี้มีรายงานการตรวจสภาพคืนรถที่เป็นฉบับร่างอยู่ กรุณากดเลือกรายการฉบับร่างที่ "ประวัติการตรวจสภาพ" ด้านล่างเพื่อทำการแก้ไขหรือส่งตรวจสภาพต่อ
                </p>
              </div>
            </div>
          )}

          {/* Checklist form */}
          {!isNotAllowedStatus && !showDraftSelectionNotice && masterItems.length > 0 && (
            <InspectionChecklist
              masterItems={masterItems}
              inspectionId={inspectionId}
              existingItems={inspectionDetail?.items || []}
              existingPhotos={inspectionDetail?.photos || []}
              mileage={inspectionDetail?.mileage}
              remark={inspectionDetail?.remark}
              status={inspectionDetail?.status || 'DRAFT'}
              disabled={inspectionDetail?.status === 'COMPLETED' && !inspectionDetail?.isPendingChecklist}
              existingIsPendingChecklist={inspectionDetail?.isPendingChecklist}
              existingReturnDate={inspectionDetail?.returnDate}
              existingParkLocation={inspectionDetail?.location}
              onSave={handleSave}
              onComplete={handleComplete}
              saving={saving}
              defaultInspectorName={inspectionDetail?.inspectorName || currentUserFullName}
              defaultReturnReason={inspectionDetail?.returnReason}
              defaultCustomerName={carDetails?.currentRent?.CustomerName || ''}
              existingCustomerName={inspectionDetail?.customerName}
              existingCustomerContact={inspectionDetail?.customerContact}
              existingContractCancellationDate={inspectionDetail?.contractCancellationDate}
              inventoryItemId={selectedCar?.InventoryItemID}
              registerNo={selectedCar?.RegisterNo}
              lineUserId={getLineUserId()}
              contractNo={activeContractNo || inspectionDetail?.contractNo}
              showAlert={showAlert}
              onPhotoDeleted={handlePhotoDeleted}
              onPhotoUploaded={handlePhotoUploaded}
            />
          )}

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
