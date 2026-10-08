import { expect, type Locator, type Page } from '@playwright/test'

export class DashboardPage {
  readonly currentUser: Locator
  readonly logoutButton: Locator
  readonly taskItems: Locator
  readonly taskProgress: Locator

  constructor(readonly page: Page) {
    this.currentUser = page.getByTestId('current-user')
    this.logoutButton = page.getByRole('button', { name: 'Log out' })
    this.taskItems = page.getByTestId('task-list').getByRole('listitem')
    this.taskProgress = page.getByTestId('task-progress')
  }

  welcomeHeading(name: string) {
    return this.page.getByRole('heading', { name: `Welcome back, ${name}` })
  }

  async goto() {
    await this.page.goto('/dashboard')
  }

  async expectLoaded(name: string) {
    await expect(this.page).toHaveURL(/\/dashboard$/)
    await expect(this.welcomeHeading(name)).toBeVisible()
  }
}
