import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lineClient, lineConfig } from '@/lib/line'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { getMSSQLPool, sql } from '@/lib/mssql'
import type { WebhookEvent } from '@line/bot-sdk'

const BOT_NAME = 'Butter'

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
    const body = await req.text()
    const signature = req.headers.get('x-line-signature') ?? ''

    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const { events }: { events: WebhookEvent[] } = JSON.parse(body)

    await Promise.allSettled(events.map(handleEvent))

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Line Webhook POST Error]', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleEvent(event: WebhookEvent) {
  // Handle follow event (user adds Line OA as friend)
  if (event.type === 'follow') {
    await handleFollow(event.source.userId!)
    return
  }

  // Handle message event
  if (event.type === 'message' && event.message.type === 'text') {
    const text = event.message.text.trim()
    const lower = text.toLowerCase()

    // Registration keywords
    if (lower === 'ลงทะเบียน' || lower === 'register') {
      await handleRegister(event.source.userId!, event.replyToken)
      return
    }

    // All other messages → Butter chat
    await handleChat(text, lower, event.source.userId!, event.replyToken)
    return
  }

  // Handle sticker messages
  if (event.type === 'message' && event.message.type === 'sticker') {
    await replyText(event.replyToken, `${BOT_NAME} เห็นสติกเกอร์น่ารักแล้วนะ 🧈✨`)
    return
  }

  // Handle image messages
  if (event.type === 'message' && (event.message.type === 'image' || event.message.type === 'video')) {
    await replyText(event.replyToken, `${BOT_NAME} รับรูป/วิดีโอไว้แล้วนะคะ 📸 ถ้ามีอะไรให้ช่วยพิมพ์บอกได้เลย~`)
    return
  }

  // Handle join event (bot added to group)
  if (event.type === 'join') {
    await replyText(
      event.replyToken,
      `สวัสดีค่า~ ${BOT_NAME} มาแล้วนะ 🧈✨\nพิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมด\nหรือพิมพ์ "ลงทะเบียน" เพื่อเข้าใช้งานระบบ EV7 ค่ะ 🚗`
    )
  }
}

// ─── Butter Chat Handler ───────────────────────────────────────────

async function handleChat(text: string, lower: string, userId: string, replyToken: string) {
  // Greeting patterns
  if (matchAny(lower, ['สวัสดี', 'หวัดดี', 'ดีครับ', 'ดีค่ะ', 'ดีจ้า', 'hi', 'hello', 'hey', 'butter', 'บัตเตอร์'])) {
    let name = ''
    try {
      if (!env.MOCK_MODE) {
        const profile = await lineClient.getProfile(userId)
        name = ` ${profile.displayName}`
      }
    } catch { /* ignore */ }
    await replyText(
      replyToken,
      `สวัสดีค่า${name}~ 🧈✨\n${BOT_NAME} พร้อมช่วยเหลือแล้วนะคะ!\n\nพิมพ์ "เมนู" เพื่อดูคำสั่งทั้งหมดได้เลย 💛`
    )
    return
  }

  // Menu / Help
  if (matchAny(lower, ['เมนู', 'menu', 'help', 'ช่วย', 'คำสั่ง', 'ทำอะไรได้บ้าง'])) {
    await replyText(
      replyToken,
      `🧈 เมนู ${BOT_NAME}\n━━━━━━━━━━━━━━━\n📊 "สถานะ" — ดูสรุปส่งมอบ & ซ่อมวันนี้\n📅 "สรุปเดือน" — สรุปรายเดือน\n📋 "ลงทะเบียน" — ลงทะเบียนเข้าระบบ\n🔗 "dashboard" — ลิงก์เปิดหน้า Dashboard\n👋 "สวัสดี" — ทักทาย ${BOT_NAME}\n━━━━━━━━━━━━━━━\nพิมพ์คำสั่งไหนก็ได้เลยนะคะ~ 💛`
    )
    return
  }

  // Status / สถานะ — pull live data from SQL Server
  if (matchAny(lower, ['สถานะ', 'status', 'วันนี้', 'today', 'สรุปวันนี้'])) {
    await handleStatusToday(replyToken)
    return
  }

  // Monthly summary
  if (matchAny(lower, ['สรุปเดือน', 'monthly', 'รายเดือน', 'เดือนนี้'])) {
    await handleStatusMonth(replyToken)
    return
  }

  // Dashboard link
  if (matchAny(lower, ['dashboard', 'แดชบอร์ด', 'เว็บ', 'link', 'ลิงก์'])) {
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

  // Default fallback
  await replyText(
    replyToken,
    `${BOT_NAME} ยังไม่เข้าใจคำว่า "${text}" น่ะค่ะ 🤔\n\nลองพิมพ์ "เมนู" เพื่อดูคำสั่งที่ใช้ได้นะคะ~ 🧈💛`
  )
}

// ─── Live Status Handlers ──────────────────────────────────────────

async function handleStatusToday(replyToken: string) {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`)
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`)

    const pool = await getMSSQLPool()
    if (!pool) {
      await replyText(replyToken, `📊 สถานะวันนี้\n━━━━━━━━━━━━━━━\nยังไม่สามารถเชื่อมต่อฐานข้อมูลได้ค่ะ\nลองเปิดดูที่ Dashboard แทนนะคะ 🧈`)
      return
    }

    // Delivery count today
    const deliveryReq = pool.request()
    deliveryReq.input('startDate', sql.DateTime, todayStart)
    deliveryReq.input('endDate', sql.DateTime, todayEnd)
    const deliveryRes = await deliveryReq.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN ReleaseDate IS NULL THEN 1 ELSE 0 END) AS pending
      FROM dbo.EV_RentItem
      WHERE IsActive = 1
        AND (
          (ExpectedReleaseDate >= @startDate AND ExpectedReleaseDate <= @endDate)
          OR (ReleaseDate >= @startDate AND ReleaseDate <= @endDate)
        )
    `)
    const d = deliveryRes.recordset[0] || { total: 0, completed: 0, pending: 0 }

    // Repair count today
    const repairReq = pool.request()
    repairReq.input('startDate', sql.DateTime, todayStart)
    repairReq.input('endDate', sql.DateTime, todayEnd)
    const repairRes = await repairReq.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN CarStatusCode = 'COMPLETE' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'STILL_WORK') THEN 1 ELSE 0 END) AS [open]
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1
        AND (
          (ReportDate >= @startDate AND ReportDate <= @endDate)
          OR (MaintenanceStartDate >= @startDate AND MaintenanceStartDate <= @endDate)
          OR (MaintenanceFinishDate >= @startDate AND MaintenanceFinishDate <= @endDate)
        )
    `)
    const r = repairRes.recordset[0] || { total: 0, closed: 0, open: 0 }

    const thaiDate = today.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })

    await replyText(
      replyToken,
      `📊 สรุปวันนี้ (${thaiDate})\n━━━━━━━━━━━━━━━\n🚗 ส่งมอบรถ: ${d.total} คัน\n   ✅ ปล่อยแล้ว: ${d.completed}\n   ⏳ เตรียมการ: ${d.pending}\n\n🔧 งานซ่อม: ${r.total} รายการ\n   ✅ ซ่อมเสร็จ: ${r.closed}\n   🔴 ค้างซ่อม: ${r.open}\n━━━━━━━━━━━━━━━\nดูรายละเอียดเพิ่มเติมที่ Dashboard นะคะ 🧈💛`
    )
  } catch (error) {
    console.error('[handleStatusToday Error]', error)
    await replyText(replyToken, `${BOT_NAME} ดึงข้อมูลไม่ได้ตอนนี้ค่ะ 😅 ลองอีกทีนะคะ`)
  }
}

async function handleStatusMonth(replyToken: string) {
  try {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const pool = await getMSSQLPool()
    if (!pool) {
      await replyText(replyToken, `📅 สรุปเดือน\n━━━━━━━━━━━━━━━\nยังไม่สามารถเชื่อมต่อฐานข้อมูลได้ค่ะ\nลองเปิดดูที่ Dashboard แทนนะคะ 🧈`)
      return
    }

    // Delivery summary for the month
    const deliveryReq = pool.request()
    deliveryReq.input('startDate', sql.DateTime, monthStart)
    deliveryReq.input('endDate', sql.DateTime, monthEnd)
    const deliveryRes = await deliveryReq.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN ReleaseDate IS NOT NULL THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN ReleaseDate IS NULL THEN 1 ELSE 0 END) AS pending
      FROM dbo.EV_RentItem
      WHERE IsActive = 1
        AND (
          (ExpectedReleaseDate >= @startDate AND ExpectedReleaseDate <= @endDate)
          OR (ReleaseDate >= @startDate AND ReleaseDate <= @endDate)
        )
    `)
    const d = deliveryRes.recordset[0] || { total: 0, completed: 0, pending: 0 }

    // Repair summary for the month
    const repairReq = pool.request()
    repairReq.input('startDate', sql.DateTime, monthStart)
    repairReq.input('endDate', sql.DateTime, monthEnd)
    const repairRes = await repairReq.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN CarStatusCode = 'COMPLETE' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN CarStatusCode IN ('IN_MAINTENANCE', 'WAITING_FOR_MAINTENANCE', 'STILL_WORK') THEN 1 ELSE 0 END) AS [open]
      FROM dbo.EV_MaintenanceItem
      WHERE IsActive = 1
        AND (
          (ReportDate >= @startDate AND ReportDate <= @endDate)
          OR (MaintenanceStartDate >= @startDate AND MaintenanceStartDate <= @endDate)
          OR (MaintenanceFinishDate >= @startDate AND MaintenanceFinishDate <= @endDate)
        )
    `)
    const r = repairRes.recordset[0] || { total: 0, closed: 0, open: 0 }

    const thaiMonth = now.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    const completionRate = d.total > 0 ? Math.round((Number(d.completed) / Number(d.total)) * 100) : 0

    await replyText(
      replyToken,
      `📅 สรุปเดือน ${thaiMonth}\n━━━━━━━━━━━━━━━\n🚗 ส่งมอบรถ: ${d.total} คัน\n   ✅ ปล่อยแล้ว: ${d.completed} (${completionRate}%)\n   ⏳ เตรียมการ: ${d.pending}\n\n🔧 งานซ่อม: ${r.total} รายการ\n   ✅ ซ่อมเสร็จ: ${r.closed}\n   🔴 ค้างซ่อม: ${r.open}\n━━━━━━━━━━━━━━━\n🧈 ${BOT_NAME} รายงานจบค่ะ~ 💛`
    )
  } catch (error) {
    console.error('[handleStatusMonth Error]', error)
    await replyText(replyToken, `${BOT_NAME} ดึงข้อมูลรายเดือนไม่ได้ตอนนี้ค่ะ 😅 ลองอีกทีนะคะ`)
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

