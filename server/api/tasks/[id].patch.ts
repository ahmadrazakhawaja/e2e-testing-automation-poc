import type { TaskItem } from '~~/shared/types/auth'
import { parseTaskTitle, taskSelect } from '~~/server/utils/tasks'

export default defineEventHandler(async (event): Promise<TaskItem> => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ title?: unknown; done?: unknown }>(event)

  const data: { title?: string; done?: boolean } = {}
  if (body?.title !== undefined) data.title = parseTaskTitle(body.title)
  if (body?.done !== undefined) {
    if (typeof body.done !== 'boolean') throw createError({ statusCode: 400, statusMessage: '`done` must be a boolean' })
    data.done = body.done
  }

  // Scoping by userId means another user's task id behaves exactly like a missing one.
  const { count } = await prisma.task.updateMany({ where: { id, userId: user.id }, data })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  return prisma.task.findUniqueOrThrow({ where: { id }, select: taskSelect })
})
