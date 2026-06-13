import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lineClient, lineConfig } from '@/lib/line'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { askButter } from '@/lib/gemini'
import type { WebhookEvent } from '@line/bot-sdk'
import { getMSSQLPool, sql } from '@/lib/mssql'

export const dynamic = 'force-dynamic';

const BOT_NAME = 'Butter'
const BOT_TRIGGERS = ['butter', 'บัตเตอร์', 'บัทเตอร์', 'butter,', 'butter:']

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

    await Promise.allSettled(events.map(event => handleEvent(event, appUrl)))

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
      // Check if message starts with bot trigger
      const trigger = BOT_TRIGGERS.find(t => rawLower.startsWith(t))
      if (!trigger) {
        // ไม่ได้เรียก Butter → ไม่ตอบ (เงียบ)
        return
      }

      // Strip bot name prefix and process the rest
      const strippedText = rawText.substring(trigger.length).trim()

      // ถ้าพิมพ์แค่ "butter" เฉยๆ → ทักทาย
      if (!strippedText) {
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

// ─── Butter Chat Handler ───────────────────────────────────────────

async function handleChat(text: string, lower: string, userId: string, replyToken: string, appUrl: string, chatSourceType: string = 'user', chatSourceId: string | null = null) {
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
    await replyText(
      replyToken,
      `🧈 เมนู ${BOT_NAME}\n━━━━━━━━━━━━━━━\n🤖 ถามอะไรก็ได้! เช่น:\n   💬 "วันนี้ปล่อยรถกี่คัน"\n   💬 "ซ่อมค้างกี่คัน"\n   💬 "ค้นหา VIN LNADH..."\n━━━━━━━━━━━━━━━\n📊 "สถานะ" — สรุปส่งมอบ & ซ่อมวันนี้\n📅 "สรุปเดือน" — สรุปรายเดือน\n📋 "ลงทะเบียน" — ลงทะเบียนเข้าระบบ\n🔗 "dashboard" — ลิงก์ Dashboard\n━━━━━━━━━━━━━━━\n${BOT_NAME} ใช้ AI ตอบคำถามได้อัจฉริยะ~ 💛`
    )
    return
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
  if (matchAny(lower, ['รายงานประจำวัน', 'สรุปรายงาน', 'สรุปประจำวัน', 'ข่าวเช้า', 'รายงานวัน'])) {
    try {
      // Try to extract date from message (DD/MM/YYYY or YYYY-MM-DD)
      let reportDate: string | null = null
      const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
      if (dateMatch) {
        const [, d, m, y] = dateMatch
        // If year > 2500 it's Buddhist Era
        const year = parseInt(y) > 2500 ? parseInt(y) - 543 : parseInt(y)
        reportDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
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

      const { getPortfolioSummary, getDeliveryByDate, getRepairDailySummary } = await import('@/lib/bot-queries')
      const [portfolio, delivery, repairDaily] = await Promise.all([
        getPortfolioSummary(),
        getDeliveryByDate({ date: reportDate }),
        getRepairDailySummary(reportDate),
      ])

      if ('error' in portfolio) {
        await replyText(replyToken, `❌ ดึงข้อมูลไม่สำเร็จค่ะ: ${portfolio.error}`)
        return
      }

      const fmt = (n: number) => n.toLocaleString('en-US')
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
              { type: 'text', text: 'ทั้งหมด', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(deliverySummary.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
              { type: 'text', text: 'สำเร็จ', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(deliverySummary.pending), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'รอดำเนินการ', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ]},
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
        })
      }
      return
    } catch (err: any) {
      console.error('[Daily Report Flex Error]', err)
      await replyText(replyToken, `❌ สร้างรายงานไม่สำเร็จค่ะ: ${err.message}\n\nลองใหม่อีกครั้งนะคะ 🧈`)
      return
    }
  }

  // ─── AI-Powered Response (Gemini) ──────────────────────────────
  // ทุกข้อความที่ไม่ตรงกับ keyword ข้างบน → ส่งให้ AI ตอบ
  try {
    console.log(`[${BOT_NAME} AI] Processing: "${text}"`)

    // Load recent chat history for context (up to 5 messages)
    const targetSourceId = chatSourceId || userId
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

    const aiResponse = await askButter(text, history)
    console.log(`[${BOT_NAME} AI] Response: "${aiResponse.substring(0, 200)}..."`)

    // ─── Log chat to database ────────────────────────────────────
    let userName: string | undefined
    try {
      if (!env.MOCK_MODE && userId) {
        const profile = await lineClient.getProfile(userId)
        userName = profile.displayName
      }
    } catch { /* ignore profile errors */ }
    logChatToDb(chatSourceType, chatSourceId || userId, userName, text, aiResponse)
      .catch(err => console.error('[logChat Error]', err))

    // ─── Try to detect a vehicle identifier for Flex Message ───
    let vehicleIdentifier: string | null = null
    let flexSent = false

    // Strategy 1: Detect VIN pattern from user's original message (17-char VIN starting with L)
    const vinFromUser = text.match(/\b(L[A-Z0-9]{16})\b/i)
    if (vinFromUser) {
      vehicleIdentifier = vinFromUser[1].toUpperCase()
      console.log(`[${BOT_NAME}] Detected VIN from user input: ${vehicleIdentifier}`)
    }

    // Strategy 2: Extract from /vehicle/xxx link in AI response (broad regex)
    if (!vehicleIdentifier) {
      const linkMatch = aiResponse.match(/\/vehicle\/([^\s"')\]]+)/i)
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

function matchAny(text: string, keywords: string[]): boolean {
  return keywords.some(kw => text.includes(kw))
}

async function replyText(replyToken: string, message: string) {
  if (env.MOCK_MODE) {
    console.log(`[Mock ${BOT_NAME}] Reply:`, message)
    return
  }
  try {
    await lineClient.replyMessage(replyToken, { type: 'text', text: message })
  } catch (err) {
    console.error(`[${BOT_NAME} replyText Error]`, err)
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

async function trySendVehicleFlexMessage(
  replyToken: string,
  registerNo: string,
  aiResponse: string,
  appUrl: string
): Promise<boolean> {
  try {
    const pool = await getMSSQLPool()
    if (!pool) return false

    // Query inventory item
    const carResult = await pool.request()
      .input('identifier', sql.NVarChar, `%${registerNo}%`)
      .query(`
        SELECT TOP 1 InventoryItemID, VinNo, RegisterNo, Model, Status AS StatusCode, StatusType, Project, ProjectType
        FROM dbo.EV_InventoryItem
        WHERE (RegisterNo LIKE @identifier OR VinNo LIKE @identifier) AND IsActive = 1
      `)

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

    let flexContents: any = null
    if (statusCode === 'MAINTENANCE') {
      const maintResult = await pool.request()
        .input('inventoryItemId', sql.Int, car.InventoryItemID)
        .query(`
           SELECT TOP 1 MaintenanceItemID, IssueTitle, ProblemTypeCode, ServiceLocationCode, MaintenanceStartDate, MaintenanceFinishDate, CarStatusCode, ReportDate
           FROM dbo.EV_MaintenanceItem
           WHERE InventoryItemID = @inventoryItemId AND IsActive = 1
           ORDER BY ReportDate DESC
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

      // Map CarStatusCode to Thai
      const statusMap: Record<string, string> = {
        'IN_MAINTENANCE': '🔧 อยู่ระหว่างการซ่อม',
        'WAITING_FOR_MAINTENANCE': '⏳ รอเข้าซ่อม',
        'STILL_WORK': '🚗 ยังวิ่งอยู่',
        'COMPLETE': '✅ ซ่อมเสร็จแล้ว',
      }
      const carStatusText = statusMap[maint.CarStatusCode] || maint.CarStatusCode || '-'

      // Build body rows
      const bodyContents: any[] = [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: 'VIN', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: car.VinNo || '-', color: '#111827', size: 'xs', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'รุ่น', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: car.Model || '-', color: '#111827', size: 'sm', weight: 'bold', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'สถานะรถ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: carStatusText, color: '#d97706', size: 'sm', weight: 'bold', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'อาการ', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: maint.IssueTitle || '-', color: '#111827', size: 'sm', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'สถานที่ซ่อม', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: maint.ServiceLocationCode || '-', color: '#111827', size: 'sm', flex: 5, wrap: true }
          ]
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'วันที่แจ้งซ่อม', color: '#6b7280', size: 'sm', flex: 3 },
            { type: 'text', text: formatDateTh(maint.ReportDate || maint.MaintenanceStartDate), color: '#111827', size: 'sm', flex: 5 }
          ]
        },
      ]

      // Add replacement car section if exists
      if (replacement) {
        bodyContents.push(
          {
            type: 'separator',
            margin: 'lg',
            color: '#e5e7eb'
          },
          {
            type: 'text',
            text: '🚙 รถทดแทน',
            weight: 'bold',
            size: 'sm',
            color: '#059669',
            margin: 'lg'
          },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'VIN', color: '#6b7280', size: 'sm', flex: 3 },
              { type: 'text', text: replacement.VinNo || '-', color: '#111827', size: 'xs', flex: 5, wrap: true }
            ]
          }
        )
        if (replacement.ReplRegisterNo) {
          bodyContents.push({
            type: 'box',
            layout: 'horizontal',
            margin: 'sm',
            contents: [
              { type: 'text', text: 'ทะเบียน', color: '#6b7280', size: 'sm', flex: 3 },
              { type: 'text', text: replacement.ReplRegisterNo, color: '#111827', size: 'sm', flex: 5, wrap: true }
            ]
          })
        }
      }

      flexContents = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#059669',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: '🔧 ข้อมูลงานซ่อมรถ',
              color: '#ffffff',
              weight: 'bold',
              size: 'lg'
            },
            {
              type: 'text',
              text: car.RegisterNo ? `ทะเบียน: ${car.RegisterNo}` : `VIN: ${car.VinNo}`,
              color: '#d1fae5',
              size: 'sm',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: bodyContents
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#059669',
              action: {
                type: 'uri',
                label: 'ดูรายละเอียดเพิ่มเติม',
                uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent(`/vehicle/${car.RegisterNo || car.VinNo}`)}`
              }
            },
            {
              type: 'button',
              style: 'secondary',
              action: {
                type: 'uri',
                label: '🔧 ดูรายการซ่อมทั้งหมด',
                uri: `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}?path=${encodeURIComponent('/maintenance')}`
              }
            }
          ]
        }
      }
    } else if (statusCode === 'ON_RENT') {
      const rentResult = await pool.request()
        .input('inventoryItemId', sql.Int, car.InventoryItemID)
        .query(`
          SELECT TOP 1 ContractNo, FirstName, LastName, ReleaseDate, ExpectedReleaseDate
          FROM dbo.EV_RentItem
          WHERE InventoryItemID = @inventoryItemId AND IsActive = 1
          ORDER BY ReleaseDate DESC
        `)
      const rent = rentResult.recordset[0] || {}

      const customerName = rent.FirstName
        ? `${rent.FirstName} ${rent.LastName ? '***' : ''}`.trim()
        : '-'

      flexContents = {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#059669',
          paddingAll: '16px',
          contents: [
            {
              type: 'text',
              text: '🚗 ข้อมูลการปล่อยรถ',
              color: '#ffffff',
              weight: 'bold',
              size: 'lg'
            },
            {
              type: 'text',
              text: car.RegisterNo ? `ทะเบียน: ${car.RegisterNo}` : `เลขตัวถัง (VIN): ${car.VinNo}`,
              color: '#d1fae5',
              size: 'sm',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'รุ่น',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: car.Model || '-',
                  color: '#111827',
                  size: 'sm',
                  weight: 'bold',
                  flex: 4,
                  wrap: true
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'สถานะรถ',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: 'ปล่อยรถแล้ว (ON_RENT)',
                  color: '#2563eb',
                  size: 'sm',
                  weight: 'bold',
                  flex: 4
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'ลูกค้า',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: customerName,
                  color: '#111827',
                  size: 'sm',
                  flex: 4,
                  wrap: true
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'เลขสัญญา',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: rent.ContractNo || '-',
                  color: '#111827',
                  size: 'sm',
                  flex: 4,
                  wrap: true
                }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                {
                  type: 'text',
                  text: 'วันส่งมอบจริง',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: formatDateTh(rent.ReleaseDate || rent.ExpectedReleaseDate),
                  color: '#111827',
                  size: 'sm',
                  flex: 4
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#059669',
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
          contents: flexContents
        }
      ])
      return true
    }

    return false
  } catch (err) {
    console.error('[trySendVehicleFlexMessage Error]', err)
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
      await lineClient.replyMessage(replyToken, responseContent)
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

export async function logChatToDb(
  sourceType: string,
  sourceId: string | null,
  userName: string | undefined,
  userMessage: string,
  botReply: string
) {
  try {
    await prisma.chatLog.create({
      data: {
        sourceType,
        sourceId: sourceId || null,
        userName: userName || null,
        userMessage: userMessage.substring(0, 2000),
        botReply: botReply.substring(0, 5000),
      },
    })
  } catch (err) {
    console.error('[DB Error] Failed to log chat:', err)
  }
}
