import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { askButter } from '@/lib/gemini'
import { prisma } from '@/lib/prisma'
import * as line from '@line/bot-sdk'

export const dynamic = 'force-dynamic'

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
})

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')

  // ── Auth check ─────────────────────────────────────────────────
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── Calculate yesterday in Bangkok timezone ──────────────────
    const now = new Date()
    const bangkokFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    // Get yesterday's date in Bangkok time
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = bangkokFormatter.format(yesterday) // YYYY-MM-DD format

    console.log(`[Cron] Generating morning report for: ${yesterdayStr}`)

    // ── Fetch active groups ─────────────────────────────────────
    const activeGroups = await prisma.lineGroup.findMany({
      where: { isActive: true, enableReport: true },
    })

    if (activeGroups.length === 0) {
      console.log('[Cron] No active groups found. Skipping report.')
      return NextResponse.json({
        success: true,
        message: 'No active groups',
        groupsSent: 0,
        reportDate: yesterdayStr,
      })
    }

    console.log(`[Cron] Found ${activeGroups.length} active group(s)`)

    // ── Generate report via Butter ──────────────────────────────
    const reportPrompt = `สรุปรายงานประจำวัน สำหรับวันที่ ${yesterdayStr} (เมื่อวาน)

กรุณาสรุปข้อมูลทั้งหมดของวันที่ ${yesterdayStr} ครับ ประกอบด้วย:
1. สรุป Portfolio (จำนวนรถทั้งหมด, ปล่อยเช่าแล้ว, ว่าง, ซ่อม)
2. กิจกรรมประจำวัน (ปล่อยรถ, รับคืน, แจ้งซ่อม, ซ่อมเสร็จ, รถทดแทน)

แสดงเป็น emoji bullet points สั้นกระชับ เหมาะกับส่งใน LINE group ครับ`

    const report = await askButter(reportPrompt)
    console.log(`[Cron] Report generated (${report.length} chars)`)

    const header = `🧈 Butter สรุปข่าวเช้า\n📅 ข้อมูลวันที่: ${yesterdayStr}\n${'─'.repeat(20)}\n\n`
    const fullReport = header + report

    // ── Send to all active groups ───────────────────────────────
    const results: { groupId: string; groupName: string | null; success: boolean; error?: string }[] = []

    for (const group of activeGroups) {
      try {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({
            to: group.groupId,
            messages: [{ type: 'text', text: fullReport }],
          })
        } else {
          console.log(`[Mock Cron] Would send to ${group.groupId}: ${fullReport.substring(0, 100)}...`)
        }
        results.push({ groupId: group.groupId, groupName: group.groupName, success: true })
        console.log(`[Cron] ✅ Sent to ${group.groupName || group.groupId}`)
      } catch (err: any) {
        results.push({
          groupId: group.groupId,
          groupName: group.groupName,
          success: false,
          error: err.message || 'Unknown error',
        })
        console.error(`[Cron] ❌ Failed to send to ${group.groupId}:`, err.message)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`[Cron] Report sent: ${successCount} success, ${failCount} failed`)

    return NextResponse.json({
      success: true,
      reportDate: yesterdayStr,
      groupsSent: successCount,
      groupsFailed: failCount,
      details: results,
    })
  } catch (error: any) {
    console.error('[Cron Error]', error)
    return NextResponse.json(
      { error: 'Failed to generate morning report', details: error.message },
      { status: 500 }
    )
  }
}
