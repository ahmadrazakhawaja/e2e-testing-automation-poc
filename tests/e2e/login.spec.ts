import { demoTasks, demoUser } from '../../prisma/seed-data'
import { expect, test } from './fixtures'

test.describe('Login flow', () => {
  test('renders the sign-in form', async ({ loginPage }) => {
    await loginPage.goto()

    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password')
    await expect(loginPage.submitButton).toBeEnabled()
    await expect(loginPage.errorAlert).toBeHidden()
  })

  test('signs in with valid credentials and shows the dashboard', async ({ loginPage, dashboardPage }) => {
    await loginPage.goto()
    await loginPage.login(demoUser.email, demoUser.password)

    await dashboardPage.expectLoaded(demoUser.name)
    await expect(dashboardPage.currentUser).toHaveText(demoUser.email)
    await expect(dashboardPage.taskItems).toHaveCount(demoTasks.length)

    const doneCount = demoTasks.filter((t) => t.done).length
    await expect(dashboardPage.taskProgress).toHaveText(`${doneCount} of ${demoTasks.length} completed`)
  })

  test('accepts the email case-insensitively', async ({ loginPage, dashboardPage }) => {
    await loginPage.goto()
    await loginPage.login(demoUser.email.toUpperCase(), demoUser.password)

    await dashboardPage.expectLoaded(demoUser.name)
  })

  test('rejects a wrong password', async ({ loginPage, page }) => {
    await loginPage.goto()
    await loginPage.login(demoUser.email, 'wrong-password')

    await expect(loginPage.errorAlert).toHaveText('Invalid email or password')
    await expect(page).toHaveURL(/\/login/)
  })

  test('rejects an unknown email with the same generic message', async ({ loginPage, page }) => {
    await loginPage.goto()
    await loginPage.login('nobody@example.com', demoUser.password)

    await expect(loginPage.errorAlert).toHaveText('Invalid email or password')
    await expect(page).toHaveURL(/\/login/)
  })

  test('requires email and password', async ({ loginPage }) => {
    await loginPage.goto()
    await loginPage.submitButton.click()

    await expect(loginPage.errorAlert).toHaveText('Please enter your email and password.')
  })

  test('validates the email format', async ({ loginPage }) => {
    await loginPage.goto()
    await loginPage.login('not-an-email', 'whatever')

    await expect(loginPage.errorAlert).toHaveText('Please enter a valid email address.')
  })

  test('clears the error after a successful retry', async ({ loginPage, dashboardPage }) => {
    await loginPage.goto()
    await loginPage.login(demoUser.email, 'wrong-password')
    await expect(loginPage.errorAlert).toBeVisible()

    await loginPage.login(demoUser.email, demoUser.password)
    await dashboardPage.expectLoaded(demoUser.name)
  })
})

test.describe('Route protection', () => {
  test('redirects anonymous users from the dashboard to login', async ({ page, loginPage }) => {
    await page.goto('/dashboard')

    await expect(loginPage.heading).toBeVisible()
    const url = new URL(page.url())
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('redirect')).toBe('/dashboard')
  })

  test('returns to the originally requested page after login', async ({ page, loginPage, dashboardPage }) => {
    await page.goto('/dashboard')
    await expect(loginPage.heading).toBeVisible()

    await loginPage.login(demoUser.email, demoUser.password)
    await dashboardPage.expectLoaded(demoUser.name)
  })

  test('ignores off-site redirect targets', async ({ loginPage, dashboardPage }) => {
    await loginPage.goto('?redirect=//evil.example.com')
    await loginPage.login(demoUser.email, demoUser.password)

    await dashboardPage.expectLoaded(demoUser.name)
  })
})

test.describe('Authenticated session', () => {
  test('persists across a page reload', async ({ authenticated, page, dashboardPage }) => {
    await dashboardPage.goto()
    await dashboardPage.expectLoaded(demoUser.name)

    await page.reload()
    await dashboardPage.expectLoaded(demoUser.name)
  })

  test('sends signed-in users away from the login page', async ({ authenticated, page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test('logs out and blocks the dashboard again', async ({ authenticated, page, dashboardPage, loginPage }) => {
    await dashboardPage.goto()
    await dashboardPage.expectLoaded(demoUser.name)

    await dashboardPage.logoutButton.click()
    await expect(loginPage.heading).toBeVisible()

    await dashboardPage.goto()
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})
