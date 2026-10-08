import type { TaskItem } from '~~/shared/types/auth'

export default defineEventHandler(async (event): Promise<TaskItem[]> => {
  const user = await requireUser(event)

  return prisma.task.findMany({
    where: { userId: user.id },
    select: { id: true, title: true, done: true },
    orderBy: { createdAt: 'asc' },
  })
})
