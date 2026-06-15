import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lineClient, lineConfig } from '@/lib/line'
import { prisma } from '@/lib/prisma'
import { logChatToDb } from '@/lib/chat-log'
import { env } from '@/lib/env'
import { askButter } from '@/lib/gemini'
import type { WebhookEvent } from '@line/bot-sdk'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic';

const pendingLogs = new Map<string, {
  userId?: string
  sourceType: string
  sourceId: string | null
  userMessage: string
}>()

async function logReplyToDb(replyToken: string, replyMessageText: string) {
  const ctx = pendingLogs.get(replyToken)
  if (!ctx || !ctx.userMessage) return
  
  let userName: string | undefined
  try {
    if (!env.MOCK_MODE && ctx.userId) {
      const profile = await lineClient.getProfile(ctx.userId)
      userName = profile.displayName
    }
  } catch { /* ignore */ }
  
  await logChatToDb(ctx.sourceType, ctx.sourceId, userName, ctx.userMessage, replyMessageText)
}

const originalReplyMessage = lineClient.replyMessage.bind(lineClient)
lineClient.replyMessage = async function(replyToken: string, messages: any, ...args: any[]) {
  const res = await originalReplyMessage(replyToken, messages, ...args)
  try {
    let logText = ''
    if (Array.isArray(messages)) {
      logText = messages.map(m => m.text || m.altText || '[Flex Message]').join('\n')
    } else if (messages && typeof messages === 'object') {
      logText = messages.text || messages.altText || '[Flex Message]'
    }
    await logReplyToDb(replyToken, logText)
    pendingLogs.delete(replyToken) // Clean up after logging
  } catch (err) {
    console.error('[logReplyToDb Error in replyMessage]', err)
  }
  return res
} as any

const BOT_NAME = 'Butter'
const BOT_TRIGGERS = ['butter', 'บัตเตอร์', 'บัทเตอร์', 'butter,', 'butter:']

const quickReplyItems = {
  items: [
    {
      type: 'action',
      action: {
        type: 'message',
        label: '📊 สรุปวันนี้',
        text: 'สรุปวันนี้'
      }
    },
    {
      type: 'action',
      action: {
        type: 'message',
        label: '📊 สรุปเมื่อวาน',
        text: 'สรุปเมื่อวาน'
      }
    },
    {
      type: 'action',
      action: {
        type: 'message',
        label: '📅 สรุปส่งมอบประจำเดือน',
        text: 'สรุปส่งมอบประจำเดือน'
      }
    },
    {
      type: 'action',
      action: {
        type: 'message',
        label: '🔧 ค้างซ่อมรายพื้นที่',
        text: 'ดูรถค้างซ่อมแต่ละพื้นที่'
      }
    },
    {
      type: 'action',
      action: {
        type: 'message',
        label: '📖 เมนู',
        text: 'เมนู'
      }
    }
  ] as any[]
}

// Verify Line signature
function verifySignature(body: string, signature: string): boolean {
  if (env.MOCK_MODE && (signature === 'mock-signature' || signature === '')) {
    return true
  }
  const hash = crypto
    .createHmac('sha256', lineConfig.channelSecret)
    .update(body)
    .digest('base64')
  return hash === signature
}

export async function POST(req: NextRequest) {
  try {
    // Extract app URL dynamically from request headers
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3001'
    const protocol = req.headers.get('x-forwarded-proto') || 'https'
    const appUrl = `${protocol}://${host}`

    const body = await req.text()
    const signature = req.headers.get('x-line-signature') ?? ''

    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { events }: { events: WebhookEvent[] } = JSON.parse(body)

    await Promise.allSettled(events.map(event => {
      const isGroupOrRoom = event.source.type === 'group' || event.source.type === 'room'
      const targetSourceId = isGroupOrRoom
        ? ((event.source as any).groupId || (event.source as any).roomId || event.source.userId!)
        : event.source.userId!
      
      if ('replyToken' in event && event.replyToken) {
        pendingLogs.set(event.replyToken, {
          userId: event.source.userId,
          sourceType: event.source.type,
          sourceId: targetSourceId || null,
          userMessage: event.type === 'message' && event.message.type === 'text' ? event.message.text : ''
        })
      }
      return handleEvent(event, appUrl)
    }))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Line Webhook POST Error]', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleEvent(event: WebhookEvent, appUrl: string) {
  const sourceType = event.source.type // 'user' | 'group' | 'room'
  const isGroup = sourceType === 'group' || sourceType === 'room'

  // Auto-save Group/Room ID to database
  if (sourceType === 'group') {
    const gid = (event.source as any).groupId as string
    console.log(`[Webhook] 📌 GROUP ID: ${gid}`)
    saveGroupToDb(gid, 'group').catch(err => console.error('[saveGroup Error]', err))
  } else if (sourceType === 'room') {
    const rid = (event.source as any).roomId as string
    console.log(`[Webhook] 📌 ROOM ID: ${rid}`)
    saveGroupToDb(rid, 'room').catch(err => console.error('[saveGroup Error]', err))
  } else {
    console.log(`[Webhook] 👤 USER ID: ${event.source.userId}`)
  }

  // Handle follow event (user adds Line OA as friend)
  if (event.type === 'follow') {
    await handleFollow(event.source.userId!)
    return
  }

  // Handle leave event (bot removed from group/room)
  if (event.type === 'leave') {
    const leaveId = sourceType === 'group'
      ? (event.source as any).groupId as string
      : (event.source as any).roomId as string
    console.log(`[Webhook] 👋 Bot left ${sourceType}: ${leaveId}`)
    await deactivateGroupInDb(leaveId)
    return
  }

  // Handle join event (bot added to group/room)
  if (event.type === 'join') {
    const joinId = sourceType === 'group'
      ? (event.source as any).groupId as string
      : (event.source as any).roomId as string
    await saveGroupToDb(joinId, sourceType === 'group' ? 'group' : 'room')
    await replyText(
      event.replyToken,
      `สวัสดีค่า~ ${BOT_NAME} มาแล้วนะ 🧈✨\n\nเรียก ${BOT_NAME} ได้โดยพิมพ์ชื่อนำหน้า เช่น:\n💬 "butter วันนี้ส่งรถกี่คัน"\n💬 "butter สรุปเดือนนี้"\n💬 "butter ซ่อมค้างกี่คัน"\n\nพิมพ์ "butter เมนู" เพื่อดูคำสั่งทั้งหมดค่ะ 💛`
    )
    return
  }

  // Handle message event
  if (event.type === 'message' && event.message.type === 'text') {
    const rawText = event.message.text.trim()
    const rawLower = rawText.toLowerCase()

    // ─── Group mode: ต้องพิมพ์ "butter" นำหน้าก่อน ─────────────
    if (isGroup) {
      // Check if message is a quick menu keyword (allow bypass without prefix)
      const bypassKeywords = [
        'สรุปวันนี้',
        'สรุปเมื่อวาน',
        'สรุปส่งมอบประจำเดือน',
        'ดูรถค้างซ่อมแต่ละพื้นที่',
        'เมนู',
        'dashboard',
        'แดชบอร์ด',
        'ลงทะเบียน',
        'register',
        'วิธีใช้งาน',
        'คู่มือ',
        'วิธีใช้'
      ]
      const isBypass = bypassKeywords.includes(rawLower) || /^(ปิดงาน\s*#?\s*\d+)/i.test(rawLower)

      let strippedText = rawText
      let triggerFound = false

      if (isBypass) {
        strippedText = rawText
        triggerFound = true
      } else {
        const trigger = BOT_TRIGGERS.find(t => rawLower.startsWith(t))
        if (trigger) {
          strippedText = rawText.substring(trigger.length).trim()
          triggerFound = true
        }
      }

      if (!triggerFound) {
        // ไม่ได้เรียก Butter และไม่ใช่คำสั่ง Bypass → ไม่ตอบ (เงียบ)
        return
      }

      // ถ้าพิมพ์แค่ "butter" เฉยๆ (ไม่มีการ bypass และ strippedText ว่าง) → ทักทาย
      if (!isBypass && !strippedText) {
        await replyText(
          event.replyToken,
          `ว่าไงคะ~ 🧈✨ ${BOT_NAME} พร้อมช่วยเหลือแล้วค่ะ!\n\nลองถาม เช่น:\n💬 "butter วันนี้ส่งรถกี่คัน"\n💬 "butter เมนู"\n💬 "butter ซ่อมค้างกี่คัน" 💛`
        )
        return
      }

      const lower = strippedText.toLowerCase()

      // Registration
      if (lower === 'ลงทะเบียน' || lower === 'register') {
        await handleRegister(event.source.userId!, event.replyToken)
        return
      }

      // ตั้งค่ากลุ่มนี้ → บันทึก Group ID + เปิด enableReport
      if (lower === 'ตั้งค่ากลุ่มนี้' || lower === 'ตั้งค่ากลุ่ม') {
        const gid = (event.source as any).groupId || (event.source as any).roomId
        if (gid) {
          try {
            await saveGroupToDb(gid, sourceType === 'group' ? 'group' : 'room')
            await prisma.lineGroup.update({
              where: { groupId: gid },
              data: { enableReport: true },
            })
            await replyText(
              event.replyToken,
              `✅ ตั้งค่าเรียบร้อยค่ะ!\n\n🧈 ${BOT_NAME} จะส่งรายงานสรุปเมื่อวานมาที่กลุ่มนี้ทุกเช้า 08:30 น. นะคะ 💛`
            )
          } catch (err: any) {
            console.error('[Setup Group Error]', err?.message || err, err?.code)
            await replyText(event.replyToken, `❌ ตั้งค่าไม่สำเร็จค่ะ (${err?.code || 'unknown'})\n${err?.message?.substring(0, 100) || ''}\nลองใหม่อีกครั้งนะคะ 🧈`)
          }
        }
        return
      }

      // Chat with stripped message
      const srcId = (event.source as any).groupId || (event.source as any).roomId || event.source.userId
      await handleChat(strippedText, lower, event.source.userId!, event.replyToken, appUrl, sourceType, srcId || null)
      return
    }

    // ─── DM (1:1): ตอบทุกข้อความเหมือนเดิม ───────────────────
    // ถ้าผู้ใช้พิมพ์ "butter xxx" ใน DM ก็ strip prefix ให้ด้วย
    let text = rawText
    let lower = rawLower
    const dmTrigger = BOT_TRIGGERS.find(t => rawLower.startsWith(t))
    if (dmTrigger && rawText.length > dmTrigger.length) {
      text = rawText.substring(dmTrigger.length).trim()
      lower = text.toLowerCase()
    }

    // Registration keywords
    if (lower === 'ลงทะเบียน' || lower === 'register') {
      await handleRegister(event.source.userId!, event.replyToken)
      return
    }

    // All other messages → Butter chat
    const srcId = (event.source as any).groupId || (event.source as any).roomId || event.source.userId
    await handleChat(text, lower, event.source.userId!, event.replyToken, appUrl, sourceType, srcId || null)
    return
  }

  // Handle sticker messages (only reply in DM, stay quiet in groups)
  if (event.type === 'message' && event.message.type === 'sticker') {
    if (!isGroup) {
      await replyText(event.replyToken, `${BOT_NAME} เห็นสติกเกอร์น่ารักแล้วนะ 🧈✨`)
    }
    return
  }

  // Handle image/video messages (only reply in DM)
  if (event.type === 'message' && (event.message.type === 'image' || event.message.type === 'video')) {
    if (!isGroup) {
      await replyText(event.replyToken, `${BOT_NAME} รับรูป/วิดีโอไว้แล้วนะคะ 📸 ถ้ามีอะไรให้ช่วยพิมพ์บอกได้เลย~`)
    }
    return
  }
}

function getGuideBubble() {
  return {
    type: 'bubble' as const,
    size: 'mega' as const,
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📖 เมนูคำสั่ง',
          weight: 'bold',
          size: 'xl',
          color: '#ffffff'
        },
        {
          type: 'text',
          text: 'คู่มือแนะนำการใช้บริการและคำสั่งทางลัด',
          size: 'xs',
          color: '#FFE0B2',
          margin: 'xs'
        }
      ],
      backgroundColor: '#FF6D00',
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '💡 วิธีพิมพ์สั่งการ',
          weight: 'bold',
          size: 'sm',
          color: '#FF6D00'
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '• แชทส่วนตัว:', size: 'xs', weight: 'bold', color: '#555555', flex: 3 },
                { type: 'text', text: 'พิมพ์ถามได้ตรงๆ ไม่ต้องใช้คำนำหน้า', size: 'xs', color: '#666666', wrap: true, flex: 7 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'xs',
              contents: [
                { type: 'text', text: '• แชทกลุ่ม/ห้อง:', size: 'xs', weight: 'bold', color: '#555555', flex: 3 },
                { type: 'text', text: 'กดผ่าน Quick Menu หรือพิมพ์ลัดได้ทันที (หากคุยกับ AI ให้พิมพ์นำหน้าด้วย "butter" หรือ "เนย" เสมอ)', size: 'xs', color: '#666666', wrap: true, flex: 7 }
              ]
            }
          ]
        },
        { type: 'separator', margin: 'md' },
        {
          type: 'text',
          text: '⚡ รายการคำสั่งทางลัด (กดหรือพิมพ์ส่งได้เลย)',
          weight: 'bold',
          size: 'sm',
          color: '#FF6D00',
          margin: 'sm'
        },
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              action: {
                type: 'message',
                label: 'สรุปวันนี้',
                text: 'สรุปวันนี้'
              },
              contents: [
                { type: 'text', text: '1. สรุปวันนี้', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'ดูสรุปการส่งมอบและงานซ่อมวันนี้', size: 'xs', color: '#666666', flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              action: {
                type: 'message',
                label: 'สรุปเมื่อวาน',
                text: 'สรุปเมื่อวาน'
              },
              contents: [
                { type: 'text', text: '2. สรุปเมื่อวาน', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'ดูสรุปการส่งมอบและงานซ่อมเมื่อวาน', size: 'xs', color: '#666666', flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              action: {
                type: 'message',
                label: 'สรุปส่งมอบประจำเดือน',
                text: 'สรุปส่งมอบประจำเดือน'
              },
              contents: [
                { type: 'text', text: '3. สรุปส่งมอบประจำเดือน', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'ดูเปรียบเทียบแผนส่งมอบในเดือนนี้', size: 'xs', color: '#666666', wrap: true, flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              action: {
                type: 'message',
                label: 'ค้างซ่อมรายพื้นที่',
                text: 'ดูรถค้างซ่อมแต่ละพื้นที่'
              },
              contents: [
                { type: 'text', text: '4. ค้างซ่อมรายพื้นที่', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'จัดอันดับรถค้างซ่อมแยกรายพื้นที่/อู่', size: 'xs', color: '#666666', wrap: true, flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              action: {
                type: 'message',
                label: 'ซ่อม ศาลายา',
                text: 'ซ่อม ศาลายา'
              },
              contents: [
                { type: 'text', text: '5. ซ่อม [ชื่ออู่]', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'ดูรถค้างซ่อมของอู่นั้น (เช่น ซ่อม ศาลายา)', size: 'xs', color: '#666666', wrap: true, flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '6. ค้นหา [ทะเบียน/VIN]', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'ดูข้อมูลรถ ผู้เช่า สัญญา และประวัติซ่อม', size: 'xs', color: '#666666', wrap: true, flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '7. แจ้งบัค [รายละเอียด]', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'พิมพ์ "butter บัค [ข้อมูล]" หรือ "butter bug [ข้อมูล]"', size: 'xs', color: '#666666', wrap: true, flex: 6 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '8. ติดตามบัค [หมายเลข]', size: 'xs', weight: 'bold', color: '#FF6D00', flex: 4 },
                { type: 'text', text: 'พิมพ์ "butter ติดตามbug [หมายเลข]"', size: 'xs', color: '#666666', wrap: true, flex: 6 }
              ]
            }
          ]
        }
      ],
      paddingAll: 'lg'
    }
  }
}

// ─── Butter Chat Handler ───────────────────────────────────────────

async function handleChat(text: string, lower: string, userId: string, replyToken: string, appUrl: string, chatSourceType: string = 'user', chatSourceId: string | null = null) {
  // ─── 📝 Direct Task Completion Command ─────────────────────────────
  if (lower.startsWith('ปิดงาน') || lower.includes('ปิดงาน')) {
    const taskMatch = text.match(/ปิดงาน\s*#?\s*(\d+)/i)
    if (taskMatch) {
      const taskId = parseInt(taskMatch[1], 10)
      try {
        const { completeTaskNote } = await import('@/lib/task-service')
        await completeTaskNote(taskId)
        await replyText(
          replyToken,
          `✅ ปิดงาน #${taskId} เรียบร้อยแล้วค่ะ! ✨ 🧈`
        )
      } catch (err: any) {
        console.error('[Direct Complete Task Error]', err)
        await replyText(
          replyToken,
          `❌ ไม่พบรหัสงาน #${taskId} หรือเกิดข้อผิดพลาดในการปิดงานค่ะ`
        )
      }
      return
    }
  }

  // ─── 🆔 LINE User ID Command ──────────────────────────────────────
  if (lower === 'my id' || lower === 'line id' || lower === 'my line id') {
    await replyText(
      replyToken,
      `🆔 LINE User ID ของคุณคือ:\n\`${userId}\` 💛`
    )
    return
  }

  // ─── 📖 Guide / Manual Command (Single Bubble) ───────────────────
  if (matchAny(lower, ['วิธีใช้งาน', 'คู่มือ', 'วิธีใช้', 'manual', 'guide', 'how to use', 'howtouse'])) {
    try {
      const flexMessage = {
        type: 'flex' as const,
        altText: '📖 คู่มือการใช้งาน Butter Bot',
        contents: getGuideBubble(),
        quickReply: quickReplyItems
      }

      if (!env.MOCK_MODE) {
        await lineClient.replyMessage(replyToken, flexMessage as any)
      } else {
        console.log('[Mock Guide Only]', JSON.stringify(flexMessage, null, 2))
      }
      return
    } catch (err: any) {
      console.error('[Guide Flex Error]', err)
      await replyText(replyToken, `❌ โหลดคู่มือไม่สำเร็จค่ะ: ${err.message}`)
      return
    }
  }

  // ─── 🔗 List Issue / List Bug Link Request (Super Admin only) ───────
  const isLinkRequest = (
    /((ลิ้งค์|ลิ้ง|ลิงก์|ลิงค์|list|รายการ).*(issue|bug|บัค|ปัญหา))/i.test(lower) ||
    /((issue|bug|บัค|ปัญหา).*(ลิ้งค์|ลิ้ง|ลิงก์|ลิงค์|list|รายการ))/i.test(lower)
  ) && !/^(แจ้งปัญหา|แจ้งบัค|แจ้ง bug|แจ้ง issue|แจ้งบั๊ก)/i.test(lower)

  if (isLinkRequest) {
    let isAuthorized = false
    try {
      const registration = await prisma.lineRegistration.findUnique({
        where: { lineUserId: userId }
      })
      if (registration?.role === 'ADMIN' || registration?.role === 'SUPER_ADMIN') {
        isAuthorized = true
      }
    } catch (err) {
      console.error('[link request authorization check error]', err)
    }

    if (!isAuthorized) {
      const adminEnv = process.env.ADMIN_LINE_USER_IDS || ''
      const adminIds = adminEnv.split(',').map(id => id.trim()).filter(Boolean)
      if (adminIds.includes(userId)) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      await replyText(
        replyToken,
        `ท่านไม่มีสิทธิ์เข้าถึงข้อมูลดังกล่าว`
      )
      return
    }

    await replyText(
      replyToken,
      `🔗 ลิงก์สำหรับเข้าดูรายการแจ้งปัญหา (Issues List) ค่ะ:\n${appUrl}/issues 💛`
    )
    return
  }

  // ─── 🔧 Fixed Command (Admin only) ──────────────────────────────────
  if (lower.startsWith('fixed')) {
    const fixedMatch = text.trim().match(/^fixed\s*#?(\d+)/i)
    if (fixedMatch) {
      const issueId = parseInt(fixedMatch[1], 10)
      
      // Check admin authorization in DB and env
      let isAdmin = false
      try {
        const registration = await prisma.lineRegistration.findUnique({
          where: { lineUserId: userId }
        })
        if (registration?.role === 'ADMIN' || registration?.role === 'SUPER_ADMIN') {
          isAdmin = true
        }
      } catch (err) {
        console.error('[fixed authorization check error]', err)
      }
      if (!isAdmin) {
        const adminEnv = process.env.ADMIN_LINE_USER_IDS || ''
        const adminIds = adminEnv.split(',').map(id => id.trim()).filter(Boolean)
        if (adminIds.includes(userId)) {
          isAdmin = true
        }
      }
      
      if (!isAdmin) {
        await replyText(
          replyToken,
          `❌ ขออภัยค่ะ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถอัปเดตสถานะเป็นเสร็จสิ้นได้ค่ะ 🧈`
        )
        return
      }

      try {
        const issue = await prisma.systemIssue.findUnique({
          where: { id: issueId }
        })

        if (!issue) {
          await replyText(
            replyToken,
            `❌ ไม่พบเลขที่แจ้งปัญหา #${issueId} ในระบบค่ะ 🧈`
          )
          return
        }

        if (issue.status === 'RESOLVED') {
          await replyText(
            replyToken,
            `ℹ️ ปัญหา #${issueId} นี้ได้รับการแก้ไขเป็นเสร็จสิ้นอยู่แล้วค่ะ 🧈`
          )
          return
        }

        // Update issue status to RESOLVED
        await prisma.systemIssue.update({
          where: { id: issueId },
          data: {
            status: 'RESOLVED',
            resolvedAt: new Date()
          }
        })

        // Notify the reporter if reporter has lineUserId
        if (issue.lineUserId) {
          await replyOrPush(
            issue.lineUserId,
            `🔔 ปัญหาเลขที่แจ้ง #${issueId} ที่คุณได้รายงานไว้:\n"${issue.description}"\n\nได้รับการแก้ไขเรียบร้อยแล้วค่ะ! ✨ ขอบคุณที่แจ้งปัญหาเข้ามานะคะ 💛`
          )
        }

        await replyText(
          replyToken,
          `✅ อัปเดตสถานะปัญหา #${issueId} "${issue.description}" เป็น "แก้ไขแล้ว" เรียบร้อย และแจ้งเตือนผู้รายงานทาง LINE ส่วนตัวแล้วค่ะ 💛`
        )
      } catch (err: any) {
        console.error('[Fixed Command Error]', err)
        await replyText(
          replyToken,
          `❌ เกิดข้อผิดพลาดในการอัปเดตปัญหา #${issueId}: ${err.message || err}`
        )
      }
      return
    }
  }

  // ─── 🚫 Cancel Command (User / Admin) ────────────────────────────────
  const cancelMatch = text.trim().match(/^(bug\s+cancel|cancel)\s*#?(\d+)/i)
  if (cancelMatch) {
    const issueId = parseInt(cancelMatch[2], 10)
    try {
      const issue = await prisma.systemIssue.findUnique({
        where: { id: issueId }
      })

      if (!issue) {
        await replyText(
          replyToken,
          `❌ ไม่พบเลขที่แจ้งปัญหา #${issueId} ในระบบค่ะ 🧈`
        )
        return
      }

      if (issue.status === 'CANCELLED') {
        await replyText(
          replyToken,
          `ℹ️ ปัญหา #${issueId} นี้ถูกยกเลิกไปแล้วค่ะ 🧈`
        )
        return
      }

      // Check authorization (only reporter or admin can cancel)
      const isReporter = issue.lineUserId === userId
      let isAdmin = false
      try {
        const registration = await prisma.lineRegistration.findUnique({
          where: { lineUserId: userId }
        })
        if (registration?.role === 'ADMIN' || registration?.role === 'SUPER_ADMIN') {
          isAdmin = true
        }
      } catch (err) {
        console.error('[cancel authorization check error]', err)
      }
      if (!isAdmin) {
        const adminEnv = process.env.ADMIN_LINE_USER_IDS || ''
        const adminIds = adminEnv.split(',').map(id => id.trim()).filter(Boolean)
        if (adminIds.includes(userId)) {
          isAdmin = true
        }
      }

      if (!isAdmin && !isReporter) {
        await replyText(
          replyToken,
          `❌ ขออภัยค่ะ เฉพาะผู้แจ้งปัญหาหรือผู้ดูแลระบบเท่านั้นที่สามารถยกเลิกรายการนี้ได้ค่ะ 🧈`
        )
        return
      }

      // Update status to CANCELLED
      await prisma.systemIssue.update({
        where: { id: issueId },
        data: { status: 'CANCELLED' }
      })

      await replyText(
        replyToken,
        `🚫 ยกเลิกปัญหาเลขที่แจ้ง #${issueId} เรียบร้อยแล้วค่ะ 💛`
      )
    } catch (err: any) {
      console.error('[Cancel Command Error]', err)
      await replyText(
        replyToken,
        `❌ เกิดข้อผิดพลาดในการยกเลิกปัญหา #${issueId}: ${err.message || err}`
      )
    }
    return
  }

  // ─── 🔍 Track Bug Command ───────────────────────────────────────────
  const followBugMatch = text.trim().match(/^(ติดตาม\s*bug|ติดตาม\s*บัค|ติดตาม\s*ปัญหา)\s*#?(\d+)/i)
  if (followBugMatch) {
    const issueId = parseInt(followBugMatch[2], 10)
    try {
      const issue = await prisma.systemIssue.findUnique({
        where: { id: issueId }
      })

      if (!issue) {
        await replyText(
          replyToken,
          `❌ ไม่พบเลขที่แจ้งปัญหา #${issueId} ในระบบค่ะ 🧈`
        )
        return
      }

      // Convert status to user friendly Thai
      let thaiStatus = issue.status
      if (issue.status === 'OPEN') {
        thaiStatus = '⏳ รอดำเนินการ'
      } else if (issue.status === 'RESOLVED') {
        thaiStatus = '✅ แก้ไขแล้ว'
      } else if (issue.status === 'CANCELLED') {
        thaiStatus = '🚫 ยกเลิกแล้ว'
      }

      const formattedCreatedAt = issue.createdAt.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const formattedResolvedAt = issue.resolvedAt ? issue.resolvedAt.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) : null

      let replyMsg = `📋 รายละเอียดการแจ้งปัญหา #${issue.id}\n`
      replyMsg += `────────────────\n`
      replyMsg += `👤 ผู้แจ้ง: ${issue.displayName || 'ไม่ระบุชื่อ'}\n`
      replyMsg += `📅 วันที่แจ้ง: ${formattedCreatedAt}\n`
      replyMsg += `📌 สถานะ: ${thaiStatus}\n`
      if (formattedResolvedAt) {
        replyMsg += `✅ แก้ไขเสร็จสิ้นเมื่อ: ${formattedResolvedAt}\n`
      }
      replyMsg += `────────────────\n`
      replyMsg += `💬 ปัญหาที่แจ้ง:\n"${issue.description}"\n`
      replyMsg += `────────────────\n`
      replyMsg += `🧈 ขอบคุณที่ร่วมพัฒนาและแจ้งปัญหานะคะ 💛`

      await replyText(replyToken, replyMsg)
    } catch (err: any) {
      console.error('[Follow Bug Command Error]', err)
      await replyText(
        replyToken,
        `❌ เกิดข้อผิดพลาดในการดึงข้อมูลปัญหา #${issueId}: ${err.message || err}`
      )
    }
    return
  }

  // ─── 🐞 Help check for empty bug reports ────────────────────────────
  if (['bug', 'บัค', 'แจ้งบัค', 'แจ้งปัญหา', 'issue'].includes(lower)) {
    await replyText(
      replyToken,
      `💡 กรุณาระบุรายละเอียดปัญหาที่ต้องการแจ้งด้วยค่ะ\nเช่น: \`butter bug ข้อมูลทะเบียนรถไม่ถูกต้อง\` 💛`
    )
    return
  }

  // ─── 🐞 Bug / Issue Report Command ──────────────────────────────────
  const bugMatch = text.trim().match(/^(บัค|bug|แจ้งบัค|แจ้งปัญหา|issue)\s*[:\-=\s]*\s*([\s\S]+)$/i)
  if (bugMatch) {
    const description = bugMatch[2].trim()
    try {
      let profileName = 'ผู้ใช้ LINE'
      try {
        if (!env.MOCK_MODE && userId) {
          const profile = await lineClient.getProfile(userId)
          profileName = profile.displayName
        }
      } catch { /* ignore profile fetch errors */ }

      // Save issue in the database
      const issue = await prisma.systemIssue.create({
        data: {
          lineUserId: userId || null,
          displayName: profileName,
          description: description,
          sourceType: chatSourceType || null,
          sourceId: chatSourceId || null,
          status: 'OPEN'
        }
      })

      await replyText(
        replyToken,
        `✅ บันทึกปัญหาเรียบร้อยค่ะ!\n\n📋 ปัญหา: "${description}"\n🆔 เลขที่แจ้ง: #${issue.id}\n\nขอบคุณสำหรับข้อมูลนะคะ บัตเตอร์จะส่งเรื่องให้ทีมพัฒนาช่วยตรวจสอบค่ะ 💛`
      )
    } catch (err: any) {
      console.error('[Report Issue Error]', err)
      await replyText(
        replyToken,
        `❌ เกิดข้อผิดพลาดในการบันทึกปัญหา: ${err.message || err}`
      )
    }
    return
  }

  // Greeting patterns
  if (matchAny(lower, ['สวัสดี', 'หวัดดี', 'ดีครับ', 'ดีค่ะ', 'ดีจ้า', 'hi', 'hello', 'hey'])) {
    let name = ''
    try {
      if (!env.MOCK_MODE) {
        const profile = await lineClient.getProfile(userId)
        name = ` ${profile.displayName}`
      }
    } catch { /* ignore */ }
    await replyText(
      replyToken,
      `สวัสดีค่า${name}~ 🧈✨\n${BOT_NAME} พร้อมช่วยเหลือแล้วนะคะ!\n\nพิมพ์ "เมนู" เพื่อดูคำสั่ง หรือจะถาม ${BOT_NAME} อะไรก็ได้เลย เช่น\n💬 "วันนี้ปล่อยรถกี่คัน"\n💬 "รถรุ่น Y Plus 490 ซ่อมค้างกี่คัน"\n💬 "สรุปเดือนนี้หน่อย" 💛`
    )
    return
  }

  // Menu / Help
  if (matchAny(lower, ['เมนู', 'menu', 'help', 'ช่วย', 'คำสั่ง', 'ทำอะไรได้บ้าง'])) {
    try {
      const flexMessage = {
        type: 'flex' as const,
        altText: '📖 เมนูคำสั่ง Butter Bot',
        contents: {
          type: 'carousel' as const,
          contents: [
            // Bubble 1: คู่มือแนะนำการใช้บริการ (Bot Usage Guide & Shortcuts)
            getGuideBubble(),
            // Bubble 2: 🚚 การปล่อยรถ & ส่งมอบ (Deliveries)
            {
              type: 'bubble' as const,
              size: 'mega' as const,
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '🚚 การปล่อยรถ & ส่งมอบ',
                    weight: 'bold',
                    size: 'lg',
                    color: '#ffffff'
                  },
                  {
                    type: 'text',
                    text: 'ดูสถิติการส่งมอบ แผนงาน และประวัติปล่อยรถเช่า',
                    size: 'xs',
                    color: '#DBEAFE',
                    margin: 'xs'
                  }
                ],
                backgroundColor: '#2563EB',
                paddingAll: 'lg'
              },
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'md',
                    contents: [
                      {
                        type: 'box',
                        layout: 'horizontal',
                        action: {
                          type: 'message',
                          label: 'สรุปส่งมอบประจำเดือน',
                          text: 'สรุปส่งมอบประจำเดือน'
                        },
                        contents: [
                          { type: 'text', text: '📅 สรุปส่งมอบประจำเดือน', size: 'xs', weight: 'bold', color: '#2563EB', flex: 6 },
                          { type: 'text', text: 'ดูเปรียบเทียบแผนส่งมอบรถ', size: 'xs', color: '#888888', align: 'end', flex: 4 }
                        ]
                      }
                    ]
                  }
                ],
                paddingAll: 'lg'
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#2563EB',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: '📅 ดูปฏิทินส่งมอบ',
                      uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent('/dashboard')}`
                    }
                  }
                ]
              }
            },
            // Bubble 2: Maintenance & Replacements (งานซ่อม & รถทดแทน)
            {
              type: 'bubble' as const,
              size: 'mega' as const,
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: '🔧 งานซ่อม & รถทดแทน',
                    weight: 'bold',
                    size: 'lg',
                    color: '#ffffff'
                  },
                  {
                    type: 'text',
                    text: 'ติดตามความคืบหน้างานซ่อมและประวัติรถทดแทน',
                    size: 'xs',
                    color: '#D1FAE5',
                    margin: 'xs'
                  }
                ],
                backgroundColor: '#059669',
                paddingAll: 'lg'
              },
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'md',
                    contents: [
                      {
                        type: 'box',
                        layout: 'horizontal',
                        action: {
                          type: 'message',
                          label: 'ค้างซ่อมรายพื้นที่',
                          text: 'ดูรถค้างซ่อมแต่ละพื้นที่'
                        },
                        contents: [
                          { type: 'text', text: '📍 ค้างซ่อมรายพื้นที่', size: 'xs', weight: 'bold', color: '#059669', flex: 5 },
                          { type: 'text', text: 'รถค้างแยกตามอู่/พื้นที่', size: 'xs', color: '#888888', align: 'end', flex: 5 }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'horizontal',
                        action: {
                          type: 'message',
                          label: 'ค้างซ่อมทั้งหมด',
                          text: 'ค้างซ่อมทั้งหมด'
                        },
                        contents: [
                          { type: 'text', text: '🛠️ ค้างซ่อมทั้งหมด', size: 'xs', weight: 'bold', color: '#059669', flex: 5 },
                          { type: 'text', text: 'ดูข้อมูลซ่อมปัจจุบัน', size: 'xs', color: '#888888', align: 'end', flex: 5 }
                        ]
                      },
                      {
                        type: 'box',
                        layout: 'horizontal',
                        action: {
                          type: 'message',
                          label: 'ซ่อม ศาลายา',
                          text: 'ซ่อม ศาลายา'
                        },
                        contents: [
                          { type: 'text', text: '📍 ซ่อม ศาลายา', size: 'xs', weight: 'bold', color: '#059669', flex: 5 },
                          { type: 'text', text: 'ดูข้อมูลรถที่อู่ศาลายา', size: 'xs', color: '#888888', align: 'end', flex: 5 }
                        ]
                      }
                    ]
                  }
                ],
                paddingAll: 'lg'
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#059669',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: '🔧 ดูรายการซ่อม & รถทดแทน',
                      uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent('/maintenance')}`
                    }
                  }
                ]
              }
            }
          ]
        },
        quickReply: quickReplyItems
      }

      if (!env.MOCK_MODE) {
        await lineClient.replyMessage(replyToken, flexMessage as any)
      } else {
        console.log('[Mock Menu Response]', JSON.stringify(flexMessage, null, 2))
      }
      return
    } catch (err: any) {
      console.error('[Menu Flex Error]', err)
      await replyText(replyToken, `❌ สร้างเมนูไม่สำเร็จค่ะ: ${err.message}`)
      return
    }
  }

  // Dashboard link (exact match only)
  if (lower === 'dashboard' || lower === 'แดชบอร์ด' || lower === 'ลิงก์') {
    const url = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    await replyText(
      replyToken,
      `🔗 เปิด Dashboard ได้ที่นี่เลยค่ะ\n${url}/dashboard\n\nดูปฏิทินส่งมอบ สถิติการซ่อม และรายการทดแทน/รับคืนแบบเรียลไทม์ 📊`
    )
    return
  }

  // Thank you
  if (matchAny(lower, ['ขอบคุณ', 'thanks', 'thank', 'thx'])) {
    await replyText(replyToken, `ยินดีค่า~ 🧈💛 ${BOT_NAME} พร้อมช่วยเสมอนะคะ!`)
    return
  }

  // Bye
  if (matchAny(lower, ['บาย', 'bye', 'ไปก่อน', 'ไปล่ะ', 'ลาก่อน'])) {
    await replyText(replyToken, `บายค่า~ 👋🧈 แล้วเจอกันใหม่นะคะ!`)
    return
  }

  // ─── Daily Report as Flex Message ─────────────────────────────
  if (matchAny(lower, ['รายงานประจำวัน', 'สรุปรายงาน', 'สรุปประจำวัน', 'ข่าวเช้า', 'รายงานวัน', 'สรุปวันนี้', 'สรุปเมื่อวาน'])) {
    try {
      let reportDate: string | null = null

      // Check relative date keywords first
      if (lower.includes('เมื่อวาน')) {
        const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        reportDate = bangkokFormatter.format(yesterday)
      } else if (lower.includes('วันนี้')) {
        const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        reportDate = bangkokFormatter.format(new Date())
      }

      // Try to extract date from message (DD/MM/YYYY or YYYY-MM-DD)
      if (!reportDate) {
        const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
        if (dateMatch) {
          const [, d, m, y] = dateMatch
          // If year > 2500 it's Buddhist Era
          const year = parseInt(y) > 2500 ? parseInt(y) - 543 : parseInt(y)
          reportDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }
      }

      // Default to today
      if (!reportDate) {
        const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        reportDate = bangkokFormatter.format(new Date())
      }

      const { getPortfolioSummary, getDeliveryByDate, getRepairDailySummary, getDeliveryPlanAndActual } = await import('@/lib/bot-queries')
      const [portfolio, delivery, repairDaily, deliveryPlanData] = await Promise.all([
        getPortfolioSummary(),
        getDeliveryByDate({ date: reportDate }),
        getRepairDailySummary(reportDate),
        getDeliveryPlanAndActual({ date: reportDate }),
      ])

      if ('error' in portfolio) {
        await replyText(replyToken, `❌ ดึงข้อมูลไม่สำเร็จค่ะ: ${portfolio.error}`)
        return
      }

      const fmt = (n: number) => n.toLocaleString('en-US')

      // Build Delivery Plan Comparison (if available)
      const planRows: any[] = []
      if (deliveryPlanData && !('error' in deliveryPlanData)) {
        const { plans = [], actuals = [] } = deliveryPlanData as any
        const comparison: Record<string, {
          ES: { plan: number; actual: number };
          Y490: { plan: number; actual: number };
          Y410: { plan: number; actual: number };
        }> = {}

        for (const p of plans) {
          const proj = p.ProjectType || 'ไม่ระบุ'
          if (!comparison[proj]) {
            comparison[proj] = {
              ES: { plan: 0, actual: 0 },
              Y490: { plan: 0, actual: 0 },
              Y410: { plan: 0, actual: 0 },
            }
          }
          comparison[proj].ES.plan += p.ES_Count || 0
          comparison[proj].Y490.plan += p.Y490_Count || 0
          comparison[proj].Y410.plan += p.Y410_Count || 0
        }

        const categorizeModel = (modelName: string) => {
          const m = (modelName || '').toUpperCase()
          if (m.includes('ES')) return 'ES'
          if (m.includes('490')) return 'Y490'
          if (m.includes('410')) return 'Y410'
          return 'Other'
        }

        for (const a of actuals) {
          const proj = a.ProjectType || 'ไม่ระบุ'
          if (!comparison[proj]) {
            comparison[proj] = {
              ES: { plan: 0, actual: 0 },
              Y490: { plan: 0, actual: 0 },
              Y410: { plan: 0, actual: 0 },
            }
          }
          const modelCat = categorizeModel(a.Model)
          if (modelCat === 'ES') {
            comparison[proj].ES.actual += a.Count || 0
          } else if (modelCat === 'Y490') {
            comparison[proj].Y490.actual += a.Count || 0
          } else if (modelCat === 'Y410') {
            comparison[proj].Y410.actual += a.Count || 0
          }
        }

        for (const proj of Object.keys(comparison)) {
          const models = comparison[proj]
          for (const model of ['ES', 'Y490', 'Y410'] as const) {
            const { plan, actual } = models[model]
            if (plan > 0 || actual > 0) {
              let valColor = '#1a1a1a'
              if (actual >= plan && plan > 0) {
                valColor = '#2E7D32' // green (target met)
              } else if (actual < plan && actual > 0) {
                valColor = '#E65100' // orange (in progress/shortfall)
              } else if (actual === 0 && plan > 0) {
                valColor = '#C62828' // red (not started)
              }

              planRows.push({
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: `• ${proj} (${model})`,
                    size: 'xs',
                    color: '#555555',
                    flex: 5
                  },
                  {
                    type: 'text',
                    text: `${actual}/${plan}`,
                    size: 'xs',
                    weight: 'bold',
                    color: valColor,
                    align: 'end',
                    flex: 3
                  }
                ]
              })
            }
          }
        }
      }

      const comparisonBox = planRows.length > 0 ? {
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        margin: 'md',
        contents: [
          {
            type: 'text',
            text: '📋 เทียบแผนส่งมอบ (จริง/แผน)',
            size: 'xs',
            weight: 'bold',
            color: '#1a1a1a',
            margin: 'xs'
          },
          ...planRows
        ]
      } : null
      const todayFormatted = new Date().toLocaleDateString('th-TH', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok',
      })
      const deliverySummary = delivery?.summary || { total: 0, completed: 0, pending: 0 }
      const repairData = {
        newReports: repairDaily?.newReports || 0,
        completed: repairDaily?.completed || 0,
        replacements: repairDaily?.replacements || 0,
        returns: repairDaily?.returns || 0,
      }

      const portfolioBubble: any = {
        type: 'bubble' as const, size: 'mega' as const,
        header: { type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: '🧈 Butter สรุปข่าว', weight: 'bold', size: 'lg', color: '#1a1a1a' },
          { type: 'text', text: todayFormatted, size: 'xs', color: '#888888' },
        ], backgroundColor: '#FFF9E6', paddingAll: 'lg' },
        body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
          { type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '🚗 รถทั้งหมด', size: 'sm', color: '#555555', flex: 5 },
            { type: 'text', text: fmt(portfolio.total), size: 'sm', weight: 'bold', color: '#1a1a1a', align: 'end', flex: 3 },
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🟢 On Rent', size: 'sm', weight: 'bold', color: '#2E7D32', flex: 5 },
              { type: 'text', text: fmt(portfolio.onRent.total), size: 'sm', weight: 'bold', color: '#2E7D32', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `On Road ${fmt(portfolio.onRent.onRoad)}`, size: 'xxs', color: '#aaaaaa', flex: 5 },
              { type: 'text', text: `Maint. ${fmt(portfolio.onRent.underMaintenance)}`, size: 'xxs', color: '#E65100', align: 'end', flex: 3 },
            ]},
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '✅ Available', size: 'sm', weight: 'bold', color: '#1565C0', flex: 5 },
              { type: 'text', text: fmt(portfolio.available.total), size: 'sm', weight: 'bold', color: '#1565C0', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `EV7 ${fmt(portfolio.available.ev7)}`, size: 'xxs', color: '#aaaaaa' },
              { type: 'text', text: `LM ${fmt(portfolio.available.lineMan)}`, size: 'xxs', color: '#aaaaaa', align: 'center' },
              { type: 'text', text: `Grab ${fmt(portfolio.available.grab)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
            ]},
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🏭 Production', size: 'sm', weight: 'bold', color: '#6A1B9A', flex: 5 },
              { type: 'text', text: fmt(portfolio.onProduction.total), size: 'sm', weight: 'bold', color: '#6A1B9A', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `Pending ${fmt(portfolio.onProduction.pending)}`, size: 'xxs', color: '#aaaaaa' },
              { type: 'text', text: `Process ${fmt(portfolio.onProduction.inProcess)}`, size: 'xxs', color: '#aaaaaa', align: 'center' },
              { type: 'text', text: `GR ${fmt(portfolio.onProduction.waitingGR)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
            ]},
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🔄 Replacement', size: 'sm', weight: 'bold', color: '#E65100', flex: 5 },
              { type: 'text', text: fmt(portfolio.replacement.total), size: 'sm', weight: 'bold', color: '#E65100', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `Available ${fmt(portfolio.replacement.available)}`, size: 'xxs', color: '#aaaaaa', flex: 5 },
              { type: 'text', text: `Car ${fmt(portfolio.replacement.car)}`, size: 'xxs', color: '#aaaaaa', align: 'end', flex: 3 },
            ]},
          ]},
          { type: 'separator' },
          { type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🛠️ Maintenance', size: 'sm', weight: 'bold', color: '#C62828', flex: 5 },
              { type: 'text', text: fmt(portfolio.underMaintenance.total), size: 'sm', weight: 'bold', color: '#C62828', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `New ${fmt(portfolio.underMaintenance.new)}`, size: 'xxs', color: '#aaaaaa' },
              { type: 'text', text: `Rent ${fmt(portfolio.underMaintenance.onRent)}`, size: 'xxs', color: '#aaaaaa', align: 'center' },
              { type: 'text', text: `Use ${fmt(portfolio.underMaintenance.use)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
            ]},
          ]},
        ], paddingAll: 'lg' },
        footer: { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: `EV7: ${fmt(portfolio.company.ev7)}`, size: 'xxs', color: '#aaaaaa' },
          { type: 'text', text: `GI: ${fmt(portfolio.company.gi)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
        ], paddingAll: 'md' },
      }

      const activityBubble: any = {
        type: 'bubble' as const, size: 'mega' as const,
        header: { type: 'box', layout: 'vertical', contents: [
          { type: 'text', text: `📅 กิจกรรมวันที่ ${reportDate}`, weight: 'bold', size: 'md', color: '#1a1a1a' },
          { type: 'text', text: 'สรุปการส่งรถและงานซ่อม', size: 'xs', color: '#888888' },
        ], backgroundColor: '#E8F5E9', paddingAll: 'lg' },
        body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
          { type: 'text', text: '🚛 ส่งมอบรถ', weight: 'bold', size: 'sm', color: '#1565C0' },
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(deliverySummary.total), size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center' },
              { type: 'text', text: 'แผนทั้งหมด', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(deliverySummary.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
              { type: 'text', text: 'สำเร็จ', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(deliverySummary.pending), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'ตามเป้า', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ]},
          ...(comparisonBox ? [comparisonBox] : []),
          { type: 'separator' },
          { type: 'text', text: '🔧 งานซ่อม', weight: 'bold', size: 'sm', color: '#C62828' },
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(repairData.newReports), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'แจ้งซ่อม', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(repairData.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
              { type: 'text', text: 'ซ่อมเสร็จ', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ]},
          { type: 'separator' },
          // Replacement & Return
          { type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: '🔄 รถทดแทน', weight: 'bold', size: 'xs', color: '#E65100', align: 'center' },
              { type: 'text', text: String(repairData.replacements), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'คัน', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: '📥 รถคืน', weight: 'bold', size: 'xs', color: '#1565C0', align: 'center' },
              { type: 'text', text: String(repairData.returns), size: 'xl', weight: 'bold', color: '#1565C0', align: 'center' },
              { type: 'text', text: 'คัน', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ]},
        ], paddingAll: 'lg' },
      }

      if (!env.MOCK_MODE) {
        await lineClient.replyMessage(replyToken, {
          type: 'flex',
          altText: `🧈 Butter สรุปรายงาน ${reportDate}`,
          contents: { type: 'carousel', contents: [activityBubble, portfolioBubble] },
          quickReply: quickReplyItems
        })
      }
      return
    } catch (err: any) {
      console.error('[Daily Report Flex Error]', err)
      await replyText(replyToken, `❌ สร้างรายงานไม่สำเร็จค่ะ: ${err.message}\n\nลองใหม่อีกครั้งนะคะ 🧈`)
      return
    }
  }

  // ─── Monthly Delivery Summary as Flex Message ──────────────────
  if (matchAny(lower, ['สรุปส่งมอบประจำเดือน', 'ส่งมอบประจำเดือน', 'สรุปประจำเดือน', 'สรุปส่งมอบ', 'สรุปเดือนนี้'])) {
    try {
      const { getMonthlyStats } = await import('@/lib/bot-queries')
      
      const parsedDate = parseMonthYear(text)
      const targetYear = parsedDate.year
      const targetMonth = parsedDate.month
      
      const stats = await getMonthlyStats({ year: targetYear, month: targetMonth })
      if ('error' in stats) {
        await replyText(replyToken, `❌ ดึงข้อมูลประจำเดือนไม่สำเร็จค่ะ: ${stats.error}`)
        return
      }

      const delivery = stats.delivery || { total: 0, completed: 0, pending: 0, pendingActual: 0 }

      const planRows: any[] = []
      if (stats.plans && stats.actuals) {
        const { plans = [], actuals = [] } = stats as any
        const comparison: Record<string, {
          ES: { plan: number; actual: number };
          Y490: { plan: number; actual: number };
          Y410: { plan: number; actual: number };
        }> = {}

        for (const p of plans) {
          const proj = p.ProjectType || 'ไม่ระบุ'
          if (!comparison[proj]) {
            comparison[proj] = {
              ES: { plan: 0, actual: 0 },
              Y490: { plan: 0, actual: 0 },
              Y410: { plan: 0, actual: 0 },
            }
          }
          comparison[proj].ES.plan += p.ES_Count || 0
          comparison[proj].Y490.plan += p.Y490_Count || 0
          comparison[proj].Y410.plan += p.Y410_Count || 0
        }

        const categorizeModel = (modelName: string) => {
          const m = (modelName || '').toUpperCase()
          if (m.includes('ES')) return 'ES'
          if (m.includes('490')) return 'Y490'
          if (m.includes('410')) return 'Y410'
          return 'Other'
        }

        for (const a of actuals) {
          const proj = a.ProjectType || 'ไม่ระบุ'
          if (!comparison[proj]) {
            comparison[proj] = {
              ES: { plan: 0, actual: 0 },
              Y490: { plan: 0, actual: 0 },
              Y410: { plan: 0, actual: 0 },
            }
          }
          const modelCat = categorizeModel(a.Model)
          if (modelCat === 'ES') {
            comparison[proj].ES.actual += a.Count || 0
          } else if (modelCat === 'Y490') {
            comparison[proj].Y490.actual += a.Count || 0
          } else if (modelCat === 'Y410') {
            comparison[proj].Y410.actual += a.Count || 0
          }
        }

        for (const proj of Object.keys(comparison)) {
          const models = comparison[proj]
          for (const model of ['ES', 'Y490', 'Y410'] as const) {
            const { plan, actual } = models[model]
            if (plan > 0 || actual > 0) {
              let valColor = '#1a1a1a'
              if (actual >= plan && plan > 0) {
                valColor = '#2E7D32' // green (target met)
              } else if (actual < plan && actual > 0) {
                valColor = '#E65100' // orange (in progress/shortfall)
              } else if (actual === 0 && plan > 0) {
                valColor = '#C62828' // red (not started)
              }

              planRows.push({
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: `• ${proj} (${model})`,
                    size: 'xs',
                    color: '#555555',
                    flex: 5
                  },
                  {
                    type: 'text',
                    text: `${actual}/${plan}`,
                    size: 'xs',
                    weight: 'bold',
                    color: valColor,
                    align: 'end',
                    flex: 3
                  }
                ]
              })
            }
          }
        }
      }

      const flexMessage = {
        type: 'flex' as const,
        altText: `📅 สรุปส่งมอบประจำเดือน ${targetMonth}/${targetYear}`,
        contents: {
          type: 'bubble' as const,
          size: 'mega' as const,
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '📅 สรุปส่งมอบประจำเดือน', weight: 'bold', size: 'lg', color: '#1a1a1a' },
              { type: 'text', text: `ข้อมูล ณ เดือนที่ ${targetMonth}/${targetYear}`, size: 'xs', color: '#888888' }
            ],
            backgroundColor: '#FFF3E0',
            paddingAll: 'lg'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              { type: 'text', text: '🚛 สถิติส่งมอบรวม', weight: 'bold', size: 'sm', color: '#E65100' },
              {
                type: 'box',
                layout: 'horizontal',
                spacing: 'md',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'text', text: String(delivery.total), size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center' },
                      { type: 'text', text: 'แผนทั้งหมด', size: 'xxs', color: '#888888', align: 'center' }
                    ],
                    flex: 1
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'text', text: String(delivery.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
                      { type: 'text', text: 'ส่งจริงแล้ว', size: 'xxs', color: '#888888', align: 'center' }
                    ],
                    flex: 1
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'text', text: String(delivery.pendingActual ?? 0), size: 'xl', weight: 'bold', color: '#EF6C00', align: 'center' },
                      { type: 'text', text: 'รอดำเนินการ', size: 'xxs', color: '#888888', align: 'center' }
                    ],
                    flex: 1
                  },
                  {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'text', text: String(delivery.pending), size: 'xl', weight: 'bold', color: '#757575', align: 'center' },
                      { type: 'text', text: 'ตามเป้า', size: 'xxs', color: '#888888', align: 'center' }
                    ],
                    flex: 1
                  }
                ]
              },
              ...(planRows.length > 0 ? [
                { type: 'separator', margin: 'lg' },
                { type: 'text', text: '📋 เทียบแผนส่งมอบรายโครงการ (จริง/แผน)', weight: 'bold', size: 'xs', color: '#555555', margin: 'md' },
                ...planRows
              ] : [])
            ],
            paddingAll: 'lg'
          }
        },
        quickReply: quickReplyItems
      }

      if (!env.MOCK_MODE) {
        await lineClient.replyMessage(replyToken, flexMessage as any)
      } else {
        console.log('[Mock Monthly Report]', JSON.stringify(flexMessage, null, 2))
      }
      return
    } catch (err: any) {
      console.error('[Monthly Report Flex Error]', err)
      await replyText(replyToken, `❌ สร้างสรุปรายเดือนไม่สำเร็จค่ะ: ${err.message}`)
      return
    }
  }

  // ─── Pending Repairs at Specific Location ────────────────────────
  // Example: "ซ่อม ศาลายา", "ซ่อม บางนา"
  const repairLocMatch = text.match(/^ซ่อม\s*(.+)$/i)
  if (repairLocMatch && !matchAny(lower, ['ดูรถค้างซ่อมแต่ละพื้นที่', 'ค้างซ่อมรายพื้นที่', 'ค้างซ่อมแต่ละพื้นที่', 'ค้างซ่อมพื้นที่', 'ค้างซ่อมทั้งหมด', 'ซ่อมทั้งหมด', 'ซ่อมเสร็จ', 'ซ่อมเสร็จแล้ว', 'ซ่อมวันนี้', 'ซ่อมเมื่อวาน', 'ซ่อมรถ'])) {
    const searchLoc = repairLocMatch[1].trim()
    if (searchLoc.length > 0) {
      try {
        const pool = await getMSSQLPool()
        if (pool) {
          const result = await pool.request()
            .input('loc', sql.NVarChar, `%${searchLoc}%`)
            .query(`
              SELECT 
                m.MaintenanceItemID AS id, 
                i.RegisterNo AS register_no, 
                i.VinNo AS vin, 
                i.Model AS model, 
                m.IssueTitle AS issue_title, 
                m.CarStatusCode AS status_code, 
                m.ServiceLocationCode AS service_location,
                m.ReportDate AS report_date
              FROM dbo.EV_MaintenanceItem m
              JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
              WHERE m.IsActive = 1 
                AND i.IsActive = 1 
                AND i.Status = 'MAINTENANCE'
                AND m.ServiceLocationCode LIKE @loc
              ORDER BY m.ReportDate DESC
            `)

          const list = result.recordset || []
          let displayLocation = searchLoc
          if (list.length > 0) {
            displayLocation = list[0].service_location || searchLoc
          }

          const flexMessage = {
            type: 'flex' as const,
            altText: `🔧 ข้อมูลรถค้างซ่อมที่ ${displayLocation}`,
            contents: {
              type: 'bubble' as const,
              size: 'mega' as const,
              header: {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'text',
                    text: `📍 อู่ซ่อม: ${displayLocation}`,
                    weight: 'bold',
                    size: 'lg',
                    color: '#ffffff'
                  },
                  {
                    type: 'text',
                    text: `สถานะรถค้างซ่อมทั้งหมดในอู่นี้`,
                    size: 'xs',
                    color: '#D1FAE5',
                    margin: 'xs'
                  }
                ],
                backgroundColor: '#059669',
                paddingAll: 'lg'
              },
              body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                contents: [
                  {
                    type: 'text',
                    text: `พบรถค้างซ่อมทั้งหมด ${list.length} คัน:`,
                    size: 'sm',
                    weight: 'bold',
                    color: '#111827'
                  },
                  { type: 'separator' },
                  ...(list.length > 0 ? list.slice(0, 5).map((car: any) => ({
                    type: 'box',
                    layout: 'vertical',
                    margin: 'md',
                    contents: [
                      {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                          {
                            type: 'text',
                            text: `🚗 ${car.register_no || car.vin}`,
                            weight: 'bold',
                            size: 'sm',
                            color: '#111827',
                            flex: 6
                          },
                          {
                            type: 'text',
                            text: car.model || '-',
                            size: 'xs',
                            color: '#4b5563',
                            align: 'end',
                            flex: 4
                          }
                        ]
                      },
                      {
                        type: 'text',
                        text: `อาการ: ${car.issue_title || 'ไม่ระบุอาการ'}`,
                        size: 'xs',
                        color: '#6b7280',
                        margin: 'xs'
                      }
                    ]
                  })) : [
                    {
                      type: 'text',
                      text: 'ไม่มีรถค้างซ่อมที่อู่นี้ในขณะนี้ 🟢',
                      size: 'sm',
                      color: '#4b5563',
                      margin: 'md',
                      align: 'center'
                    }
                  ]),
                  ...(list.length > 5 ? [
                    { type: 'separator', margin: 'md' },
                    {
                      type: 'text',
                      text: `...และคันอื่นๆ อีก ${list.length - 5} คัน`,
                      size: 'xs',
                      color: '#6b7280',
                      align: 'center'
                    }
                  ] : [])
                ],
                paddingAll: 'lg'
              },
              footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: 'lg',
                contents: [
                  {
                    type: 'button',
                    style: 'primary',
                    color: '#059669',
                    height: 'sm',
                    action: {
                      type: 'uri',
                      label: 'ดูรายละเอียดเพิ่มเติม',
                      uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/maintenance?location=${displayLocation}`)}`
                    }
                  }
                ]
              }
            },
            quickReply: quickReplyItems
          }

          if (!env.MOCK_MODE) {
            await lineClient.replyMessage(replyToken, flexMessage as any)
          } else {
            console.log('[Mock Repair by Location Name Report]', JSON.stringify(flexMessage, null, 2))
          }
          return
        }
      } catch (err: any) {
        console.error('[Repair Location Name Flex Error]', err)
        await replyText(replyToken, `❌ ดึงข้อมูลรถค้างซ่อมที่ ${searchLoc} ไม่สำเร็จค่ะ: ${err.message}`)
        return
      }
    }
  }

  // ─── Pending Repairs by Location as Flex Message ────────────────
  if (matchAny(lower, ['ดูรถค้างซ่อมแต่ละพื้นที่', 'ค้างซ่อมรายพื้นที่', 'ค้างซ่อมแต่ละพื้นที่', 'ค้างซ่อมพื้นที่'])) {
    try {
      const { getRepairByLocation } = await import('@/lib/bot-queries')
      const repairs = await getRepairByLocation()

      if ('error' in repairs) {
        await replyText(replyToken, `❌ ดึงข้อมูลค้างซ่อมไม่สำเร็จค่ะ: ${repairs.error}`)
        return
      }

      const list = (repairs as any).data || []
      const totalCount = (repairs as any).totalCount || 0

      const formatLocationName = (loc: string) => {
        if (!loc || loc === 'ไม่ระบุ') return 'ไม่ระบุพื้นที่/อู่'
        return loc.replace(/_/g, ' ')
      }

      const locationRows = list.slice(0, 10).map((item: any) => {
        const pathUrl = `/maintenance?location=${item.Location}`
        const liffUrl = `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(pathUrl)}`

        return {
          type: 'box',
          layout: 'horizontal',
          action: {
            type: 'uri',
            label: `ดูค้างซ่อม ${formatLocationName(item.Location)}`,
            uri: liffUrl
          },
          contents: [
            {
              type: 'text',
              text: `• ${formatLocationName(item.Location)}`,
              size: 'sm',
              color: '#1565C0',
              decoration: 'underline',
              flex: 5,
              wrap: true
            },
            {
              type: 'text',
              text: `${item.Count} คัน`,
              size: 'sm',
              weight: 'bold',
              color: '#C62828',
              align: 'end',
              flex: 2
            }
          ]
        }
      })

      const flexMessage = {
        type: 'flex' as const,
        altText: `🔧 สรุปรถค้างซ่อมแยกตามพื้นที่`,
        contents: {
          type: 'bubble' as const,
          size: 'mega' as const,
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '🔧 รถค้างซ่อมแยกตามพื้นที่', weight: 'bold', size: 'lg', color: '#ffffff' },
              { type: 'text', text: `รวมทั้งหมด: ${totalCount} คัน`, size: 'sm', color: '#ffcdd2', margin: 'xs' }
            ],
            backgroundColor: '#C62828',
            paddingAll: 'lg'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            spacing: 'md',
            contents: [
              { type: 'text', text: '📍 รายชื่อพื้นที่ที่มีรถค้างซ่อมสูงสุด (Top 10)', weight: 'bold', size: 'sm', color: '#1a1a1a' },
              { type: 'separator' },
              ...locationRows,
              ...(list.length > 10 ? [
                { type: 'separator', margin: 'lg' },
                { type: 'text', text: `...และพื้นที่อื่นๆ อีก ${list.length - 10} แห่ง`, size: 'xs', color: '#888888', align: 'center', margin: 'md' }
              ] : [])
            ],
            paddingAll: 'lg'
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'lg',
            contents: [
              {
                type: 'button',
                style: 'secondary',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '🔧 ดูรายการซ่อมทั้งหมด',
                  uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent('/maintenance')}`
                }
              }
            ]
          }
        },
        quickReply: quickReplyItems
      }

      if (!env.MOCK_MODE) {
        await lineClient.replyMessage(replyToken, flexMessage as any)
      } else {
        console.log('[Mock Repair by Location Report]', JSON.stringify(flexMessage, null, 2))
      }
      return
    } catch (err: any) {
      console.error('[Repair Location Flex Error]', err)
      await replyText(replyToken, `❌ สร้างสรุปค้างซ่อมไม่สำเร็จค่ะ: ${err.message}`)
      return
    }
  }

  // ─── AI-Powered Response (Gemini) ──────────────────────────────
  // ทุกข้อความที่ไม่ตรงกับ keyword ข้างบน → ส่งให้ AI ตอบ
  try {
    console.log(`[${BOT_NAME} AI] Processing: "${text}"`)

    // Load recent chat history for context (up to 5 messages)
    // สำหรับกลุ่ม/ห้องใช้ Group ID/Room ID, สำหรับส่วนตัวใช้ User ID
    const isGroupOrRoom = chatSourceType === 'group' || chatSourceType === 'room'
    const targetSourceId = isGroupOrRoom ? (chatSourceId || userId) : userId
    let history: any[] = []

    if (targetSourceId) {
      try {
        const logs = await prisma.chatLog.findMany({
          where: { sourceId: targetSourceId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        })
        const chronologicalLogs = [...logs].reverse()
        history = chronologicalLogs.flatMap(log => [
          { role: 'user', parts: [{ text: log.userMessage }] },
          { role: 'model', parts: [{ text: log.botReply }] }
        ])
      } catch (err) {
        console.error('[handleChat] Error loading conversation history:', err)
      }
    }

    let userName: string | undefined
    try {
      if (!env.MOCK_MODE && userId) {
        const profile = await lineClient.getProfile(userId)
        userName = profile.displayName
      }
    } catch { /* ignore */ }

    const userContext: {
      userId?: string
      userName?: string
      toolsCalled?: string[]
      createdTaskId?: number
      completedTaskId?: number
    } = { userId, userName }

    const aiResponse = await askButter(text, history, userContext)
    console.log(`[${BOT_NAME} AI] Response: "${aiResponse.substring(0, 200)}..."`)

    // ─── Try to detect task list or vehicle identifier for Flex Message ───
    let flexSent = false

    // 1. Task Checklist Flow
    const isTaskQuery = matchAny(lower, ['งานค้าง', 'รายการงาน', 'รายการโน้ต', 'ดูงาน', 'ดูโน้ต', 'งานทั้งหมด', 'มีงานอะไร', 'จดอะไรไว้บ้าง', 'task list', 'list task'])

    if (userContext.createdTaskId) {
      flexSent = await trySendSingleTaskFlexMessage(replyToken, aiResponse, userContext.createdTaskId)
    } else if (userContext.completedTaskId) {
      flexSent = await trySendSingleTaskFlexMessage(replyToken, aiResponse, userContext.completedTaskId)
    } else if (isTaskQuery || (userContext.toolsCalled && userContext.toolsCalled.includes('listTaskNotes'))) {
      let vehicleRef: string | undefined = undefined
      const vehicleMatch = text.match(/([ก-ฮ]{2}\-\d{3,4})|([ก-ฮ]{2}\d{3,4})|\b(L[A-Z0-9]{16})\b/i)
      if (vehicleMatch) {
        vehicleRef = vehicleMatch[0]
      }

      let assigneeName: string | undefined = undefined
      const assigneeMatch = text.match(/@([ก-ฮa-zA-Z0-9_°\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+)/)
      if (assigneeMatch) {
        assigneeName = assigneeMatch[1].trim()
      }

      flexSent = await trySendTaskFlexMessage(replyToken, aiResponse, vehicleRef, assigneeName)
    } else {
      // Fallback detection (e.g. if tools were not explicitly called or text pattern match is required)
      const aiMentionsTasks = aiResponse.includes('ID #') || aiResponse.includes('รายการงาน') || aiResponse.includes('งานค้าง')
      if (aiMentionsTasks) {
        const singleTaskMatch = aiResponse.match(/ID\s*#?\s*(\d+)/i)
        if (singleTaskMatch) {
          const taskId = parseInt(singleTaskMatch[1], 10)
          flexSent = await trySendSingleTaskFlexMessage(replyToken, aiResponse, taskId)
        } else {
          let vehicleRef: string | undefined = undefined
          const vehicleMatch = text.match(/([ก-ฮ]{2}\-\d{3,4})|([ก-ฮ]{2}\d{3,4})|\b(L[A-Z0-9]{16})\b/i)
          if (vehicleMatch) {
            vehicleRef = vehicleMatch[0]
          }
          flexSent = await trySendTaskFlexMessage(replyToken, aiResponse, vehicleRef)
        }
      }
    }

    // 2. Vehicle Info Flow (fallback if tasks not sent or not a task query)
    if (!flexSent) {
      let vehicleIdentifier: string | null = null

      // Strategy 1: Detect VIN pattern from user's original message (17-char VIN starting with L)
      const vinFromUser = text.match(/\b(L[A-Z0-9]{16})\b/i)
      if (vinFromUser) {
        vehicleIdentifier = vinFromUser[1].toUpperCase()
        console.log(`[${BOT_NAME}] Detected VIN from user input: ${vehicleIdentifier}`)
      }

      // Strategy 2: Extract from /vehicle/xxx link in AI response (broad regex)
      if (!vehicleIdentifier) {
        const linkMatch = aiResponse.match(/\/vehicle\/([^\"')\]\r\n\t]+)/i)
        if (linkMatch) {
          vehicleIdentifier = decodeURIComponent(linkMatch[1]).trim()
          console.log(`[${BOT_NAME}] Detected vehicle from AI link: ${vehicleIdentifier}`)
        }
      }

      // Strategy 3: Detect VIN pattern from AI response text
      if (!vehicleIdentifier) {
        const vinFromAi = aiResponse.match(/\b(L[A-Z0-9]{16})\b/i)
        if (vinFromAi) {
          vehicleIdentifier = vinFromAi[1].toUpperCase()
          console.log(`[${BOT_NAME}] Detected VIN from AI response: ${vehicleIdentifier}`)
        }
      }

      // Try to send Flex Message if we found a vehicle identifier
      if (vehicleIdentifier) {
        flexSent = await trySendVehicleFlexMessage(replyToken, vehicleIdentifier, aiResponse, appUrl)
      }
    }

    if (!flexSent) {
      await replyText(replyToken, aiResponse)
    }
  } catch (error) {
    console.error(`[${BOT_NAME} AI Error]`, error)
    await replyText(
      replyToken,
      `${BOT_NAME} ขัดข้องชั่วคราวค่ะ 😅 ลองพิมพ์ "สถานะ" หรือ "สรุปเดือน" เพื่อใช้คำสั่งเร็วแทนนะคะ 🧈💛`
    )
  }
}

// ─── Utilities ──────────────────────────────────────────────────────

function parseMonthYear(text: string) {
  const now = new Date()
  const formatterYear = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric' })
  const formatterMonth = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', month: 'numeric' })
  let year = parseInt(formatterYear.format(now))
  let month = parseInt(formatterMonth.format(now))

  const lowerText = text.toLowerCase()

  const thMonths = [
    { names: ['มกราคม', 'มกรา', 'ม.ค.'], val: 1 },
    { names: ['กุมภาพันธ์', 'กุมภา', 'ก.พ.'], val: 2 },
    { names: ['มีนาคม', 'มีนา', 'มี.ค.'], val: 3 },
    { names: ['เมษายน', 'เมษา', 'เม.ย.'], val: 4 },
    { names: ['พฤษภาคม', 'พฤษภา', 'พ.ค.'], val: 5 },
    { names: ['มิถุนายน', 'มิถุนา', 'มิ.ย.'], val: 6 },
    { names: ['กรกฎาคม', 'กรกฎา', 'ก.ค.'], val: 7 },
    { names: ['สิงหาคม', 'สิงหา', 'ส.ค.'], val: 8 },
    { names: ['กันยายน', 'กันยา', 'ก.ย.'], val: 9 },
    { names: ['ตุลาคม', 'ตุลา', 'ต.ค.'], val: 10 },
    { names: ['พฤศจิกายน', 'พฤศจิกา', 'พ.ย.'], val: 11 },
    { names: ['ธันวาคม', 'ธันวา', 'ธ.ค.'], val: 12 }
  ]

  let foundMonthByName = false
  for (const m of thMonths) {
    if (m.names.some(name => lowerText.includes(name))) {
      month = m.val
      foundMonthByName = true
      break
    }
  }

  const slashRegex = /(\d{1,2})\/(\d{2,4})/
  const slashMatch = lowerText.match(slashRegex)
  if (slashMatch) {
    month = parseInt(slashMatch[1])
    let y = parseInt(slashMatch[2])
    if (y < 100) y += 2000
    year = y
    return { month, year }
  }

  const yearRegex = /(20\d{2})|(25\d{2})/
  const yearMatch = lowerText.match(yearRegex)
  if (yearMatch) {
    const yStr = yearMatch[0]
    let y = parseInt(yStr)
    if (y > 2500) y -= 543
    year = y
  }

  if (!foundMonthByName) {
    let cleanText = lowerText
    if (yearMatch) {
      cleanText = lowerText.replace(yearMatch[0], '')
    }
    const numbers = cleanText.match(/\d{1,2}/g)
    if (numbers) {
      for (const numStr of numbers) {
        const num = parseInt(numStr)
        if (num >= 1 && num <= 12) {
          month = num
          break
        }
      }
    }
  }

  return { month, year }
}

function matchAny(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw))
}

async function replyText(replyToken: string, message: string) {
  if (env.MOCK_MODE) {
    console.log(`[Mock ${BOT_NAME}] Reply:`, message)
    await logReplyToDb(replyToken, message).catch(err => console.error('[Mock logReplyToDb error]', err))
    return
  }
  try {
    await lineClient.replyMessage(replyToken, {
      type: 'text',
      text: message,
      quickReply: quickReplyItems
    })
  } catch (err: any) {
    console.error(`[${BOT_NAME} replyText Error]`, err)
    if (err.response?.data) {
      console.error(`[${BOT_NAME} replyText Error Details]`, JSON.stringify(err.response.data))
    }
  }
}

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

function getCarStatusDisplay(
  statusName: string,
  statusCode: string,
  subStatusName?: string,
  subStatusCode?: string
): string {
  const emojiMap: Record<string, string> = {
    PRODUCTION: '🏭',
    AVAILABLE: '✅',
    ON_RENT: '🚗',
    MAINTENANCE: '🔧',
    REPLACEMENT: '🔄',
    WAITING_FOR_GR: '📦',
  }
  const emoji = emojiMap[statusCode || ''] || '📋'
  const name = subStatusName || statusName || statusCode || '-'
  if (statusCode && subStatusCode && statusCode !== subStatusCode) {
    return `${emoji} ${name} (${statusCode} / ${subStatusCode})`
  }
  if (statusCode) {
    return `${emoji} ${name} (${statusCode})`
  }
  return `${emoji} ${name}`
}

async function trySendVehicleFlexMessage(
  replyToken: string,
  registerNo: string,
  aiResponse: string,
  appUrl: string
): Promise<boolean> {
  let flexContents: any = null
  try {
    const pool = await getMSSQLPool()
    if (!pool) return false

    // Normalize identifier to remove spaces and dashes
    const normalized = registerNo.replace(/[\s\-]/g, '')

    let query = `
      SELECT TOP 1
        i.InventoryItemID, i.VinNo, i.RegisterNo, i.Model,
        i.Status AS StatusCode, i.StatusType, i.Project, i.ProjectType,
        s.DescriptionStatus AS StatusName,
        sub.DescriptionStatus AS SubStatusName
      FROM dbo.EV_InventoryItem i
      LEFT JOIN dbo.EV_MsStatus s ON i.Status = s.StatusCode
      LEFT JOIN dbo.EV_MsSubStatus sub ON i.StatusType = sub.StatusCode AND sub.Type LIKE 'STATUS_TYPE_%'
      WHERE i.IsActive = 1 AND (
        i.RegisterNo = @exact
        OR i.VinNo = @exact
        OR REPLACE(REPLACE(i.RegisterNo, ' ', ''), '-', '') = @normalized
        OR REPLACE(REPLACE(i.VinNo, ' ', ''), '-', '') = @normalized
    `

    const request = pool.request()
      .input('exact', sql.NVarChar, registerNo)
      .input('normalized', sql.NVarChar, normalized)

    if (registerNo.length >= 4) {
      query += `
        OR i.RegisterNo LIKE @like
        OR i.VinNo LIKE @like
      `
      request.input('like', sql.NVarChar, `%${registerNo}%`)
    }

    query += `)`

    const carResult = await request.query(query)

    if (carResult.recordset.length === 0) return false
    const car = carResult.recordset[0]
    const statusCode = car.StatusCode

    if (statusCode !== 'MAINTENANCE' && statusCode !== 'ON_RENT') {
      return false
    }

    const cleanedText = aiResponse
      .replace(/(?:\n\r?|\r)?(?:🔗\s*)?(?:ดูเพิ่มเติม|ดูเพิ่มเติมได้ที่นี่|ดูข้อมูลเพิ่มเติม)[:\s]*(?:https?:\/\/[^\s]+|\/vehicle\/[^\s]+)/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    flexContents = null
    if (statusCode === 'MAINTENANCE') {
      const maintResult = await pool.request()
        .input('inventoryItemId', sql.Int, car.InventoryItemID)
        .query(`
           SELECT TOP 1 
             m.MaintenanceItemID, 
             m.IssueTitle, 
             m.CarStatusCode, 
             m.ServiceLocationCode, 
             m.ReportDate, 
             m.CreateDate, 
             m.IncidentDate,
             ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
           FROM dbo.EV_MaintenanceItem m
           LEFT JOIN dbo.EV_User u ON m.CreateUserID = u.UserID
           WHERE m.InventoryItemID = @inventoryItemId AND m.IsActive = 1
           ORDER BY m.ReportDate DESC
        `)
      const maint = maintResult.recordset[0] || {}

      // Query replacement car if exists
      let replacement: any = null
      if (maint.MaintenanceItemID) {
        const replResult = await pool.request()
          .input('maintId', sql.Int, maint.MaintenanceItemID)
          .query(`
            SELECT TOP 1 r.VinNo, i.RegisterNo AS ReplRegisterNo, r.ReplacementStartDate, r.Location
            FROM dbo.EV_ReplacementItem r
            LEFT JOIN dbo.EV_InventoryItem i ON r.VinNo = i.VinNo
            WHERE r.MaintenanceItemID = @maintId AND r.IsActive = 1
            ORDER BY r.ReplacementStartDate DESC
          `)
        replacement = replResult.recordset[0] || null
      }

      // Query follow-up logs if exist
      let followUps: any[] = []
      if (maint.MaintenanceItemID) {
        const followUpResult = await pool.request()
          .input('maintId', sql.Int, maint.MaintenanceItemID)
          .query(`
            SELECT f.FollowUpDate, f.FollowUpDetail, f.CreateDate, f.CreateUserID,
                   ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreateUserName
            FROM dbo.EV_MaintenanceFollowUp f
            LEFT JOIN dbo.EV_User u ON f.CreateUserID = u.UserID
            WHERE f.MaintenanceItemID = @maintId AND f.IsActive = 1
            ORDER BY f.FollowUpDate DESC, f.CreateDate DESC
          `)
        followUps = followUpResult.recordset || []
      }

      const usageStatus =
        maint.CarStatusCode === 'STILL_WORK'
          ? '🟢 ยังใช้งานได้ (ยังวิ่งอยู่)'
          : maint.CarStatusCode === 'IN_MAINTENANCE'
          ? '🔴 งดใช้งาน (อยู่ระหว่างซ่อม)'
          : maint.CarStatusCode === 'WAITING_FOR_MAINTENANCE'
          ? '🟡 งดใช้งาน (รอเข้าซ่อม)'
          : maint.CarStatusCode === 'COMPLETE'
          ? '🟢 ซ่อมเสร็จสิ้น (ใช้งานได้)'
          : maint.CarStatusCode || '-'

      const projectDisplay = (car.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (car.ProjectType || '-')
      const currentStatus = getCarStatusDisplay(car.StatusName, car.StatusCode, car.SubStatusName, car.StatusType)

      // Build body rows
      const bodyContents: any[] = [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'VIN', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: car.VinNo || '-', color: '#111827', size: 'xs', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'รุ่น/โครงการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${car.Model || '-'} (${projectDisplay})`, color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'อาการ', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: maint.IssueTitle || '-', color: '#111827', size: 'xs', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'การใช้งาน/อู่', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${usageStatus} / ${maint.ServiceLocationCode || '-'}`, color: '#111827', size: 'xs', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'วันเกิดเหตุ/บันทึก', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(maint.IncidentDate)} / ${formatDateTh(maint.CreateDate)}`, color: '#111827', size: 'xs', flex: 5 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'วันที่แจ้ง/ผู้แจ้ง', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: `${formatDateTh(maint.ReportDate)} (${maint.CreatorName || '-'})`, color: '#111827', size: 'xs', flex: 5 }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'xs', flex: 3 },
            { type: 'text', text: currentStatus, color: '#dc2626', size: 'xs', weight: 'bold', flex: 5, wrap: true }
          ]
        }
      ]

      // Add replacement car section if exists
      if (replacement) {
        bodyContents.push(
          {
            type: 'separator',
            margin: 'md',
            color: '#e5e7eb'
          },
          {
            type: 'text',
            text: '🚙 รถทดแทน',
            weight: 'bold',
            size: 'xs',
            color: '#059669',
            margin: 'sm'
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'xs',
            contents: [
              { type: 'text', text: 'VIN', color: '#6b7280', size: 'xs', flex: 3 },
              { type: 'text', text: replacement.VinNo || '-', color: '#111827', size: 'xs', flex: 5, wrap: true }
            ]
          }
        )
        if (replacement.ReplRegisterNo) {
          bodyContents.push({
            type: 'box',
            layout: 'horizontal',
            margin: 'xs',
            contents: [
              { type: 'text', text: 'ทะเบียน', color: '#6b7280', size: 'xs', flex: 3 },
              { type: 'text', text: replacement.ReplRegisterNo, color: '#111827', size: 'xs', flex: 5, wrap: true }
            ]
          })
        }
      }

      const mainBubble = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#dc2626',
          paddingStart: '16px',
          paddingEnd: '16px',
          paddingTop: '12px',
          paddingBottom: '12px',
          contents: [
            {
              type: 'text',
              text: '🔧 ข้อมูลงานซ่อมรถ',
              color: '#ffffff',
              weight: 'bold',
              size: 'md'
            },
            {
              type: 'text',
              text: car.RegisterNo ? `ทะเบียน: ${car.RegisterNo}` : `เลขตัวถัง (VIN): ${car.VinNo}`,
              color: '#fee2e2',
              size: 'xs',
              margin: 'xs',
              weight: 'bold'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingStart: '16px',
          paddingEnd: '16px',
          paddingTop: '10px',
          paddingBottom: '10px',
          spacing: 'sm',
          contents: bodyContents
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingStart: '16px',
          paddingEnd: '16px',
          paddingTop: '8px',
          paddingBottom: '12px',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#dc2626',
              height: 'sm',
              action: {
                type: 'uri',
                label: 'ดูรายละเอียดเพิ่มเติม',
                uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${car.RegisterNo || car.VinNo}`)}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              height: 'sm',
              action: {
                type: 'uri',
                label: '🔧 ดูรายการซ่อมทั้งหมด',
                uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent('/maintenance')}`
              }
            }
          ]
        }
      }

      if (followUps.length > 0) {
        const timelineRows: any[] = []
        const maxTimelineItems = 4
        const itemsToShow = followUps.slice(0, maxTimelineItems)

        itemsToShow.forEach((f, idx) => {
          const isLast = idx === itemsToShow.length - 1 && followUps.length <= maxTimelineItems
          timelineRows.push({
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '16px',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    width: '8px',
                    height: '8px',
                    cornerRadius: '4px',
                    backgroundColor: '#dc2626',
                    contents: []
                  },
                  ...(!isLast ? [{
                    type: 'box',
                    layout: 'vertical',
                    width: '2px',
                    flex: 1,
                    backgroundColor: '#cbd5e1',
                    margin: 'xs',
                    contents: []
                  }] : [])
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  {
                    type: 'text',
                    text: `${formatDateTh(f.FollowUpDate || f.CreateDate)} - โดย ${f.CreateUserName || `User ${f.CreateUserID || '-'}`}`,
                    size: 'xxs',
                    color: '#6b7280',
                    weight: 'bold'
                  },
                  {
                    type: 'text',
                    text: f.FollowUpDetail || '-',
                    size: 'xs',
                    color: '#111827',
                    weight: 'bold',
                    wrap: true,
                    margin: 'xs'
                  }
                ]
              }
            ]
          })
        })

        if (followUps.length > maxTimelineItems) {
          timelineRows.push({
            type: 'text',
            text: `... และประวัติการติดตามอีก ${followUps.length - maxTimelineItems} รายการ`,
            size: 'xxs',
            color: '#9ca3af',
            align: 'center',
            margin: 'sm'
          })
        }

        const timelineBubble = {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#059669',
            paddingStart: '16px',
            paddingEnd: '16px',
            paddingTop: '12px',
            paddingBottom: '12px',
            contents: [
              {
                type: 'text',
                text: '📋 ประวัติการติดตาม (Timeline)',
                color: '#ffffff',
                weight: 'bold',
                size: 'md'
              },
              {
                type: 'text',
                text: car.RegisterNo ? `ทะเบียน: ${car.RegisterNo}` : `เลขตัวถัง (VIN): ${car.VinNo}`,
                color: '#d1fae5',
                size: 'xs',
                margin: 'xs',
                weight: 'bold'
              }
            ]
          },
          body: {
            type: 'box',
            layout: 'vertical',
            paddingStart: '16px',
            paddingEnd: '16px',
            paddingTop: '10px',
            paddingBottom: '10px',
            spacing: 'md',
            contents: timelineRows
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            paddingStart: '16px',
            paddingEnd: '16px',
            paddingTop: '8px',
            paddingBottom: '12px',
            contents: [
              {
                type: 'button',
                style: 'primary',
                color: '#059669',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: 'ดูรายละเอียดทั้งหมด',
                  uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${car.RegisterNo || car.VinNo}`)}`
                }
              }
            ]
          }
        }

        flexContents = {
          type: 'carousel',
          contents: [
            mainBubble,
            timelineBubble
          ]
        }
      } else {
        flexContents = mainBubble
      }
    } else if (statusCode === 'ON_RENT') {
      const rentResult = await pool.request()
        .input('inventoryItemId', sql.Int, car.InventoryItemID)
        .query(`
          SELECT TOP 1 
            r.ContractNo, r.FirstName, r.LastName, r.ReleaseDate, r.ExpectedReleaseDate, r.ContractType,
            ISNULL(NULLIF(u.FirstName, ''), u.UserName) AS CreatorName
          FROM dbo.EV_RentItem r
          LEFT JOIN dbo.EV_User u ON r.CreateUserID = u.UserID
          WHERE r.InventoryItemID = @inventoryItemId AND r.IsActive = 1
          ORDER BY r.ReleaseDate DESC, r.ExpectedReleaseDate DESC
        `)
      const rent = rentResult.recordset[0] || {}

      const customerName = rent.FirstName
        ? `${rent.FirstName} ${rent.LastName ? '***' : ''}`.trim()
        : '-'

      const projectDisplay = (car.ProjectType || '').toLowerCase() === 'taxi' ? 'EV7' : (car.ProjectType || '-')
      const currentStatus = getCarStatusDisplay(car.StatusName, car.StatusCode, car.SubStatusName, car.StatusType)

      flexContents = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#059669',
          paddingStart: '16px',
          paddingEnd: '16px',
          paddingTop: '12px',
          paddingBottom: '12px',
          contents: [
            {
              type: 'text',
              text: '🚗 ข้อมูลการปล่อยรถ',
              color: '#ffffff',
              weight: 'bold',
              size: 'md'
            },
            {
              type: 'text',
              text: car.RegisterNo ? `ทะเบียน: ${car.RegisterNo}` : `เลขตัวถัง (VIN): ${car.VinNo}`,
              color: '#d1fae5',
              size: 'xs',
              margin: 'xs',
              weight: 'bold'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingStart: '16px',
          paddingEnd: '16px',
          paddingTop: '10px',
          paddingBottom: '10px',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'VIN', color: '#6b7280', size: 'xs', flex: 3 },
                { type: 'text', text: car.VinNo || '-', color: '#111827', size: 'xs', flex: 5, wrap: true }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'รุ่น/โครงการ', color: '#6b7280', size: 'xs', flex: 3 },
                { type: 'text', text: `${car.Model || '-'} (${projectDisplay})`, color: '#111827', size: 'xs', weight: 'bold', flex: 5, wrap: true }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'ลูกค้า/สัญญา', color: '#6b7280', size: 'xs', flex: 3 },
                { type: 'text', text: `${customerName} (${rent.ContractNo || '-'})`, color: '#111827', size: 'xs', flex: 5, wrap: true }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'วันส่งมอบ/ผู้ส่ง', color: '#6b7280', size: 'xs', flex: 3 },
                { type: 'text', text: `${formatDateTh(rent.ReleaseDate || rent.ExpectedReleaseDate)} (${rent.CreatorName || '-'})`, color: '#111827', size: 'xs', flex: 5 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'ประเภทสัญญา', color: '#6b7280', size: 'xs', flex: 3 },
                { type: 'text', text: rent.ContractType || '-', color: '#111827', size: 'xs', flex: 5 }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'sm',
              contents: [
                { type: 'text', text: 'สถานะปัจจุบัน', color: '#6b7280', size: 'xs', flex: 3 },
                { type: 'text', text: currentStatus, color: car.StatusType === 'ON_RENT_MAINTENANCE' ? '#dc2626' : '#2563eb', size: 'xs', weight: 'bold', flex: 5, wrap: true }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingStart: '16px',
          paddingEnd: '16px',
          paddingTop: '8px',
          paddingBottom: '12px',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#059669',
              height: 'sm',
              action: {
                type: 'uri',
                label: 'ดูรายละเอียดเพิ่มเติม',
                uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${car.RegisterNo || car.VinNo}`)}`
              }
            }
          ]
        }
      }
    }

    if (flexContents) {
      if (env.MOCK_MODE) {
        console.log(`[Mock ${BOT_NAME}] Sending Flex Message for ${car.RegisterNo || car.VinNo}:`, JSON.stringify(flexContents))
        return true
      }

      await lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: cleanedText
        },
        {
          type: 'flex',
          altText: `ข้อมูลรถ ${car.RegisterNo || car.VinNo}`,
          contents: flexContents,
          quickReply: quickReplyItems
        }
      ])
      return true
    }

    return false
  } catch (err: any) {
    console.error('[trySendVehicleFlexMessage Error]', err)
    if (flexContents) {
      console.error('[trySendVehicleFlexMessage Payload]', JSON.stringify(flexContents))
    }
    if (err.response?.data) {
      console.error('[trySendVehicleFlexMessage Error Details]', JSON.stringify(err.response.data))
    }
    return false
  }
}

async function trySendTaskFlexMessage(
  replyToken: string,
  aiResponse: string,
  vehicleRef?: string,
  assigneeName?: string
): Promise<boolean> {
  try {
    const { getPendingTasks } = await import('@/lib/task-service')
    const tasks = await getPendingTasks(vehicleRef, assigneeName)
    if (!tasks || tasks.length === 0) {
      return false
    }

    const maxTasks = 5
    const displayedTasks = tasks.slice(0, maxTasks)

    const taskRows = displayedTasks.map(task => {
      const dueDateStr = task.dueDate ? formatDateTh(task.dueDate) : 'ไม่ระบุกำหนดเสร็จ'
      const assignee = task.assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ'
      const vehicleDisplay = task.vehicleRef ? `🚗 ${task.vehicleRef}` : '📂 ทั่วไป'
      
      return {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        backgroundColor: '#f8fafc',
        cornerRadius: 'md',
        margin: 'md',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `📌 ID #${task.id}`,
                size: 'xs',
                weight: 'bold',
                color: '#FF6D00',
                flex: 3
              },
              {
                type: 'text',
                text: vehicleDisplay,
                size: 'xs',
                weight: 'bold',
                color: '#3b82f6',
                align: 'end',
                flex: 7
              }
            ]
          },
          {
            type: 'text',
            text: task.taskDetail,
            size: 'sm',
            color: '#1e293b',
            weight: 'bold',
            wrap: true
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `👤 ${assignee}`,
                size: 'xs',
                color: '#64748b',
                flex: 6
              },
              {
                type: 'text',
                text: `📅 ${dueDateStr}`,
                size: 'xs',
                color: '#64748b',
                align: 'end',
                flex: 6
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'สถานะ', color: '#6b7280', size: 'xs', flex: 3 },
              { type: 'text', text: '⏳ รอดำเนินการ (PENDING)', color: '#FF6D00', size: 'xs', weight: 'bold', flex: 9 }
            ]
          },
          {
            type: 'button',
            style: 'secondary',
            color: '#FF6D00',
            height: 'sm',
            action: {
              type: 'uri',
              label: '🔍 รายละเอียด',
              uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/tasks?id=${task.id}`)}`
            }
          }
        ]
      }
    })

    if (tasks.length > maxTasks) {
      taskRows.push({
        type: 'text',
        text: `... และมีงานค้างอื่นๆ อีก ${tasks.length - maxTasks} รายการ`,
        size: 'xs',
        color: '#64748b',
        align: 'center',
        margin: 'md'
      } as any)
    }

    const flexContents = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#FFB300',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: vehicleRef 
              ? `📋 งานค้างรถ ${vehicleRef}` 
              : assigneeName 
                ? `📋 งานค้างของ @${assigneeName}` 
                : '📋 รายการภารกิจ & โน้ตทีม',
            weight: 'bold',
            size: 'lg',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: `รายการงานค้างที่ยังไม่เสร็จสิ้น (${tasks.length} รายการ)`,
            size: 'xs',
            color: '#FFE082',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        contents: taskRows
      }
    }

    if (env.MOCK_MODE) {
      console.log(`[Mock ${BOT_NAME}] Sending Task Flex Message:`, JSON.stringify(flexContents, null, 2))
      return true
    }

    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: aiResponse
      },
      {
        type: 'flex',
        altText: '📋 รายการงานค้าง',
        contents: flexContents as any,
        quickReply: quickReplyItems
      }
    ])

    return true
  } catch (err) {
    console.error('[trySendTaskFlexMessage Error]', err)
    return false
  }
}

async function trySendSingleTaskFlexMessage(
  replyToken: string,
  aiResponse: string,
  taskId: number
): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const task = await prisma.taskNote.findUnique({
      where: { id: taskId }
    })
    if (!task) {
      return false
    }

    const dueDateStr = task.dueDate ? formatDateTh(task.dueDate) : 'ไม่ระบุกำหนดเสร็จ'
    const assignee = task.assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ'
    const vehicleDisplay = task.vehicleRef ? `🚗 ${task.vehicleRef}` : '📂 ทั่วไป'
    
    const statusText = task.status === 'COMPLETED' ? '✅ เสร็จสิ้น (COMPLETED)' : '⏳ รอดำเนินการ (PENDING)'
    const statusColor = task.status === 'COMPLETED' ? '#059669' : '#FF6D00'

    const flexContents = {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#FFB300',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: '📋 รายละเอียดภารกิจ',
            weight: 'bold',
            size: 'lg',
            color: '#ffffff'
          },
          {
            type: 'text',
            text: `รหัสภารกิจ ID #${task.id}`,
            size: 'xs',
            color: '#FFE082',
            margin: 'xs'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'md',
        spacing: 'sm',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            paddingAll: 'md',
            backgroundColor: '#f8fafc',
            cornerRadius: 'md',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: `📌 ID #${task.id}`,
                    size: 'xs',
                    weight: 'bold',
                    color: '#FF6D00',
                    flex: 3
                  },
                  {
                    type: 'text',
                    text: vehicleDisplay,
                    size: 'xs',
                    weight: 'bold',
                    color: '#3b82f6',
                    align: 'end',
                    flex: 7
                  }
                ]
              },
              {
                type: 'text',
                text: task.taskDetail,
                size: 'sm',
                color: '#1e293b',
                weight: 'bold',
                wrap: true
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  {
                    type: 'text',
                    text: `👤 ${assignee}`,
                    size: 'xs',
                    color: '#64748b',
                    flex: 6
                  },
                  {
                    type: 'text',
                    text: `📅 ${dueDateStr}`,
                    size: 'xs',
                    color: '#64748b',
                    align: 'end',
                    flex: 6
                  }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                contents: [
                  { type: 'text', text: 'สถานะ', color: '#6b7280', size: 'xs', flex: 3 },
                  { type: 'text', text: statusText, color: statusColor, size: 'xs', weight: 'bold', flex: 9 }
                ]
              },
              {
                type: 'button',
                style: 'secondary',
                color: '#FF6D00',
                height: 'sm',
                action: {
                  type: 'uri',
                  label: '🔍 รายละเอียด',
                  uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/tasks?id=${task.id}`)}`
                }
              }
            ]
          }
        ]
      }
    }

    if (env.MOCK_MODE) {
      console.log(`[Mock ${BOT_NAME}] Sending Single Task Flex Message:`, JSON.stringify(flexContents, null, 2))
      return true
    }

    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: aiResponse
      },
      {
        type: 'flex',
        altText: `รายละเอียดงาน #${task.id}`,
        contents: flexContents as any,
        quickReply: quickReplyItems
      }
    ])

    return true
  } catch (err) {
    console.error('[trySendSingleTaskFlexMessage Error]', err)
    return false
  }
}

// ─── Registration & Follow Handlers ────────────────────────────────

async function safeUpsert(userId: string, displayName: string, pictureUrl: string | null, statusMessage?: string | null) {
  try {
    await prisma.lineRegistration.upsert({
      where: { lineUserId: userId },
      update: {
        displayName,
        pictureUrl,
        ...(statusMessage !== undefined ? { statusMessage } : {}),
        isActive: true,
      },
      create: {
        lineUserId: userId,
        displayName,
        pictureUrl,
        ...(statusMessage !== undefined ? { statusMessage } : {}),
        system: 'EV7',
      },
    })
    console.log(`[DB] Successfully registered/updated Line user ${userId} in PostgreSQL.`)
  } catch (err) {
    console.error(`[DB Error] Failed to write Line user to PostgreSQL:`, err)
    if (!env.MOCK_MODE) {
      throw err
    }
    console.warn(`[Mock Mode DB Warning] PostgreSQL write bypassed.`)
  }
}

async function handleFollow(userId: string) {
  try {
    let profile: Partial<import('@line/bot-sdk').Profile> & { displayName: string } = {
      displayName: 'Mock User',
      pictureUrl: 'https://via.placeholder.com/200',
      statusMessage: 'Hello EV7!'
    }

    if (!env.MOCK_MODE) {
      profile = await lineClient.getProfile(userId)
    }

    await safeUpsert(userId, profile.displayName, profile.pictureUrl ?? null, profile.statusMessage ?? null)

    await replyOrPush(
      userId,
      `สวัสดีค่า ${profile.displayName}~ 🧈✨\n${BOT_NAME} ยินดีต้อนรับสู่ระบบ EV7 Tracking!\n\nพิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมด\nหรือพิมพ์ "ลงทะเบียน" เพื่อเข้าใช้งานระบบค่ะ 💛`
    )
  } catch (error) {
    console.error('[handleFollow Error]', error)
  }
}

async function handleRegister(userId: string, replyToken: string) {
  try {
    let profile: Partial<import('@line/bot-sdk').Profile> & { displayName: string } = {
      displayName: 'Mock User',
      pictureUrl: 'https://via.placeholder.com/200',
      statusMessage: 'Hello EV7!'
    }

    if (!env.MOCK_MODE) {
      profile = await lineClient.getProfile(userId)
    }

    let existing = null
    try {
      existing = await prisma.lineRegistration.findUnique({
        where: { lineUserId: userId },
      })
    } catch (dbErr) {
      console.warn(`[DB Error] Failed to query existing user, assuming none.`, dbErr)
    }

    if (existing?.isActive) {
      await replyText(
        replyToken,
        `✅ ${profile.displayName} ลงทะเบียนไว้แล้วค่ะ\nสามารถใช้งานระบบ EV7 Tracking ได้เลย\n\nพิมพ์ "เมนู" เพื่อดูคำสั่ง ${BOT_NAME} ได้นะคะ~ 🧈💛`
      )
      return
    }

    await safeUpsert(userId, profile.displayName, profile.pictureUrl ?? null)

    const responseContent = {
      type: 'flex' as const,
      altText: `${BOT_NAME}: ลงทะเบียนสำเร็จ!`,
      contents: {
        type: 'bubble' as const,
        hero: {
          type: 'image' as const,
          url: profile.pictureUrl ?? 'https://via.placeholder.com/800x400',
          size: 'full' as const,
          aspectRatio: '2:1' as const,
          aspectMode: 'cover' as const,
        },
        body: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'text' as const,
              text: `🧈 ${BOT_NAME}: ลงทะเบียนสำเร็จ!`,
              weight: 'bold' as const,
              size: 'xl' as const,
            },
            {
              type: 'text' as const,
              text: `ชื่อ: ${profile.displayName}`,
              size: 'md' as const,
              margin: 'md' as const,
              color: '#555555',
            },
            {
              type: 'text' as const,
              text: `ระบบ: EV7 Tracking`,
              size: 'sm' as const,
              color: '#888888',
            },
            {
              type: 'text' as const,
              text: `พิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมดนะคะ~ 💛`,
              size: 'sm' as const,
              margin: 'md' as const,
              color: '#888888',
            },
          ],
        },
      },
    }

    if (!env.MOCK_MODE) {
      await lineClient.replyMessage(replyToken, { ...responseContent, quickReply: quickReplyItems })
    } else {
      console.log(`[Mock ${BOT_NAME}] Replied to user ${userId} with registration success Flex message.`)
    }
  } catch (error) {
    console.error('[handleRegister Error]', error)
  }
}

async function replyOrPush(userId: string, message: string) {
  if (env.MOCK_MODE) {
    console.log(`[Mock ${BOT_NAME}] Push to ${userId}:`, message)
    return
  }
  try {
    await lineClient.pushMessage(userId, { type: 'text', text: message })
  } catch (err) {
    console.error(`[${BOT_NAME} pushMessage Error]`, err)
  }
}

// ─── Group & Chat Logging Functions ─────────────────────────────────

async function saveGroupToDb(groupId: string, type: 'group' | 'room') {
  try {
    let groupName: string | null = null
    if (!env.MOCK_MODE && type === 'group') {
      try {
        const summary = await lineClient.getGroupSummary(groupId)
        groupName = summary.groupName || null
      } catch { /* ignore - may not have permission */ }
    }

    await prisma.lineGroup.upsert({
      where: { groupId },
      update: {
        isActive: true,
        ...(groupName ? { groupName } : {}),
      },
      create: {
        groupId,
        groupName,
        groupType: type,
      },
    })
    console.log(`[DB] Saved ${type} ${groupId} (${groupName || 'unknown'}) to database`)
  } catch (err) {
    console.error(`[DB Error] Failed to save group ${groupId}:`, err)
  }
}

async function deactivateGroupInDb(groupId: string) {
  try {
    await prisma.lineGroup.updateMany({
      where: { groupId },
      data: { isActive: false },
    })
    console.log(`[DB] Deactivated group ${groupId}`)
  } catch (err) {
    console.error(`[DB Error] Failed to deactivate group ${groupId}:`, err)
  }
}
