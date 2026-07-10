import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getPortfolioSummary, getDeliveryByDate, getRepairDailySummary, getDeliveryPlanAndActual, getMonthlyPlanAndCompleted } from '@/lib/bot-queries'
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

// ─── Build Flex Message (carousel: portfolio + daily activity) ─────
// ─── Build Flex Message (carousel: portfolio + daily activity) ─────
function buildComparisonBox(headerText: string, plans: any[], actuals: any[], dailyOnly = false): any {
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

  const planRows: any[] = []
  for (const proj of Object.keys(comparison)) {
    const models = comparison[proj]
    const totalActual = models.ES.actual + models.Y490.actual + models.Y410.actual;
    const totalPlan = models.ES.plan + models.Y490.plan + models.Y410.plan;

    if (totalPlan > 0 || totalActual > 0) {
      let totalColor = '#1a1a1a'
      if (totalActual >= totalPlan && totalPlan > 0) {
        totalColor = '#2E7D32' // green
      } else if (totalActual < totalPlan && totalActual > 0) {
        totalColor = '#E65100' // orange
      } else if (totalActual === 0 && totalPlan > 0) {
        totalColor = '#C62828' // red
      }

      planRows.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: `📁 ${proj} (รวม)`,
            size: 'xs',
            weight: 'bold',
            color: '#1a1a1a',
            flex: 5
          },
          {
            type: 'text',
            text: dailyOnly ? `${totalActual}` : `${totalActual}/${totalPlan}`,
            size: 'xs',
            weight: 'bold',
            color: totalColor,
            align: 'end',
            flex: 3
          }
        ]
      })

      for (const model of ['ES', 'Y490', 'Y410'] as const) {
        const { plan, actual } = models[model]
        if (plan > 0 || actual > 0) {
          let valColor = '#555555'
          if (actual >= plan && plan > 0) {
            valColor = '#2E7D32'
          } else if (actual < plan && actual > 0) {
            valColor = '#E65100'
          } else if (actual === 0 && plan > 0) {
            valColor = '#C62828'
          }

          planRows.push({
            type: 'box',
            layout: 'horizontal',
            margin: 'xs',
            contents: [
              {
                type: 'text',
                text: `    • ${model}`,
                size: 'xs',
                color: '#888888',
                flex: 5
              },
              {
                type: 'text',
                text: dailyOnly ? `${actual}` : `${actual}/${plan}`,
                size: 'xs',
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

  if (planRows.length === 0) return null

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'md',
    paddingStart: 'md',
    contents: [
      {
        type: 'text',
        text: headerText,
        size: 'xs',
        weight: 'bold',
        color: '#1a1a1a',
        margin: 'xs'
      },
      ...planRows
    ]
  }
}

function buildBreakdownBox(headerText: string, breakdown: any[], dailyOnly = false): any {
  if (!breakdown || breakdown.length === 0) return null

  const rows: any[] = []
  for (const item of breakdown) {
    let valColor = '#1a1a1a'
    if (item.completed >= item.total && item.total > 0) {
      valColor = '#2E7D32' // green (all completed)
    } else if (item.completed < item.total && item.completed > 0) {
      valColor = '#E65100' // orange (in progress)
    } else if (item.completed === 0 && item.total > 0) {
      valColor = '#C62828' // red (none completed)
    }

    rows.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: `• ${item.project} (${item.model})`,
          size: 'xs',
          color: '#555555',
          flex: 5
        },
        {
          type: 'text',
          text: dailyOnly ? `${item.completed}` : `${item.completed}/${item.total}`,
          size: 'xs',
          weight: 'bold',
          color: valColor,
          align: 'end',
          flex: 3
        }
      ]
    })
  }

  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    margin: 'md',
    paddingStart: 'md',
    contents: [
      {
        type: 'text',
        text: headerText,
        size: 'xs',
        weight: 'bold',
        color: '#1a1a1a',
        margin: 'xs'
      },
      ...rows
    ]
  }
}

function buildFlexMessage(dateStr: string, portfolio: any, delivery: any, repairDaily: any, deliveryPlanData?: any, monthlyPlan?: any): any {
  const todayFormatted = new Date().toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  })

  const reportDateShort = (() => {
    try {
      const d = new Date(dateStr)
      return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
    } catch { return dateStr }
  })()

  const newDeliverySummary = delivery?.newVehicles?.summary || { total: 0, completed: 0, pending: 0 }
  const usedDeliverySummary = delivery?.usedVehicles?.summary || { total: 0, completed: 0, pending: 0 }

  const repairData = {
    newReports: repairDaily?.newReports || 0,
    completed: repairDaily?.completed || 0,
    replacements: repairDaily?.replacements || 0,
    returns: repairDaily?.returns || 0,
  }

  // Build New/Used Delivery Plan Comparison (if available)
  let newComparisonBox: any = null
  let usedComparisonBox: any = null

  if (deliveryPlanData && !('error' in deliveryPlanData)) {
    const { plans = [], dailyActuals = [] } = deliveryPlanData
    
    // Partition daily actuals by RentType
    const newDailyActuals = dailyActuals.filter((a: any) => a.RentType === 'ONRENT_NEW')

    newComparisonBox = buildComparisonBox('📋 ส่งมอบรถใหม่ แยกตามโปรเจค', plans, newDailyActuals, true)
    usedComparisonBox = buildBreakdownBox('📋 รายละเอียดส่งมอบ รถมือสอง', delivery?.usedVehicles?.breakdown, true)
  }

  // Bubble 1: Portfolio
  const portfolioBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '🧈 Butter สรุปข่าว', weight: 'bold', size: 'lg', color: '#1a1a1a' },
        { type: 'text', text: todayFormatted, size: 'xs', color: '#888888' },
      ],
      backgroundColor: '#FFF9E6',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'box', layout: 'horizontal', contents: [
            { type: 'text', text: '🚗 รถทั้งหมด', size: 'sm', color: '#555555', flex: 5 },
            { type: 'text', text: fmt(portfolio.total), size: 'sm', weight: 'bold', color: '#1a1a1a', align: 'end', flex: 3 },
          ],
        },
        { type: 'separator' },
        {
          type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🟢 On Rent', size: 'sm', weight: 'bold', color: '#2E7D32', flex: 5 },
              { type: 'text', text: fmt(portfolio.onRent.total), size: 'sm', weight: 'bold', color: '#2E7D32', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `On Road ${fmt(portfolio.onRent.onRoad)}`, size: 'xxs', color: '#aaaaaa', flex: 5 },
              { type: 'text', text: `Maint. ${fmt(portfolio.onRent.underMaintenance)}`, size: 'xxs', color: '#E65100', align: 'end', flex: 3 },
            ]},
          ],
        },
        { type: 'separator' },
        {
          type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '✅ Available', size: 'sm', weight: 'bold', color: '#1565C0', flex: 5 },
              { type: 'text', text: fmt(portfolio.available.total), size: 'sm', weight: 'bold', color: '#1565C0', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `EV7 ${fmt(portfolio.available.ev7)}`, size: 'xxs', color: '#aaaaaa' },
              { type: 'text', text: `LM ${fmt(portfolio.available.lineMan)}`, size: 'xxs', color: '#aaaaaa', align: 'center' },
              { type: 'text', text: `Grab ${fmt(portfolio.available.grab)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
            ]},
          ],
        },
        { type: 'separator' },
        {
          type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🏭 Production', size: 'sm', weight: 'bold', color: '#6A1B9A', flex: 5 },
              { type: 'text', text: fmt(portfolio.onProduction.total), size: 'sm', weight: 'bold', color: '#6A1B9A', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `Pending ${fmt(portfolio.onProduction.pending)}`, size: 'xxs', color: '#aaaaaa' },
              { type: 'text', text: `Process ${fmt(portfolio.onProduction.inProcess)}`, size: 'xxs', color: '#aaaaaa', align: 'center' },
              { type: 'text', text: `GR ${fmt(portfolio.onProduction.waitingGR)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
            ]},
          ],
        },
        { type: 'separator' },
        {
          type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🔄 Replacement', size: 'sm', weight: 'bold', color: '#E65100', flex: 5 },
              { type: 'text', text: fmt(portfolio.replacement.total), size: 'sm', weight: 'bold', color: '#E65100', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `Available ${fmt(portfolio.replacement.available)}`, size: 'xxs', color: '#aaaaaa', flex: 5 },
              { type: 'text', text: `Car ${fmt(portfolio.replacement.car)}`, size: 'xxs', color: '#aaaaaa', align: 'end', flex: 3 },
            ]},
          ],
        },
        { type: 'separator' },
        {
          type: 'box', layout: 'vertical', spacing: 'xs', contents: [
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: '🛠️ Maintenance', size: 'sm', weight: 'bold', color: '#C62828', flex: 5 },
              { type: 'text', text: fmt(portfolio.underMaintenance.total), size: 'sm', weight: 'bold', color: '#C62828', align: 'end', flex: 3 },
            ]},
            { type: 'box', layout: 'horizontal', contents: [
              { type: 'text', text: `New ${fmt(portfolio.underMaintenance.new)}`, size: 'xxs', color: '#aaaaaa' },
              { type: 'text', text: `Rent ${fmt(portfolio.underMaintenance.onRent)}`, size: 'xxs', color: '#aaaaaa', align: 'center' },
              { type: 'text', text: `Use ${fmt(portfolio.underMaintenance.use)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
            ]},
          ],
        },
      ],
      paddingAll: 'lg',
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: `EV7: ${fmt(portfolio.company.ev7)}`, size: 'xxs', color: '#aaaaaa' },
        { type: 'text', text: `GI: ${fmt(portfolio.company.gi)}`, size: 'xxs', color: '#aaaaaa', align: 'end' },
      ],
      paddingAll: 'md',
    },
  }

  // Bubble 2: Daily Activity (yesterday)
  const activityBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `📅 กิจกรรมวันที่ ${dateStr}`, weight: 'bold', size: 'md', color: '#1a1a1a' },
        { type: 'text', text: 'สรุปการส่งรถและงานซ่อม', size: 'xs', color: '#888888' },
      ],
      backgroundColor: '#E8F5E9',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        // New Delivery Section
        { type: 'text', text: '🚛 ส่งมอบรถใหม่', weight: 'bold', size: 'sm', color: '#1565C0' },
        {
          type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(monthlyPlan?.newPlanTotal ?? 0), size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center' },
              { type: 'text', text: 'เป้าประจำเดือน', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(newDeliverySummary.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
              { type: 'text', text: `ส่งมอบ (${reportDateShort})`, size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(monthlyPlan?.newCompleted ?? 0), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'สะสมประจำเดือน', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ],
        },
        ...(newComparisonBox ? [newComparisonBox] : []),
        { type: 'separator' },

        // Used Delivery Section
        { type: 'text', text: '🚗 ปล่อยรถมือสอง', weight: 'bold', size: 'sm', color: '#8E24AA' },
        {
          type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(monthlyPlan?.usedPlanTotal ?? 0), size: 'xl', weight: 'bold', color: '#1a1a1a', align: 'center' },
              { type: 'text', text: 'เป้าประจำเดือน', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(usedDeliverySummary.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
              { type: 'text', text: `ส่งมอบ (${reportDateShort})`, size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(monthlyPlan?.usedCompleted ?? 0), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'สะสมประจำเดือน', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ],
        },
        ...(usedComparisonBox ? [usedComparisonBox] : []),
        { type: 'separator' },

        // Repair
        { type: 'text', text: '🔧 งานซ่อม', weight: 'bold', size: 'sm', color: '#C62828' },
        {
          type: 'box', layout: 'horizontal', spacing: 'md', contents: [
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(repairData.newReports), size: 'xl', weight: 'bold', color: '#E65100', align: 'center' },
              { type: 'text', text: 'แจ้งซ่อม', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
            { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: String(repairData.completed), size: 'xl', weight: 'bold', color: '#2E7D32', align: 'center' },
              { type: 'text', text: 'ซ่อมเสร็จ', size: 'xxs', color: '#888888', align: 'center' },
            ], flex: 1 },
          ],
        },
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
      ],
      paddingAll: 'lg',
    },
  }

  return {
    type: 'flex',
    altText: `🧈 Butter สรุปข่าว ${todayFormatted}`,
    contents: {
      type: 'carousel',
      contents: [activityBubble, portfolioBubble],
    },
  }
}

// ─── Main GET handler ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')

  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
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

    const activeGroups = await prisma.lineGroup.findMany({
      where: { isActive: true, enableReport: true },
    })

    if (activeGroups.length === 0) {
      return NextResponse.json({ success: true, message: 'No active groups', groupsSent: 0 })
    }

    // Fetch all data in parallel
    const [portfolio, delivery, repair, deliveryPlanData, monthlyPlan] = await Promise.all([
      getPortfolioSummary(),
      getDeliveryByDate({ date: yesterdayStr }),
      getRepairDailySummary(yesterdayStr),
      getDeliveryPlanAndActual({ date: yesterdayStr }),
      getMonthlyPlanAndCompleted({ date: yesterdayStr }),
    ])

    if ('error' in portfolio) {
      return NextResponse.json(
        { error: 'Failed to fetch portfolio', details: portfolio.error },
        { status: 500 }
      )
    }

    // Build Flex Message (carousel: portfolio + daily activity)
    const flexMessage = buildFlexMessage(yesterdayStr, portfolio, delivery, repair, deliveryPlanData, monthlyPlan)

    // Send to groups
    const results: { groupId: string; groupName: string | null; success: boolean; error?: string }[] = []

    for (const group of activeGroups) {
      try {
        if (!env.MOCK_MODE) {
          await lineClient.pushMessage({
            to: group.groupId,
            messages: [flexMessage],
          })
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
        console.error(`[Cron] ❌ Failed:`, err.message)
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

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
