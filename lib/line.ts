import { Client, middleware } from '@line/bot-sdk'
import { env } from './env'

export const lineConfig = {
  channelSecret: env.LINE_CHANNEL_SECRET,
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
}

export const lineClient = new Client(lineConfig)
export const lineMiddleware = middleware(lineConfig)

import { getMSSQLPool } from './mssql'
import { prisma } from './prisma'
import sql from 'mssql'

/**
 * ค้นหาผู้ใช้ที่ถูกกล่าวถึงในข้อความ (เช่น @Inkk, @นิรชา) แล้วส่ง LINE Push Message หาเขา
 */
export async function sendMentionNotifications(text: string, ticketId: number, senderName: string) {
  if (!text) return

  // ดึงข้อความที่มี @ (ES5-compatible regex execution)
  const matches: string[] = []
  const regex = /@([^\s@]+)/g
  let match
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) {
      matches.push(match[1].trim())
    }
  }
  if (matches.length === 0) return

  try {
    const mssqlPool = await getMSSQLPool()
    if (!mssqlPool) return

    for (const name of matches) {
      let ev7UserId: number | null = null
      let targetLineUserId: string | null = null

      // 1. ค้นหาใน EV_User (SQL Server)
      const userReq = mssqlPool.request()
      userReq.input('name', sql.NVarChar, `%${name}%`)
      const userRes = await userReq.query(`
        SELECT UserID 
        FROM dbo.EV_User 
        WHERE (FirstName LIKE @name OR LastName LIKE @name OR (FirstName + ' ' + LastName) LIKE @name) 
          AND IsActive = 1
      `)

      if (userRes.recordset.length > 0) {
        ev7UserId = userRes.recordset[0].UserID
      }

      // 2. นำ ev7UserId มาค้นหาใน LineRegistration (Postgres)
      if (ev7UserId) {
        const lineReg = await prisma.lineRegistration.findFirst({
          where: { ev7UserId, isActive: true }
        })
        if (lineReg) {
          targetLineUserId = lineReg.lineUserId
        }
      }

      // 3. หากยังไม่พบ ให้ลองค้นหาจาก DisplayName ใน LineRegistration ตรงๆ
      if (!targetLineUserId) {
        const lineReg = await prisma.lineRegistration.findFirst({
          where: {
            displayName: {
              contains: name,
              mode: 'insensitive'
            },
            isActive: true
          }
        })
        if (lineReg) {
          targetLineUserId = lineReg.lineUserId
        }
      }

      // 0. ดึงทะเบียนรถของตั๋วใบนี้จาก SQL Server เพื่อแสดงผลและสร้าง URL link
      let registerNo = 'ไม่ระบุทะเบียน'
      try {
        const ticketReq = mssqlPool.request()
        ticketReq.input('ticketId', sql.Int, ticketId)
        const ticketRes = await ticketReq.query(`
          SELECT COALESCE(m.RegisterNo, i.RegisterNo) AS RegisterNo 
          FROM dbo.EV_MaintenanceItem m
          LEFT JOIN dbo.EV_InventoryItem i ON m.InventoryItemID = i.InventoryItemID
          WHERE m.MaintenanceItemID = @ticketId
        `)
        if (ticketRes.recordset.length > 0 && ticketRes.recordset[0].RegisterNo) {
          registerNo = ticketRes.recordset[0].RegisterNo
        }
      } catch (dbErr) {
        console.error('[LINE Mention - DB Error fetching RegisterNo]', dbErr)
      }

      // 4. ส่ง Push Message
      if (targetLineUserId) {
        console.log(`[LINE Mention] Sending notification to ${name} (LINE ID: ${targetLineUserId}) for Ticket #${ticketId}`)
        
        const liffUrl = `https://liff.line.me/${env.NEXT_PUBLIC_LINE_LIFF_ID}/quick-report?registerNo=${encodeURIComponent(registerNo)}&maintId=${ticketId}&tab=history`
        const messageText = `🔔 คุณถูกกล่าวถึงโดยคุณ ${senderName} ในใบงาน #${ticketId} (ทะเบียน: ${registerNo}):\n"${text}"\n\n🔗 กดดูรายละเอียด/ตอบกลับ:\n${liffUrl}`
        
        await lineClient.pushMessage(targetLineUserId, {
          type: 'text',
          text: messageText
        }).catch(err => {
          console.error(`[LINE Mention Error] Failed to send push message to ${targetLineUserId}:`, err)
        })
      } else {
        console.log(`[LINE Mention] User "${name}" mentioned in text but no active LINE Registration found.`)
      }
    }
  } catch (err) {
    console.error('[LINE Mention Notification Error]', err)
  }
}
