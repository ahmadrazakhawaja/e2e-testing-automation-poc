import type { TaskItem } from '~~/shared/types/auth'
import { parseTaskTitle, taskSelect } from '~~/server/utils/tasks'

export default defineEventHandler(async (event): Promise<TaskItem> => {
  const user = await requireUser(event)
  const body = await readBody<{ title?: unknown }>(event)

  setResponseStatus(event, 201)
  return prisma.task.create({
    data: { title: parseTaskTitle(body?.title), userId: user.id },
    select: taskSelect,
  })
})
