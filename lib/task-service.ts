import { prisma } from './prisma'

export interface CreateTaskInput {
  vehicleRef?: string
  assigneeName?: string
  taskDetail: string
  dueDate?: Date | string
  createUserId?: string
  createUserName?: string
}

export async function createTaskNote(input: CreateTaskInput) {
  return await prisma.taskNote.create({
    data: {
      vehicleRef: input.vehicleRef || null,
      assigneeName: input.assigneeName || 'ยังไม่ทราบผู้รับผิดชอบ',
      taskDetail: input.taskDetail,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      createUserId: input.createUserId || null,
      createUserName: input.createUserName || null,
      status: 'PENDING',
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
