'use client'

import React, { useState, useCallback, useMemo } from 'react'
import type { InspectionItemData, InspectionPhotoData } from '@/lib/inspection/types'
import { CHECKLIST_SECTIONS, createEmptyItemsFromTemplate } from '@/lib/inspection/checklist-config'
import ChecklistSection from './ChecklistSection'

interface InspectionChecklistProps {
  inspectionId: number | null
  existingItems?: InspectionItemData[]
  existingPhotos?: InspectionPhotoData[]
  mileage?: number | null
  remark?: string | null
  disabled?: boolean
  onSave: (data: {
    items: InspectionItemData[]
    mileage: number | null
    remark: string | null
  }) => Promise<void>
  onComplete?: () => Promise<void>
  saving?: boolean
  status?: string
}

export default function InspectionChecklist({
  inspectionId,
  existingItems = [],
  existingPhotos = [],
  mileage: initialMileage = null,
  remark: initialRemark = null,
  disabled = false,
  onSave,
  onComplete,
  saving = false,
  status = 'DRAFT',
}: InspectionChecklistProps) {
  // ---- State: items as a flat map (category_itemCode → data) ----
  const [itemsMap, setItemsMap] = useState<Record<string, InspectionItemData>>(() => {
    // Initialize from existing items or create empty template
    const map: Record<string, InspectionItemData> = {}

    // First, populate from template (all empty)
    const emptyItems = createEmptyItemsFromTemplate()
    for (const item of emptyItems) {
      map[`${item.category}_${item.itemCode}`] = { ...item }
    }

    // Then overlay with existing saved data
    for (const item of existingItems) {
      const key = `${item.category}_${item.itemCode}`
      map[key] = { ...item }
    }

    return map
  })

  const [mileage, setMileage] = useState<number | null>(initialMileage)
  const [remark, setRemark] = useState<string>(initialRemark || '')

  // ---- Handlers ----

  const handleItemChange = useCallback((
    category: string,
    itemCode: string,
    field: keyof InspectionItemData,
    value: any
  ) => {
    const key = `${category}_${itemCode}`
    setItemsMap(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        category,
        itemCode,
        [field]: value,
      },
    }))
  }, [])

  const handlePhotosChange = useCallback((
    category: string,
    itemCode: string | null,
    files: File[],
    position?: string | null
  ) => {
    // Photos are handled by PhotoUploader directly via API
    // This callback is for future use (e.g. tracking unsaved changes)
  }, [])

  const handleSave = useCallback(async () => {
    const items = Object.values(itemsMap)
    await onSave({ items, mileage, remark: remark || null })
  }, [itemsMap, mileage, remark, onSave])

  // ---- Filled count (for progress display) ----
  const filledCount = useMemo(() => {
    return Object.values(itemsMap).filter(
      item => item.value || item.numericValue != null || item.detail || item.expiryDate
    ).length
  }, [itemsMap])

  const totalCount = useMemo(() => {
    return CHECKLIST_SECTIONS.reduce((sum, s) =>
      sum + s.items.filter(i => i.inputType !== 'photos_only').length, 0
    )
  }, [])

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500">ความคืบหน้า</span>
          <span className="text-xs font-bold text-emerald-600">
            {filledCount}/{totalCount} ข้อ
          </span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-300"
            style={{ width: `${totalCount > 0 ? (filledCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Checklist sections */}
      {CHECKLIST_SECTIONS.map(section => (
        <ChecklistSection
          key={section.category}
          section={section}
          items={
            // Extract items for this section from the flat map
            Object.fromEntries(
              section.items.map(itemDef => [
                itemDef.itemCode,
                itemsMap[`${section.category}_${itemDef.itemCode}`] || {},
              ])
            )
          }
          inspectionId={inspectionId}
          existingPhotos={existingPhotos.filter(p => p.category === section.category)}
          onChange={(itemCode, field, value) =>
            handleItemChange(section.category, itemCode, field, value)
          }
          onPhotosChange={handlePhotosChange}
          disabled={disabled}
        />
      ))}

      {/* Remark */}
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm space-y-2">
        <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>📝</span> หมายเหตุ
        </label>
        <textarea
          value={remark}
          onChange={e => setRemark(e.target.value)}
          disabled={disabled}
          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
        />
      </div>

      {/* Action buttons */}
      {/* Action buttons (Temporarily disabled for user review) */}
      {!disabled && (
        <div className="space-y-2 pb-6">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-xs font-semibold text-center leading-relaxed">
            🚧 ระบบเปิดให้ตรวจสอบรายการบันทึกคืนรถก่อนชั่วคราว ปุ่มบันทึกข้อมูลจะเปิดใช้งานในภายหลัง
          </div>
        </div>
      )}
    </div>
  )
}
