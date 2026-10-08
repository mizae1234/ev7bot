import {
  HEADER_ALIASES,
  REQUIRED_FIELDS,
  FAULT_PARTY_RULES,
  INSURANCE_RULES,
  FIELD_META,
  IMPORT_CONFIG,
  TEMPLATE_COLUMN_ORDER,
  TEMPLATE_HEADERS,
  TEMPLATE_CONFIG,
  type FieldLevel,
  type ImportField,
} from './config'

const levelOf = (field: ImportField): FieldLevel =>
  REQUIRED_FIELDS.includes(field) ? 'required' : FIELD_META[field].level

const headerOf = (field: ImportField) => HEADER_ALIASES[field][0]

const thin = { style: 'thin', color: { rgb: 'BFBFBF' } }
const border = { top: thin, bottom: thin, left: thin, right: thin }

/**
 * Build and download the import template (.xlsx). Browser only.
 * Uses xlsx-js-style (loaded on demand) because plain SheetJS cannot write cell styles.
 * Headers and rules come from config.ts, so the template never drifts from the importer.
 */
export async function downloadImportTemplate(): Promise<void> {
  const mod = await import('xlsx-js-style')
  const XLSX = (mod as any).default ?? mod

  const { colors, prefilledRows } = TEMPLATE_CONFIG
  const rowsCount = Math.min(prefilledRows, IMPORT_CONFIG.maxRows)

  // ── Sheet 1: data — same 70 columns as the insurer's report (row 1 = headers) ──
  // Map each header to the importer field it feeds (first occurrence only: "เบอร์โทร" repeats).
  const fieldByHeader = new Map<string, ImportField>()
  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    for (const alias of HEADER_ALIASES[field]) if (!fieldByHeader.has(alias)) fieldByHeader.set(alias, field)
  }
  const usedFields = new Set<ImportField>()
  const columns = TEMPLATE_HEADERS.map(header => {
    const field = fieldByHeader.get(header)
    if (field && !usedFields.has(field)) {
      usedFields.add(field)
      return { header, level: levelOf(field) as FieldLevel | 'ignored' }
    }
    return { header, level: 'ignored' as FieldLevel | 'ignored' }
  })

  const dataSheet: Record<string, unknown> = {}
  columns.forEach(({ header, level }, c) => {
    dataSheet[XLSX.utils.encode_cell({ r: 0, c })] = {
      t: 's',
      v: header,
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: colors[level].header } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border,
      },
    }
    for (let r = 1; r <= rowsCount; r++) {
      dataSheet[XLSX.utils.encode_cell({ r, c })] = {
        t: 's',
        v: '',
        z: '@', // text format: keeps claim numbers / plates / dates exactly as typed
        s: level === 'ignored' ? { border } : { fill: { patternType: 'solid', fgColor: { rgb: colors[level].cell } }, border },
      }
    }
  })
  dataSheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowsCount, c: columns.length - 1 } })
  dataSheet['!cols'] = columns.map(({ header }) => ({ wch: Math.max(header.length * 1.6, 14) }))
  dataSheet['!rows'] = [{ hpt: 42 }]
  dataSheet['!views'] = [{ state: 'frozen', ySplit: 1 }]

  // ── Sheet 2: guide ───────────────────────────────────────────────
  const cell = (v: string, s: Record<string, unknown> = {}) => ({ t: 's', v, s: { alignment: { vertical: 'top', wrapText: true }, border, ...s } })
  const head = (v: string) => cell(v, { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '404040' } } })

  const guideRows: ReturnType<typeof cell>[][] = [
    ['คอลัมน์', 'ระดับ', 'คำอธิบาย', 'รูปแบบ', 'ตัวอย่าง'].map(head),
    ...TEMPLATE_COLUMN_ORDER.map(field => {
      const level = levelOf(field)
      let description = FIELD_META[field].description
      if (field === 'faultSummary') {
        const rules = FAULT_PARTY_RULES.map(r => `"${r.match}"`).join(', ')
        description += ` · ค่าที่ระบบรู้จัก: ${rules}`
      }
      if (field === 'insuranceCompany') {
        description += ` · ชื่อที่ระบบรู้จัก (มีคำว่า): ${INSURANCE_RULES.map(r => `"${r.match}"`).join(', ')}`
      }
      return [
        cell(headerOf(field), { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: colors[level].cell } } }),
        cell(colors[level].label),
        cell(description),
        cell(FIELD_META[field].format ?? '-'),
        cell(FIELD_META[field].example),
      ]
    }),
  ]

  const notes = [
    `1. กรอกข้อมูลในแผ่น "${TEMPLATE_CONFIG.dataSheetName}" เริ่มที่แถวที่ 2 ห้ามแก้ชื่อหัวคอลัมน์ในแถวแรก (ลำดับคอลัมน์สลับได้) คอลัมน์ทั้งหมดตรงกับไฟล์รายงานของบริษัทประกัน วางข้อมูลจากรายงานต่อได้เลย`,
    `2. นำเข้าได้สูงสุด ${IMPORT_CONFIG.maxRows} แถวต่อครั้ง`,
    `3. คอลัมน์ที่ไม่ไฮไลท์ (${TEMPLATE_HEADERS.length - usedFields.size} คอลัมน์) ไม่ถูกใช้สร้างใบแจ้งซ่อม จะถูกเก็บไว้ใน log การนำเข้าเท่านั้น ปล่อยว่างได้`,
    '4. ระบบจะข้ามแถวที่: ไม่มีเลขเคลม, เลขเคลมซ้ำ, ไม่พบทะเบียนในระบบ, หรือรถคันนั้นมีใบซ่อมที่ยังเปิดอยู่',
    `5. ใบแจ้งซ่อมที่นำเข้าจะมีสถานะ "ยังขับใช้งานได้" และสถานที่ซ่อม = "${IMPORT_CONFIG.unspecifiedLocationLabel}" (ระบุอู่ภายหลังด้วยปุ่ม "เข้าซ่อม")`,
  ]

  const guideSheet: Record<string, unknown> = {}
  guideRows.forEach((row, r) => row.forEach((c, ci) => { guideSheet[XLSX.utils.encode_cell({ r, c: ci })] = c }))
  const noteStart = guideRows.length + 1
  notes.forEach((text, i) => {
    guideSheet[XLSX.utils.encode_cell({ r: noteStart + i, c: 0 })] = { t: 's', v: text, s: { alignment: { vertical: 'top' } } }
  })
  guideSheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: noteStart + notes.length - 1, c: 4 } })
  guideSheet['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 70 }, { wch: 20 }, { wch: 30 }]
  guideSheet['!merges'] = notes.map((_, i) => ({ s: { r: noteStart + i, c: 0 }, e: { r: noteStart + i, c: 4 } }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, dataSheet, TEMPLATE_CONFIG.dataSheetName)
  XLSX.utils.book_append_sheet(wb, guideSheet, TEMPLATE_CONFIG.guideSheetName)
  XLSX.writeFile(wb, `${TEMPLATE_CONFIG.fileName}.xlsx`)
}
