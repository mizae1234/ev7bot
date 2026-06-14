import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const activityNotifications = await prisma.activityNotification.findMany({
      orderBy: { sentAt: 'desc' },
      take: 20
    })

    const chatLogs = await prisma.chatLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    return NextResponse.json({
      activityNotifications,
      chatLogs,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message })
  }
}
