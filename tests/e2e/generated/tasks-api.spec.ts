import { expect, test } from '../fixtures'

test.describe('Tasks API', () => {
  test('GET /api/tasks returns empty list for new user', async ({ page, signedInUser }) => {
    const res = await page.request.get('/api/tasks')

    expect(res.status()).toBe(200)
    const tasks = await res.json()
    expect(tasks).toEqual([])
  })

  test('POST /api/tasks creates a task', async ({ page, signedInUser }) => {
    const res = await page.request.post('/api/tasks', {
      data: { title: 'API test task' },
    })

    expect(res.status()).toBe(201)
    const task = await res.json()
    expect(task).toMatchObject({ title: 'API test task', done: false })
    expect(task.id).toBeTruthy()
  })

  test('POST /api/tasks rejects empty title', async ({ page, signedInUser }) => {
    const res = await page.request.post('/api/tasks', { data: { title: '' } })

    expect(res.status()).toBe(400)
  })

  test('POST /api/tasks rejects missing title', async ({ page, signedInUser }) => {
    const res = await page.request.post('/api/tasks', { data: {} })

    expect(res.status()).toBe(400)
  })

  test('POST /api/tasks rejects title over 120 chars', async ({ page, signedInUser }) => {
    const res = await page.request.post('/api/tasks', {
      data: { title: 'a'.repeat(121) },
    })

    expect(res.status()).toBe(400)
  })

  test('PATCH /api/tasks/:id toggles done status', async ({ page, signedInUser }) => {
    const createRes = await page.request.post('/api/tasks', {
      data: { title: 'Patchable task' },
    })
    const task = await createRes.json()

    const patchRes = await page.request.patch(`/api/tasks/${task.id}`, {
      data: { done: true },
    })

    expect(patchRes.status()).toBe(200)
    const updated = await patchRes.json()
    expect(updated.done).toBe(true)
  })

  test('PATCH /api/tasks/:id returns 404 for non-existent task', async ({
    page,
    signedInUser,
  }) => {
    const res = await page.request.patch('/api/tasks/fake-id-123', {
      data: { done: true },
    })

    expect(res.status()).toBe(404)
  })

  test('PATCH /api/tasks/:id rejects non-boolean done value', async ({
    page,
    signedInUser,
  }) => {
    const createRes = await page.request.post('/api/tasks', {
      data: { title: 'Validation task' },
    })
    const task = await createRes.json()

    const patchRes = await page.request.patch(`/api/tasks/${task.id}`, {
      data: { done: 'yes' },
    })

    expect(patchRes.status()).toBe(400)
  })

  test('DELETE /api/tasks/:id removes the task', async ({ page, signedInUser }) => {
    const createRes = await page.request.post('/api/tasks', {
      data: { title: 'Deleteable task' },
    })
    const task = await createRes.json()

    const delRes = await page.request.delete(`/api/tasks/${task.id}`)

    expect(delRes.status()).toBe(204)

    const getRes = await page.request.get('/api/tasks')
    const tasks = await getRes.json()
    expect(tasks).not.toContainEqual(expect.objectContaining({ id: task.id }))
  })

  test('DELETE /api/tasks/:id returns 404 for non-existent task', async ({
    page,
    signedInUser,
  }) => {
    const res = await page.request.delete('/api/tasks/fake-id-456')

    expect(res.status()).toBe(404)
  })
})
