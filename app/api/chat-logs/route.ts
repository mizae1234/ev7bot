import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const passcode = searchParams.get('passcode')

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const sourceType = searchParams.get('sourceType') || 'all'
    const filterUser = searchParams.get('user') || ''

    const skip = (page - 1) * limit

    const where: any = {}

    if (sourceType !== 'all') {
      where.sourceType = sourceType
    }

    const conditions: any[] = []

    if (filterUser) {
      conditions.push({
        OR: [
          { userName: filterUser },
          { sourceId: filterUser }
        ]
      })
    }

    if (search) {
      conditions.push({
        OR: [
          { userName: { contains: search, mode: 'insensitive' } },
          { userMessage: { contains: search, mode: 'insensitive' } },
          { botReply: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    if (conditions.length > 0) {
      where.AND = conditions
    }

    // Fetch unique users for the dropdown filter (last 2000 chats)
    const allUsersRaw = await prisma.chatLog.findMany({
      select: {
        userName: true,
        sourceId: true,
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 2000
    })

    const uniqueUsersMap = new Map()
    for (const log of allUsersRaw) {
      const key = log.sourceId || log.userName
      if (key && !uniqueUsersMap.has(key)) {
        uniqueUsersMap.set(key, {
          userName: log.userName,
          sourceId: log.sourceId
        })
      }
    }
    const usersList = Array.from(uniqueUsersMap.values()).sort((a, b) => {
      const nameA = a.userName || a.sourceId || ''
      const nameB = b.userName || b.sourceId || ''
      return nameA.localeCompare(nameB, 'th')
    })

    const [logs, total] = await Promise.all([
      prisma.chatLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.chatLog.count({ where })
    ])

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      users: usersList
    })
  } catch (error) {
    console.error('[Chat Logs API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
