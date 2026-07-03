import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ authenticated: false, reason: 'Missing userId' })
    }

    const reg = await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!reg || !reg.ev7UserId) {
      return NextResponse.json({ authenticated: false, reason: 'Not mapped' })
    }

    return NextResponse.json({ 
      authenticated: true, 
      ev7UserId: reg.ev7UserId,
      role: reg.role
    })

  } catch (error: any) {
    console.error('[Check Auth API Error]', error)
    return NextResponse.json({ error: error.message }, { status: 550 })
  }
}
