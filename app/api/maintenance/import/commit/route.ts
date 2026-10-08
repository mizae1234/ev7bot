import { NextRequest, NextResponse } from 'next/server'
import { getMSSQLWritePool } from '@/lib/mssql'
import { env } from '@/lib/env'
import { parseImportRows } from '@/lib/maintenance-import/parse'
import { evaluateRows, summarize, toEvaluatedRow } from '@/lib/maintenance-import/validate'
import { commitRows, importLogTableExists, IMPORT_LOG_TABLE_MISSING } from '@/lib/maintenance-import/commit'
import { resolveImportUser, ImportAuthError } from '@/lib/maintenance-import/user'
import type { ImportRequestBody, ImportResponse } from '@/lib/maintenance-import/types'

export const dynamic = 'force-dynamic'

/**
 * Re-validates the sheet server-side (never trusts the preview result), then inserts
 * every READY row as a STILL_WORK ticket and logs every row.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImportRequestBody
    if (!Array.isArray(body.headers) || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, { status: 400 })
    }

    const user = await resolveImportUser(body.lineUserId)

    const parsed = parseImportRows(body.headers, body.rows)
    if (parsed.errors.length > 0) {
      return NextResponse.json({ error: parsed.errors.join(' / ') }, { status: 400 })
    }

    if (env.MOCK_MODE) {
      return NextResponse.json({ error: 'MOCK_MODE: ไม่รองรับการนำเข้าข้อมูล' }, { status: 400 })
    }
    const pool = await getMSSQLWritePool()
    if (!pool) return NextResponse.json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' }, { status: 500 })

    if (!(await importLogTableExists(pool))) {
      return NextResponse.json({ error: IMPORT_LOG_TABLE_MISSING }, { status: 500 })
    }

    const { rows, warnings } = await evaluateRows(pool, parsed.rows)
    const { batchId } = await commitRows(pool, rows, { fileName: body.fileName, userId: user.userId })

    const evaluated = rows.map(toEvaluatedRow)
    const response: ImportResponse = { summary: summarize(evaluated), rows: evaluated, warnings, batchId }
    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof ImportAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[Maintenance Import Commit Error]', err)
    return NextResponse.json({ error: 'นำเข้าข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}
