import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-3.5-flash': { input: 1.50, output: 9.00 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-2.5-flash': { input: 0.15, output: 3.50 },
}

const DEFAULT_PRICING = { input: 0.50, output: 3.00 } // fallback to gemini-3-flash-preview
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
  const modelBreakdown: Record<string, { count: number; inputTokens: number; outputTokens: number; costUSD: number }> = {}

  for (const log of logs) {
    const inT = log.inputTokens || 0
    const outT = log.outputTokens || 0
    const cost = calculateCost(inT, outT, log.modelName)
    totalInputTokens += inT
    totalOutputTokens += outT
    totalCost += cost

    const model = log.modelName || 'unknown'
    if (!modelBreakdown[model]) {
      modelBreakdown[model] = { count: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 }
    }
    modelBreakdown[model].count++
    modelBreakdown[model].inputTokens += inT
    modelBreakdown[model].outputTokens += outT
    modelBreakdown[model].costUSD += cost
  }

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
    totalCostTHB: Math.round(totalCost * EXCHANGE_RATE * 100) / 100,
    modelBreakdown,
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
    const chatFilter = { ...tokenFilter, sourceType: { not: 'autoclaim' } }
    const autoclaimFilter = { ...tokenFilter, sourceType: 'autoclaim' }

    // Fetch all aggregations in parallel
    const [
      thisMonthLogs,
      todayLogs,
      last7DaysLogs,
      recentLogs,
      // Autoclaim separate
      thisMonthAutoclaim,
      todayAutoclaim,
      last7DaysAutoclaim,
      recentAutoclaimLogs,
    ] = await Promise.all([
      // This month (chat only)
      prisma.chatLog.findMany({
        where: {
          createdAt: { gte: monthStart },
          ...chatFilter,
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelName: true,
        },
      }),
      // Today (chat only)
      prisma.chatLog.findMany({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          ...chatFilter,
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelName: true,
        },
      }),
      // Last 7 days (chat only)
      prisma.chatLog.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          ...chatFilter,
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelName: true,
        },
      }),
      // Recent logs with full detail (last 30, chat only)
      prisma.chatLog.findMany({
        where: chatFilter,
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
      // Autoclaim: this month
      prisma.chatLog.findMany({
        where: { createdAt: { gte: monthStart }, ...autoclaimFilter },
        select: { inputTokens: true, outputTokens: true, modelName: true },
      }),
      // Autoclaim: today
      prisma.chatLog.findMany({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, ...autoclaimFilter },
        select: { inputTokens: true, outputTokens: true, modelName: true },
      }),
      // Autoclaim: last 7 days
      prisma.chatLog.findMany({
        where: { createdAt: { gte: sevenDaysAgo }, ...autoclaimFilter },
        select: { inputTokens: true, outputTokens: true, modelName: true },
      }),
      // Autoclaim: recent 20
      prisma.chatLog.findMany({
        where: autoclaimFilter,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          userName: true,
          userMessage: true,
          inputTokens: true,
          outputTokens: true,
          modelName: true,
          createdAt: true,
        },
      }),
    ])

    // Also count total questions (including those without token data)
    const [thisMonthTotal, todayTotal, last7DaysTotal] = await Promise.all([
      prisma.chatLog.count({ where: { createdAt: { gte: monthStart }, sourceType: { not: 'autoclaim' } } }),
      prisma.chatLog.count({ where: { createdAt: { gte: todayStart, lte: todayEnd }, sourceType: { not: 'autoclaim' } } }),
      prisma.chatLog.count({ where: { createdAt: { gte: sevenDaysAgo }, sourceType: { not: 'autoclaim' } } }),
    ])



    const thisMonthAgg = aggregate(thisMonthLogs)
    const todayAgg = aggregate(todayLogs)
    const last7DaysAgg = aggregate(last7DaysLogs)

    // Autoclaim aggregations
    const autoclaimThisMonth = aggregate(thisMonthAutoclaim)
    const autoclaimToday = aggregate(todayAutoclaim)
    const autoclaimLast7Days = aggregate(last7DaysAutoclaim)

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

    // Format autoclaim recent
    const formattedAutoclaim = recentAutoclaimLogs.map(log => {
      const inT = log.inputTokens || 0
      const outT = log.outputTokens || 0
      const cost = calculateCost(inT, outT, log.modelName)
      return {
        id: log.id,
        userMessage: log.userMessage.substring(0, 100),
        inputTokens: inT,
        outputTokens: outT,
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
      autoclaim: {
        thisMonth: { ...autoclaimThisMonth, calls: thisMonthAutoclaim.length },
        today: { ...autoclaimToday, calls: todayAutoclaim.length },
        last7Days: { ...autoclaimLast7Days, calls: last7DaysAutoclaim.length },
        recentLogs: formattedAutoclaim,
      },
      recentLogs: formattedRecent,
      pricing: {
        models: MODEL_PRICING,
        exchangeRate: EXCHANGE_RATE,
      },
    })
  } catch (error) {
    console.error('[Chat Logs Usage API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
