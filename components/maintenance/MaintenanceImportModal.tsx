'use client'
import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { exportToExcel } from '@/lib/exportExcel'
import { IMPORT_CONFIG } from '@/lib/maintenance-import/config'
import {
  IMPORT_STATUS_LABEL,
  type EvaluatedRow,
  type ImportRequestBody,
  type ImportResponse,
  type ImportRowStatus,
} from '@/lib/maintenance-import/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Called after a commit that imported at least one row (refresh the table). */
  onImported: () => void
}

type Step = 'select' | 'preview' | 'done'
type RowFilter = 'all' | 'ready' | 'skipped'

const getLineUserId = (): string | null => {
  try {
    const profile = localStorage.getItem('liff_profile')
    return profile ? JSON.parse(profile).userId || null : null
  } catch {
    return null
  }
}

const statusChipClass = (status: ImportRowStatus) => {
  if (status === 'READY' || status === 'IMPORTED') return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400'
  if (status === 'ERROR') return 'bg-rose-500/10 text-rose-700 border-rose-500/20 dark:text-rose-400'
  return 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400'
}

const formatIncident = (iso: string | null) => {
  if (!iso) return '-'
  const [date, time] = iso.split('T')
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y} ${time?.slice(0, 5) ?? ''}`.trim()
}

export function MaintenanceImportModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('select')
  const [payload, setPayload] = useState<ImportRequestBody | null>(null)
  const [result, setResult] = useState<ImportResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<RowFilter>('all')

  if (!open) return null

  const reset = () => {
    setStep('select')
    setPayload(null)
    setResult(null)
    setError(null)
    setFilter('all')
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    if (busy) return
    reset()
    onClose()
  }

  const post = async (url: string, body: ImportRequestBody): Promise<ImportResponse> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')
    return data as ImportResponse
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null })
      if (aoa.length < 2) throw new Error('ไฟล์ Excel ไม่มีข้อมูลแถวรายการ')

      const body: ImportRequestBody = {
        fileName: file.name,
        headers: aoa[0],
        rows: aoa.slice(1),
        lineUserId: getLineUserId(),
      }
      const preview = await post('/api/maintenance/import/preview', body)
      setPayload(body)
      setResult(preview)
      setFilter('all')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const handleCommit = async () => {
    if (!payload) return
    setError(null)
    setBusy(true)
    try {
      const committed = await post('/api/maintenance/import/commit', { ...payload, lineUserId: getLineUserId() })
      setResult(committed)
      setStep('done')
      if ((committed.summary.imported ?? 0) > 0) onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const downloadSkipped = () => {
    if (!result) return
    const skipped = result.rows.filter(r => r.status !== 'IMPORTED' && r.status !== 'READY')
    exportToExcel({
      reportName: 'รายงานแถวที่ไม่ได้นำเข้า',
      periodLabel: payload?.fileName || '-',
      headers: ['แถวใน Excel', 'เลขเคลม', 'เลขงาน', 'ทะเบียน', 'ผลการตรวจ', 'สาเหตุ'],
      rows: skipped.map(r => [r.rowNo, r.claimNumber || '-', r.jobNo || '-', r.registerNo || '-', IMPORT_STATUS_LABEL[r.status], r.reason || '-']),
      fileName: 'import_skipped',
    })
  }

  const rows: EvaluatedRow[] = result?.rows ?? []
  const visibleRows = rows.filter(r => {
    if (filter === 'ready') return r.status === 'READY' || r.status === 'IMPORTED'
    if (filter === 'skipped') return r.status !== 'READY' && r.status !== 'IMPORTED'
    return true
  })
  const summary = result?.summary
  const byStatus = Object.entries(summary?.byStatus ?? {}) as [ImportRowStatus, number][]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
      <div
        className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">📥 นำเข้างานซ่อม/เคลมจาก Excel</h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              เปิดใบแจ้งซ่อมสถานะ “ยังขับใช้งานได้” ให้รถที่ยังไม่มีใบซ่อมเปิดอยู่ · ตรวจซ้ำด้วยเลขเคลม · สถานที่ซ่อม = {IMPORT_CONFIG.unspecifiedLocationLabel}
            </p>
          </div>
          <button onClick={close} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none" aria-label="ปิด">✕</button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </div>
          )}

          {step === 'select' && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-zinc-200 py-14 dark:border-zinc-700">
              <p className="text-xs text-zinc-500">เลือกไฟล์ .xlsx / .xls (สูงสุด {IMPORT_CONFIG.maxRows} แถวต่อครั้ง)</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} disabled={busy} className="text-xs" />
              {busy && <p className="text-xs text-zinc-400">กำลังตรวจสอบไฟล์...</p>}
            </div>
          )}

          {step !== 'select' && summary && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full border border-zinc-200 px-2.5 py-1 font-bold dark:border-zinc-700">
                  ทั้งหมด {summary.total} แถว
                </span>
                {byStatus.map(([status, count]) => (
                  <span key={status} className={`rounded-full border px-2.5 py-1 font-bold ${statusChipClass(status)}`}>
                    {IMPORT_STATUS_LABEL[status]} {count}
                  </span>
                ))}
              </div>

              {result?.warnings.map((w, i) => (
                <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">⚠️ {w}</div>
              ))}

              <div className="flex gap-2 text-[11px]">
                {(['all', 'ready', 'skipped'] as RowFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-lg border px-3 py-1 font-bold ${filter === f ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' : 'border-zinc-200 text-zinc-500 dark:border-zinc-700'}`}
                  >
                    {f === 'all' ? 'ทั้งหมด' : f === 'ready' ? (step === 'done' ? 'นำเข้าแล้ว' : 'พร้อมนำเข้า') : 'ข้าม/ผิดพลาด'}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-400 dark:bg-zinc-900/50">
                    <tr>
                      {['แถว', 'เลขเคลม', 'ทะเบียน', 'รุ่น', 'วันที่เกิดเหตุ', 'อาการ', 'ผู้ขับ', 'ฝ่ายผิด', 'สถานที่ซ่อม', 'ผลการตรวจ'].map(h => (
                        <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {visibleRows.map(r => (
                      <tr key={r.rowNo}>
                        <td className="px-3 py-2 text-zinc-400">{r.rowNo}</td>
                        <td className="px-3 py-2 font-mono">{r.claimNumber || '-'}</td>
                        <td className="px-3 py-2 font-mono font-bold">{r.matchedRegisterNo || r.registerNo || '-'}</td>
                        <td className="px-3 py-2">{r.model || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatIncident(r.incidentDate)}</td>
                        <td className="px-3 py-2 max-w-[220px] truncate" title={r.issueTitle}>{r.issueTitle || '-'}</td>
                        <td className="px-3 py-2">{r.driverName || '-'}</td>
                        <td className="px-3 py-2">{r.faultPartyName || r.faultPartyCode || '-'}</td>
                        <td className="px-3 py-2 text-zinc-500">{IMPORT_CONFIG.unspecifiedLocationLabel}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusChipClass(r.status)}`}>
                            {IMPORT_STATUS_LABEL[r.status]}
                          </span>
                          {r.reason && <div className="mt-0.5 text-[10px] text-zinc-400">{r.reason}</div>}
                        </td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 && (
                      <tr><td colSpan={10} className="py-8 text-center text-zinc-400">ไม่มีรายการ</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <div>
            {step !== 'select' && summary && summary.total - summary.ready - (summary.imported ?? 0) > 0 && (
              <button onClick={downloadSkipped} className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
                ⬇️ ดาวน์โหลดรายงานแถวที่ไม่ได้นำเข้า
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 'preview' && (
              <>
                <button onClick={reset} disabled={busy} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">เลือกไฟล์ใหม่</button>
                <button
                  onClick={handleCommit}
                  disabled={busy || !summary || summary.ready === 0}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${summary?.ready ?? 0} รายการ`}
                </button>
              </>
            )}
            {step === 'done' && (
              <button onClick={close} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700">
                เสร็จสิ้น (นำเข้า {summary?.imported ?? 0} / ข้าม {summary?.skipped ?? 0}{(summary?.failed ?? 0) > 0 ? ` / ผิดพลาด ${summary?.failed}` : ''})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
