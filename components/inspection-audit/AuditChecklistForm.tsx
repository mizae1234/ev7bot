import React, { useState, useMemo } from 'react'
import type { ChecklistSectionDef } from '@/lib/inspection/types'
import { QC_CHECKLIST_SECTIONS } from '@/lib/inspection/checklist-config'
import { VehicleNotesSection } from '@/components/vehicle/VehicleNotesSection'

interface FormItemState {
  category: string
  itemCode: string
  value: string | null
  detail: string | null
  numericValue: number | null
  expiryDate: string | null
}

interface UploadedPhoto {
  inspectionPhotoId?: number
  category: string
  itemCode: string | null
  photoPosition: string | null
  s3Key: string
}

interface AuditChecklistFormProps {
  sessionStatus?: 'OPEN' | 'CLOSED'
  activeVehicle: {
    inspectionId?: number
    inventoryItemId?: number
    vinNo: string
    registerNo: string | null
    model: string | null
    project?: string | null
    currentLocation?: string | null
  }
  dynamicSections: ChecklistSectionDef[]
  inspectionMode?: 'QC' | 'AUDIT'
  onInspectionModeChange?: (mode: 'QC' | 'AUDIT') => void
  formItems: Record<string, FormItemState>
  mileage: number | ''
  remark: string
  inspectorName: string
  uploadedPhotos: UploadedPhoto[]
  pendingPhotos: Record<string, File[]>
  saving: boolean
  spacesCdn: string
  autoAssessment?: string
  damagedItems?: Array<{ label: string; valueLabel: string }>
  onMileageChange: (val: number | '') => void
  onRemarkChange: (val: string) => void
  onInspectorNameChange: (val: string) => void
  onChecklistValueChange: (category: string, itemCode: string, value: string | null) => void
  onChecklistDetailChange: (category: string, itemCode: string, detail: string) => void
  onChecklistNumberChange: (category: string, itemCode: string, value: number | null) => void
  onChecklistExpiryChange: (category: string, itemCode: string, expiry: string) => void
  onPhotoSelect: (category: string, itemCode: string, files: FileList | null) => void
  onRemovePendingPhoto: (posKey: string, idx: number) => void
  onDeleteUploadedPhoto: (photoId: number) => void
  onSave: (mode?: 'QC' | 'AUDIT') => void
  onCancel: () => void
  lineUserId?: string | null
}

const LICENSE_PLATE_OPTIONS = [
  { value: 'FRONT_BACK', label: 'ป้ายทะเบียนหน้า-หลัง' },
  { value: 'FRONT_ONLY', label: 'ป้ายทะเบียนหน้า' },
  { value: 'BACK_ONLY', label: 'ป้ายทะเบียนหลัง' },
  { value: 'NONE', label: 'ไม่มีป้ายทะเบียนรถมา' },
]

const BOOLEAN_OPTIONS = [
  { value: 'YES', label: 'มี' },
  { value: 'NO', label: 'ไม่มี' },
]

const BODY_CONDITION_OPTIONS = [
  { value: 'NORMAL', label: 'ปกติ' },
  { value: 'SCRATCH', label: 'มีรอยขีดข่วน' },
  { value: 'DENT', label: 'บุบ-แตก' },
]

export function AuditChecklistForm({
  sessionStatus = 'OPEN',
  activeVehicle,
  dynamicSections,
  inspectionMode: propInspectionMode,
  onInspectionModeChange,
  formItems,
  mileage,
  remark,
  inspectorName,
  uploadedPhotos,
  pendingPhotos,
  saving,
  spacesCdn,
  autoAssessment: propAutoAssessment,
  damagedItems: propDamagedItems,
  onMileageChange,
  onRemarkChange,
  onInspectorNameChange,
  onChecklistValueChange,
  onChecklistDetailChange,
  onChecklistNumberChange,
  onChecklistExpiryChange,
  onPhotoSelect,
  onRemovePendingPhoto,
  onDeleteUploadedPhoto,
  onSave,
  onCancel,
  lineUserId,
}: AuditChecklistFormProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'QC' | 'AUDIT'>(propInspectionMode || 'QC')
  const [initialNoteText, setInitialNoteText] = useState('')

  const handleModeChange = (newMode: 'QC' | 'AUDIT') => {
    setMode(newMode)
    if (onInspectionModeChange) onInspectionModeChange(newMode)
  }

  // Choose sections based on mode: use dynamicSections from DB master if provided, otherwise fallback to QC_CHECKLIST_SECTIONS
  const currentSections = useMemo(() => {
    if (mode === 'QC') {
      return dynamicSections.length > 0 && dynamicSections.some(s => s.category.startsWith('QC_'))
        ? dynamicSections
        : QC_CHECKLIST_SECTIONS
    }
    return dynamicSections
  }, [mode, dynamicSections])

  // QC Auto Assessment
  const { qcAssessment, qcFailedItems } = useMemo(() => {
    if (mode !== 'QC') {
      return { qcAssessment: propAutoAssessment || '', qcFailedItems: propDamagedItems || [] }
    }
    const failed: Array<{ label: string; valueLabel: string }> = []
    let filledCount = 0

    currentSections.forEach(sec => {
      sec.items.forEach(item => {
        const key = `${sec.category}_${item.itemCode}`
        const state = formItems[key]
        if (state && state.value) {
          filledCount++
          if (state.value === 'NO' || state.value === 'NOT_CLEAN' || state.value === 'NO_KEY' || state.value === 'NOT_READY' || state.value === 'WORN_OUT') {
            const optLabel = item.options?.find(o => o.value === state.value)?.label || 'ไม่พร้อม'
            failed.push({ label: item.label, valueLabel: optLabel })
          }
        }
      })
    })

    if (failed.length > 0) {
      return { qcAssessment: 'ไม่ผ่าน QC (พบจุดที่ต้องแก้ไข)', qcFailedItems: failed }
    }
    if (filledCount === currentSections.length) {
      return { qcAssessment: '🟢 ผ่านการตรวจ QC (พร้อมส่งมอบ)', qcFailedItems: [] }
    }
    return { qcAssessment: 'รอผลการตรวจ', qcFailedItems: [] }
  }, [mode, formItems, propAutoAssessment, propDamagedItems, currentSections])

  // Helper to compile QC formatted text for Vehicle Notes
  const handlePullQCToNote = () => {
    const reg = activeVehicle.registerNo || activeVehicle.vinNo
    const lines: string[] = [reg]
    
    const qcCatList = [
      { cat: 'QC_CLEANLINESS', code: 'STATUS', label: 'ความสะอาด ภายนอก - ภายใน', num: 1 },
      { cat: 'QC_KEY', code: 'STATUS', label: 'กุญแจพร้อม', num: 2 },
      { cat: 'QC_TAX_VEHICLE', code: 'STATUS', label: 'ทะเบียนเหลือมากกว่า 3 เดือน', num: 3 },
      { cat: 'QC_TAX_METER', code: 'STATUS', label: 'ภาษีมิเตอร์เหลือมากกว่า 1 เดือน', num: 4 },
      { cat: 'QC_PARK_POSITION', code: 'STATUS', label: 'รถอยู่ในตำแหน่งพร้อมส่ง', num: 5 },
      { cat: 'QC_BATTERY_HV', code: 'STATUS', label: 'ไฟแบตลูกใหญ่มากกว่า40%', num: 6 },
      { cat: 'QC_QR_CODE', code: 'STATUS', label: 'QR code มี-ไม่มี', num: 7 },
      { cat: 'QC_WIPER', code: 'STATUS', label: 'ยางปัดน้ำฝน', num: 8 },
      { cat: 'QC_TIRE', code: 'STATUS', label: 'ยางรถ', num: 9 },
    ]

    qcCatList.forEach(item => {
      const it = formItems[`${item.cat}_${item.code}`]
      const val = it?.value
      const det = it?.detail?.trim()
      const exp = it?.expiryDate
      const num = it?.numericValue
      let statusText = 'พร้อม'
      if (item.cat === 'QC_QR_CODE') {
        statusText = val === 'YES' ? 'มี' : val === 'NO' ? 'ไม่มี' : '-'
      } else if (item.cat === 'QC_TAX_VEHICLE' || item.cat === 'QC_TAX_METER') {
        statusText = exp ? `${exp}` : (val === 'YES' ? 'พร้อม' : 'ไม่พร้อม')
      } else if (item.cat === 'QC_BATTERY_HV') {
        statusText = num != null ? `${num}%` : (val === 'YES' ? '>40%' : 'ไม่พร้อม')
      } else {
        statusText = val === 'YES' ? 'พร้อม' : val === 'NO' ? 'ไม่พร้อม' : '-'
      }
      const comment = det ? ` //${det}` : ` //${statusText}`
      lines.push(`${item.num} ${item.label}${comment}`)
    })

    setInitialNoteText(lines.join('\n'))
  }

  const effectiveAssessment = mode === 'QC' ? qcAssessment : (propAutoAssessment || '')
  const effectiveDamagedItems = mode === 'QC' ? qcFailedItems : (propDamagedItems || [])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onCancel}
              className="md:hidden mr-3 p-2 bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-bold rounded-lg transition"
            >
              ⬅ กลับ
            </button>
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <span>{mode === 'QC' ? '🟢' : '📝'}</span>
                <span>{mode === 'QC' ? 'ตรวจ QC รถก่อนส่งมอบ' : 'บันทึกผลการตรวจสภาพ'}: {activeVehicle.registerNo || 'ไม่มีทะเบียน'}</span>
              </h3>
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium mt-0.5">
                VIN: {activeVehicle.vinNo} • {activeVehicle.model || '-'}
                {activeVehicle.currentLocation && ` • ลานจอด: ${activeVehicle.currentLocation}`}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="hidden md:block text-xs text-slate-400 hover:text-slate-600 transition font-bold"
          >
            ปิดหน้านี้ ✕
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1 text-xs font-bold shadow-inner">
          <button
            type="button"
            onClick={() => handleModeChange('QC')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'QC'
                ? 'bg-emerald-600 text-white shadow-sm font-extrabold scale-[1.01]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <span>🟢</span>
            <span>QC รถก่อนส่งมอบ (ชุดง่าย 9 ข้อ)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('AUDIT')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'AUDIT'
                ? 'bg-indigo-600 text-white shadow-sm font-extrabold scale-[1.01]'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <span>🔍</span>
            <span>ตรวจสภาพรถ (เต็มรูปแบบ)</span>
          </button>
        </div>
      </div>

      {/* Checklist Form Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 bg-white">
        
        {/* Mileage & Inspector details */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-600">เลขไมล์รถสะสม (กม.)</label>
            <input
              type="number"
              disabled={sessionStatus === 'CLOSED'}
              placeholder="กรอกไมล์สะสมล่าสุด..."
              value={mileage}
              onChange={e => onMileageChange(e.target.value === '' ? '' : parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-mono font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="font-bold text-slate-600">ชื่อเจ้าหน้าที่ผู้ตรวจเช็ค</label>
            <input
              type="text"
              disabled={sessionStatus === 'CLOSED'}
              placeholder="ชื่อผู้บันทึกข้อมูล..."
              value={inspectorName}
              onChange={e => onInspectorNameChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>
        </div>

        {/* Render Sections */}
        {currentSections.map(section => (
          <div key={section.category} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
              <span className="text-sm">{section.icon}</span>
              <h4 className="text-xs font-bold text-slate-700">{section.label}</h4>
            </div>

            <div className="divide-y divide-slate-100 bg-white">
              {section.items.map(itemDef => {
                const key = `${section.category}_${itemDef.itemCode}`
                const stateItem = formItems[key] || {
                  category: section.category,
                  itemCode: itemDef.itemCode,
                  value: null,
                  detail: null,
                  numericValue: null,
                  expiryDate: null,
                }
                const itemPhotos = uploadedPhotos.filter(
                  p => p.category === section.category && p.itemCode === itemDef.itemCode
                )

                let options = itemDef.options
                if (!options || options.length === 0) {
                  options = itemDef.inputType === 'select'
                    ? LICENSE_PLATE_OPTIONS
                    : itemDef.inputType === 'three_way'
                    ? BODY_CONDITION_OPTIONS
                    : BOOLEAN_OPTIONS
                }

                return (
                  <div key={itemDef.itemCode} className="px-4 py-3.5 space-y-2 text-slate-700 bg-white">
                    <p className="text-xs font-semibold text-slate-800">{itemDef.label}</p>

                    {/* SELECT TYPE */}
                    {itemDef.inputType === 'select' && (
                      <div className="flex flex-wrap gap-2">
                        {options.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={sessionStatus === 'CLOSED'}
                            onClick={() => onChecklistValueChange(section.category, itemDef.itemCode, opt.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                              stateItem.value === opt.value
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold opacity-100'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* THREE WAY TYPE */}
                    {itemDef.inputType === 'three_way' && (
                      <div className="flex gap-1.5 max-w-md">
                        {options.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={sessionStatus === 'CLOSED'}
                            onClick={() => onChecklistValueChange(section.category, itemDef.itemCode, opt.value)}
                            className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-medium border transition text-center leading-tight ${
                              stateItem.value === opt.value
                                ? opt.value === 'NORMAL'
                                ? 'bg-emerald-600 text-white border-emerald-600 font-bold opacity-100'
                                : opt.value === 'SCRATCH'
                                ? 'bg-amber-500 text-white border-amber-500 font-bold opacity-100'
                                : 'bg-rose-500 text-white border-rose-500 font-bold opacity-100'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* BOOLEAN TYPE */}
                    {(itemDef.inputType === 'boolean' || itemDef.inputType === 'boolean_expiry') && (
                      <div className="flex gap-2 max-w-xs">
                        {options.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={sessionStatus === 'CLOSED'}
                            onClick={() => onChecklistValueChange(section.category, itemDef.itemCode, opt.value)}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition text-center ${
                              stateItem.value === opt.value
                                ? opt.value === 'YES'
                                  ? (section.category === 'ACCIDENT' ? 'bg-rose-500 text-white border-rose-500' : 'bg-emerald-600 text-white border-emerald-600') + ' font-bold opacity-100'
                                  : (section.category === 'ACCIDENT' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-500 text-white border-rose-500') + ' font-bold opacity-100'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* NUMBER TYPE */}
                    {itemDef.inputType === 'number' && (
                      <div className="w-full max-w-[150px]">
                        <input
                          type="number"
                          disabled={sessionStatus === 'CLOSED'}
                          placeholder="ใส่ค่าตัวเลข..."
                          value={stateItem.numericValue ?? ''}
                          onChange={e => onChecklistNumberChange(section.category, itemDef.itemCode, e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white text-xs font-mono font-bold outline-none"
                        />
                      </div>
                    )}

                    {/* QC Battery HV special SoC % input */}
                    {section.category === 'QC_BATTERY_HV' && (
                      <div className="flex items-center gap-2 pt-1 max-w-xs">
                        <label className="text-[11px] font-bold text-slate-500">ระดับแบตเตอรี่ (SoC %):</label>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="เช่น 85"
                            disabled={sessionStatus === 'CLOSED'}
                            value={stateItem.numericValue ?? ''}
                            onChange={e => onChecklistNumberChange(section.category, itemDef.itemCode, e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-bold outline-none"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                    )}

                    {/* EXPIRY DATE */}
                    {itemDef.hasExpiry && stateItem.value === 'YES' && (
                      <div className="space-y-0.5 mt-1 max-w-xs">
                        <span className="text-[9px] font-bold text-slate-500">วันหมดอายุของเอกสาร/อุปกรณ์</span>
                        <input
                          type="date"
                          disabled={sessionStatus === 'CLOSED'}
                          value={stateItem.expiryDate ? stateItem.expiryDate.slice(0, 10) : ''}
                          onChange={e => onChecklistExpiryChange(section.category, itemDef.itemCode, e.target.value)}
                          className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none"
                        />
                      </div>
                    )}

                    {/* Detail note input */}
                    <div className="max-w-md mt-1">
                      <input
                        type="text"
                        disabled={sessionStatus === 'CLOSED'}
                        placeholder="เขียนโน้ตบันทึกรอยชำรุด หรือข้อมูลเพิ่มเติม..."
                        value={stateItem.detail || ''}
                        onChange={e => onChecklistDetailChange(section.category, itemDef.itemCode, e.target.value)}
                        className="w-full px-2.5 py-1 text-[10px] text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-400 transition"
                      />
                    </div>

                    {/* Photos */}
                    {itemDef.hasPhoto !== false && (
                      <div className="space-y-1.5 mt-1">
                        {itemPhotos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {itemPhotos.map(photo => (
                              <div
                                key={photo.inspectionPhotoId}
                                className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group shadow-sm"
                              >
                                <img
                                  src={`${spacesCdn}/${photo.s3Key}`}
                                  alt=""
                                  className="w-full h-full object-cover cursor-pointer"
                                  onClick={() => setLightboxUrl(`${spacesCdn}/${photo.s3Key}`)}
                                />
                                {sessionStatus === 'OPEN' && (
                                  <button
                                    type="button"
                                    onClick={() => photo.inspectionPhotoId && onDeleteUploadedPhoto(photo.inspectionPhotoId)}
                                    className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-[8px] flex items-center justify-center rounded-bl hover:bg-rose-600 transition"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pending photos */}
                        {(() => {
                          const posKey = `${section.category}::${itemDef.itemCode}::default`
                          const files = pendingPhotos[posKey] || []
                          return files.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {files.map((file, idx) => {
                                const fileUrl = URL.createObjectURL(file)
                                return (
                                  <div
                                    key={idx}
                                    className="relative w-14 h-14 rounded-lg overflow-hidden border border-indigo-200 bg-indigo-50/20 group shadow-sm"
                                  >
                                    <img src={fileUrl} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => onRemovePendingPhoto(posKey, idx)}
                                      className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-[8px] flex items-center justify-center rounded-bl hover:bg-rose-600 transition"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null
                        })()}

                        {/* Choose file uploader */}
                        {sessionStatus === 'OPEN' && (
                          <div>
                            <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-600 font-bold cursor-pointer transition active:scale-95 shadow-sm">
                              <span>📷</span> แนบภาพถ่ายตรวจสภาพ
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={e => onPhotoSelect(section.category, itemDef.itemCode, e.target.files)}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Auto Assessment Card with Damage Summary List */}
        <div className={`p-4 rounded-2xl border flex flex-col gap-2 shadow-sm transition duration-300 ${
          effectiveAssessment === 'ต้องส่งเข้าซ่อม' || effectiveAssessment.startsWith('ไม่ผ่าน')
            ? 'bg-rose-50 border-rose-200 text-rose-800 shadow-rose-100/50' 
            : effectiveAssessment === 'รอผลการตรวจ'
            ? 'bg-slate-50 border-slate-200 text-slate-800 shadow-slate-100/50'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/50'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">
                {effectiveAssessment === 'ต้องส่งเข้าซ่อม' || effectiveAssessment.startsWith('ไม่ผ่าน')
                  ? '⚠️'
                  : effectiveAssessment === 'รอผลการตรวจ'
                  ? '⏳'
                  : '✅'}
              </span>
              <div className="text-xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  {mode === 'QC' ? 'ผลประเมิน QC ก่อนส่งมอบ' : 'ผลประเมินสภาพรถ (ประมวลผลอัตโนมัติ)'}
                </p>
                <p className="text-xs font-extrabold">{effectiveAssessment}</p>
              </div>
            </div>

            {mode === 'QC' && (
              <button
                type="button"
                onClick={handlePullQCToNote}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs active:scale-95 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>📋</span> ดึงผล QC ลงกล่องบันทึกรถ
              </button>
            )}
          </div>

          {(effectiveAssessment === 'ต้องส่งเข้าซ่อม' || effectiveAssessment.startsWith('ไม่ผ่าน')) && effectiveDamagedItems.length > 0 && (
            <div className="mt-1 pt-2 border-t border-rose-200/60 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-bold text-[9px] uppercase text-rose-700">🛠️ รายการที่ตรวจพบปัญหา / ไม่พร้อม:</p>
                {mode !== 'QC' && (
                  <button
                    type="button"
                    onClick={() => {
                      const summaryText = `พบจุดเสียหาย:\n` + effectiveDamagedItems.map((item, idx) => `${idx + 1}. ${item.label} (${item.valueLabel})`).join('\n')
                      onRemarkChange((summaryText + '\n' + remark).trim())
                    }}
                    className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[9px] active:scale-95 transition"
                  >
                    📋 ดึงลงช่องโน้ต
                  </button>
                )}
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-rose-700 font-medium">
                {effectiveDamagedItems.map((item, idx) => (
                  <li key={idx}>
                    {item.label}: <span className="font-bold">{item.valueLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* General Remark */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-sm">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <span>📝</span> หมายเหตุเพิ่มเติม (Remark)
          </label>
          <textarea
            rows={2}
            disabled={sessionStatus === 'CLOSED'}
            placeholder="เขียนรายละเอียดบันทึกสภาพรถยนต์ภายนอกหรือหมายเหตุโดยรวมเพิ่มเติม..."
            value={remark}
            onChange={e => onRemarkChange(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none"
          />
        </div>

        {/* Vehicle Notes Section with @Mentions */}
        {activeVehicle.inventoryItemId && activeVehicle.registerNo && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>💬</span> บันทึกข้อมูลรถและแท็กทีมงาน (Vehicle Note & Mention)
              </h4>
              <span className="text-[10px] text-slate-400">พิมพ์ @ เพื่อแท็กเพื่อนร่วมงาน</span>
            </div>
            <VehicleNotesSection
              inventoryItemId={activeVehicle.inventoryItemId}
              registerNo={activeVehicle.registerNo}
              lineUserId={lineUserId}
              sourceProcess={mode === 'QC' ? 'VEHICLE_QC' : 'VEHICLE_AUDIT'}
              initialNoteText={initialNoteText}
            />
          </div>
        )}

      </div>

      {/* Actions Footer */}
      <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 flex-none">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition active:scale-95"
        >
          ยกเลิก
        </button>
        {sessionStatus === 'OPEN' && (
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(mode)}
            className={`px-4 py-2 rounded-lg disabled:opacity-50 text-white text-xs font-bold transition active:scale-95 shadow-sm flex items-center gap-1.5 ${
              mode === 'QC' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {saving ? (
              'กำลังบันทึกข้อมูล...'
            ) : mode === 'QC' ? (
              '✅ ยืนยันผลการตรวจ QC (จบการตรวจ)'
            ) : (
              'บันทึกข้อมูลตรวจสภาพ'
            )}
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh]">
            <img src={lightboxUrl} alt="" className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-800" />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
