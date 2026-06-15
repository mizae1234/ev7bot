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

    if (!caller || (caller.role !== 'USER' && caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    }

    // Direct fetch by single ID if provided
    const targetIdStr = searchParams.get('id')
    if (targetIdStr) {
      const targetId = parseInt(targetIdStr, 10)
      if (!isNaN(targetId)) {
        const task = await prisma.taskNote.findUnique({ where: { id: targetId } })
        return NextResponse.json({ tasks: task ? [task] : [], total: task ? 1 : 0 })
      }
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
        { assigneeName: { contains: search, mode: 'insensitive' } },
        { taskDetail: { contains: search, mode: 'insensitive' } },
        { vehicleRef: { contains: search, mode: 'insensitive' } }
      ]
    }

    const [tasks, total, pendingCount, completedCount] = await Promise.all([
      prisma.taskNote.findMany({
        where,
        orderBy: [
          { status: 'asc' }, // PENDING first
          { dueDate: 'asc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.taskNote.count({ where }),
      prisma.taskNote.count({ where: { status: 'PENDING' } }),
      prisma.taskNote.count({ where: { status: 'COMPLETED' } })
    ])

    return NextResponse.json({
      tasks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        pending: pendingCount,
        completed: completedCount,
        total: pendingCount + completedCount
      }
    })
  } catch (error) {
    console.error('[Tasks API GET Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { passcode, userId, vehicleRef, assigneeName, taskDetail, dueDate } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN', displayName: 'Developer' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    if (!taskDetail) {
      return NextResponse.json({ error: 'Missing taskDetail' }, { status: 400 })
    }

    const task = await prisma.taskNote.create({
      data: {
        vehicleRef: vehicleRef || null,
        assigneeName: assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ',
        taskDetail,
        dueDate: dueDate ? new Date(dueDate) : null,
        createUserId: userId,
        createUserName: caller.displayName || null,
        status: 'PENDING'
      }
    })

    return NextResponse.json({ success: true, task })
  } catch (error) {
    console.error('[Tasks API POST Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, action, passcode, userId, vehicleRef, assigneeName, taskDetail, dueDate } = body

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    const taskId = parseInt(id)
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid Task ID' }, { status: 400 })
    }

    const task = await prisma.taskNote.findUnique({
      where: { id: taskId }
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (action === 'resolve') {
      const updated = await prisma.taskNote.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })
      return NextResponse.json({ success: true, task: updated })
    } else if (action === 'edit') {
      const updated = await prisma.taskNote.update({
        where: { id: taskId },
        data: {
          vehicleRef: vehicleRef || null,
          assigneeName: assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ',
          taskDetail: taskDetail || task.taskDetail,
          dueDate: dueDate ? new Date(dueDate) : null
        }
      })
      return NextResponse.json({ success: true, task: updated })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Tasks API PATCH Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const passcode = searchParams.get('passcode')
    const userId = searchParams.get('userId')
    const idStr = searchParams.get('id')

    if (passcode !== 'ev7admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId || !idStr) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const caller = userId === 'usr_mock_dev' ? { role: 'SUPER_ADMIN' } : await prisma.lineRegistration.findUnique({
      where: { lineUserId: userId }
    })

    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    const taskId = parseInt(idStr, 10)
    if (isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    await prisma.taskNote.delete({
      where: { id: taskId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Tasks API DELETE Error]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
