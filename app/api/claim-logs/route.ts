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

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
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
        { vehicleRef: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
        { extractedDetail: { contains: search, mode: 'insensitive' } },
        { lineUserId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [claims, total, pendingCount, processedCount, cancelledCount] = await Promise.all([
      prisma.claimLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.claimLog.count({ where }),
      prisma.claimLog.count({ where: { status: 'PENDING' } }),
      prisma.claimLog.count({ where: { status: 'PROCESSED' } }),
      prisma.claimLog.count({ where: { status: 'CANCELLED' } })
    ])

    return NextResponse.json({
      claims,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        pending: pendingCount,
        processed: processedCount,
        cancelled: cancelledCount,
        total: pendingCount + processedCount + cancelledCount
      }
    })
  } catch (error) {
    console.error('[Claim Logs API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, passcode, userId } = body

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

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    const claimId = parseInt(id)
    if (isNaN(claimId)) {
      return NextResponse.json({ error: 'Invalid Claim ID' }, { status: 400 })
    }

    const claim = await prisma.claimLog.findUnique({
      where: { id: claimId }
    })

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    if (action === 'process') {
      await prisma.claimLog.update({
        where: { id: claimId },
        data: {
          status: 'PROCESSED'
        }
      })

      // Push notification to reporter if user id exists
      if (claim.lineUserId) {
        const displayRef = claim.vehicleRef ? `ของรถทะเบียน ${claim.vehicleRef}` : ''
        await pushMessage(
          claim.lineUserId,
          `🔔 บัตเตอร์ได้รับเรื่องแจ้งซ่อม ${displayRef} และนำเข้าสู่ระบบเรียบร้อยแล้วค่ะ 🛠️💛\n(รายละเอียด: ${claim.extractedDetail || claim.message})`
        )
      }

      return NextResponse.json({ success: true, status: 'PROCESSED' })
    } else if (action === 'cancel') {
      await prisma.claimLog.update({
        where: { id: claimId },
        data: {
          status: 'CANCELLED'
        }
      })

      return NextResponse.json({ success: true, status: 'CANCELLED' })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Claim Logs API PATCH Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
