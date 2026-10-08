import { expect, type Locator, type Page } from '@playwright/test'

export class LoginPage {
  readonly heading: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorAlert: Locator

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Sign in' })
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.submitButton = page.getByRole('button', { name: 'Sign in' })
    this.errorAlert = page.getByRole('alert')
  }

  async goto(query = '') {
    await this.page.goto(`/login${query}`)
    await expect(this.heading).toBeVisible()
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
