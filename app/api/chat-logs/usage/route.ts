import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash': { input: 1.50, output: 9.00 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-2.5-flash': { input: 0.15, output: 3.50 },
}

const DEFAULT_PRICING = { input: 1.50, output: 9.00 } // fallback to gemini-3.5-flash
const EXCHANGE_RATE = 34 // THB per USD

function calculateCost(inputTokens: number, outputTokens: number, modelName?: string | null): number {
  const pricing = (modelName && MODEL_PRICING[modelName]) || DEFAULT_PRICING
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

function aggregate(logs: { inputTokens: number | null; outputTokens: number | null; modelName: string | null }[]) {
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCost = 0

  for (const log of logs) {
    const inT = log.inputTokens || 0
    const outT = log.outputTokens || 0
    totalInputTokens += inT
    totalOutputTokens += outT
    totalCost += calculateCost(inT, outT, log.modelName)
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    totalCostTHB: Math.round(totalCost * EXCHANGE_RATE * 100) / 100,
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const passcode = searchParams.get('passcode')
    const userId = searchParams.get('userId')

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // Check database role of caller
    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 })
    }

    // Date calculations (Bangkok timezone)
    const now = new Date()
    const bkkFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
    const todayStr = bkkFormatter.format(now)
    const todayStart = new Date(todayStr + 'T00:00:00+07:00')
    const todayEnd = new Date(todayStr + 'T23:59:59.999+07:00')

    // First day of this month
    const [y, m] = todayStr.split('-')
    const monthStart = new Date(`${y}-${m}-01T00:00:00+07:00`)

    // 7 days ago
    const sevenDaysAgo = new Date(todayStart)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Only count records that have token data (non-null)
    const tokenFilter = { inputTokens: { not: null } }

    // Fetch all aggregations in parallel
    const [
      thisMonthLogs,
      todayLogs,
      last7DaysLogs,
      recentLogs,
    ] = await Promise.all([
      // This month
      prisma.chatLog.findMany({
        where: {
          createdAt: { gte: monthStart },
          ...tokenFilter,
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelName: true,
        },
      }),
      // Today
      prisma.chatLog.findMany({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          ...tokenFilter,
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelName: true,
        },
      }),
      // Last 7 days
      prisma.chatLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          ...tokenFilter,
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelName: true,
        },
      }),
      // Recent logs with full detail (last 30)
      prisma.chatLog.findMany({
        where: tokenFilter,
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          userName: true,
          userMessage: true,
          inputTokens: true,
          outputTokens: true,
          modelName: true,
          responseTimeMs: true,
          createdAt: true,
        },
      }),
    ])

    // Also count total questions (including those without token data)
    const [thisMonthTotal, todayTotal, last7DaysTotal] = await Promise.all([
      prisma.chatLog.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.chatLog.count({ where: { createdAt: { gte: todayStart, lte: todayEnd } } }),
      prisma.chatLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    ])



    const thisMonthAgg = aggregate(thisMonthLogs)
    const todayAgg = aggregate(todayLogs)
    const last7DaysAgg = aggregate(last7DaysLogs)

    // Format recent logs
    const formattedRecent = recentLogs.map(log => {
      const inT = log.inputTokens || 0
      const outT = log.outputTokens || 0
      const cost = calculateCost(inT, outT, log.modelName)
      return {
        id: log.id,
        userName: log.userName,
        userMessage: log.userMessage.substring(0, 100),
        inputTokens: inT,
        outputTokens: outT,
        totalTokens: inT + outT,
        responseTimeMs: log.responseTimeMs,
        costUSD: Math.round(cost * 1_000_000) / 1_000_000,
        costTHB: Math.round(cost * EXCHANGE_RATE * 10_000) / 10_000,
        modelName: log.modelName,
        createdAt: log.createdAt,
      }
    })

    return NextResponse.json({
      thisMonth: {
        ...thisMonthAgg,
        questions: thisMonthTotal,
        trackedQuestions: thisMonthLogs.length,
      },
      today: {
        ...todayAgg,
        questions: todayTotal,
        trackedQuestions: todayLogs.length,
      },
      last7Days: {
        ...last7DaysAgg,
        questions: last7DaysTotal,
        trackedQuestions: last7DaysLogs.length,
      },
      recentLogs: formattedRecent,
      pricing: {
        currentModel: 'gemini-3.5-flash',
        inputPer1M: 1.50,
        outputPer1M: 9.00,
        exchangeRate: EXCHANGE_RATE,
      },
    })
  } catch (error) {
    console.error('[Chat Logs Usage API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
