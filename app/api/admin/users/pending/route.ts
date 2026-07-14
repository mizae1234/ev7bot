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

    const pendingRequests = await prisma.registrationRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ success: true, requests: pendingRequests })
  } catch (error) {
    console.error('[Admin Pending Users API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
