import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLPool } from '@/lib/mssql'
import { env } from '@/lib/env'
import { parseImportRows } from '@/lib/maintenance-import/parse'
import { evaluateRows, summarize, toEvaluatedRow } from '@/lib/maintenance-import/validate'
import type { ImportRequestBody, ImportResponse } from '@/lib/maintenance-import/types'

export const dynamic = 'force-dynamic'

/** Dry run: parse + validate the uploaded sheet, write nothing. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportRequestBody
    if (!Array.isArray(body.headers) || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    const parsed = parseImportRows(body.headers, body.rows)
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: parsed.errors.join(' / ') }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      return NextResponse.json({ error: 'MOCK_MODE: ไม่รองรับการตรวจสอบข้อมูลนำเข้า' }, { status: 400 })
    }
    const pool = await getMSSQLPool()
    if (!pool) return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })

    const { rows, warnings } = await evaluateRows(pool, parsed.rows)
    const evaluated = rows.map(toEvaluatedRow)
    const response: ImportResponse = { summary: summarize(evaluated), rows: evaluated, warnings }
    return NextResponse.json(response)
  } catch (err) {
    console.error('[Maintenance Import Preview Error]', err)
    return NextResponse.json({ error: 'ตรวจสอบไฟล์ไม่สำเร็จ' }, { status: 500 })
  }
}
