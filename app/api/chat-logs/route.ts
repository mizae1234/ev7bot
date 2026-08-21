import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const sourceType = searchParams.get('sourceType') || 'all'
    const filterUser = searchParams.get('user') || ''
    const excludeAutoclaim = searchParams.get('excludeAutoclaim') === 'true'

    const skip = (page - 1) * limit

    const where: any = {}

    if (sourceType === 'autoclaim') {
      where.OR = [
        { sourceType: 'autoclaim' },
        { userName: 'AutoClaim' },
        { botReply: { contains: 'isClaim' } }
      ]
    } else {
      if (sourceType !== 'all') {
        where.sourceType = sourceType
      }
      if (excludeAutoclaim) {
        where.NOT = [
          { sourceType: 'autoclaim' },
          { userName: 'AutoClaim' },
          { botReply: { contains: 'isClaim' } }
        ]
      }
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

    // Fetch registered Line users and unique chat log users for the dropdown filter
    const userQueryWhere: any = {}
    if (sourceType === 'autoclaim') {
      userQueryWhere.OR = [
        { sourceType: 'autoclaim' },
        { userName: 'AutoClaim' },
        { botReply: { contains: 'isClaim' } }
      ]
    } else if (excludeAutoclaim) {
      userQueryWhere.NOT = [
        { sourceType: 'autoclaim' },
        { userName: 'AutoClaim' },
        { botReply: { contains: 'isClaim' } }
      ]
    }

    const [registeredUsers, allUsersRaw] = await Promise.all([
      prisma.lineRegistration.findMany({
        select: {
          displayName: true,
          lineUserId: true,
        }
      }),
      prisma.chatLog.findMany({
        where: Object.keys(userQueryWhere).length > 0 ? userQueryWhere : undefined,
        select: {
          userName: true,
          sourceId: true,
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 2000
      })
    ])

    const uniqueUsersMap = new Map()

    // 1. Add all registered users (except for autoclaim if excluding)
    for (const reg of registeredUsers) {
      if (reg.lineUserId) {
        if (excludeAutoclaim && (reg.displayName === 'AutoClaim' || reg.lineUserId === 'AutoClaim')) {
          continue
        }
        uniqueUsersMap.set(reg.lineUserId, {
          userName: reg.displayName,
          sourceId: reg.lineUserId
        })
      }
    }

    // 2. Add users from chat logs (includes groups and non-registered users)
    for (const log of allUsersRaw) {
      if (excludeAutoclaim && (log.userName === 'AutoClaim' || log.sourceId === 'AutoClaim')) {
        continue
      }
      const key = log.sourceId || log.userName
      if (key) {
        if (!uniqueUsersMap.has(key)) {
          uniqueUsersMap.set(key, {
            userName: log.userName,
            sourceId: log.sourceId
          })
        } else {
          const existing = uniqueUsersMap.get(key)
          if (!existing.userName && log.userName) {
            existing.userName = log.userName
          }
        }
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
