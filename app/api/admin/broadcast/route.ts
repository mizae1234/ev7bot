import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { lineClient } from '@/lib/line'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { passcode, userId, targetId, targetType, message } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized: Invalid passcode' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    if (!targetId || !targetType || !message) {
      return NextResponse.json({ error: 'Missing targetId, targetType, or message' }, { status: 400 })
    }

    // Check database role of the caller
    const caller = userId === 'usr_mock_dev' ? { displayName: 'คุณ เนย (Dev Mode)', role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 })
    }

    const senderName = caller.displayName || 'Super Admin'

    // Look up target name for logging
    let targetName = 'LINE Recipient'
    if (targetType === 'user') {
      const user = await prisma.lineRegistration.findUnique({
        where: { lineUserId: targetId }
      })
      if (user && user.displayName) {
        targetName = user.displayName
      }
    } else if (targetType === 'group') {
      const group = await prisma.lineGroup.findUnique({
        where: { groupId: targetId }
      })
      if (group && group.groupName) {
        targetName = group.groupName
      }
    }

    // Build the yellow/green themed LINE Flex message ("ประกาศจาก Butter 🧈💛")
    const flexMessage = {
      type: 'flex' as const,
      altText: '📢 ประกาศจาก Butter 🧈💛',
      contents: {
        type: 'bubble' as const,
        size: 'mega' as const,
        header: {
          type: 'box' as const,
          layout: 'vertical' as const,
          backgroundColor: '#FEF9C3', // Light Yellow (Amber-50/100)
          contents: [
            {
              type: 'text' as const,
              text: '📢 ประกาศจาก Butter 🧈💛',
              weight: 'bold' as const,
              size: 'lg' as const,
              color: '#854D0E' // Dark yellow/brown for readability
            }
          ],
          paddingAll: 'lg' as const,
        },
        body: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'text' as const,
              text: message,
              wrap: true,
              size: 'md' as const,
              color: '#374151' // Dark grey for premium look
            }
          ],
          paddingAll: 'lg' as const,
        },
        footer: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'text' as const,
              text: `ส่งโดย: ${senderName}`,
              size: 'xs' as const,
              color: '#9CA3AF',
              align: 'end' as const
            }
          ],
          paddingAll: 'md' as const,
          backgroundColor: '#F9FAFB'
        }
      }
    }

    // Send the message using LINE Messaging API
    if (env.MOCK_MODE) {
      console.log(`[Mock Butter Broadcast] Sending to ${targetType} (${targetName} - ID: ${targetId}):`, JSON.stringify(flexMessage, null, 2))
    } else {
      await lineClient.pushMessage(targetId, flexMessage)
    }

    // Log the broadcast event to database chat_logs
    await prisma.chatLog.create({
      data: {
        sourceType: targetType === 'group' ? 'group_broadcast' : 'user_broadcast',
        sourceId: targetId,
        userName: targetName,
        userMessage: `[ประกาศจาก Butter] ${message}`,
        botReply: `ประกาศจาก Butter (Flex Message) (ส่งโดย: ${senderName})`
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Admin Broadcast API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
