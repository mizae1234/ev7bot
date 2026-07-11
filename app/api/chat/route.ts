import { NextRequest, NextResponse } from 'next/server'
import { askButter } from '@/lib/gemini'
import { logChatToDb } from '@/lib/chat-log'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { message, userId, displayName } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'กรุณาพิมพ์ข้อความ' }, { status: 400 })
    }

    const trimmed = message.trim()
    if (trimmed.length > 500) {
      return NextResponse.json({ error: 'ข้อความยาวเกินไป (สูงสุด 500 ตัวอักษร)' }, { status: 400 })
    }

    console.log(`[Chat API] User (${displayName || 'Guest'} / ${userId || 'No ID'}): "${trimmed}"`)
    const startTime = Date.now()
    const butterResult = await askButter(trimmed)
    const responseTimeMs = Date.now() - startTime
    const reply = butterResult.text
    console.log(`[Chat API] Butter: "${reply.substring(0, 100)}..." (tokens: in=${butterResult.inputTokens} out=${butterResult.outputTokens} time=${responseTimeMs}ms)`)

    // Log web chat to database with token data
    logChatToDb('web', userId || null, displayName || undefined, trimmed, reply, {
      inputTokens: butterResult.inputTokens,
      outputTokens: butterResult.outputTokens,
      modelName: butterResult.modelName,
      responseTimeMs,
    })
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
