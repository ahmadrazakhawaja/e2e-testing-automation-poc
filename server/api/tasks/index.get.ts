import type { TaskItem } from '~~/shared/types/auth'
import { taskSelect } from '~~/server/utils/tasks'

export default defineEventHandler(async (event): Promise<TaskItem[]> => {
  const user = await requireUser(event)

  return prisma.task.findMany({
    where: { userId: user.id },
    select: taskSelect,
    orderBy: { createdAt: 'asc' },
  })
})
