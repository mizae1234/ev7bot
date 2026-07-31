import { NextRequest, NextResponse } from 'next/server'
import {
  listAuditSessions,
  createAuditSession,
  closeAuditSession,
  resolveEv7User,
} from '@/lib/inspection/inspection-service'

export const dynamic = 'force-dynamic'

// GET: ดึงรายการ Audit Sessions
export async function GET() {
  try {
    const sessions = await listAuditSessions()
    return NextResponse.json({ sessions })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Audit Session GET Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: สร้าง Audit Session ใหม่
export async function POST(request: NextRequest) {
  try {
    const { sessionName, sessionDate, location, notes, lineUserId } = await request.json()

    if (!sessionName || !sessionDate) {
      return NextResponse.json(
        { error: 'กรุณาระบุชื่อรอบตรวจ และวันที่' },
        { status: 400 }
      )
    }

    const ev7User = await resolveEv7User(lineUserId)

    const sessionId = await createAuditSession({
      sessionName,
      sessionDate,
      location,
      notes,
      createdBy: ev7User.userId,
    })

    return NextResponse.json({ success: true, inspectionSessionId: sessionId })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Audit Session POST Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: ปิดรอบตรวจ
export async function PUT(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'กรุณาระบุ sessionId' }, { status: 400 })
    }

    await closeAuditSession(sessionId)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Audit Session PUT Error]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
