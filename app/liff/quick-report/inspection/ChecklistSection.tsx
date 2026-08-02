'use client'

import React from 'react'
import type { ChecklistSectionDef, InspectionItemData } from '@/lib/inspection/types'
import PhotoUploader from './PhotoUploader'

interface ChecklistSectionProps {
  section: ChecklistSectionDef
  items: Record<string, InspectionItemData>      // key = itemCode
  inspectionId: number | null
  existingPhotos?: Array<{
    inspectionPhotoId?: number
    s3Key: string
    category: string
    itemCode?: string | null
    photoPosition?: string | null
  }>
  onChange: (itemCode: string, field: keyof InspectionItemData, value: any) => void
  onPhotosChange?: (category: string, itemCode: string | null, files: File[], position?: string | null) => void
  disabled?: boolean
  onPhotoDeleted?: (photoId: number) => void
  onUploadSuccess?: (photos: any[]) => void
  lineUserId?: string | null
}

export default function ChecklistSection({
  section,
  items,
  inspectionId,
  existingPhotos = [],
  onChange,
  onPhotosChange,
  disabled = false,
  onPhotoDeleted,
  onUploadSuccess,
  lineUserId,
}: ChecklistSectionProps) {
  // Compute completion counts including standard and photos_only items
  let totalSecCount = 0
  let filledSecCount = 0

  for (const itemDef of section.items) {
    totalSecCount++
    if (itemDef.inputType === 'photos_only') {
      if (itemDef.photoPositions && itemDef.photoPositions.length > 0) {
        const hasAllPositions = itemDef.photoPositions.every(pos =>
          existingPhotos.some(p => p.itemCode === itemDef.itemCode && p.photoPosition === pos)
        )
        if (hasAllPositions) filledSecCount++
      } else {
        const hasPhoto = existingPhotos.some(p => p.itemCode === itemDef.itemCode)
        if (hasPhoto) filledSecCount++
      }
    } else {
      const data = items[itemDef.itemCode] || {}
      const isFilled = !!(data.value || data.numericValue != null || data.detail || data.expiryDate)
      if (isFilled) filledSecCount++
    }
  }

  const isCompleted = filledSecCount === totalSecCount

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span>{section.icon}</span>
          {section.label}
        </h3>
        {totalSecCount > 0 && (
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border transition-all ${
            isCompleted 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
          }`}>
            {isCompleted ? '✓ ครบแล้ว' : `${filledSecCount}/${totalSecCount} ข้อ`}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-slate-100">
        {section.items.map(itemDef => {
          const data = items[itemDef.itemCode] || {}
          const sectionPhotos = existingPhotos.filter(
            p => p.category === section.category && p.itemCode === itemDef.itemCode
          )
          
          const isUnfilled = itemDef.inputType !== 'photos_only' && 
            !data.value && 
            data.numericValue == null && 
            !data.detail && 
            !data.expiryDate

          return (
            <div key={itemDef.itemCode} className="px-4 py-3 space-y-2">
              {/* Label */}
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                {itemDef.label}
                {isUnfilled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="ยังไม่ได้ตอบ" />
                )}
              </label>

              {/* Input based on type */}
              {itemDef.inputType === 'select' && itemDef.options && (
                <div className="flex flex-wrap gap-2">
                  {itemDef.options.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(itemDef.itemCode, 'value', opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition active:scale-95 ${
                        data.value === opt.value
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {(itemDef.inputType === 'boolean' || itemDef.inputType === 'boolean_expiry') && itemDef.options && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {itemDef.options.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(itemDef.itemCode, 'value', opt.value)}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition active:scale-95 ${
                          data.value === opt.value
                            ? opt.value === 'YES'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-rose-500 text-white border-rose-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Expiry date (visible when YES) */}
                  {itemDef.hasExpiry && data.value === 'YES' && (
                    <div>
                      <label className="text-[11px] text-slate-500 mb-1 block">วันหมดอายุ</label>
                      <input
                        type="date"
                        disabled={disabled}
                        value={data.expiryDate ? data.expiryDate.substring(0, 10) : ''}
                        onChange={e => onChange(itemDef.itemCode, 'expiryDate', e.target.value || null)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {itemDef.inputType === 'three_way' && itemDef.options && (
                <div className="flex gap-1.5">
                  {itemDef.options.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(itemDef.itemCode, 'value', opt.value)}
                      className={`flex-1 px-2 py-2 rounded-lg text-[11px] font-medium border transition active:scale-95 text-center leading-tight ${
                        data.value === opt.value
                          ? opt.value === 'NORMAL'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : opt.value === 'SCRATCH'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-rose-500 text-white border-rose-500'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {itemDef.inputType === 'number' && (
                <input
                  type="number"
                  inputMode="numeric"
                  disabled={disabled}
                  value={data.numericValue ?? ''}
                  onChange={e => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value)
                    onChange(itemDef.itemCode, 'numericValue', val)
                  }}
                  placeholder={itemDef.label}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onWheel={e => (e.target as HTMLInputElement).blur()}
                />
              )}

              {/* Photos (if hasPhoto) */}
              {itemDef.hasPhoto !== false &&
                ((itemDef.inputType !== 'boolean' && itemDef.inputType !== 'boolean_expiry') ||
                  data.value === 'YES' ||
                  data.value === 'NO') && (
                <PhotoUploader
                  inspectionId={inspectionId}
                  category={section.category}
                  itemCode={itemDef.inputType === 'photos_only' ? itemDef.itemCode : itemDef.itemCode}
                  positions={itemDef.photoPositions}
                  existingPhotos={sectionPhotos}
                  disabled={disabled}
                  onPhotosChange={onPhotosChange}
                  onPhotoDeleted={onPhotoDeleted}
                  onUploadSuccess={onUploadSuccess}
                  lineUserId={lineUserId}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
