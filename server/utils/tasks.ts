export const TASK_TITLE_MAX = 120

export const taskSelect = { id: true, title: true, done: true } as const

export function parseTaskTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : ''
  if (!title) throw createError({ statusCode: 400, statusMessage: 'Task title is required' })
  if (title.length > TASK_TITLE_MAX) {
    throw createError({ statusCode: 400, statusMessage: `Task title must be ${TASK_TITLE_MAX} characters or fewer` })
  }
  return title
}
