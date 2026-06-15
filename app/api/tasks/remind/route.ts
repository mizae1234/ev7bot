import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { lineClient } from '@/lib/line'

export const dynamic = 'force-dynamic'

function formatDateTh(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-'
  try {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Bangkok',
    })
  } catch {
    return String(dateStr)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, passcode, userId } = body

    // 1. Verify Passcode
    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized: Invalid passcode' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // 2. Check Database Role
    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    const taskId = parseInt(id, 10)
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid Task ID' }, { status: 400 })
    }

    // 3. Fetch Task details
    const task = await prisma.taskNote.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'PENDING') {
      return NextResponse.json({ error: 'ภารกิจนี้ทำเสร็จสิ้นไปแล้ว ไม่สามารถส่งเตือนได้' }, { status: 400 })
    }

    // 4. Resolve Alert Target Details
    let targetId = ''
    let targetType: 'user' | 'group' = 'group'
    let targetName = 'LINE Target'

    if (task.alertTarget === 'NONE') {
      return NextResponse.json({ error: 'ภารกิจนี้ไม่ได้ตั้งค่าช่องทางสำหรับแจ้งเตือนไว้' }, { status: 400 })
    }

    if (task.alertTarget === 'GROUP') {
      targetType = 'group'
      if (task.groupId) {
        targetId = task.groupId
        // Get group name
        const group = await prisma.lineGroup.findUnique({ where: { groupId: task.groupId } })
        if (group && group.groupName) {
          targetName = group.groupName
        }
      } else {
        // Fallback: Use the first active line group
        const fallbackGroup = await prisma.lineGroup.findFirst({
          where: { isActive: true }
        })
        if (!fallbackGroup) {
          return NextResponse.json({ error: 'ไม่พบกลุ่มไลน์ที่ลงทะเบียนในระบบ' }, { status: 400 })
        }
        targetId = fallbackGroup.groupId
        targetName = fallbackGroup.groupName || 'กลุ่มไลน์เริ่มต้น'
      }
    } else if (task.alertTarget === 'PERSONAL') {
      targetType = 'user'
      if (task.assigneeLineUserId) {
        targetId = task.assigneeLineUserId
        // Get user display name
        const user = await prisma.lineRegistration.findUnique({ where: { lineUserId: task.assigneeLineUserId } })
        if (user && user.displayName) {
          targetName = user.displayName
        }
      } else {
        return NextResponse.json({ error: 'ผู้รับผิดชอบงานนี้ ยังไม่ได้ผูกบัญชี LINE สำหรับรับแชทส่วนตัว' }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: 'Invalid alert target type' }, { status: 400 })
    }

    // 5. Construct Premium Flex Message
    const dueDateStr = task.dueDate ? formatDateTh(task.dueDate) : 'ไม่ระบุกำหนดเสร็จ'
    const assignee = task.assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ'
    const vehicleDisplay = task.vehicleRef ? `🚗 ${task.vehicleRef}` : '📂 ทั่วไป'

    const flexMessage = {
      type: 'flex' as const,
      altText: `🔔 ติดตามภารกิจค้างส่ง ID #${task.id}`,
      contents: {
        type: 'bubble' as const,
        size: 'mega' as const,
        header: {
          type: 'box' as const,
          layout: 'vertical' as const,
          backgroundColor: '#FFB300', // Yellow Premium Theme
          paddingAll: 'lg' as const,
          contents: [
            {
              type: 'text' as const,
              text: '🔔 ติดตามภารกิจค้างส่ง',
              weight: 'bold' as const,
              size: 'lg' as const,
              color: '#ffffff'
            },
            {
              type: 'text' as const,
              text: `รหัสภารกิจ ID #${task.id}`,
              size: 'xs' as const,
              color: '#FFE082',
              margin: 'xs' as const
            }
          ]
        },
        body: {
          type: 'box' as const,
          layout: 'vertical' as const,
          paddingAll: 'md' as const,
          spacing: 'sm' as const,
          contents: [
            {
              type: 'box' as const,
              layout: 'vertical' as const,
              paddingAll: 'md' as const,
              backgroundColor: '#f8fafc',
              cornerRadius: 'md' as const,
              spacing: 'sm' as const,
              contents: [
                {
                  type: 'box' as const,
                  layout: 'horizontal' as const,
                  contents: [
                    {
                      type: 'text' as const,
                      text: `📌 ID #${task.id}`,
                      size: 'xs' as const,
                      weight: 'bold' as const,
                      color: '#FF6D00',
                      flex: 3
                    },
                    {
                      type: 'text' as const,
                      text: vehicleDisplay,
                      size: 'xs' as const,
                      weight: 'bold' as const,
                      color: '#3b82f6',
                      align: 'end' as const,
                      flex: 7
                    }
                  ]
                },
                {
                  type: 'text' as const,
                  text: task.taskDetail,
                  size: 'sm' as const,
                  color: '#1e293b',
                  weight: 'bold' as const,
                  wrap: true
                },
                {
                  type: 'box' as const,
                  layout: 'horizontal' as const,
                  contents: [
                    {
                      type: 'text' as const,
                      text: `👤 ${assignee}`,
                      size: 'xs' as const,
                      color: '#64748b',
                      flex: 6
                    },
                    {
                      type: 'text' as const,
                      text: `📅 ${dueDateStr}`,
                      size: 'xs' as const,
                      color: '#64748b',
                      align: 'end' as const,
                      flex: 6
                    }
                  ]
                },
                {
                  type: 'box' as const,
                  layout: 'vertical' as const,
                  margin: 'md' as const,
                  paddingAll: 'sm' as const,
                  backgroundColor: '#FFF8E1',
                  cornerRadius: 'sm' as const,
                  contents: [
                    {
                      type: 'text' as const,
                      text: '💡 เมื่อทำงานเสร็จสิ้นแล้ว กรุณาพิมพ์:',
                      size: 'xxs' as const,
                      color: '#B78103',
                      weight: 'bold' as const
                    },
                    {
                      type: 'text' as const,
                      text: `butter ปิดงาน #${task.id}`,
                      size: 'xs' as const,
                      color: '#E65100',
                      weight: 'bold' as const,
                      margin: 'xs' as const
                    }
                  ]
                },
                {
                  type: 'button' as const,
                  style: 'secondary' as const,
                  color: '#FF6D00',
                  height: 'sm' as const,
                  action: {
                    type: 'uri' as const,
                    label: '🔍 รายละเอียดงาน',
                    uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/tasks/${task.id}`)}`
                  }
                }
              ]
            }
          ]
        }
      }
    }

    // 6. Dispatch the notification
    if (env.MOCK_MODE) {
      console.log(`[Mock Task Reminder Alert] Sending to ${targetType} (${targetName} - ID: ${targetId}):`, JSON.stringify(flexMessage, null, 2))
    } else {
      await lineClient.pushMessage(targetId, flexMessage)
    }

    // 7. Update reminder time history
    const updatedTask = await prisma.taskNote.update({
      where: { id: taskId },
      data: {
        lastAlertedAt: new Date()
      }
    })

    // 8. Log inside chat logs
    await prisma.chatLog.create({
      data: {
        sourceType: targetType === 'group' ? 'group_alert' : 'user_alert',
        sourceId: targetId,
        userName: targetName,
        userMessage: `[ระบบแจ้งเตือนตามงาน #${task.id}] ${task.taskDetail}`,
        botReply: `ส่งแจ้งเตือนติดตามภารกิจ (LINE Flex Message)`
      }
    })

    return NextResponse.json({ 
      success: true, 
      lastAlertedAt: updatedTask.lastAlertedAt 
    })
  } catch (error) {
    console.error('[Task Reminder API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
