import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { User } from '@prisma/client'
import type { PublicUser } from '~~/shared/types/auth'

export const SESSION_COOKIE = 'session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }
}

export async function createSession(event: H3Event, userId: string) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)

  await prisma.session.create({ data: { token, userId, expiresAt } })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    expires: expiresAt,
  })
}

export async function getSessionUser(event: H3Event): Promise<User | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } })
    return null
  }

  return session.user
}

export async function requireUser(event: H3Event): Promise<User> {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return user
}

export async function destroySession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE)
  if (token) await prisma.session.deleteMany({ where: { token } })
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}
