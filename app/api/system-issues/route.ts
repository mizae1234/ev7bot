import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { lineClient } from '@/lib/line'

export const dynamic = 'force-dynamic'

async function pushMessage(userId: string, message: string) {
  if (env.MOCK_MODE) {
    console.log(`[Mock Butter] Push to ${userId}:`, message)
    return
  }
  try {
    await lineClient.pushMessage(userId, { type: 'text', text: message })
  } catch (err) {
    console.error(`[Butter pushMessage Error]`, err)
  }
}

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
    const status = searchParams.get('status') || 'all'

    const skip = (page - 1) * limit
    const where: any = {}

    if (status !== 'all') {
      where.status = status
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { lineUserId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [issues, total, openCount, resolvedCount, cancelledCount] = await Promise.all([
      prisma.systemIssue.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.systemIssue.count({ where }),
      prisma.systemIssue.count({ where: { status: 'OPEN' } }),
      prisma.systemIssue.count({ where: { status: 'RESOLVED' } }),
      prisma.systemIssue.count({ where: { status: 'CANCELLED' } })
    ])

    return NextResponse.json({
      issues,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        open: openCount,
        resolved: resolvedCount,
        cancelled: cancelledCount,
        total: openCount + resolvedCount + cancelledCount
      }
    })
  } catch (error) {
    console.error('[System Issues API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, passcode } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const issueId = parseInt(id)
    if (isNaN(issueId)) {
      return NextResponse.json({ error: 'Invalid Issue ID' }, { status: 400 })
    }

    const issue = await prisma.systemIssue.findUnique({
      where: { id: issueId }
    })

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }

    if (action === 'resolve') {
      await prisma.systemIssue.update({
        where: { id: issueId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date()
        }
      })

      // Push notification to reporter
      if (issue.lineUserId) {
        await pushMessage(
          issue.lineUserId,
          `🔔 ปัญหาเลขที่แจ้ง #${issueId} ที่คุณได้รายงานไว้:\n"${issue.description}"\n\nได้รับการแก้ไขเรียบร้อยแล้วค่ะ! ✨ ขอบคุณที่แจ้งปัญหาเข้ามานะคะ 💛`
        )
      }

      return NextResponse.json({ success: true, status: 'RESOLVED' })
    } else if (action === 'cancel') {
      await prisma.systemIssue.update({
        where: { id: issueId },
        data: {
          status: 'CANCELLED'
        }
      })

      return NextResponse.json({ success: true, status: 'CANCELLED' })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[System Issues API PATCH Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
