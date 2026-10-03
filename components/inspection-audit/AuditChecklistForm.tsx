import React, { useState, useMemo, useRef } from 'react'
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
  onSave: (mode?: 'QC' | 'AUDIT', isDraft?: boolean) => Promise<number | undefined> | void
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

// Step Wizard groups for AUDIT mode (similar to Vehicle Return flow)
const AUDIT_STEP_GROUPS = [
  { label: 'เอกสาร & ทะเบียน', icon: '📋', categories: ['LICENSE_PLATE', 'ROAD_TAX', 'TAX_VEHICLE', 'TAX_METER', 'KEY_REMOTE'] },
  { label: 'ตรวจสภาพรถ', icon: '🔍', categories: ['CONDITION'] },
  { label: 'สภาพตัวถัง', icon: '🚗', categories: ['BODY'] },
  { label: 'ระบบ & อุปกรณ์', icon: '⚙️', categories: ['AIR_CON', 'BATTERY_HV', 'MILEAGE', 'CLAIM_DOCS'] },
  { label: 'รูปรถ & อุบัติเหตุ', icon: '📸', categories: ['CAR_PHOTOS', 'ACCIDENT'] },
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
  const [currentStep, setCurrentStep] = useState(0)
  const [stepSaving, setStepSaving] = useState(false)
  const stepIndicatorRef = useRef<HTMLDivElement>(null)

  const handleModeChange = (newMode: 'QC' | 'AUDIT') => {
    setMode(newMode)
    setCurrentStep(0)
    if (onInspectionModeChange) onInspectionModeChange(newMode)
  }

  // Choose sections based on mode: dynamicSections from DB master or fallback
  const currentSections = useMemo(() => {
    if (mode === 'QC') {
      return dynamicSections.length > 0 && dynamicSections.some(s => s.category.startsWith('QC_'))
        ? dynamicSections
        : QC_CHECKLIST_SECTIONS
    }
    return dynamicSections
  }, [mode, dynamicSections])

  // Step Groups
  const stepGroups = useMemo(() => {
    if (mode === 'QC') {
      const qcCount = currentSections.reduce((acc, s) => acc + s.items.length, 0)
      return [
        { label: `ตรวจ QC (${qcCount} ข้อ)`, icon: '🟢', categories: currentSections.map(s => s.category) }
      ]
    }
    return AUDIT_STEP_GROUPS
  }, [mode, currentSections])

  const totalSteps = stepGroups.length
  const isLastStep = currentStep === totalSteps - 1

  // Sections in the currently active step
  const visibleSections = useMemo(() => {
    if (mode === 'QC') return currentSections

    const activeCats = stepGroups[currentStep]?.categories || []
    const matched = currentSections.filter(s => activeCats.includes(s.category))

    // Fallback: If last step, also include any categories that weren't mapped in steps 0..3
    if (isLastStep) {
      const allMappedCats = stepGroups.flatMap(g => g.categories)
      const unmapped = currentSections.filter(s => !allMappedCats.includes(s.category))
      return [...matched, ...unmapped]
    }
    return matched
  }, [currentSections, stepGroups, currentStep, isLastStep, mode])

  // Overall progress across all sections
  const { allFilledCount, allTotalCount } = useMemo(() => {
    let filled = 0
    let total = 0
    currentSections.forEach(sec => {
      sec.items.forEach(item => {
        total++
        const key = `${sec.category}_${item.itemCode}`
        const state = formItems[key]
        if (state && (state.value !== null || state.numericValue !== null || state.detail || state.expiryDate)) {
          filled++
        }
      })
    })
    return { allFilledCount: filled, allTotalCount: total }
  }, [currentSections, formItems])

  // Step Auto-Save and Navigation
  const handleNextStep = async () => {
    if (isLastStep) return
    setStepSaving(true)
    try {
      if (onSave) {
        await onSave(mode, true) // Save as draft + upload staged photos
      }
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
      setTimeout(() => {
        stepIndicatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (err) {
      console.error('Step save failed:', err)
    } finally {
      setStepSaving(false)
    }
  }

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setTimeout(() => {
      stepIndicatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const handleStepClick = async (idx: number) => {
    if (idx === currentStep) return
    if (idx > currentStep) {
      setStepSaving(true)
      try {
        if (onSave) {
          await onSave(mode, true) // Save progress before jumping forward
        }
        setCurrentStep(idx)
        setTimeout(() => {
          stepIndicatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      } catch (err) {
        console.error('Step jump save failed:', err)
      } finally {
        setStepSaving(false)
      }
    } else {
      setCurrentStep(idx)
      setTimeout(() => {
        stepIndicatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }

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
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-col gap-2.5 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onCancel}
              className="md:hidden mr-2.5 p-2 bg-slate-200 text-slate-700 hover:bg-slate-300 text-xs font-bold rounded-lg transition"
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
            <span>ตรวจสภาพรถ (เต็มรูปแบบ 5 ขั้นตอน)</span>
          </button>
        </div>
      </div>

      {/* Checklist Form Body */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 bg-slate-50/50">

        {/* Progress Bar + Step Indicator (Matches Return Inspection flow) */}
        <div ref={stepIndicatorRef} className="bg-white rounded-2xl border border-slate-200 px-4 py-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">ความคืบหน้า</span>
            <span className="text-xs font-bold text-emerald-600 font-mono">
              {allFilledCount}/{allTotalCount} ข้อ
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${allTotalCount > 0 ? (allFilledCount / allTotalCount) * 100 : 0}%` }}
            />
          </div>

          {/* Step Indicator Tabs */}
          {totalSteps > 1 && (
            <div className="flex items-center gap-1.5 pt-1">
              {stepGroups.map((step, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className={`flex-1 py-2 rounded-xl text-[10px] font-bold transition-all duration-200 border active:scale-95 cursor-pointer ${
                    idx === currentStep
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.02]'
                      : idx < currentStep
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs">{step.icon}</span>
                  <span className="block leading-tight mt-0.5">{idx + 1}/{totalSteps}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-center text-xs font-bold text-slate-700 pt-0.5">
            {stepGroups[currentStep]?.icon} {stepGroups[currentStep]?.label}
          </p>
        </div>

        {/* Mileage & Inspector details (Shown on Step 1) */}
        {currentStep === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs shadow-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-600">เลขไมล์รถสะสม (กม.)</label>
              <input
                type="number"
                disabled={sessionStatus === 'CLOSED'}
                placeholder="กรอกไมล์สะสมล่าสุด..."
                value={mileage}
                onChange={e => onMileageChange(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition font-mono font-bold"
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
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>
          </div>
        )}

        {/* Category Cards (Current Step Only) */}
        {visibleSections.map(section => {
          // Calculate section completed items
          let secTotal = section.items.length
          let secFilled = 0
          section.items.forEach(item => {
            const key = `${section.category}_${item.itemCode}`
            const it = formItems[key]
            if (it && (it.value !== null || it.numericValue !== null || it.detail || it.expiryDate)) {
              secFilled++
            }
          })
          const isSecCompleted = secTotal > 0 && secFilled === secTotal

          return (
            <div key={section.category} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              {/* Card Header */}
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                </h4>
                {secTotal > 0 && (
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border transition-all ${
                    isSecCompleted
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {isSecCompleted ? '✓ ครบแล้ว' : `${secFilled}/${secTotal} ข้อ`}
                  </span>
                )}
              </div>

              {/* Items List */}
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

                  const isItemFilled = !!(stateItem.value || stateItem.numericValue != null || stateItem.detail || stateItem.expiryDate)
                  const itemPhotos = uploadedPhotos.filter(
                    p => p.category === section.category && p.itemCode === itemDef.itemCode
                  )
                  const pendingPosKey = `${section.category}::${itemDef.itemCode}::default`
                  const pendingList = pendingPhotos[pendingPosKey] || []

                  let options = itemDef.options
                  if (!options || options.length === 0) {
                    options = itemDef.inputType === 'select'
                      ? LICENSE_PLATE_OPTIONS
                      : itemDef.inputType === 'three_way'
                      ? BODY_CONDITION_OPTIONS
                      : BOOLEAN_OPTIONS
                  }

                  return (
                    <div key={itemDef.itemCode} className="px-4 py-3.5 space-y-2.5 text-slate-700 bg-white">
                      {/* Item Title with indicator dot */}
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isItemFilled ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-amber-400 ring-2 ring-amber-100'}`} />
                        <p className="text-xs sm:text-sm font-semibold text-slate-800">{itemDef.label}</p>
                      </div>

                      {/* SELECT TYPE */}
                      {itemDef.inputType === 'select' && (
                        <div className="flex flex-wrap gap-2">
                          {options.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={sessionStatus === 'CLOSED'}
                              onClick={() => onChecklistValueChange(section.category, itemDef.itemCode, opt.value)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition active:scale-95 ${
                                stateItem.value === opt.value
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold opacity-100'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* THREE WAY TYPE */}
                      {itemDef.inputType === 'three_way' && (
                        <div className="grid grid-cols-3 gap-2 max-w-md">
                          {options.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={sessionStatus === 'CLOSED'}
                              onClick={() => onChecklistValueChange(section.category, itemDef.itemCode, opt.value)}
                              className={`px-2 py-2 rounded-xl text-[11px] font-medium border transition text-center leading-tight active:scale-95 ${
                                stateItem.value === opt.value
                                  ? opt.value === 'NORMAL'
                                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm'
                                    : opt.value === 'SCRATCH'
                                    ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-sm'
                                    : 'bg-rose-500 text-white border-rose-500 font-bold shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* BOOLEAN TYPE */}
                      {(itemDef.inputType === 'boolean' || itemDef.inputType === 'boolean_expiry') && (
                        <div className="grid grid-cols-2 gap-2 max-w-xs">
                          {options.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={sessionStatus === 'CLOSED'}
                              onClick={() => onChecklistValueChange(section.category, itemDef.itemCode, opt.value)}
                              className={`py-2 px-3 rounded-xl text-xs font-medium border transition text-center active:scale-95 ${
                                stateItem.value === opt.value
                                  ? opt.value === 'YES'
                                    ? (section.category === 'ACCIDENT' ? 'bg-rose-500 text-white border-rose-500' : 'bg-emerald-600 text-white border-emerald-600') + ' font-bold shadow-sm'
                                    : (section.category === 'ACCIDENT' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-700 text-white border-slate-700') + ' font-bold shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* NUMBER TYPE */}
                      {itemDef.inputType === 'number' && (
                        <div className="w-full max-w-[160px]">
                          <input
                            type="number"
                            disabled={sessionStatus === 'CLOSED'}
                            placeholder="ใส่ค่าตัวเลข..."
                            value={stateItem.numericValue ?? ''}
                            onChange={e => onChecklistNumberChange(section.category, itemDef.itemCode, e.target.value === '' ? null : parseFloat(e.target.value))}
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white text-xs font-mono font-bold outline-none"
                          />
                        </div>
                      )}

                      {/* QC Battery HV SoC % */}
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
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 font-bold outline-none"
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
                            className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 outline-none"
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
                          className="w-full px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-400 transition"
                        />
                      </div>

                      {/* Photo Upload Section with [ถ่ายรูป] [อัลบั้ม] buttons */}
                      {itemDef.hasPhoto !== false && (
                        <div className="space-y-2 pt-1">
                          {/* Previews of uploaded & pending photos */}
                          {(itemPhotos.length > 0 || pendingList.length > 0) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {/* Uploaded Photos from S3 */}
                              {itemPhotos.map(photo => (
                                <div
                                  key={photo.inspectionPhotoId}
                                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs"
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
                                      className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-[9px] flex items-center justify-center rounded-bl hover:bg-rose-600 transition"
                                    >
                                      ✕
                                    </button>
                                  )}
                                  <span className="absolute bottom-0 inset-x-0 bg-emerald-600/80 text-white text-[7px] text-center font-bold py-0.2">
                                    บันทึกแล้ว
                                  </span>
                                </div>
                              ))}

                              {/* Pending Photos staged locally */}
                              {pendingList.map((file, idx) => {
                                const fileUrl = URL.createObjectURL(file)
                                return (
                                  <div
                                    key={idx}
                                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-amber-300 bg-amber-50/30 group shadow-xs"
                                  >
                                    <img src={fileUrl} alt="" className="w-full h-full object-cover" />
                                    <button
                                      type="button"
                                      onClick={() => onRemovePendingPhoto(pendingPosKey, idx)}
                                      className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white text-[9px] flex items-center justify-center rounded-bl hover:bg-rose-600 transition"
                                    >
                                      ✕
                                    </button>
                                    <span className="absolute bottom-0 inset-x-0 bg-amber-600/85 text-white text-[7px] text-center font-bold py-0.2">
                                      รอเซฟขั้นนี้
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Camera and Album upload buttons */}
                          {sessionStatus === 'OPEN' && (
                            <div className="flex items-center gap-2">
                              <label className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 text-slate-600 transition active:scale-95 text-[10px] font-bold gap-1 cursor-pointer">
                                <span className="text-base">📸</span>
                                <span>ถ่ายรูป</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  className="hidden"
                                  onChange={e => {
                                    onPhotoSelect(section.category, itemDef.itemCode, e.target.files)
                                    e.target.value = ''
                                  }}
                                />
                              </label>
                              <label className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30 text-slate-600 transition active:scale-95 text-[10px] font-bold gap-1 cursor-pointer">
                                <span className="text-base">🖼️</span>
                                <span>อัลบั้ม</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={e => {
                                    onPhotoSelect(section.category, itemDef.itemCode, e.target.files)
                                    e.target.value = ''
                                  }}
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
          )
        })}

        {/* Step Navigation Bar: Back & Next Step (Progressive Save) */}
        {totalSteps > 1 && (
          <div className="flex gap-2.5 pt-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="flex-1 py-3 rounded-2xl font-bold text-xs sm:text-sm transition shadow-xs active:scale-[0.98] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
              >
                ← ย้อนกลับ
              </button>
            )}

            {!isLastStep && (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={saving || stepSaving}
                className="flex-1 py-3 rounded-2xl font-bold text-xs sm:text-sm transition shadow-sm active:scale-[0.98] bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {stepSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>กำลังบันทึกและอัปโหลดรูป...</span>
                  </>
                ) : (
                  <span>ถัดไป → (บันทึกฉบับร่าง)</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* === Final Section: Shown only on the last step (or in QC single-step mode) === */}
        {isLastStep && (
          <div className="space-y-4 pt-2">
            {/* Auto Assessment Card with Damage Summary List */}
            <div className={`p-4 rounded-2xl border flex flex-col gap-2 shadow-xs transition duration-300 ${
              effectiveAssessment === 'ต้องส่งเข้าซ่อม' || effectiveAssessment.startsWith('ไม่ผ่าน')
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : effectiveAssessment === 'รอผลการตรวจ'
                ? 'bg-slate-50 border-slate-200 text-slate-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
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
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs active:scale-95 transition flex items-center gap-1.5 shadow-xs"
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
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 shadow-xs">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>📝</span> หมายเหตุเพิ่มเติม (Remark)
              </label>
              <textarea
                rows={2}
                disabled={sessionStatus === 'CLOSED'}
                placeholder="เขียนรายละเอียดบันทึกสภาพรถยนต์ภายนอกหรือหมายเหตุโดยรวมเพิ่มเติม..."
                value={remark}
                onChange={e => onRemarkChange(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none"
              />
            </div>

            {/* Vehicle Notes Section with @Mentions */}
            {activeVehicle.inventoryItemId && activeVehicle.registerNo && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-xs">
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
        )}

      </div>

      {/* Actions Footer */}
      <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 flex-none">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-650 text-xs font-bold transition active:scale-95 shadow-xs"
        >
          {isLastStep ? 'ปิดหน้านี้' : 'ยกเลิก'}
        </button>

        <div className="flex items-center gap-2">
          {sessionStatus === 'OPEN' && (
            <>
              {/* If not on last step, footer offers Next (Auto-save) */}
              {!isLastStep ? (
                <button
                  type="button"
                  disabled={saving || stepSaving}
                  onClick={handleNextStep}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {stepSaving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>ถัดไป → (บันทึกฉบับร่าง)</span>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={saving || stepSaving}
                    onClick={() => onSave(mode, true)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer"
                  >
                    💾 บันทึกฉบับร่าง
                  </button>
                  <button
                    type="button"
                    disabled={saving || stepSaving}
                    onClick={() => onSave(mode, false)}
                    className={`px-4 py-2 rounded-xl disabled:opacity-50 text-white text-xs font-bold transition active:scale-[0.98] shadow-sm flex items-center gap-1.5 cursor-pointer ${
                      mode === 'QC' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {saving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>กำลังบันทึกผล...</span>
                      </>
                    ) : mode === 'QC' ? (
                      '✅ ยืนยันผลการตรวจ QC (จบการตรวจ)'
                    ) : (
                      '✅ ยืนยันผลการตรวจสภาพ (เสร็จสิ้น)'
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
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
