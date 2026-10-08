import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Talks to the same database as the app under test (DATABASE_URL, set in playwright.config.ts).
let prisma: PrismaClient | undefined
const db = () => (prisma ??= new PrismaClient())

export const TEST_USER_PASSWORD = 'Password123!'
let passwordHash: Promise<string> | undefined

export interface TestUser {
  id: string
  name: string
  email: string
  password: string
}

/** Creates a throwaway user with no tasks (or the given ones), isolated from the seeded demo data. */
export async function createTestUser(options: { tasks?: { title: string; done?: boolean }[] } = {}): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8)
  const user = await db().user.create({
    data: {
      name: `Test User ${suffix}`,
      email: `e2e-${suffix}@example.test`,
      passwordHash: await (passwordHash ??= bcrypt.hash(TEST_USER_PASSWORD, 10)),
      tasks: options.tasks ? { create: options.tasks } : undefined,
    },
  })
  return { id: user.id, name: user.name, email: user.email, password: TEST_USER_PASSWORD }
}

/** Deletes the user; sessions and tasks go with it (onDelete: Cascade). */
export async function deleteTestUser(id: string) {
  await db().user.deleteMany({ where: { id } })
}

export async function disconnectTestUsers() {
  await prisma?.$disconnect()
  prisma = undefined
}
