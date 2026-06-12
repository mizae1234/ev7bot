import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId, displayName, pictureUrl, statusMessage } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    console.log(`[LIFF Register] Registering user: ${userId} (${displayName})`)

    const reg = await prisma.lineRegistration.upsert({
      where: { lineUserId: userId },
      update: {
        displayName,
        pictureUrl,
        statusMessage,
        isActive: true,
      },
      create: {
        lineUserId: userId,
        displayName,
        pictureUrl,
        statusMessage,
        system: 'EV7',
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, registration: reg })
  } catch (error) {
    console.error('[LIFF Register API Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
