'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { InspectionData, MasterItemDef } from '@/lib/inspection/types'
import { buildDynamicSections } from '@/lib/inspection/checklist-config'
import {
  getSpacesCDN,
  getThaiDate,
  getReasonLabel,
  LICENSE_PLATE_OPTIONS,
  BOOLEAN_OPTIONS,
  BODY_CONDITION_OPTIONS,
} from './constants'
import ImageLightbox from './ImageLightbox'

interface InspectionDrawerProps {
  inspectionId: number
  masterItems: MasterItemDef[]
  onClose: () => void
}

type TabKey = 'info' | 'checklist' | 'photos'

export default function InspectionDrawer({ inspectionId, masterItems, onClose }: InspectionDrawerProps) {
  const [inspectionDetail, setInspectionDetail] = useState<InspectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('info')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const SPACES_CDN = getSpacesCDN()

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
        alert(err.message || 'เกิดข้อผิดพลาด')
        onClose()
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [inspectionId, onClose])

  // Dynamic sections from masterItems
  const dynamicSections = useMemo(() => {
    return buildDynamicSections(masterItems)
  }, [masterItems])

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
              <div className="flex border-b border-slate-200 bg-slate-50 px-2 py-1 gap-1">
                <TabButton active={activeTab === 'info'} onClick={() => setActiveTab('info')}>
                  ℹ️ ข้อมูลรับคืน
                </TabButton>
                <TabButton active={activeTab === 'checklist'} onClick={() => setActiveTab('checklist')}>
                  ✏️ เช็คลิสต์ ({inspectionDetail.items?.length || 0})
                </TabButton>
                <TabButton active={activeTab === 'photos'} onClick={() => setActiveTab('photos')}>
                  📷 ภาพแนบ ({inspectionDetail.photos?.filter(p => p.category !== 'SIGNATURE').length || 0})
                </TabButton>
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">

                {/* INFO TAB */}
                {activeTab === 'info' && (
                  <InfoTab
                    detail={inspectionDetail}
                    spacesCDN={SPACES_CDN}
                    onImageClick={setLightboxUrl}
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
        </div>
      </div>

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

// ─── INFO TAB ───────────────────────────────────────

function InfoTab({
  detail,
  spacesCDN,
  onImageClick,
}: {
  detail: InspectionData
  spacesCDN: string
  onImageClick: (url: string) => void
}) {
  return (
    <div className="space-y-4">

      {/* Auto Assessment Hero Banner */}
      <div className={`p-4 rounded-2xl border text-center space-y-1.5 shadow-sm ${
        detail.assessmentResult === 'NORMAL'
          ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
          : detail.assessmentResult === 'NEED_REPAIR'
          ? 'bg-rose-50 border-rose-100 text-rose-800'
          : 'bg-slate-100 border-slate-200 text-slate-750'
      }`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ผลการประเมินสภาพรถอัตโนมัติ</p>
        <h4 className="text-lg font-black flex items-center justify-center gap-1.5">
          <span>
            {detail.assessmentResult === 'NORMAL' ? '✅ ปกติเรียบร้อย' : detail.assessmentResult === 'NEED_REPAIR' ? '⚠️ ต้องส่งเข้าซ่อมแซม' : '⏳ รอตรวจสภาพ'}
          </span>
        </h4>
        {detail.assessmentResult === 'NEED_REPAIR' && (
          <p className="text-[10px] text-rose-600 font-medium">ตรวจพบรอยเสียหายหรือสภาพไม่ปกติในเช็คลิสต์ด้านล่าง</p>
        )}
      </div>

      {/* Return details card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>📅</span> รายละเอียดการคืนรถ
        </h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailField label="ทะเบียนรถ" value={detail.registerNo || '-'} bold />
          <DetailField label="เลขตัวถัง (VIN)" value={detail.vinNo} mono />
          <DetailField label="ชื่อลูกค้าที่คืนรถ" value={detail.customerName || '-'} bold />
          <DetailField label="เบอร์โทรศัพท์ติดต่อ" value={detail.customerContact || '-'} mono />
          <DetailField label="วันที่รับคืนจริง" value={getThaiDate(detail.returnDate || detail.inspectionDate)} bold />
          <DetailField label="วันที่ยกเลิกสัญญา" value={getThaiDate(detail.contractCancellationDate)} bold />
          <DetailField label="สถานที่จอดคืน" value={detail.locationName || detail.location || '-'} bold />
          <DetailField label="เลขไมล์สะสม" value={detail.mileage != null ? `${detail.mileage.toLocaleString()} กม.` : '-'} mono bold />
          <div className="space-y-0.5 col-span-2">
            <span className="text-[10px] text-slate-400">เหตุผลในการคืนรถ</span>
            <p className="font-medium text-slate-800">{getReasonLabel(detail.returnReason)}</p>
          </div>
          <div className="space-y-0.5 col-span-2 border-t border-slate-200 pt-2 mt-1">
            <span className="text-[10px] text-slate-400">เจ้าหน้าที่ผู้ตรวจเช็ค</span>
            <p className="font-bold text-indigo-600">{detail.inspectorName || '-'}</p>
          </div>
          <div className="space-y-0.5 col-span-2">
            <span className="text-[10px] text-slate-400">หมายเหตุเพิ่มเติม</span>
            <p className="text-slate-700 whitespace-pre-line bg-white p-2.5 rounded-lg border border-slate-200 mt-1">{detail.remark || 'ไม่มีบันทึกข้อความ'}</p>
          </div>
        </div>
      </div>

      {/* Customer signature card */}
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
