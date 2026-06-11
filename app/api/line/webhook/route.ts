import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lineClient, lineConfig } from '@/lib/line'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { askButter } from '@/lib/gemini'
import type { WebhookEvent } from '@line/bot-sdk'
import { getMSSQLPool, sql } from '@/lib/mssql'

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

  // Handle follow event (user adds Line OA as friend)
  if (event.type === 'follow') {
    await handleFollow(event.source.userId!)
    return
  }

  // Handle join event (bot added to group/room)
  if (event.type === 'join') {
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

      // Chat with stripped message
      await handleChat(strippedText, lower, event.source.userId!, event.replyToken, appUrl)
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
    await handleChat(text, lower, event.source.userId!, event.replyToken, appUrl)
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

async function handleChat(text: string, lower: string, userId: string, replyToken: string, appUrl: string) {
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

  // ─── AI-Powered Response (Gemini) ──────────────────────────────
  // ทุกข้อความที่ไม่ตรงกับ keyword ข้างบน → ส่งให้ AI ตอบ
  try {
    console.log(`[${BOT_NAME} AI] Processing: "${text}"`)
    const aiResponse = await askButter(text)
    console.log(`[${BOT_NAME} AI] Response: "${aiResponse.substring(0, 100)}..."`)

    // Extract link if any, and try to send Flex Message
    const vehicleLinkRegex = /(?:🔗\s*ดูเพิ่มเติม:\s*|ดูเพิ่มเติมได้ที่นี่:\s*)(https?:\/\/[^\s]+|\/vehicle\/[^\s]+)/i
    const linkMatch = aiResponse.match(vehicleLinkRegex)
    let flexSent = false

    if (linkMatch) {
      const rawUrl = linkMatch[1]
      const registerNoMatch = rawUrl.match(/\/vehicle\/([^\s\/?#]+)/i)
      if (registerNoMatch) {
        const registerNo = decodeURIComponent(registerNoMatch[1]).trim()
        flexSent = await trySendVehicleFlexMessage(replyToken, registerNo, aiResponse, appUrl)
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
      .replace(/(?:\n\r?|\r)?(?:🔗\s*)?ดูเพิ่มเติม:\s*(?:https?:\/\/[^\s]+|\/vehicle\/[^\s]+)/gi, '')
      .trim()

    let flexContents: any = null

    if (statusCode === 'MAINTENANCE') {
      const maintResult = await pool.request()
        .input('inventoryItemId', sql.Int, car.InventoryItemID)
        .query(`
          SELECT TOP 1 IssueTitle, ProblemTypeDescription, ServiceLocation, MaintenanceStartDate, CarStatusCode
          FROM dbo.EV_MaintenanceItem
          WHERE InventoryItemID = @inventoryItemId AND IsActive = 1
          ORDER BY ReportDate DESC
        `)
      const maint = maintResult.recordset[0] || {}

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
              text: `ทะเบียน: ${car.RegisterNo || '-'}`,
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
                  text: 'ซ่อม (MAINTENANCE)',
                  color: '#d97706',
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
                  text: 'อาการ',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: maint.IssueTitle || '-',
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
                  text: 'สถานที่ซ่อม',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: maint.ServiceLocation || '-',
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
                  text: 'วันที่เริ่มซ่อม',
                  color: '#6b7280',
                  size: 'sm',
                  flex: 2
                },
                {
                  type: 'text',
                  text: formatDateTh(maint.MaintenanceStartDate),
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
                uri: `${appUrl}/vehicle/${encodeURIComponent(car.RegisterNo || car.VinNo)}`
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
              text: `ทะเบียน: ${car.RegisterNo || '-'}`,
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
                uri: `${appUrl}/vehicle/${encodeURIComponent(car.RegisterNo || car.VinNo)}`
              }
            }
          ]
        }
      }
    }

    if (flexContents) {
      if (env.MOCK_MODE) {
        console.log(`[Mock ${BOT_NAME}] Sending Flex Message for ${car.RegisterNo}:`, JSON.stringify(flexContents))
        return true
      }

      await lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: cleanedText
        },
        {
          type: 'flex',
          altText: `ข้อมูลรถ ${car.RegisterNo}`,
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

