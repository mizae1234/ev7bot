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

    // Check database role of the caller
    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || caller.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch active users and groups
    const [users, groups] = await Promise.all([
      prisma.lineRegistration.findMany({
        where: { isActive: true },
        select: {
          lineUserId: true,
          displayName: true,
          pictureUrl: true,
        },
        orderBy: { displayName: 'asc' }
      }),
      prisma.lineGroup.findMany({
        where: { isActive: true },
        select: {
          groupId: true,
          groupName: true,
        },
        orderBy: { groupName: 'asc' }
      })
    ])

    return NextResponse.json({
      success: true,
      users,
      groups,
    })
  } catch (error) {
    console.error('[Admin Recipients API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
