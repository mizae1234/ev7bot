'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { InspectionData, MasterItemDef, InspectionPhotoData } from '@/lib/inspection/types'
import { buildDynamicSections, CHECKLIST_SECTIONS, RESOLVE_STATUS_CONFIG, type ItemResolveStatus } from '@/lib/inspection/checklist-config'
import {
  getSpacesCDN,
  getThaiDate,
  getReasonLabel,
  maskName,
  LICENSE_PLATE_OPTIONS,
  BOOLEAN_OPTIONS,
  BODY_CONDITION_OPTIONS,
} from './constants'
import ImageLightbox from './ImageLightbox'
import { VehicleNotesSection } from '@/components/vehicle/VehicleNotesSection'

interface InspectionDrawerProps {
  inspectionId: number
  masterItems: MasterItemDef[]
  onClose: () => void
}

type TabKey = 'info' | 'checklist' | 'photos' | 'notes'

export default function InspectionDrawer({ inspectionId, masterItems, onClose }: InspectionDrawerProps) {
  const [inspectionDetail, setInspectionDetail] = useState<InspectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [resolveModalData, setResolveModalData] = useState<{
    item: IssueItem
    targetStatus: ItemResolveStatus
    initialRemark: string
  } | null>(null)
  const [isSavingResolution, setIsSavingResolution] = useState(false)

  const SPACES_CDN = getSpacesCDN()

  // Auto-dismiss toast after 3.5s
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // Fetch detail
  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/inspection/${inspectionId}`)
        if (!res.ok) throw new Error('ไม่สามารถดึงรายละเอียดการตรวจสภาพได้')
        const data = await res.json()
        setInspectionDetail(data.inspection)
        setActiveTab('info')
      } catch (err: any) {
        setToast({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล' })
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [inspectionId])

  // Dynamic sections from masterItems
  const dynamicSections = useMemo(() => {
    return buildDynamicSections(masterItems)
  }, [masterItems])

  const [resolvingKey, setResolvingKey] = useState<string | null>(null)

  const handleOpenResolveModal = (item: IssueItem, targetStatus: ItemResolveStatus) => {
    setResolveModalData({
      item,
      targetStatus,
      initialRemark: item.resolveRemark || '',
    })
  }

  const handleConfirmResolve = async (customRemark: string) => {
    if (!resolveModalData) return
    const { item, targetStatus } = resolveModalData
    const key = `${item.category}_${item.itemCode}`
    setResolvingKey(key)
    setIsSavingResolution(true)
    try {
      const res = await fetch(`/api/inspection/${inspectionId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionItemId: item.inspectionItemId,
          category: item.category,
          itemCode: item.itemCode,
          resolveStatus: targetStatus,
          resolveRemark: customRemark || null,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'บันทึกสถานะไม่สำเร็จ')
      }
      const data = await res.json()

      // Update local state
      setInspectionDetail(prev => {
        if (!prev) return prev
        const updatedItems = (prev.items || []).map(it => {
          if (it.category === item.category && it.itemCode === item.itemCode) {
            return {
              ...it,
              resolveStatus: targetStatus,
              resolveRemark: customRemark || null,
              resolveDate: new Date().toISOString(),
            }
          }
          return it
        })
        return {
          ...prev,
          repairStatus: data.updatedRepairStatus,
          items: updatedItems,
        }
      })
      setResolveModalData(null)
      setToast({ type: 'success', message: 'บันทึกสถานะการจัดการจุดชำรุดเรียบร้อยแล้ว' })
    } catch (err: any) {
      setToast({ type: 'error', message: err.message || 'เกิดข้อผิดพลาดในการบันทึกสถานะ' })
    } finally {
      setResolvingKey(null)
      setIsSavingResolution(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-all duration-300">
        {/* Backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Drawer Content */}
        <div className="relative w-full max-w-2xl h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">

          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 className="text-sm font-bold text-slate-900">📋 รายงานผลการตรวจรับคืนรถ</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">เลขรายงานอ้างอิง: #{inspectionId}</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300 transition"
            >
              ✕
            </button>
          </div>

          {/* Loader */}
          {loading || !inspectionDetail ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500">กำลังโหลดรายละเอียดการประเมินสภาพ...</p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-50 px-2 py-1 gap-1 overflow-x-auto">
                <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
                  ℹ️ ข้อมูลรับคืน & สรุปผล
                </TabButton>
                <TabButton active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')}>
                  ✏️ เช็คลิสต์ ({inspectionDetail.items?.length || 0})
                </TabButton>
                <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>
                  📷 ภาพแนบ ({inspectionDetail.photos?.filter(p => p.category !== 'SIGNATURE').length || 0})
                </TabButton>
                <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>
                  💬 โน้ต/แชทติดตามรถ
                </TabButton>
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* INFO TAB */}
                {activeTab === 'info' && (
                  <InfoTab
                    detail={inspectionDetail}
                    dynamicSections={dynamicSections}
                    spacesCDN={SPACES_CDN}
                    onImageClick={setLightboxUrl}
                    onNavigateToChecklist={() => setActiveTab('checklist')}
                    onNavigateToNotes={() => setActiveTab('notes')}
                    onRequestResolveChange={handleOpenResolveModal}
                    resolvingKey={resolvingKey}
                  />
                )}

                {/* CHECKLIST TAB */}
                {activeTab === 'checklist' && (
                  <ChecklistTab
                    detail={inspectionDetail}
                    dynamicSections={dynamicSections}
                    spacesCDN={SPACES_CDN}
                    onImageClick={setLightboxUrl}
                  />
                )}

                {/* PHOTOS TAB */}
                {activeTab === 'photos' && (
                  <PhotosTab
                    detail={inspectionDetail}
                    dynamicSections={dynamicSections}
                    spacesCDN={SPACES_CDN}
                    onImageClick={setLightboxUrl}
                  />
                )}

                {/* NOTES & CHAT TAB */}
                {activeTab === 'notes' && (
                  <div className="space-y-4">
                    {inspectionDetail.inventoryItemId ? (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="pb-3 mb-4 border-b border-slate-100 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span>💬</span> บันทึกโน้ต & แชทติดตามความคืบหน้ารถยนต์
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              ทะเบียน: {inspectionDetail.registerNo || '-'} | เลขตัวถัง (VIN): {inspectionDetail.vinNo}
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            #INSPECTION-{inspectionId}
                          </span>
                        </div>
                        <VehicleNotesSection
                          inventoryItemId={inspectionDetail.inventoryItemId}
                          registerNo={inspectionDetail.registerNo || ''}
                          sourceProcess="INSPECTION"
                          refDocNo={String(inspectionId)}
                        />
                      </div>
                    ) : (
                      <div className="py-16 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
                        <span className="text-2xl block">💬</span>
                        <p className="font-semibold text-slate-600">ไม่พบรหัสสต็อกคลัง (Inventory Item) ของรถคันนี้</p>
                        <p className="text-[11px] text-slate-400">ระบบจำเป็นต้องมีข้อมูลสต็อกคลังเพื่อผูกประวัติแชทและโน้ตติดตามรถยนต์</p>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Actions footer */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-350 hover:text-slate-800 text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-sm"
                >
                  <span>🖨️</span> พิมพ์เอกสารรายงาน
                </button>
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 shadow-sm"
                >
                  ปิดหน้ารายงาน
                </button>
              </div>
            </>
          )}

          {/* Toast Notification */}
          {toast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90%] pointer-events-auto">
              <div
                className={`px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center justify-between gap-2 transition-all ${
                  toast.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : toast.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
                  <span className="truncate">{toast.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="text-slate-400 hover:text-slate-600 shrink-0 font-bold px-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Status Modal Dialog */}
      {resolveModalData && (
        <ResolveStatusModal
          data={resolveModalData}
          isSaving={isSavingResolution}
          onConfirm={handleConfirmResolve}
          onClose={() => {
            if (!isSavingResolution) setResolveModalData(null)
          }}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  )
}

// ─── Sub-components ─────────────────────────────────

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
        active
          ? 'bg-indigo-600 text-white shadow-sm'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Damaged / Issue Item Structure ─────────────────
interface IssueItem {
  inspectionItemId?: number | null
  category: string
  categoryLabel: string
  categoryIcon: string
  itemCode: string
  label: string
  value: string
  valueLabel: string
  detailNote?: string | null
  expiryDate?: string | null
  resolveStatus?: ItemResolveStatus | null
  resolveRemark?: string | null
  resolveDate?: string | null
  photos: InspectionPhotoData[]
  severity: 'danger' | 'warning'
}

// ─── INFO TAB ───────────────────────────────────────

function InfoTab({
  detail,
  dynamicSections,
  spacesCDN,
  onImageClick,
  onNavigateToChecklist,
  onNavigateToNotes,
  onRequestResolveChange,
  resolvingKey,
}: {
  detail: InspectionData
  dynamicSections: ReturnType<typeof buildDynamicSections>
  spacesCDN: string
  onImageClick: (url: string) => void
  onNavigateToChecklist?: () => void
  onNavigateToNotes?: () => void
  onRequestResolveChange?: (item: IssueItem, status: ItemResolveStatus) => void
  resolvingKey?: string | null
}) {
  // Compute comprehensive inspection analysis
  const {
    damagedList,
    totalChecked,
    normalCount,
    issueCount,
    activeIssueCount,
    nonSignaturePhotosCount,
    overallStatus,
    categoryBreakdown,
  } = useMemo(() => {
    const sections = dynamicSections.length > 0 ? dynamicSections : CHECKLIST_SECTIONS
    const issues: IssueItem[] = []
    let checkedItemsCount = 0
    const catMap: Record<string, { label: string; icon: string; total: number; checked: number; issues: number }> = {}

    sections.forEach(sec => {
      catMap[sec.category] = {
        label: sec.label,
        icon: sec.icon,
        total: sec.items.length,
        checked: 0,
        issues: 0,
      }

      sec.items.forEach(itemDef => {
        const savedItem = detail.items?.find(
          i => i.category === sec.category && i.itemCode === itemDef.itemCode
        )
        if (!savedItem || (!savedItem.value && savedItem.numericValue == null)) {
          return
        }

        checkedItemsCount++
        catMap[sec.category].checked++
        const val = savedItem.value

        let isDamaged = false
        let severity: 'danger' | 'warning' = 'danger'
        let valueLabel = val || ''

        if (sec.category === 'ACCIDENT') {
          if (val === 'YES') {
            isDamaged = true
            severity = 'danger'
            valueLabel = 'พบร่องรอย/ประวัติอุบัติเหตุ'
          }
        } else if (sec.category === 'CAR_PHOTOS') {
          // Photos only
        } else if (itemDef.inputType === 'three_way') {
          if (val === 'DENT') {
            isDamaged = true
            severity = 'danger'
            valueLabel = 'บุบ-แตก / มีความเสียหาย'
          } else if (val === 'SCRATCH') {
            isDamaged = true
            severity = 'warning'
            valueLabel = 'มีรอยเฉี่ยว/ขีดข่วน / ชำรุด'
          }
        } else if (itemDef.inputType === 'select') {
          if (val === 'NONE') {
            isDamaged = true
            severity = 'danger'
            valueLabel = 'ไม่มีป้ายทะเบียนรถ'
          } else if (val === 'FRONT_ONLY') {
            isDamaged = true
            severity = 'warning'
            valueLabel = 'มีเฉพาะป้ายหน้า (ป้ายหลังหาย)'
          } else if (val === 'BACK_ONLY') {
            isDamaged = true
            severity = 'warning'
            valueLabel = 'มีเฉพาะป้ายหลัง (ป้ายหน้าหาย)'
          }
        } else if (itemDef.inputType === 'boolean' || itemDef.inputType === 'boolean_expiry') {
          if (val === 'NO') {
            isDamaged = true
            severity = 'danger'
            valueLabel = 'ไม่มี / ชำรุดไม่ปกติ'
          }
        }

        if (isDamaged) {
          catMap[sec.category].issues++
          const matchedPhotos = (detail.photos || []).filter(
            p => p.category === sec.category && p.itemCode === itemDef.itemCode
          )
          issues.push({
            inspectionItemId: savedItem.inspectionItemId,
            category: sec.category,
            categoryLabel: sec.label,
            categoryIcon: sec.icon,
            itemCode: itemDef.itemCode,
            label: itemDef.label,
            value: val || '',
            valueLabel,
            detailNote: savedItem.detail,
            expiryDate: savedItem.expiryDate,
            resolveStatus: (savedItem.resolveStatus || 'PENDING') as ItemResolveStatus,
            resolveRemark: savedItem.resolveRemark,
            resolveDate: savedItem.resolveDate,
            photos: matchedPhotos,
            severity,
          })
        }
      })
    })

    const nonSigPhotos = (detail.photos || []).filter(p => p.category !== 'SIGNATURE')
    const activeIssues = issues.filter(i => i.resolveStatus === 'PENDING' || i.resolveStatus === 'IN_PROGRESS')

    let statusType: 'NORMAL' | 'RESOLVED' | 'NEED_REPAIR' | 'PENDING_CHECKLIST' | 'PENDING' = 'PENDING'
    if (detail.isPendingChecklist) {
      statusType = 'PENDING_CHECKLIST'
    } else if (issues.length > 0 && activeIssues.length === 0) {
      statusType = 'RESOLVED'
    } else if (issues.length > 0 || detail.assessmentResult === 'NEED_REPAIR') {
      statusType = 'NEED_REPAIR'
    } else if (checkedItemsCount > 0 || detail.assessmentResult === 'NORMAL') {
      statusType = 'NORMAL'
    }

    const categoriesList = Object.values(catMap).filter(c => c.checked > 0)

    return {
      damagedList: issues,
      totalChecked: checkedItemsCount,
      normalCount: Math.max(0, checkedItemsCount - issues.length),
      issueCount: issues.length,
      activeIssueCount: activeIssues.length,
      nonSignaturePhotosCount: nonSigPhotos.length,
      overallStatus: statusType,
      categoryBreakdown: categoriesList,
    }
  }, [detail, dynamicSections])

  return (
    <div className="space-y-4">

      {/* ─── 1. สรุปผลการตรวจสภาพ (Inspection Condition Hero Card) ─── */}
      <div className={`p-4 rounded-2xl border transition-all shadow-sm ${
        overallStatus === 'NORMAL' || overallStatus === 'RESOLVED'
          ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
          : overallStatus === 'NEED_REPAIR'
          ? 'bg-rose-50/90 border-rose-200 text-rose-950'
          : overallStatus === 'PENDING_CHECKLIST'
          ? 'bg-purple-50/90 border-purple-200 text-purple-950'
          : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}>
        {/* Banner Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 pb-3 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-xs shrink-0 ${
              overallStatus === 'NORMAL' || overallStatus === 'RESOLVED'
                ? 'bg-emerald-500 text-white'
                : overallStatus === 'NEED_REPAIR'
                ? 'bg-rose-500 text-white'
                : overallStatus === 'PENDING_CHECKLIST'
                ? 'bg-purple-500 text-white'
                : 'bg-slate-400 text-white'
            }`}>
              {overallStatus === 'NORMAL' || overallStatus === 'RESOLVED' ? '✅' : overallStatus === 'NEED_REPAIR' ? '⚠️' : overallStatus === 'PENDING_CHECKLIST' ? '🔄' : '⏳'}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">สรุปผลการตรวจสภาพรถยนต์</p>
              <h4 className="text-base font-black text-slate-900">
                {overallStatus === 'NORMAL'
                  ? 'สภาพปกติสมบูรณ์ ผ่านเกณฑ์ 100%'
                  : overallStatus === 'RESOLVED'
                  ? `จัดการจุดชำรุดครบถ้วนแล้ว (${issueCount} รายการได้รับการซ่อม/ยอมรับสภาพ)`
                  : overallStatus === 'NEED_REPAIR'
                  ? `พบจุดชำรุดเสียหาย ${issueCount} รายการ (ค้างจัดการ ${activeIssueCount} จุด)`
                  : overallStatus === 'PENDING_CHECKLIST'
                  ? 'รับคืนรถแล้ว (รอตรวจเช็คลิสต์ภายหลัง)'
                  : 'รอการตรวจสภาพ'}
              </h4>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border shrink-0 ${
            overallStatus === 'NORMAL' || overallStatus === 'RESOLVED'
              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
              : overallStatus === 'NEED_REPAIR'
              ? 'bg-rose-100 text-rose-800 border-rose-300'
              : overallStatus === 'PENDING_CHECKLIST'
              ? 'bg-purple-100 text-purple-800 border-purple-300'
              : 'bg-slate-200 text-slate-700 border-slate-300'
          }`}>
            {overallStatus === 'NORMAL' ? 'NORMAL' : overallStatus === 'RESOLVED' ? 'RESOLVED' : overallStatus === 'NEED_REPAIR' ? 'NEED REPAIR' : overallStatus === 'PENDING_CHECKLIST' ? 'PENDING CHECK' : 'PENDING'}
          </span>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-4 gap-2 pt-3 text-center">
          <div className="bg-white/80 rounded-xl p-2 border border-black/5 shadow-xs">
            <span className="text-[10px] text-slate-500 font-semibold block">ตรวจแล้ว</span>
            <span className="text-base font-mono font-bold text-slate-800">{totalChecked}</span>
            <span className="text-[9px] text-slate-400 block">ข้อ</span>
          </div>
          <div className="bg-white/80 rounded-xl p-2 border border-black/5 shadow-xs">
            <span className="text-[10px] text-emerald-600 font-semibold block">สภาพปกติ</span>
            <span className="text-base font-mono font-bold text-emerald-700">{normalCount}</span>
            <span className="text-[9px] text-emerald-500 block">ข้อ</span>
          </div>
          <div className={`bg-white/80 rounded-xl p-2 border shadow-xs ${issueCount > 0 ? 'border-rose-300 bg-rose-50/50' : 'border-black/5'}`}>
            <span className={`text-[10px] font-semibold block ${issueCount > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>จุดชำรุด/มีรอย</span>
            <span className={`text-base font-mono font-black ${issueCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{issueCount}</span>
            <span className={`text-[9px] block ${issueCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>จุด</span>
          </div>
          <div className="bg-white/80 rounded-xl p-2 border border-black/5 shadow-xs">
            <span className="text-[10px] text-indigo-600 font-semibold block">รูปถ่ายสภาพ</span>
            <span className="text-base font-mono font-bold text-indigo-700">{nonSignaturePhotosCount}</span>
            <span className="text-[9px] text-indigo-500 block">รูป</span>
          </div>
        </div>
      </div>

      {/* ─── 2. รายการจุดที่พบปัญหา/ความเสียหาย (Damaged & Abnormal Items Detail) ─── */}
      {issueCount > 0 ? (
        <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <span>🛠️</span> รายการจุดที่พบความเสียหาย / ติดตามการซ่อม ({issueCount} จุด)
            </h4>
            {onNavigateToChecklist && (
              <button
                type="button"
                onClick={onNavigateToChecklist}
                className="text-[10px] text-rose-700 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                ดูเช็คลิสต์เต็ม ➔
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {damagedList.map((item, idx) => {
              const currentResolve = item.resolveStatus || 'PENDING'
              const resolveCfg = RESOLVE_STATUS_CONFIG[currentResolve]
              const isResolving = resolvingKey === `${item.category}_${item.itemCode}`

              return (
                <div
                  key={`${item.category}_${item.itemCode}_${idx}`}
                  className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs">{item.categoryIcon}</span>
                        <span className="text-xs font-bold text-slate-800">{item.label}</span>
                        <span className="text-[10px] text-slate-400">({item.categoryLabel})</span>
                      </div>
                      {item.detailNote && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100 mt-1">
                          📝 <span className="font-semibold">โน้ต:</span> {item.detailNote}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      item.severity === 'danger'
                        ? 'bg-rose-100 text-rose-700 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {item.valueLabel}
                    </span>
                  </div>

                  {/* Thumbnails of damaged item */}
                  {item.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                      {item.photos.map((photo, pIdx) => (
                        <div
                          key={photo.inspectionPhotoId || pIdx}
                          onClick={() => onImageClick(`${spacesCDN}/${photo.s3Key}`)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shadow-2xs cursor-pointer hover:scale-105 hover:border-indigo-400 transition relative group"
                          title="คลิกเพื่อดูภาพขนาดเต็ม"
                        >
                          <img
                            src={`${spacesCDN}/${photo.s3Key}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {photo.photoPosition && (
                            <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[7px] text-center font-bold py-0.5 leading-none">
                              {photo.photoPosition}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─── Resolution Management Action Bar ─── */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold">สถานะจัดการ:</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${resolveCfg.badgeClass}`}>
                          <span>{resolveCfg.icon}</span>
                          <span>{resolveCfg.label}</span>
                        </span>
                      </div>

                      {/* Quick action buttons */}
                      {onRequestResolveChange && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {(['PENDING', 'IN_PROGRESS', 'RESOLVED', 'NO_ACTION_NEEDED'] as ItemResolveStatus[]).map(stKey => {
                            const isSelected = currentResolve === stKey
                            const cfg = RESOLVE_STATUS_CONFIG[stKey]
                            return (
                              <button
                                key={stKey}
                                type="button"
                                disabled={isSelected || isResolving}
                                onClick={() => onRequestResolveChange(item, stKey)}
                                className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer disabled:cursor-not-allowed ${
                                  isSelected
                                    ? 'bg-slate-800 text-white shadow-xs'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 hover:border-slate-300'
                                }`}
                                title={cfg.description}
                              >
                                <span>{cfg.icon}</span>
                                <span>{cfg.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {item.resolveRemark && (
                      <p className="text-[10px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60 flex items-center gap-1">
                        <span>💬</span>
                        <span className="font-semibold text-slate-700">บันทึก:</span> {item.resolveRemark}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : totalChecked > 0 ? (
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 text-base">
            ✨
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-800">ไม่พบจุดชำรุดเสียหาย</p>
            <p className="text-[11px] text-emerald-600">รายการตรวจเช็คทั้ง {totalChecked} รายการผ่านเกณฑ์ในสภาพปกติสมบูรณ์ทั้งหมด</p>
          </div>
        </div>
      ) : null}

      {/* ─── 3. หมวดหมู่การตรวจสภาพ (Category Quick Overview) ─── */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
          <h4 className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
            <span>📑</span> สถานะแยกตามหมวดหมู่
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {categoryBreakdown.map(cat => (
              <div
                key={cat.label}
                className="bg-white rounded-xl p-2 border border-slate-200 flex items-center justify-between text-xs"
              >
                <span className="truncate text-slate-700 text-[11px] flex items-center gap-1" title={cat.label}>
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </span>
                {cat.issues > 0 ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-700 shrink-0">
                    พบ {cat.issues} จุด
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-600 shrink-0">
                    ✓ ปกติ
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 4. Return Details Card ─── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>📅</span> รายละเอียดการคืนรถ
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailField label="ทะเบียนรถ" value={detail.registerNo || '-'} bold />
          <DetailField label="เลขตัวถัง (VIN)" value={detail.vinNo} mono />
          <DetailField label="ชื่อลูกค้าที่คืนรถ" value={maskName(detail.customerName)} bold />
          <DetailField label="เบอร์โทรศัพท์ติดต่อ" value={detail.customerContact || '-'} mono />
          <DetailField label="วันที่รับคืนจริง" value={getThaiDate(detail.returnDate || detail.inspectionDate)} bold />
          <DetailField label="วันที่ยกเลิกสัญญา" value={getThaiDate(detail.contractCancellationDate)} bold />
          <DetailField label="สถานที่จอดคืน" value={detail.locationName || detail.location || '-'} bold />
          {(() => {
            const displayMileage = detail.mileage ?? (detail.items?.find(i => i.category === 'MILEAGE' && i.itemCode === 'VALUE')?.numericValue != null ? Math.round(Number(detail.items.find(i => i.category === 'MILEAGE' && i.itemCode === 'VALUE')!.numericValue)) : null)
            return <DetailField label="เลขไมล์สะสม" value={displayMileage != null ? `${displayMileage.toLocaleString()} กม.` : '-'} mono bold />
          })()}
          <div className="space-y-0.5 col-span-2">
            <span className="text-[10px] text-slate-400">เหตุผลในการคืนรถ</span>
            <p className="font-medium text-slate-800">{detail.returnReasonName || getReasonLabel(detail.returnReason)}</p>
          </div>
          <div className="space-y-0.5 col-span-2 border-t border-slate-200 pt-2 mt-1">
            <span className="text-[10px] text-slate-400">เจ้าหน้าที่ผู้ตรวจเช็ค</span>
            <p className="font-bold text-indigo-600">{maskName(detail.inspectorName)}</p>
          </div>
          <div className="space-y-0.5 col-span-2">
            <span className="text-[10px] text-slate-400">หมายเหตุเพิ่มเติม</span>
            <p className="text-slate-700 whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 mt-1">{detail.remark || 'ไม่มีบันทึกข้อความ'}</p>
          </div>
        </div>
      </div>

      {/* ─── 5. Customer signature card ─── */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>✍️</span> ลายเซ็นลูกค้า (ยืนยันส่งคืน)
        </h4>
        <div className="bg-white rounded-xl p-3 border border-slate-200 max-w-[240px] mx-auto">
          {detail.photos.some(p => p.category === 'SIGNATURE') ? (
            detail.photos
              .filter(p => p.category === 'SIGNATURE')
              .map((sig, i) => (
                <img
                  key={i}
                  src={`${spacesCDN}/${sig.s3Key}`}
                  alt="Customer Signature"
                  className="max-h-28 mx-auto object-contain cursor-pointer hover:opacity-90 transition"
                  onClick={() => onImageClick(`${spacesCDN}/${sig.s3Key}`)}
                />
              ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 font-medium">
              ไม่พบลายเซ็นลูกค้าในระบบ
            </div>
          )}
        </div>
      </div>

      {/* ─── 6. Vehicle Notes & Chat Quick Jump Card ─── */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-base shadow-xs shrink-0">
            💬
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-indigo-950 truncate">โน้ต & แชทติดตามความคืบหน้ารถยนต์</h4>
            <p className="text-[10px] text-indigo-700 truncate mt-0.5">
              ดูประวัติการติดตาม, แท็กพนักงาน, แนบภาพเอกสาร และบันทึกโน้ตของรถคันนี้
            </p>
          </div>
        </div>
        {onNavigateToNotes && (
          <button
            type="button"
            onClick={onNavigateToNotes}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shrink-0 shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <span>เปิดหน้าแชท</span>
            <span>➔</span>
          </button>
        )}
      </div>

    </div>
  )
}

function DetailField({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] text-slate-400">{label}</span>
      <p className={`text-slate-800 ${bold ? 'font-bold' : ''} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

// ─── CHECKLIST TAB ──────────────────────────────────

function ChecklistTab({
  detail,
  dynamicSections,
  spacesCDN,
  onImageClick,
}: {
  detail: InspectionData
  dynamicSections: ReturnType<typeof buildDynamicSections>
  spacesCDN: string
  onImageClick: (url: string) => void
}) {
  return (
    <div className="space-y-4">
      {dynamicSections.map(section => (
        <div key={section.category} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Section Header */}
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
            <span className="text-sm">{section.icon}</span>
            <h4 className="text-xs font-bold text-slate-700">{section.label}</h4>
          </div>

          {/* Section Items */}
          <div className="divide-y divide-slate-100 bg-white">
            {section.items.map(itemDef => {
              const savedItem = detail.items.find(
                i => i.category === section.category && i.itemCode === itemDef.itemCode
              )
              const itemPhotos = detail.photos.filter(
                p => p.category === section.category && p.itemCode === itemDef.itemCode
              )

              // Determine option list
              let options = itemDef.options
              if (!options || options.length === 0) {
                options = itemDef.inputType === 'select'
                  ? [...LICENSE_PLATE_OPTIONS]
                  : itemDef.inputType === 'three_way'
                  ? [...BODY_CONDITION_OPTIONS]
                  : [...BOOLEAN_OPTIONS]
              }

              return (
                <div key={itemDef.itemCode} className="px-4 py-3.5 space-y-2 text-slate-700 bg-white">
                  {/* Item Title */}
                  <p className="text-xs font-semibold text-slate-800">{itemDef.label}</p>

                  {/* Selection Buttons */}
                  {itemDef.inputType === 'select' && (
                    <div className="flex flex-wrap gap-2">
                      {options.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-default ${
                            savedItem?.value === opt.value
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold opacity-100'
                              : 'bg-slate-50 text-slate-350 border-slate-200 opacity-60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {itemDef.inputType === 'three_way' && (
                    <div className="flex gap-1.5 max-w-md">
                      {options.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled
                          className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-medium border transition text-center leading-tight cursor-default ${
                            savedItem?.value === opt.value
                              ? opt.value === 'NORMAL'
                                ? 'bg-emerald-600 text-white border-emerald-600 font-bold opacity-100'
                                : opt.value === 'SCRATCH'
                                ? 'bg-amber-500 text-white border-amber-500 font-bold opacity-100'
                                : 'bg-rose-500 text-white border-rose-500 font-bold opacity-100'
                              : 'bg-slate-50 text-slate-350 border-slate-200 opacity-60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {(itemDef.inputType === 'boolean' || itemDef.inputType === 'boolean_expiry') && (
                    <div className="flex gap-2 max-w-xs">
                      {options.map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled
                          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition text-center cursor-default ${
                            savedItem?.value === opt.value
                              ? opt.value === 'YES'
                                ? (section.category === 'ACCIDENT' ? 'bg-rose-500 text-white border-rose-500' : 'bg-emerald-600 text-white border-emerald-600') + ' font-bold opacity-100'
                                : (section.category === 'ACCIDENT' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-500') + ' font-bold opacity-100'
                              : 'bg-slate-50 text-slate-350 border-slate-200 opacity-60'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {itemDef.inputType === 'number' && (
                    <div className="w-full max-w-[150px] px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-mono font-bold">
                      {savedItem?.numericValue ?? '-'}
                    </div>
                  )}

                  {/* Expiry Date */}
                  {itemDef.hasExpiry && savedItem?.value === 'YES' && savedItem?.expiryDate && (
                    <div className="text-[10px] text-slate-550 font-medium mt-1">
                      วันหมดอายุ: {getThaiDate(savedItem.expiryDate)}
                    </div>
                  )}

                  {/* Detail Notes */}
                  {savedItem?.detail && (
                    <div className="text-[10px] text-slate-500 italic bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block mt-1">
                      📝 โน้ต: {savedItem.detail}
                    </div>
                  )}

                  {/* Item Photos */}
                  {itemPhotos.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {itemPhotos.map((photo, index) => (
                        <div
                          key={index}
                          onClick={() => onImageClick(`${spacesCDN}/${photo.s3Key}`)}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:border-indigo-400 hover:shadow-md transition relative"
                        >
                          <img
                            src={`${spacesCDN}/${photo.s3Key}`}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {photo.photoPosition && (
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[7px] text-center font-extrabold py-0.5 leading-none">
                              {photo.photoPosition}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── PHOTOS TAB ─────────────────────────────────────

function PhotosTab({
  detail,
  dynamicSections,
  spacesCDN,
  onImageClick,
}: {
  detail: InspectionData
  dynamicSections: ReturnType<typeof buildDynamicSections>
  spacesCDN: string
  onImageClick: (url: string) => void
}) {
  const nonSignaturePhotos = detail.photos.filter(p => p.category !== 'SIGNATURE')

  if (nonSignaturePhotos.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 font-medium bg-slate-50 border border-slate-200 rounded-2xl">
        ไม่มีรูปภาพตรวจสภาพประกอบเอกสารนี้
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {nonSignaturePhotos.map((photo, i) => {
          const matchedSection = dynamicSections.find(s => s.category === photo.category)
          const matchedItem = matchedSection?.items.find(item => item.itemCode === photo.itemCode)
          const itemLabel = matchedItem ? matchedItem.label : photo.category

          return (
            <div
              key={photo.inspectionPhotoId || i}
              className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col group hover:border-slate-300 transition shadow-sm"
            >
              <div className="relative aspect-square bg-slate-100 overflow-hidden border-b border-slate-200">
                <img
                  src={`${spacesCDN}/${photo.s3Key}`}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300 cursor-pointer"
                  onClick={() => onImageClick(`${spacesCDN}/${photo.s3Key}`)}
                />
              </div>
              <div className="p-2 space-y-0.5 text-[9px] leading-tight bg-white">
                <p className="font-bold text-slate-700 truncate">{itemLabel}</p>
                {photo.photoPosition && (
                  <span className="px-1 py-0.5 bg-slate-100 rounded text-slate-500 font-extrabold inline-block mt-0.5">{photo.photoPosition}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── RESOLVE STATUS MODAL DIALOG ────────────────────

interface ResolveModalData {
  item: IssueItem
  targetStatus: ItemResolveStatus
  initialRemark: string
}

function ResolveStatusModal({
  data,
  isSaving,
  onConfirm,
  onClose,
}: {
  data: ResolveModalData
  isSaving: boolean
  onConfirm: (remark: string) => void
  onClose: () => void
}) {
  const [remark, setRemark] = useState(data.initialRemark)
  const cfg = RESOLVE_STATUS_CONFIG[data.targetStatus]

  const suggestions = useMemo(() => {
    switch (data.targetStatus) {
      case 'NO_ACTION_NEEDED':
        return [
          'รอยขีดข่วนเล็กน้อย สภาพรับได้ ปล่อยเช่าต่อ',
          'ลูกค้ารับสภาพ/เคลียร์ค่าเสียหายเรียบร้อย',
          'อยู่นอกเงื่อนไขเคลม ไม่กระทบการใช้งาน',
        ]
      case 'IN_PROGRESS':
        return [
          'เปิดใบงานซ่อมแล้ว รอคิวเข้าอู่',
          'ส่งซ่อมอู่ศูนย์ (รอเบิกอะไหล่)',
          'อยู่ระหว่างเคาะ/ทำสีตัวถัง',
        ]
      case 'RESOLVED':
        return [
          'แก้ไขและซ่อมแซมเรียบร้อยแล้ว',
          'เปลี่ยนอะไหล่ชิ้นส่วนใหม่เรียบร้อย',
          'ขัดสีลบรอยและทำความสะอาดแล้ว',
        ]
      case 'PENDING':
        return [
          'รอส่งฝ่ายเทคนิคประเมินความเสียหาย',
          'รอยืนยันใบเสนอราคาจากอู่',
        ]
      default:
        return []
    }
  }, [data.targetStatus])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-xl">{cfg.icon}</span>
            <div>
              <h4 className="text-sm font-bold text-slate-900">เปลี่ยนสถานะ: {cfg.label}</h4>
              <p className="text-[11px] text-slate-500">{cfg.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="w-7 h-7 rounded-lg bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300 transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Target Item Info */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{data.item.categoryIcon}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{data.item.label}</p>
                <p className="text-[10px] text-slate-400">หมวดหมู่: {data.item.categoryLabel}</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 bg-rose-100 text-rose-700 border border-rose-200">
              {data.item.valueLabel}
            </span>
          </div>

          {/* Quick Preset Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-600">ข้อความแนะนำ (คลิกเพื่อเลือก):</label>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setRemark(s)}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 text-slate-600 transition text-left"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Remark Input / Textarea */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-700">
              ระบุรายละเอียด / โน้ตเพิ่มเติม / เลขใบงานซ่อม:
            </label>
            <textarea
              rows={3}
              value={remark}
              onChange={e => setRemark(e.target.value)}
              placeholder="เช่น เลขใบงานซ่อม, ชื่ออู่, หรือเหตุผลที่ปล่อยผ่าน..."
              className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onConfirm(remark)}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>กำลังบันทึก...</span>
              </>
            ) : (
              <span>ยืนยันบันทึก</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
