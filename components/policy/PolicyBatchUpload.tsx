import React, { useState, useRef, useMemo } from 'react'
import { parsePolicyFileName } from '@/lib/policy/policy-parser'
import { ParsedPolicyFile } from '@/lib/policy/policy-types'
import { formatThaiDate } from '@/lib/policy/policy-constants'

interface PolicyBatchUploadProps {
  lineUserId?: string | null
  onUploadSuccess: () => void
}

interface UploadQueueItem extends ParsedPolicyFile {
  id: string
  file: File
  uploadStatus: 'IDLE' | 'QUEUED' | 'UPLOADING' | 'SUCCESS' | 'ERROR'
  uploadError?: string | null
  s3Key?: string | null
}

const CHUNK_SIZE = 15 // Number of files per HTTP batch request
const CONCURRENCY = 4 // Number of parallel batch requests

export function PolicyBatchUpload({ lineUserId, onUploadSuccess }: PolicyBatchUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<UploadQueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const isPausedRef = useRef(false)

  // Progress metrics
  const [progressState, setProgressState] = useState<{
    total: number
    completed: number
    success: number
    failed: number
    currentBatchInfo: string
  }>({
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    currentBatchInfo: ''
  })

  // Table pagination & filter within queue for high performance with 4,000+ files
  const [queuePage, setQueuePage] = useState(1)
  const [queueStatusFilter, setQueueStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR' | 'PENDING' | 'INVALID'>('ALL')
  const [queueSearch, setQueueSearch] = useState('')
  const ITEMS_PER_PAGE = 50

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (newFiles.length === 0) {
      alert('กรุณาเลือกไฟล์เอกสารนามสกุล .PDF เท่านั้น')
      return
    }

    const existingNames = new Set(items.map(it => it.originalFileName))
    const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name))

    const newQueueItems: UploadQueueItem[] = uniqueNewFiles.map((file, idx) => {
      const parsed = parsePolicyFileName(file.name, file.size)
      return {
        ...parsed,
        id: `${Date.now()}_${idx}_${file.name}`,
        file,
        uploadStatus: 'IDLE',
        uploadError: null,
        s3Key: null
      }
    })

    setItems(prev => [...prev, ...newQueueItems])
    setQueuePage(1)
  }

  const handleRemoveItem = (id: string) => {
    if (uploading) return
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const handleClearAll = () => {
    if (uploading) return
    setItems([])
    setProgressState({ total: 0, completed: 0, success: 0, failed: 0, currentBatchInfo: '' })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Upload a batch chunk (e.g. 15 files in 1 HTTP multipart request)
  const uploadBatchChunk = async (
    chunk: UploadQueueItem[]
  ): Promise<{ successMap: Record<string, string>; errorMap: Record<string, string> }> => {
    const formData = new FormData()
    chunk.forEach(it => formData.append('files', it.file))
    if (lineUserId) formData.append('lineUserId', lineUserId)

    const metadataMap: Record<string, any> = {}
    chunk.forEach(it => {
      metadataMap[it.originalFileName] = {
        vinNo: it.vinNo,
        docType: it.docType,
        policyType: it.policyType,
        policyTypeName: it.policyTypeName,
        policyNo: it.policyNo,
        startDate: it.startDateStr,
        endDate: it.expiryDateStr
      }
    })
    formData.append('metadata', JSON.stringify(metadataMap))

    const successMap: Record<string, string> = {}
    const errorMap: Record<string, string> = {}

    try {
      const res = await fetch('/api/policy/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (res.ok && data.success) {
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((r: any) => {
            successMap[r.fileName] = r.s3Key
          })
        }
        if (data.errors && Array.isArray(data.errors)) {
          data.errors.forEach((errStr: string) => {
            // Find matched item
            chunk.forEach(c => {
              if (errStr.includes(c.originalFileName)) {
                errorMap[c.originalFileName] = errStr
              }
            })
          })
        }
        // Check for any chunk items not in results
        chunk.forEach(c => {
          if (!successMap[c.originalFileName] && !errorMap[c.originalFileName]) {
            errorMap[c.originalFileName] = 'ไม่สามารถบันทึกข้อมูลได้'
          }
        })
      } else {
        const fallbackErr = data.error || 'การอัปโหลดชุดนี้ล้มเหลว'
        chunk.forEach(c => {
          errorMap[c.originalFileName] = fallbackErr
        })
      }
    } catch (err: any) {
      chunk.forEach(c => {
        errorMap[c.originalFileName] = err.message || 'การเชื่อมต่อผิดพลาด'
      })
    }

    return { successMap, errorMap }
  }

  // Start Batch Upload (Massive Scale 4,000+ files)
  const handleStartUpload = async (retryOnlyFailed = false) => {
    const targetItems = retryOnlyFailed
      ? items.filter(it => it.uploadStatus === 'ERROR' && it.isValid)
      : items.filter(it => it.isValid && it.uploadStatus !== 'SUCCESS')

    if (targetItems.length === 0) {
      alert('ไม่พบไฟล์ที่พร้อมอัปโหลด')
      return
    }

    setUploading(true)
    isPausedRef.current = false

    // Set status of target items to QUEUED
    const targetIds = new Set(targetItems.map(it => it.id))
    setItems(prev =>
      prev.map(it => (targetIds.has(it.id) ? { ...it, uploadStatus: 'QUEUED', uploadError: null } : it))
    )

    // Slice into chunks
    const chunks: UploadQueueItem[][] = []
    for (let i = 0; i < targetItems.length; i += CHUNK_SIZE) {
      chunks.push(targetItems.slice(i, i + CHUNK_SIZE))
    }

    const total = targetItems.length
    let completed = 0
    let success = 0
    let failed = 0

    setProgressState({
      total,
      completed: 0,
      success: 0,
      failed: 0,
      currentBatchInfo: `เตรียมส่ง ${chunks.length} ชุด (ชุดละ ${CHUNK_SIZE} ไฟล์)...`
    })

    let nextChunkIndex = 0

    const runWorker = async (workerId: number) => {
      while (nextChunkIndex < chunks.length) {
        if (isPausedRef.current) break

        const chunkIndex = nextChunkIndex++
        const chunk = chunks[chunkIndex]
        if (!chunk) break

        const chunkFileNames = new Set(chunk.map(c => c.originalFileName))

        // Mark items in this chunk as UPLOADING
        setItems(prev =>
          prev.map(it => (chunkFileNames.has(it.originalFileName) ? { ...it, uploadStatus: 'UPLOADING' } : it))
        )
        setProgressState(prev => ({
          ...prev,
          currentBatchInfo: `Worker ${workerId}: กำลังส่งชุดที่ ${chunkIndex + 1}/${chunks.length} (${chunk.length} ไฟล์)...`
        }))

        // Upload chunk
        const { successMap, errorMap } = await uploadBatchChunk(chunk)

        const chunkSuccess = Object.keys(successMap).length
        const chunkFailed = Object.keys(errorMap).length

        completed += chunk.length
        success += chunkSuccess
        failed += chunkFailed

        setItems(prev =>
          prev.map(it => {
            if (successMap[it.originalFileName]) {
              return { ...it, uploadStatus: 'SUCCESS', s3Key: successMap[it.originalFileName], uploadError: null }
            }
            if (errorMap[it.originalFileName]) {
              return { ...it, uploadStatus: 'ERROR', uploadError: errorMap[it.originalFileName] }
            }
            return it
          })
        )

        setProgressState(prev => ({
          ...prev,
          completed: Math.min(total, completed),
          success,
          failed
        }))
      }
    }

    // Run parallel workers
    const workerPromises = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, (_, i) =>
      runWorker(i + 1)
    )

    await Promise.all(workerPromises)

    setUploading(false)
    onUploadSuccess()
  }

  const handleStopUpload = () => {
    isPausedRef.current = true
    setUploading(false)
  }

  // Filtered Queue List for Display
  const filteredQueueItems = useMemo(() => {
    return items.filter(it => {
      // Status filter
      if (queueStatusFilter === 'SUCCESS' && it.uploadStatus !== 'SUCCESS') return false
      if (queueStatusFilter === 'ERROR' && it.uploadStatus !== 'ERROR') return false
      if (queueStatusFilter === 'PENDING' && (it.uploadStatus === 'SUCCESS' || !it.isValid)) return false
      if (queueStatusFilter === 'INVALID' && it.isValid) return false

      // Search filter
      if (queueSearch) {
        const q = queueSearch.toLowerCase()
        return (
          it.originalFileName.toLowerCase().includes(q) ||
          (it.vinNo && it.vinNo.toLowerCase().includes(q)) ||
          (it.policyNo && it.policyNo.toLowerCase().includes(q))
        )
      }
      return true
    })
  }, [items, queueStatusFilter, queueSearch])

  // Pagination for Queue View
  const totalQueuePages = Math.ceil(filteredQueueItems.length / ITEMS_PER_PAGE) || 1
  const displayedQueueItems = useMemo(() => {
    const start = (queuePage - 1) * ITEMS_PER_PAGE
    return filteredQueueItems.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredQueueItems, queuePage])

  const validCount = items.filter(it => it.isValid).length
  const successCount = items.filter(it => it.uploadStatus === 'SUCCESS').length
  const errorCount = items.filter(it => it.uploadStatus === 'ERROR').length
  const pendingCount = items.filter(it => it.isValid && it.uploadStatus !== 'SUCCESS').length

  const progressPercent = progressState.total > 0
    ? Math.min(100, Math.round((progressState.completed / progressState.total) * 100))
    : 0

  return (
    <div className="space-y-5">
      {/* Dropzone Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleFileSelect(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer text-center group"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          ลากไฟล์ PDF กรมธรรม์มาวางที่นี่ (รองรับสูงสุด 4,000+ ไฟล์)
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-lg">
          ระบบ Chunking Concurrency ควบคุมการส่งชุดละ 15 ไฟล์พร้อมกัน 4 เส้นทาง สามารถอัปโหลดไฟล์ 4,000 ไฟล์เสร็จสิ้นภายใน ~1-2 นาที
        </p>
        <div className="flex items-center gap-3 mt-3 text-[11px] text-zinc-400 font-mono">
          <span>ตัวอย่าง: PLMV_LNAAKAA12R5E01443_DV1BK2508000072_17082569.PDF</span>
        </div>
      </div>

      {/* Real-time Progress Bar & Queue Status Banner */}
      {(uploading || progressState.completed > 0) && (
        <div className="p-5 rounded-3xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-xl space-y-3.5 border border-zinc-700/80">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              {uploading ? (
                <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : progressState.completed === progressState.total && progressState.failed === 0 ? (
                <span className="p-1 rounded-full bg-emerald-500 text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="text-amber-400 text-lg font-bold">⚠️</span>
              )}

              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>
                    {uploading
                      ? `กำลังอัปโหลดคิวไฟล์ (${progressState.completed.toLocaleString()} / ${progressState.total.toLocaleString()} เสร็จสิ้น)`
                      : progressState.completed === progressState.total
                      ? `อัปโหลดเสร็จสิ้น (${progressState.success.toLocaleString()} สำเร็จ, ${progressState.failed.toLocaleString()} ล้มเหลว)`
                      : `หยุดชั่วคราว (${progressState.completed.toLocaleString()} / ${progressState.total.toLocaleString()} เสร็จสิ้น)`}
                  </span>
                  <span className="text-amber-400 font-mono text-sm font-bold">{progressPercent}%</span>
                </div>
                {uploading && progressState.currentBatchInfo && (
                  <p className="text-xs text-zinc-400 font-mono truncate max-w-sm sm:max-w-md mt-0.5">
                    ⚡ {progressState.currentBatchInfo}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {uploading ? (
                <button
                  type="button"
                  onClick={handleStopUpload}
                  className="px-3 py-1.5 text-xs font-semibold bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-xl transition-colors"
                >
                  หยุดชั่วคราว
                </button>
              ) : errorCount > 0 ? (
                <button
                  type="button"
                  onClick={() => handleStartUpload(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-xl transition-colors shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>ลองใหม่เฉพาะที่ล้มเหลว ({errorCount.toLocaleString()})</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Animated Percentage Bar */}
          <div className="w-full bg-zinc-800 dark:bg-zinc-950 rounded-full h-3 overflow-hidden p-0.5 border border-zinc-700">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressState.failed > 0 && progressState.completed === progressState.total
                  ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                  : 'bg-gradient-to-r from-amber-500 to-emerald-400'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Metric Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              ทั้งหมดในคิว: <strong>{items.length.toLocaleString()}</strong> ไฟล์
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              สำเร็จแล้ว: <strong>{successCount.toLocaleString()}</strong> ไฟล์
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                ล้มเหลว: <strong>{errorCount.toLocaleString()}</strong> ไฟล์
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                รอคิว: <strong>{pendingCount.toLocaleString()}</strong> ไฟล์
              </span>
            )}
          </div>
        </div>
      )}

      {/* Items Table with Live Queue Status */}
      {items.length > 0 && (
        <div className="space-y-3">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={queueSearch}
                onChange={(e) => { setQueueSearch(e.target.value); setQueuePage(1) }}
                placeholder="ค้นหาในคิว (ชื่อไฟล์, VIN)..."
                className="text-xs px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 w-44 sm:w-60"
              />

              <select
                value={queueStatusFilter}
                onChange={(e) => { setQueueStatusFilter(e.target.value as any); setQueuePage(1) }}
                className="text-xs py-1.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
              >
                <option value="ALL">สถานะทั้งหมด ({items.length.toLocaleString()})</option>
                <option value="PENDING">รออัปโหลด ({pendingCount.toLocaleString()})</option>
                <option value="SUCCESS">สำเร็จ ({successCount.toLocaleString()})</option>
                <option value="ERROR">ล้มเหลว ({errorCount.toLocaleString()})</option>
                <option value="INVALID">รูปแบบไม่ถูกต้อง ({items.filter(it => !it.isValid).length.toLocaleString()})</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={uploading}
                className="text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                ล้างคิวทั้งหมด
              </button>

              <button
                type="button"
                onClick={() => handleStartUpload(false)}
                disabled={uploading || validCount === 0 || (pendingCount === 0 && errorCount === 0)}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-zinc-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>กำลังอัปโหลด ({progressState.completed.toLocaleString()}/{progressState.total.toLocaleString()})...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>เริ่มอัปโหลดเข้าคิว ({validCount.toLocaleString()} ไฟล์)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Queue Table */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm max-h-[550px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200/80 dark:border-zinc-700">
                <tr className="text-zinc-600 dark:text-zinc-400 font-semibold">
                  <th className="py-2.5 px-3.5">ลำดับ</th>
                  <th className="py-2.5 px-3.5">สถานะคิว</th>
                  <th className="py-2.5 px-3.5">ชื่อไฟล์</th>
                  <th className="py-2.5 px-3.5">เลขตัวถัง (VIN)</th>
                  <th className="py-2.5 px-3.5">ประเภท</th>
                  <th className="py-2.5 px-3.5">เลขที่กรมธรรม์</th>
                  <th className="py-2.5 px-3.5">วันหมดอายุ (แปลงแล้ว)</th>
                  <th className="py-2.5 px-3.5 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
                {displayedQueueItems.map((item, idx) => {
                  const globalIdx = (queuePage - 1) * ITEMS_PER_PAGE + idx + 1

                  let statusBadge = (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      ⏳ รอคิว
                    </span>
                  )

                  if (!item.isValid) {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800" title={item.validationError || ''}>
                        ❌ {item.validationError || 'ไม่ถูกต้อง'}
                      </span>
                    )
                  } else if (item.uploadStatus === 'UPLOADING') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        กำลังส่ง...
                      </span>
                    )
                  } else if (item.uploadStatus === 'SUCCESS') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <svg className="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                        สำเร็จ
                      </span>
                    )
                  } else if (item.uploadStatus === 'ERROR') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800" title={item.uploadError || ''}>
                        ❌ {item.uploadError || 'ล้มเหลว'}
                      </span>
                    )
                  }

                  return (
                    <tr
                      key={item.id}
                      className={
                        item.uploadStatus === 'SUCCESS'
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                          : item.uploadStatus === 'ERROR'
                          ? 'bg-rose-50/30 dark:bg-rose-950/20'
                          : item.uploadStatus === 'UPLOADING'
                          ? 'bg-amber-50/30 dark:bg-amber-950/20'
                          : !item.isValid
                          ? 'bg-zinc-100/50 dark:bg-zinc-800/20'
                          : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40'
                      }
                    >
                      <td className="py-2.5 px-3.5 font-mono text-zinc-400">{globalIdx}</td>
                      <td className="py-2.5 px-3.5">{statusBadge}</td>
                      <td className="py-2.5 px-3.5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate" title={item.originalFileName}>
                        {item.originalFileName}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-medium text-zinc-900 dark:text-white">
                        {item.vinNo || '-'}
                      </td>
                      <td className="py-2.5 px-3.5">
                        {item.prefix === 'PLMV' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200">
                            🛡️ PLMV ({item.policyTypeName || item.policyType})
                          </span>
                        ) : item.prefix === 'PLMC' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200">
                            📜 PLMC (พ.ร.บ.)
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">ไม่ระบุ</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-zinc-800 dark:text-zinc-200">
                        {item.policyNo || '-'}
                      </td>
                      <td className="py-2.5 px-3.5">
                        {item.expiryDateStr ? (
                          <div>
                            <strong className="text-zinc-900 dark:text-white">{formatThaiDate(item.expiryDateStr)}</strong>
                            <span className="text-[10px] text-zinc-400 font-mono ml-1">({item.expiryDateStr})</span>
                          </div>
                        ) : (
                          <span className="text-rose-500 italic">ไม่ถูกต้อง</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={uploading}
                          className="text-zinc-400 hover:text-rose-600 transition-colors p-1 disabled:opacity-30"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Queue Pagination Footer */}
          {totalQueuePages > 1 && (
            <div className="flex items-center justify-between pt-2 px-1 text-xs text-zinc-500">
              <span>
                แสดงรายการที่ {(queuePage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(queuePage * ITEMS_PER_PAGE, filteredQueueItems.length)} จากทั้งหมด {filteredQueueItems.length.toLocaleString()} รายการ
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQueuePage(p => Math.max(1, p - 1))}
                  disabled={queuePage === 1}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                >
                  ก่อนหน้า
                </button>
                <span className="font-mono px-2">
                  หน้า {queuePage} / {totalQueuePages}
                </span>
                <button
                  type="button"
                  onClick={() => setQueuePage(p => Math.min(totalQueuePages, p + 1))}
                  disabled={queuePage === totalQueuePages}
                  className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
