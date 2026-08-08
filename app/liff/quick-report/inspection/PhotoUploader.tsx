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
  onUploadSuccess?: (photos: any[]) => void
  onPhotoDeleted?: (photoId: number) => void
  lineUserId?: string | null
}

const POSITION_LABELS: Record<string, string> = {
  FRONT: '📷 ด้านหน้า',
  BACK: '📷 ด้านหลัง',
  LEFT: '📷 ด้านซ้าย',
  RIGHT: '📷 ด้านขวา',
}

const spacesEndpoint = 'https://sgp1.digitaloceanspaces.com'
const spacesBucket = 'space-ev7tracking-prod'
const SPACES_CDN = (typeof window !== 'undefined' && localStorage.getItem('spaces_cdn')) || spacesEndpoint.replace('https://', `https://${spacesBucket}.`)

export default function PhotoUploader({
  inspectionId,
  category,
  itemCode = null,
  positions,
  label,
  existingPhotos = [],
  disabled = false,
  onPhotosChange,
  onUploadSuccess,
  onPhotoDeleted,
  lineUserId,
}: PhotoUploaderProps) {
  // Track pending files per position (or null for no-position)
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadedPhotos, setUploadedPhotos] = useState(existingPhotos)
  const cameraInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const galleryInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  // Sync existing photos when prop changes
  useEffect(() => {
    setUploadedPhotos(existingPhotos)
  }, [existingPhotos])

  const handleDeleteExistingPhoto = useCallback(async (photoId: number) => {
    try {
      const url = lineUserId 
        ? `/api/inspection/photo/${photoId}?lineUserId=${encodeURIComponent(lineUserId)}`
        : `/api/inspection/photo/${photoId}`
      const res = await fetch(url, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      if (onPhotoDeleted) {
        onPhotoDeleted(photoId)
      }
    } catch (err) {
      console.error(err)
    }
  }, [onPhotoDeleted, lineUserId])

  const handleFileSelect = useCallback(async (position: string | null, files: FileList | null) => {
    if (!files || files.length === 0) return
    const key = position || '_default'
    const newFiles = Array.from(files)

    if (inspectionId) {
      setUploading(true)
      try {
        const formData = new FormData()
        newFiles.forEach(f => formData.append('files', f))
        formData.append('inspectionId', String(inspectionId))
        formData.append('category', category)
        if (itemCode) formData.append('itemCode', itemCode)
        if (position) formData.append('photoPosition', position)
        if (lineUserId) formData.append('lineUserId', lineUserId)

        const res = await fetch('/api/inspection/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) throw new Error('Upload failed')
        const data = await res.json()
        const newPhotos = data.photos || []
        setUploadedPhotos(prev => [...prev, ...newPhotos])
        if (onUploadSuccess) {
          onUploadSuccess(newPhotos)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setUploading(false)
      }
    } else {
      setPendingFiles(prev => ({
        ...prev,
        [key]: [...(prev[key] || []), ...newFiles],
      }))

      // Notify parent
      if (onPhotosChange) {
        onPhotosChange(category, itemCode, newFiles, position)
      }
    }
  }, [category, itemCode, inspectionId, lineUserId, onPhotosChange, onUploadSuccess])

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
      if (lineUserId) formData.append('lineUserId', lineUserId)

      const res = await fetch('/api/inspection/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()

      // Add to uploaded list & clear pending
      const newPhotos = data.photos || []
      setUploadedPhotos(prev => [...prev, ...newPhotos])
      setPendingFiles(prev => ({ ...prev, [key]: [] }))

      if (onUploadSuccess) {
        onUploadSuccess(newPhotos)
      }
    } catch (err) {
      console.error('Photo upload error:', err)
    } finally {
      setUploading(false)
    }
  }, [pendingFiles, inspectionId, category, itemCode, lineUserId, onUploadSuccess])

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
              className="relative w-16 h-16 rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50"
            >
              <img
                src={`${SPACES_CDN}/${photo.s3Key}`}
                alt=""
                className="w-full h-full object-cover"
              />
              {!disabled && photo.inspectionPhotoId && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(photo.inspectionPhotoId!)}
                  className="absolute top-0 right-0 bg-rose-500 text-white w-4 h-4 rounded-full text-[9px] flex items-center justify-center active:scale-90 transition shadow-sm z-10"
                  title="ลบรูปภาพ"
                >
                  ✕
                </button>
              )}
              {confirmDeleteId === photo.inspectionPhotoId && (
                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-20 transition-all duration-200">
                  <span className="text-[9px] font-bold text-white mb-1 leading-none">ลบรูป?</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteExistingPhoto(photo.inspectionPhotoId!)
                        setConfirmDeleteId(null)
                      }}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white text-[8px] px-1 py-0.5 rounded font-bold"
                    >
                      ลบ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="bg-slate-600 hover:bg-slate-700 text-white text-[8px] px-1 py-0.5 rounded font-bold"
                    >
                      เลิก
                    </button>
                  </div>
                </div>
              )}
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

          {/* Add buttons */}
          {!disabled && (
            <>
              <button
                type="button"
                onClick={() => cameraInputRefs.current[key]?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-350 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center text-slate-500 transition active:scale-95"
                title="ถ่ายรูปสด"
              >
                <span className="text-lg">📸</span>
                <span className="text-[9px] font-bold">ถ่ายรูป</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRefs.current[key]?.click()}
                className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-350 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center text-slate-500 transition active:scale-95"
                title="เลือกจากคลังภาพ"
              >
                <span className="text-lg">🖼️</span>
                <span className="text-[9px] font-bold">อัลบั้ม</span>
              </button>
            </>
          )}
        </div>

        {/* Camera Input */}
        <input
          ref={el => { cameraInputRefs.current[key] = el }}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => {
            handleFileSelect(position, e.target.files)
            e.target.value = ''
          }}
        />

        {/* Gallery Input */}
        <input
          ref={el => { galleryInputRefs.current[key] = el }}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => {
            handleFileSelect(position, e.target.files)
            e.target.value = ''
          }}
        />
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
