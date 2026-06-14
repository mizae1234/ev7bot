import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Treat local dev mock user as SUPER_ADMIN
    if (userId === 'usr_mock_dev') {
      return NextResponse.json({
        userId,
        role: 'SUPER_ADMIN',
        isActive: true,
        displayName: 'คุณ เนย (Dev Mode)',
        pictureUrl: null,
      })
    }

    const reg = await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId },
    })

    if (!reg) {
      return NextResponse.json({
        userId,
        role: 'USER',
        isActive: false,
        displayName: null,
        pictureUrl: null,
      })
    }

    return NextResponse.json({
      userId: reg.lineUserId,
      role: reg.role,
      isActive: reg.isActive,
      displayName: reg.displayName,
      pictureUrl: reg.pictureUrl,
    })
  } catch (error) {
    console.error('[Auth Role API Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
