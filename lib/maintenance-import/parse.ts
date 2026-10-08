import { HEADER_ALIASES, REQUIRED_FIELDS, IMPORT_CONFIG, type ImportField } from './config'
import type { ParsedRow, ParseResult } from './types'

const cellToString = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** Plate comparison key: drop spaces/dashes ("ทอ-8100" == "ทอ 8100" == "ทอ8100"). */
export function normalizePlate(plate: string | null | undefined): string {
  return (plate || '').replace(/[\s\-_]+/g, '').toUpperCase()
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Parse the insurer's date (`dd/MM/yyyy HH:mm[:ss]`, Gregorian or Buddhist year) or an
 * Excel serial number into a wall-clock `YYYY-MM-DDTHH:mm:ss` string. No timezone shift:
 * the value is stored exactly as shown in the file.
 */
export function parseIncidentDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial (days since 1899-12-30), computed in UTC to avoid local-zone drift.
    const ms = Math.round(value * 86400 * 1000)
    const d = new Date(Date.UTC(1899, 11, 30) + ms)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  }

  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  let year = Number(m[3])
  if (year > 2400) year -= 543
  const hh = m[4] ? Number(m[4]) : 0
  const mi = m[5] ? Number(m[5]) : 0
  const ss = m[6] ? Number(m[6]) : 0
  if (month < 1 || month > 12 || day < 1 || day > 31 || hh > 23 || mi > 59 || ss > 59) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (check.getUTCMonth() !== month - 1) return null // e.g. 31/02
  return `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mi)}:${pad(ss)}`
}

/** Build header → column index, first occurrence wins (the file repeats "เบอร์โทร"). */
function buildHeaderIndex(headers: string[]): Partial<Record<ImportField, number>> {
  const index: Partial<Record<ImportField, number>> = {}
  const normalized = headers.map(h => cellToString(h))
  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    for (const alias of HEADER_ALIASES[field]) {
      const col = normalized.indexOf(alias)
      if (col >= 0) {
        index[field] = col
        break
      }
    }
  }
  return index
}

export function parseImportRows(
  headers: (string | number | null)[],
  dataRows: (string | number | null)[][],
): ParseResult {
  const errors: string[] = []
  const headerNames = headers.map(h => cellToString(h))
  const index = buildHeaderIndex(headerNames)

  for (const field of REQUIRED_FIELDS) {
    if (index[field] === undefined) {
      errors.push(`ไม่พบคอลัมน์ "${HEADER_ALIASES[field][0]}" ในไฟล์`)
    }
  }
  if (dataRows.length > IMPORT_CONFIG.maxRows) {
    errors.push(`จำนวนแถวเกินกำหนด (${dataRows.length} > ${IMPORT_CONFIG.maxRows}) กรุณาแบ่งไฟล์`)
  }
  if (errors.length > 0) return { rows: [], errors }

  // Raw keys: header name, with " (n)" suffix on repeats so no column is lost.
  const seen: Record<string, number> = {}
  const rawKeys = headerNames.map((h, i) => {
    const base = h || `column_${i + 1}`
    seen[base] = (seen[base] || 0) + 1
    return seen[base] > 1 ? `${base} (${seen[base]})` : base
  })

  const rows: ParsedRow[] = []
  dataRows.forEach((r, i) => {
    if (!r || r.every(c => cellToString(c) === '')) return // blank line

    const fields = {} as Record<ImportField, string>
    for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
      const col = index[field]
      fields[field] = col === undefined ? '' : cellToString(r[col])
    }
    const incidentCol = index.incidentDate
    const raw: Record<string, string | number | null> = {}
    rawKeys.forEach((k, c) => {
      const cell = r[c]
      raw[k] = cell === undefined || cell === null || cell === '' ? null : cell
    })

    rows.push({
      rowNo: i + 2,
      fields,
      incidentDateIso: incidentCol === undefined ? null : parseIncidentDate(r[incidentCol]),
      raw,
    })
  })

  return { rows, errors }
}
