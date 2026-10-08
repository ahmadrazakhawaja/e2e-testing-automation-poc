import { test as base, expect } from '@playwright/test'
import { demoUser } from '../../prisma/seed-data'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

type Fixtures = {
  loginPage: LoginPage
  dashboardPage: DashboardPage
  /** Signs in through the API (fast) so tests that aren't about the login UI start authenticated. */
  authenticated: void
}

export const test = base.extend<Fixtures>({
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
})

export { expect }
