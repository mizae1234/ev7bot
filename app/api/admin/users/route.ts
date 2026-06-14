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

    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || 'all'
    const status = searchParams.get('status') || 'all'

    const skip = (page - 1) * limit
    const where: any = {}

    if (role !== 'all') {
      where.role = role
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    if (search) {
      where.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { lineUserId: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [users, total, totalSuperAdmin, totalAdmin, totalUser] = await Promise.all([
      prisma.lineRegistration.findMany({
        where,
        orderBy: { registeredAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.lineRegistration.count({ where }),
      prisma.lineRegistration.count({ where: { role: 'SUPER_ADMIN' } }),
      prisma.lineRegistration.count({ where: { role: 'ADMIN' } }),
      prisma.lineRegistration.count({ where: { role: 'USER' } })
    ])

    return NextResponse.json({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalSuperAdmin,
        totalAdmin,
        totalUser,
        total: totalSuperAdmin + totalAdmin + totalUser
      }
    })
  } catch (error) {
    console.error('[Admin Users API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { lineUserId, role, isActive, passcode } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!lineUserId) {
      return NextResponse.json({ error: 'Missing lineUserId' }, { status: 400 })
    }

    const user = await prisma.lineRegistration.findUnique({
      where: { lineUserId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: any = {}
    if (role !== undefined) {
      if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updateData.role = role
    }
    if (isActive !== undefined) {
      updateData.isActive = !!isActive
    }

    const updatedUser = await prisma.lineRegistration.update({
      where: { lineUserId },
      data: updateData
    })

    return NextResponse.json({ success: true, user: updatedUser })
  } catch (error) {
    console.error('[Admin Users API PATCH Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
