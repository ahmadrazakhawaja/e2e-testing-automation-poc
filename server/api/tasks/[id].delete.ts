export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')!

  const { count } = await prisma.task.deleteMany({ where: { id, userId: user.id } })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Task not found' })

  setResponseStatus(event, 204)
  return null
})
