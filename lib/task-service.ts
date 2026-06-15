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

export async function getPendingTasks(vehicleRef?: string) {
  if (vehicleRef) {
    // Search for tasks matching the vehicle reference (case-insensitive)
    return await prisma.taskNote.findMany({
      where: {
        status: 'PENDING',
        vehicleRef: {
          contains: vehicleRef,
          mode: 'insensitive',
        },
      },
      orderBy: [
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    })
  }

  // Get all pending tasks
  return await prisma.taskNote.findMany({
    where: {
      status: 'PENDING',
    },
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
