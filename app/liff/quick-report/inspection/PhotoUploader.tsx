'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'

interface PhotoUploaderProps {
  inspectionId: number | null
  category: string
  itemCode?: string | null
  positions?: string[]       // ถ้ามี = ถ่ายหลายมุม (FRONT, BACK, LEFT, RIGHT)
  label?: string
  existingPhotos?: Array<{
    inspectionPhotoId?: number
    s3Key: string
    photoPosition?: string | null
  }>
  disabled?: boolean
  onPhotosChange?: (category: string, itemCode: string | null, files: File[], position?: string | null) => void
}

const POSITION_LABELS: Record<string, string> = {
  FRONT: '📷 ด้านหน้า',
  BACK: '📷 ด้านหลัง',
  LEFT: '📷 ด้านซ้าย',
  RIGHT: '📷 ด้านขวา',
}

const SPACES_CDN = 'https://space-ev7tracking-prod.sgp1.cdn.digitaloceanspaces.com'

export default function PhotoUploader({
  inspectionId,
  category,
  itemCode = null,
  positions,
  label,
  existingPhotos = [],
  disabled = false,
  onPhotosChange,
}: PhotoUploaderProps) {
  // Track pending files per position (or null for no-position)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadedPhotos, setUploadedPhotos] = useState(existingPhotos)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Sync existing photos when prop changes
  useEffect(() => {
    setUploadedPhotos(existingPhotos)
  }, [existingPhotos])

  const handleFileSelect = useCallback((position: string | null, files: FileList | null) => {
    if (!files || files.length === 0) return
    const key = position || '_default'
    const newFiles = Array.from(files)

    setPendingFiles(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), ...newFiles],
    }))

    // Notify parent
    if (onPhotosChange) {
      onPhotosChange(category, itemCode, newFiles, position)
    }
  }, [category, itemCode, onPhotosChange])

  const removePendingFile = useCallback((posKey: string, index: number) => {
    setPendingFiles(prev => {
      const updated = [...(prev[posKey] || [])]
      updated.splice(index, 1)
      return { ...prev, [posKey]: updated }
    })
  }, [])

  const handleUpload = useCallback(async (position: string | null) => {
    const key = position || '_default'
    const files = pendingFiles[key]
    if (!files || files.length === 0 || !inspectionId) return

    setUploading(true)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      formData.append('inspectionId', String(inspectionId))
      formData.append('category', category)
      if (itemCode) formData.append('itemCode', itemCode)
      if (position) formData.append('photoPosition', position)

      const res = await fetch('/api/inspection/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()

      // Add to uploaded list & clear pending
      setUploadedPhotos(prev => [...prev, ...(data.photos || [])])
      setPendingFiles(prev => ({ ...prev, [key]: [] }))
    } catch (err) {
      console.error('Photo upload error:', err)
    } finally {
      setUploading(false)
    }
  }, [pendingFiles, inspectionId, category, itemCode])

  // Auto-upload when inspectionId becomes available and there are pending files
  useEffect(() => {
    if (!inspectionId) return
    Object.keys(pendingFiles).forEach(key => {
      if (pendingFiles[key]?.length > 0) {
        handleUpload(key === '_default' ? null : key)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  const renderSlot = (position: string | null) => {
    const key = position || '_default'
    const posLabel = position ? POSITION_LABELS[position] || position : label || '📷 ถ่ายรูป'
    const existingForPos = uploadedPhotos.filter(p =>
      position ? p.photoPosition === position : !p.photoPosition
    )
    const pendingForPos = pendingFiles[key] || []
    const hasSomething = existingForPos.length > 0 || pendingForPos.length > 0

    return (
      <div key={key} className="space-y-2">
        {positions && positions.length > 1 && (
          <p className="text-xs font-medium text-slate-500">{posLabel}</p>
        )}

        {/* Existing uploaded photos */}
        <div className="flex flex-wrap gap-2">
          {existingForPos.map((photo, i) => (
            <div
              key={`existing-${i}`}
              className="w-16 h-16 rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50"
            >
              <img
                src={`${SPACES_CDN}/${photo.s3Key}`}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}

          {/* Pending files preview */}
          {pendingForPos.map((file, i) => (
            <div key={`pending-${i}`} className="relative w-16 h-16 rounded-xl overflow-hidden border border-amber-300 bg-amber-50">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="w-full h-full object-cover opacity-80"
              />
              <button
                type="button"
                onClick={() => removePendingFile(key, i)}
                className="absolute top-0 right-0 bg-rose-500 text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center"
              >
                ✕
              </button>
              {uploading && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ))}

          {/* Add button */}
          {!disabled && (
            <button
              type="button"
              onClick={() => fileInputRefs.current[key]?.click()}
              className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center text-slate-400 transition active:scale-95"
            >
              <span className="text-lg">📷</span>
              <span className="text-[9px]">เพิ่มรูป</span>
            </button>
          )}
        </div>

        <input
          ref={el => { fileInputRefs.current[key] = el }}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={e => {
            handleFileSelect(position, e.target.files)
            e.target.value = '' // reset so same file can be selected again
          }}
        />

        {/* Upload button (if inspectionId exists and has pending) */}
        {inspectionId && pendingForPos.length > 0 && !uploading && (
          <button
            type="button"
            onClick={() => handleUpload(position)}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg transition"
          >
            อัปโหลด {pendingForPos.length} รูป
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {positions && positions.length > 0
        ? positions.map(pos => renderSlot(pos))
        : renderSlot(null)
      }
    </div>
  )
}
