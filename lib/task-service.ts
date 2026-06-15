import { prisma } from './prisma'

export interface CreateTaskInput {
  vehicleRef?: string
  assigneeName?: string
  taskDetail: string
  dueDate?: Date | string
  createUserId?: string
  createUserName?: string
  alertTarget?: string
  groupId?: string
  assigneeLineUserId?: string
}

export async function createTaskNote(input: CreateTaskInput) {
  let alertTarget = input.alertTarget || 'NONE'
  let groupId = input.groupId || null
  let assigneeLineUserId = input.assigneeLineUserId || null

  // If assigneeLineUserId was not provided, let's try to resolve it from the assigneeName
  if (!assigneeLineUserId && input.assigneeName && input.assigneeName !== 'ยังไม่ทราบผู้รับผิดชอบ') {
    try {
      const matchedUser = await prisma.lineRegistration.findFirst({
        where: {
          isActive: true,
          displayName: {
            contains: input.assigneeName,
            mode: 'insensitive'
          }
        }
      })
      if (matchedUser) {
        assigneeLineUserId = matchedUser.lineUserId
      }
    } catch (err) {
      console.error('[createTaskNote] Failed to auto-resolve assignee Line ID:', err)
    }
  }

  return await prisma.taskNote.create({
    data: {
      vehicleRef: input.vehicleRef || null,
      assigneeName: input.assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ',
      taskDetail: input.taskDetail,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createUserId: input.createUserId || null,
      createUserName: input.createUserName || null,
      status: 'PENDING',
      alertTarget,
      groupId,
      assigneeLineUserId,
    },
  })
}

export async function getPendingTasks(vehicleRef?: string, assigneeName?: string) {
  const where: any = { status: 'PENDING' }

  if (vehicleRef) {
    where.vehicleRef = {
      contains: vehicleRef,
      mode: 'insensitive',
    }
  }

  if (assigneeName) {
    where.assigneeName = {
      contains: assigneeName,
      mode: 'insensitive',
    }
  }

  return await prisma.taskNote.findMany({
    where,
    orderBy: [
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
  })
}

export async function completeTaskNote(id: number) {
  return await prisma.taskNote.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  })
}
