import React, { useState, useEffect } from 'react'
import { PolicyLogItem } from '@/lib/policy/policy-types'
import { formatThaiDate } from '@/lib/policy/policy-constants'

interface PolicyHistoryDrawerProps {
  vinNo: string | null
  registerNo: string | null
  isOpen: boolean
  onClose: () => void
  onViewPdf: (url: string, title: string) => void
}

const SPACES_CDN = process.env.NEXT_PUBLIC_SPACES_CDN_URL || 'https://space-ev7tracking-prod.sgp1.digitaloceanspaces.com'

export function PolicyHistoryDrawer({
  vinNo,
  registerNo,
  isOpen,
  onClose,
  onViewPdf
}: PolicyHistoryDrawerProps) {
  const [logs, setLogs] = useState<PolicyLogItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !vinNo) return

    setLoading(true)
    fetch(`/api/policy/${vinNo}/history`)
      .then(res => res.json())
      .then(data => {
        setLogs(data.history || [])
      })
      .catch(err => {
        console.error('Failed to fetch history:', err)
      })
      .finally(() => setLoading(false))
  }, [isOpen, vinNo])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-zinc-900 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>📜 ประวัติกรมธรรม์และเอกสาร</span>
              </h2>
              <p className="text-xs text-zinc-500 font-mono mt-0.5">
                {registerNo ? `${registerNo} (${vinNo})` : vinNo}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Timeline Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs">กำลังโหลดประวัติ...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-zinc-400 text-xs">
                ยังไม่มีบันทึกประวัติกรมธรรม์หรือเอกสารสำหรับรถคันนี้
              </div>
            ) : (
              <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-3 space-y-6">
                {logs.map((log) => {
                  const pdfUrl = log.filePath
                    ? log.filePath.startsWith('http')
                      ? log.filePath
                      : `${SPACES_CDN}/${log.filePath}`
                    : null

                  return (
                    <div key={log.logId} className="relative pl-5">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center ${
                        log.isCurrent ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-zinc-400'
                      }`} />

                      <div className="p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              log.docType === 'INSURANCE'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200'
                                : log.docType === 'ACT'
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200'
                            }`}>
                              {log.policyTypeName || log.docType}
                            </span>
                            {log.isCurrent && (
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                ฉบับปัจจุบัน
                              </span>
                            )}
                          </div>

                          <span className="text-[10px] text-zinc-400 font-mono">
                            {formatThaiDate(log.createDate)}
                          </span>
                        </div>

                        {log.policyNo && (
                          <div className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                            เลขที่: {log.policyNo}
                          </div>
                        )}

                        <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
                          <div>
                            วันหมดอายุ: <strong className="text-zinc-900 dark:text-white font-medium">{formatThaiDate(log.endDate)}</strong>
                          </div>
                          {log.startDate && (
                            <div className="text-[11px] text-zinc-400">
                              (เริ่มคุ้มครอง: {formatThaiDate(log.startDate)})
                            </div>
                          )}
                        </div>

                        {pdfUrl && (
                          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 truncate max-w-[180px]">
                              📄 {log.originalFileName || 'ไฟล์แนบ PDF'}
                            </span>
                            <button
                              type="button"
                              onClick={() => onViewPdf(pdfUrl, `${log.policyTypeName || 'เอกสาร'} - ${log.policyNo || vinNo}`)}
                              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium underline inline-flex items-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              เปิดดู PDF
                            </button>
                          </div>
                        )}

                        {log.createUserName && (
                          <div className="text-[10px] text-zinc-400">
                            ผู้อัปโหลด: {log.createUserName} ({log.uploadSource === 'EXCEL_IMPORT' ? 'นำเข้าผ่าน Excel' : 'อัปโหลด PDF'})
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
