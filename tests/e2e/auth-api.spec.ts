import { demoUser } from '../../prisma/seed-data'
import { expect, test } from './fixtures'

test.describe('Auth API', () => {
  test('returns 400 when credentials are missing', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: {} })
    expect(res.status()).toBe(400)
  })

  test('returns 401 for bad credentials', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: demoUser.email, password: 'nope' },
    })
    expect(res.status()).toBe(401)
  })

  test('sets an HttpOnly session cookie on success', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: demoUser.email, password: demoUser.password },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ user: { email: demoUser.email, name: demoUser.name } })
    expect(body.user).not.toHaveProperty('passwordHash')

    const cookie = res.headersArray().find((h) => h.name.toLowerCase() === 'set-cookie')?.value ?? ''
    expect(cookie).toMatch(/^session=/)
    expect(cookie).toMatch(/HttpOnly/i)
  })

  test('protects /api/tasks without a session', async ({ request }) => {
    const res = await request.get('/api/tasks')
    expect(res.status()).toBe(401)
  })
})
