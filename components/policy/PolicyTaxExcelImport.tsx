import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'

interface PolicyTaxExcelImportProps {
  lineUserId?: string | null
  onImportSuccess: () => void
}

interface TaxImportRow {
  vinNo: string
  registerNo?: string
  vehicleTaxStartDate?: string
  vehicleTaxEndDate?: string
  meterTaxStartDate?: string
  meterTaxEndDate?: string
  remark?: string
  isValid: boolean
  error?: string
}

export function PolicyTaxExcelImport({ lineUserId, onImportSuccess }: PolicyTaxExcelImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<TaxImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    updatedCount: number
    totalRows: number
    errors: string[]
  } | null>(null)

  // Download Excel Template
  const handleDownloadTemplate = () => {
    const headers = [
      'เลขตัวถัง (VIN) *จำเป็น',
      'เลขทะเบียนรถ (ไม่บังคับ)',
      'วันเริ่มภาษีรถยนต์ (YYYY-MM-DD)',
      'วันหมดอายุภาษีรถยนต์ (YYYY-MM-DD) *',
      'วันเริ่มตรวจมิเตอร์ (YYYY-MM-DD)',
      'วันหมดอายุตรวจมิเตอร์ (YYYY-MM-DD) *',
      'หมายเหตุ'
    ]

    const sampleData = [
      headers,
      [
        'LNAAKAA12R5E01443',
        'ทอ-4007',
        '2025-08-18',
        '2026-08-17',
        '2025-08-18',
        '2026-08-17',
        'ต่อภาษีรอบปี 2569'
      ],
      [
        'LNADHAB39T1G01570',
        'ทอ-4008',
        '2025-09-01',
        '2026-08-31',
        '',
        '',
        ''
      ]
    ]

    const ws = XLSX.utils.aoa_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tax_Template')
    XLSX.writeFile(wb, 'Template_นำเข้าภาษีรถและมิเตอร์_EV7.xlsx')
  }

  // Parse Excel Date safely
  const parseExcelDate = (val: any): string | undefined => {
    if (!val) return undefined
    if (typeof val === 'number') {
      // Excel serial date format
      const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000))
      return jsDate.toISOString().split('T')[0]
    }
    const str = String(val).trim()
    if (!str) return undefined

    // Check YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str
    }
    // Check DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (ddmmyyyy) {
      const dd = ddmmyyyy[1].padStart(2, '0')
      const mm = ddmmyyyy[2].padStart(2, '0')
      let yyyy = parseInt(ddmmyyyy[3], 10)
      if (yyyy >= 2500) yyyy -= 543 // convert BE to AD
      return `${yyyy}-${mm}-${dd}`
    }

    return str
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]

        if (data.length < 2) {
          alert('ไฟล์ Excel ไม่มีข้อมูลแถวรายการ')
          return
        }

        // Parse rows starting from row 2 (skip header)
        const parsedRows: TaxImportRow[] = []
        for (let i = 1; i < data.length; i++) {
          const r = data[i]
          if (!r || r.length === 0) continue

          const vinNo = r[0] ? String(r[0]).trim().toUpperCase() : ''
          const registerNo = r[1] ? String(r[1]).trim() : undefined
          const vehicleTaxStartDate = parseExcelDate(r[2])
          const vehicleTaxEndDate = parseExcelDate(r[3])
          const meterTaxStartDate = parseExcelDate(r[4])
          const meterTaxEndDate = parseExcelDate(r[5])
          const remark = r[6] ? String(r[6]).trim() : undefined

          if (!vinNo) continue

          let isValid = true
          let error = ''

          if (vinNo.length !== 17) {
            isValid = false
            error = 'VIN ต้องมี 17 หลัก'
          } else if (!vehicleTaxEndDate && !meterTaxEndDate) {
            isValid = false
            error = 'ต้องระบุวันหมดอายุภาษีรถ หรือ ภาษีมิเตอร์ อย่างน้อย 1 รายการ'
          }

          parsedRows.push({
            vinNo,
            registerNo,
            vehicleTaxStartDate,
            vehicleTaxEndDate,
            meterTaxStartDate,
            meterTaxEndDate,
            remark,
            isValid,
            error
          })
        }

        setRows(parsedRows)
      } catch (err: any) {
        alert(`อ่านไฟล์ Excel ล้มเหลว: ${err.message}`)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleConfirmImport = async () => {
    const validRows = rows.filter(r => r.isValid)
    if (validRows.length === 0) {
      alert('ไม่พบรายการที่ถูกต้องสำหรับนำเข้า')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/policy/import-tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: validRows,
          lineUserId
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setImportResult({
          success: true,
          updatedCount: data.updatedCount,
          totalRows: data.totalRows,
          errors: data.errors || []
        })
        onImportSuccess()
      } else {
        setImportResult({
          success: false,
          updatedCount: 0,
          totalRows: validRows.length,
          errors: [data.error || 'เกิดข้อผิดพลาดในการบันทึก']
        })
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        updatedCount: 0,
        totalRows: validRows.length,
        errors: [err.message || 'การเชื่อมต่อผิดพลาด']
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-5 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <span>📥 นำเข้าข้อมูลภาษีรถยนต์และภาษีมิเตอร์ (Excel Batch Import)</span>
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
            ไฟล์ Excel รวมช่องข้อมูลทั้ง <strong>ภาษีรถยนต์ประจำปี</strong> และ <strong>การตรวจมิเตอร์แท็กซี่</strong> ไว้ในเทมเพลตเดียวกัน สามารถเลือกกรอกเฉพาะรายการที่ต้องการอัปเดต หรือกรอกทั้งคู่พร้อมกันได้
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors shadow-xs"
          >
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>ดาวน์โหลด Template Excel</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 rounded-xl hover:bg-zinc-800 dark:hover:bg-white/90 transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>เลือกไฟล์ Excel เพื่อนำเข้า</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* 📖 Column Structure Guide */}
      <div className="p-4.5 rounded-3xl bg-zinc-50/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              โครงสร้างคอลัมน์ในไฟล์ Excel (ระบบจะแยกประเภทจากคอลัมน์ที่กรอก)
            </h4>
          </div>
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            รองรับทั้งรูปแบบ YYYY-MM-DD หรือ DD/MM/YYYY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Identifiers */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-800/70 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">คอลัมน์ A & B (ข้อมูลระบุรถ)</span>
            </div>
            <ul className="text-[11px] text-zinc-600 dark:text-zinc-300 space-y-1 pl-3.5 list-disc">
              <li><strong>Col A:</strong> เลขตัวถัง VIN 17 หลัก <span className="text-rose-500 font-bold">*จำเป็น</span></li>
              <li><strong>Col B:</strong> เลขทะเบียนรถ (ใส่หรือไม่ใส่ก็ได้)</li>
            </ul>
          </div>

          {/* Vehicle Tax */}
          <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">🚗 คอลัมน์ C & D (ภาษีรถยนต์ประจำปี)</span>
            </div>
            <ul className="text-[11px] text-amber-800 dark:text-amber-200 space-y-1 pl-3.5 list-disc">
              <li><strong>Col C:</strong> วันเริ่มคุ้มครองภาษีรถ</li>
              <li><strong>Col D:</strong> วันหมดอายุภาษีรถยนต์ประจำปี</li>
            </ul>
            <p className="text-[10px] text-amber-700/80 dark:text-amber-400">
              💡 หากต้องการอัปเดตเฉพาะภาษีรถ ให้กรอกช่องนี้และเว้นช่องมิเตอร์ว่างไว้
            </p>
          </div>

          {/* Meter Tax */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">📟 คอลัมน์ E & F (ภาษีตรวจมิเตอร์แท็กซี่)</span>
            </div>
            <ul className="text-[11px] text-emerald-800 dark:text-emerald-200 space-y-1 pl-3.5 list-disc">
              <li><strong>Col E:</strong> วันเริ่มตรวจมิเตอร์</li>
              <li><strong>Col F:</strong> วันหมดอายุตรวจมิเตอร์แท็กซี่</li>
            </ul>
            <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
              💡 หากต้องการอัปเดตเฉพาะตรวจมิเตอร์ ให้กรอกช่องนี้และเว้นช่องภาษีรถว่างไว้
            </p>
          </div>
        </div>
      </div>

      {/* Result Notification */}
      {importResult && (
        <div className={`p-4 rounded-2xl border ${
          importResult.success
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {importResult.success
                ? `นำเข้าและอัปเดตข้อมูลสำเร็จ ${importResult.updatedCount} คัน`
                : 'นำเข้าข้อมูลไม่สำเร็จ'}
            </span>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-rose-700 dark:text-rose-300 list-disc list-inside">
              {importResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                ข้อมูลจากไฟล์ {fileName} ({rows.length} รายการ)
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200">
                ถูกต้อง {rows.filter(r => r.isValid).length}
              </span>
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={importing || rows.filter(r => r.isValid).length === 0}
              className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              {importing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin text-zinc-950" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>กำลังนำเข้า...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>ยืนยันบันทึกข้อมูล ({rows.filter(r => r.isValid).length} คัน)</span>
                </>
              )}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/75 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 font-semibold">
                  <th className="py-2.5 px-3.5">ลำดับ</th>
                  <th className="py-2.5 px-3.5">เลขตัวถัง (VIN)</th>
                  <th className="py-2.5 px-3.5">ทะเบียนรถ</th>
                  <th className="py-2.5 px-3.5">วันหมดอายุภาษีรถ</th>
                  <th className="py-2.5 px-3.5">วันหมดอายุภาษีมิเตอร์</th>
                  <th className="py-2.5 px-3.5">หมายเหตุ</th>
                  <th className="py-2.5 px-3.5">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60 text-zinc-800 dark:text-zinc-200">
                {rows.map((row, idx) => (
                  <tr key={idx} className={row.isValid ? 'hover:bg-zinc-50/60' : 'bg-rose-50/40 dark:bg-rose-950/20'}>
                    <td className="py-2 px-3.5 font-mono text-zinc-400">{idx + 1}</td>
                    <td className="py-2 px-3.5 font-mono font-medium text-zinc-900 dark:text-white">
                      {row.vinNo}
                    </td>
                    <td className="py-2 px-3.5 font-medium text-zinc-700 dark:text-zinc-300">
                      {row.registerNo || '-'}
                    </td>
                    <td className="py-2 px-3.5">
                      {row.vehicleTaxEndDate ? (
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">{row.vehicleTaxEndDate}</span>
                      ) : (
                        <span className="text-zinc-400 italic">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3.5">
                      {row.meterTaxEndDate ? (
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">{row.meterTaxEndDate}</span>
                      ) : (
                        <span className="text-zinc-400 italic">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3.5 text-zinc-500 max-w-[150px] truncate">
                      {row.remark || '-'}
                    </td>
                    <td className="py-2 px-3.5">
                      {row.isValid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          พร้อมนำเข้า
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
