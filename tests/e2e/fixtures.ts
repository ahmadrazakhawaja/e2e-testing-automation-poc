import { test as base, expect } from '@playwright/test'
import { demoUser } from '../../prisma/seed-data'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { createTestUser, deleteTestUser, disconnectTestUsers, type TestUser } from './support/test-users'

type Fixtures = {
  loginPage: LoginPage
  dashboardPage: DashboardPage
  /** Signs in as the seeded demo user. Read-only use only — other tests assert its seeded data. */
  authenticated: void
  /** A fresh user with no tasks, created for this test and deleted afterwards. Not signed in. */
  testUser: TestUser
  /** Same as `testUser`, but already signed in on `page`. Use this for anything that changes data. */
  signedInUser: TestUser
}

type WorkerFixtures = {
  testUserCleanup: void
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  dashboardPage: async ({ page }, use) => use(new DashboardPage(page)),
  authenticated: async ({ page }, use) => {
    // page.request shares the browser context's cookie jar, so the session cookie sticks.
    const res = await page.request.post('/api/auth/login', {
      data: { email: demoUser.email, password: demoUser.password },
    })
    expect(res.ok()).toBeTruthy()
    await use()
  },
  testUser: async ({}, use) => {
    const user = await createTestUser()
    await use(user)
    await deleteTestUser(user.id)
  },
  signedInUser: async ({ page, testUser }, use) => {
    const res = await page.request.post('/api/auth/login', {
      data: { email: testUser.email, password: testUser.password },
    })
    expect(res.ok()).toBeTruthy()
    await use(testUser)
  },
  testUserCleanup: [
    async ({}, use) => {
      await use()
      await disconnectTestUsers()
    },
    { scope: 'worker', auto: true },
  ],
})

export { expect }
