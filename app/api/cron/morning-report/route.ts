import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getPortfolioSummary, getDeliveryToday, getRepairStatus } from '@/lib/bot-queries'
import { prisma } from '@/lib/prisma'
import * as line from '@line/bot-sdk'

export const dynamic = 'force-dynamic'

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
})

// ─── Helper: format number with commas ─────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

// ─── Helper: percentage string ─────────────────────────────────────
function pct(value: number, total: number): string {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

// ─── Build Flex Message for Morning Report ─────────────────────────
function buildMorningReportFlex(
  dateStr: string,
  portfolio: any,
  delivery: any,
  repair: any
): line.messagingApi.FlexMessage {
  const todayFormatted = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  })

  const contents: line.messagingApi.FlexBubble[] = []

  // ─── Bubble 1: Portfolio Overview ──────────────────────────────
  contents.push({
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'text',
              text: '🧈',
              size: 'xxl',
              flex: 0,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: 'Butter สรุปข่าวเช้า',
                  weight: 'bold',
                  size: 'lg',
                  color: '#1a1a1a',
                },
                {
                  type: 'text',
                  text: todayFormatted,
                  size: 'xs',
                  color: '#888888',
                },
              ],
              paddingStart: '12px',
            },
          ],
          alignItems: 'center',
        },
      ],
      backgroundColor: '#FFF9E6',
      paddingAll: '16px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Total
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '🚗 รถทั้งหมด', size: 'sm', color: '#555555', flex: 5 },
            { type: 'text', text: fmt(portfolio.total), size: 'sm', weight: 'bold', color: '#1a1a1a', align: 'end', flex: 3 },
          ],
          paddingBottom: '12px',
        },
        { type: 'separator', color: '#E8E8E8' },

        // On Rent
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '🟢 On Rent', size: 'sm', weight: 'bold', color: '#2E7D32', flex: 5 },
                { type: 'text', text: fmt(portfolio.onRent.total), size: 'sm', weight: 'bold', color: '#2E7D32', align: 'end', flex: 3 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: `  On Road ${fmt(portfolio.onRent.onRoad)}`, size: 'xs', color: '#888888', flex: 5 },
                { type: 'text', text: `Maint. ${fmt(portfolio.onRent.underMaintenance)}`, size: 'xs', color: '#E65100', align: 'end', flex: 3 },
              ],
              paddingTop: '4px',
            },
          ],
          paddingTop: '12px',
          paddingBottom: '12px',
        },
        { type: 'separator', color: '#E8E8E8' },

        // Available
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '✅ Available', size: 'sm', weight: 'bold', color: '#1565C0', flex: 5 },
                { type: 'text', text: fmt(portfolio.available.total), size: 'sm', weight: 'bold', color: '#1565C0', align: 'end', flex: 3 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: `  EV7 ${fmt(portfolio.available.ev7)}`, size: 'xs', color: '#888888' },
                { type: 'text', text: `LM ${fmt(portfolio.available.lineMan)}`, size: 'xs', color: '#888888', align: 'center' },
                { type: 'text', text: `Grab ${fmt(portfolio.available.grab)}`, size: 'xs', color: '#888888', align: 'end' },
              ],
              paddingTop: '4px',
            },
          ],
          paddingTop: '12px',
          paddingBottom: '12px',
        },
        { type: 'separator', color: '#E8E8E8' },

        // On Production
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '🏭 On Production', size: 'sm', weight: 'bold', color: '#6A1B9A', flex: 5 },
                { type: 'text', text: fmt(portfolio.onProduction.total), size: 'sm', weight: 'bold', color: '#6A1B9A', align: 'end', flex: 3 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: `  Pending ${fmt(portfolio.onProduction.pending)}`, size: 'xs', color: '#888888' },
                { type: 'text', text: `Process ${fmt(portfolio.onProduction.inProcess)}`, size: 'xs', color: '#888888', align: 'center' },
                { type: 'text', text: `GR ${fmt(portfolio.onProduction.waitingGR)}`, size: 'xs', color: '#888888', align: 'end' },
              ],
              paddingTop: '4px',
            },
          ],
          paddingTop: '12px',
          paddingBottom: '12px',
        },
        { type: 'separator', color: '#E8E8E8' },

        // Replacement
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '🔧 Replacement', size: 'sm', weight: 'bold', color: '#E65100', flex: 5 },
                { type: 'text', text: fmt(portfolio.replacement.total), size: 'sm', weight: 'bold', color: '#E65100', align: 'end', flex: 3 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: `  Available ${fmt(portfolio.replacement.available)}`, size: 'xs', color: '#888888', flex: 5 },
                { type: 'text', text: `Car ${fmt(portfolio.replacement.car)}`, size: 'xs', color: '#888888', align: 'end', flex: 3 },
              ],
              paddingTop: '4px',
            },
          ],
          paddingTop: '12px',
          paddingBottom: '12px',
        },
        { type: 'separator', color: '#E8E8E8' },

        // Under Maintenance
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '🛠️ Maintenance', size: 'sm', weight: 'bold', color: '#C62828', flex: 5 },
                { type: 'text', text: fmt(portfolio.underMaintenance.total), size: 'sm', weight: 'bold', color: '#C62828', align: 'end', flex: 3 },
              ],
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: `  New ${fmt(portfolio.underMaintenance.new)}`, size: 'xs', color: '#888888' },
                { type: 'text', text: `Rent ${fmt(portfolio.underMaintenance.onRent)}`, size: 'xs', color: '#888888', align: 'center' },
                { type: 'text', text: `Use ${fmt(portfolio.underMaintenance.use)}`, size: 'xs', color: '#888888', align: 'end' },
              ],
              paddingTop: '4px',
            },
          ],
          paddingTop: '12px',
        },
      ],
      paddingAll: '16px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: `EV7: ${fmt(portfolio.company.ev7)}`, size: 'xxs', color: '#AAAAAA' },
            { type: 'text', text: `GI: ${fmt(portfolio.company.gi)}`, size: 'xxs', color: '#AAAAAA', align: 'end' },
          ],
        },
      ],
      backgroundColor: '#F5F5F5',
      paddingAll: '12px',
    },
  })

  // ─── Bubble 2: Daily Activity ─────────────────────────────────
  const deliverySummary = delivery?.summary || { total: 0, completed: 0, pending: 0 }
  const repairSummary = repair?.summary || { total: 0, closed: 0, open: 0 }

  contents.push({
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `📅 กิจกรรมวันที่ ${dateStr}`,
          weight: 'bold',
          size: 'md',
          color: '#1a1a1a',
        },
      ],
      backgroundColor: '#E8F5E9',
      paddingAll: '16px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        // Delivery section
        {
          type: 'text',
          text: '🚛 ส่งมอบรถ',
          weight: 'bold',
          size: 'sm',
          color: '#1565C0',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: fmt(deliverySummary.total), size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center' },
                { type: 'text', text: 'ทั้งหมด', size: 'xxs', color: '#888888', align: 'center' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: fmt(deliverySummary.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
                { type: 'text', text: 'สำเร็จ', size: 'xxs', color: '#888888', align: 'center' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: fmt(deliverySummary.pending), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
                { type: 'text', text: 'รอดำเนินการ', size: 'xxs', color: '#888888', align: 'center' },
              ],
              flex: 1,
            },
          ],
          paddingTop: '8px',
          paddingBottom: '16px',
        },

        { type: 'separator', color: '#E8E8E8' },

        // Repair section
        {
          type: 'text',
          text: '🔧 งานซ่อม',
          weight: 'bold',
          size: 'sm',
          color: '#C62828',
          paddingTop: '16px',
        },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: fmt(repairSummary.total), size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center' },
                { type: 'text', text: 'ทั้งหมด', size: 'xxs', color: '#888888', align: 'center' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: fmt(repairSummary.closed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
                { type: 'text', text: 'ปิดงาน', size: 'xxs', color: '#888888', align: 'center' },
              ],
              flex: 1,
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: fmt(repairSummary.open), size: 'xl', weight: 'bold', color: '#C62828', align: 'center' },
                { type: 'text', text: 'ค้างซ่อม', size: 'xxs', color: '#888888', align: 'center' },
              ],
              flex: 1,
            },
          ],
          paddingTop: '8px',
          paddingBottom: '8px',
        },

        // Breakdown by project (if available)
        ...(delivery?.breakdown && delivery.breakdown.length > 0
          ? [
              { type: 'separator' as const, color: '#E8E8E8' },
              {
                type: 'text' as const,
                text: '📊 แยกตาม Project',
                weight: 'bold' as const,
                size: 'sm' as const,
                color: '#555555',
                paddingTop: '12px',
              },
              ...delivery.breakdown.slice(0, 5).map((b: any) => ({
                type: 'box' as const,
                layout: 'horizontal' as const,
                contents: [
                  { type: 'text' as const, text: `  ${b.project} / ${b.model}`, size: 'xs' as const, color: '#888888', flex: 6 },
                  { type: 'text' as const, text: `${b.count} คัน`, size: 'xs' as const, color: '#555555', align: 'end' as const, flex: 2 },
                ],
                paddingTop: '4px',
              })),
            ]
          : []),
      ],
      paddingAll: '16px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: '📊 ดู Dashboard เต็ม',
            uri: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
          },
          style: 'primary',
          color: '#FFC107',
          height: 'sm',
        },
      ],
      paddingAll: '12px',
    },
  })

  return {
    type: 'flex',
    altText: `🧈 Butter สรุปข่าวเช้า ${todayFormatted}`,
    contents: {
      type: 'carousel',
      contents,
    },
  }
}

// ─── Main GET handler ──────────────────────────────────────────────
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

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const yesterdayStr = bangkokFormatter.format(yesterday)

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

    // ── Fetch data directly from DB (faster + more accurate) ────
    const [portfolio, delivery, repair] = await Promise.all([
      getPortfolioSummary(),
      getDeliveryToday(),
      getRepairStatus({ date: yesterdayStr }),
    ])

    console.log('[Cron] Data fetched successfully')

    // Check if portfolio has error
    if ('error' in portfolio) {
      console.error('[Cron] Portfolio error:', portfolio.error)
      return NextResponse.json(
        { error: 'Failed to fetch portfolio data', details: portfolio.error },
        { status: 500 }
      )
    }

    // ── Build Flex Message ───────────────────────────────────────
    const flexMessage = buildMorningReportFlex(yesterdayStr, portfolio, delivery, repair)

    // ── Send to all active groups ───────────────────────────────
    const results: { groupId: string; groupName: string | null; success: boolean; error?: string }[] = []

    for (const group of activeGroups) {
      try {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({
            to: group.groupId,
            messages: [flexMessage],
          })
        } else {
          console.log(`[Mock Cron] Would send flex to ${group.groupId}`)
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
      portfolio,
    })
  } catch (error: any) {
    console.error('[Cron Error]', error)
    return NextResponse.json(
      { error: 'Failed to generate morning report', details: error.message },
      { status: 500 }
    )
  }
}
