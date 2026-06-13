import { NextRequest, NextResponse } from 'next/server'
import { askButter } from '@/lib/gemini'
import { logChatToDb } from '@/lib/chat-log'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'กรุณาพิมพ์ข้อความ' }, { status: 400 })
    }

    const trimmed = message.trim()
    if (trimmed.length > 500) {
      return NextResponse.json({ error: 'ข้อความยาวเกินไป (สูงสุด 500 ตัวอักษร)' }, { status: 400 })
    }

    console.log(`[Chat API] User: "${trimmed}"`)
    const reply = await askButter(trimmed)
    console.log(`[Chat API] Butter: "${reply.substring(0, 100)}..."`)

    // Log web chat to database
    logChatToDb('web', null, undefined, trimmed, reply)
      .catch((err: any) => console.error('[Chat API logChat Error]', err))

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('[Chat API Error]', error)
    return NextResponse.json(
      { error: 'Butter ไม่สามารถตอบได้ในตอนนี้ ลองใหม่อีกทีนะคะ 🧈' },
      { status: 500 }
    )
  }
}
