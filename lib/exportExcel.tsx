'use client'
import * as XLSX from 'xlsx'

interface ExportOptions {
  reportName: string           // ชื่อรายงาน เช่น "รายการงานซ่อม"
  periodLabel: string          // ช่วงเวลา เช่น "12 มิ.ย. 2569" หรือ "1 มิ.ย. - 12 มิ.ย. 2569"
  headers: string[]            // ชื่อคอลัมน์ภาษาไทย
  rows: (string | number | null | undefined)[][] // ข้อมูลแต่ละแถว
  fileName?: string            // ชื่อไฟล์ (ไม่ต้องมี .xlsx)
}

const formatExportDatetime = () => {
  return new Date().toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: 'Asia/Bangkok'
  })
}

export function exportToExcel({ reportName, periodLabel, headers, rows, fileName }: ExportOptions) {
  const exportTime = formatExportDatetime()

  // Build data with header info rows
  const data: (string | number | null | undefined)[][] = [
    [`รายงาน: ${reportName}`],
    [`ช่วงเวลา: ${periodLabel}`],
    [`วันที่ส่งออก: ${exportTime}`],
    [`จำนวน: ${rows.length} รายการ`],
    [], // empty row separator
    headers,
    ...rows
  ]

  const ws = XLSX.utils.aoa_to_sheet(data)

  // Auto-size columns
  const colWidths = headers.map((h, colIdx) => {
    const headerLen = h.length * 2 // Thai chars are wider
    const maxDataLen = rows.reduce((max, row) => {
      const cellVal = String(row[colIdx] ?? '')
      return Math.max(max, cellVal.length)
    }, 0)
    return { wch: Math.max(headerLen, maxDataLen, 12) + 2 }
  })
  ws['!cols'] = colWidths

  // Merge header info cells across columns
  const totalCols = headers.length
  if (totalCols > 1) {
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }, // Report name
      { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } }, // Period
      { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } }, // Export time
      { s: { r: 3, c: 0 }, e: { r: 3, c: totalCols - 1 } }, // Count
    ]
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, reportName.substring(0, 31)) // Sheet name max 31 chars

  const safeName = (fileName || reportName).replace(/[^a-zA-Z0-9ก-๙_\- ]/g, '').replace(/\s+/g, '_')
  const dateStr = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `${safeName}_${dateStr}.xlsx`)
}

// ─── Helper: Format date for Excel cell value ───────────────────────
export function formatDateForExcel(dateStr: string | null): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', year: 'numeric',
      timeZone: 'Asia/Bangkok'
    })
  } catch {
    return dateStr
  }
}

// ─── Reusable Export Button Component ──────────────────────────────
export function ExportButton({ onClick, label = '📥 Export Excel' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 px-3 py-1.5 rounded-xl transition-all duration-200 border border-emerald-500/20 hover:border-emerald-600 shadow-sm hover:shadow-md"
    >
      {label}
    </button>
  )
}
