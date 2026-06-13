import { NextResponse } from 'next/server'
import { env } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json({
      liffId: env.NEXT_PUBLIC_LINE_LIFF_ID || ''
    })
  } catch (error) {
    console.error('[Config API Error]', error)
    return NextResponse.json({ error: 'Failed to retrieve configuration' }, { status: 500 })
  }
}
