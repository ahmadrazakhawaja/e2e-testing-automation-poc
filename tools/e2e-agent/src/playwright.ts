import { spawn } from 'node:child_process'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { createTestUser, deleteTestUser } from '../../../tests/e2e/support/test-users'
import { REPO_ROOT, toRepoRelative } from './paths'

export interface SpecTestResult {
  title: string
  outcome: 'passed' | 'failed' | 'flaky' | 'skipped'
  error?: string
}

export interface SpecRunResult {
  passed: boolean
  tests: SpecTestResult[]
  /** Errors before any test ran: syntax/type errors, bad imports, timeouts. */
  loadErrors: string[]
}

// Model-written specs run with only what Playwright needs: no API keys or tokens in their env.
const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'USER', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'TERM', 'CI',
  'PLAYWRIGHT_BROWSERS_PATH', 'XDG_CACHE_HOME', 'DATABASE_URL',
]

function specEnv(baseURL: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { E2E_BASE_URL: baseURL } // set => playwright.config.ts skips its webServer
  for (const key of ENV_ALLOWLIST) if (process.env[key] !== undefined) env[key] = process.env[key]
  return env
}

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s)

interface PwError { message?: string }
interface PwSuite {
  title: string
  specs?: { title: string; tests: { status: string; results: { status: string; error?: PwError; errors?: PwError[] }[] }[] }[]
  suites?: PwSuite[]
}
interface PwReport { suites?: PwSuite[]; errors?: PwError[] }

const OUTCOME: Record<string, SpecTestResult['outcome']> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
}

function collect(suite: PwSuite, titles: string[], out: SpecTestResult[]) {
  const scope = suite.title && !suite.title.endsWith('.spec.ts') ? [...titles, suite.title] : titles
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      const failed = test.results.find((r) => r.status !== 'passed' && r.status !== 'skipped')
      const message = failed?.error?.message ?? failed?.errors?.[0]?.message
      out.push({
        title: [...scope, spec.title].join(' › '),
        outcome: OUTCOME[test.status] ?? 'failed',
        error: message ? clip(stripAnsi(message), 1500) : undefined,
      })
    }
  }
  for (const child of suite.suites ?? []) collect(child, scope, out)
}

export function runSpec(
  file: string,
  options: { baseURL: string; timeoutMs: number; repeatEach?: number },
): Promise<SpecRunResult> {
  const args = ['test', toRepoRelative(file), '--reporter=json', '--retries=0']
  if (options.repeatEach) args.push(`--repeat-each=${options.repeatEach}`)

  return new Promise((resolve) => {
    const child = spawn(path.join(REPO_ROOT, 'node_modules/.bin/playwright'), args, {
      cwd: REPO_ROOT,
      env: specEnv(options.baseURL),
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))

    const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (signal === 'SIGKILL') {
        return resolve({ passed: false, tests: [], loadErrors: [`Timed out after ${options.timeoutMs / 1000}s`] })
      }
      let report: PwReport
      try {
        report = JSON.parse(stdout)
      } catch {
        return resolve({ passed: false, tests: [], loadErrors: [clip(stripAnsi(stderr || stdout), 3000)] })
      }
      const tests: SpecTestResult[] = []
      for (const suite of report.suites ?? []) collect(suite, [], tests)
      const loadErrors = (report.errors ?? []).map((e) => clip(stripAnsi(e.message ?? 'Unknown error'), 3000))
      const passed = code === 0 && loadErrors.length === 0 && tests.length > 0 && tests.every((t) => t.outcome === 'passed')
      resolve({ passed, tests, loadErrors })
    })
  })
}

export interface PageSnapshot {
  url: string
  title: string
  /** Playwright ARIA snapshot (YAML): roles, accessible names, text — what role/label locators see. */
  aria: string
}

/** Opens a path of the running app (optionally as a fresh signed-in user) and returns its accessibility tree. */
export async function snapshotPage(options: { baseURL: string; path: string; signedIn: boolean }): Promise<PageSnapshot> {
  if (!options.path.startsWith('/') || options.path.startsWith('//')) {
    throw new Error('path must be an app path starting with "/", e.g. "/tasks"')
  }
  const user = options.signedIn ? await createTestUser() : undefined
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ baseURL: options.baseURL })
    if (user) {
      const res = await context.request.post('/api/auth/login', { data: { email: user.email, password: user.password } })
      if (!res.ok()) throw new Error(`Could not sign in the snapshot user (HTTP ${res.status()})`)
    }
    const page = await context.newPage()
    await page.goto(options.path)
    await page.waitForLoadState('networkidle')
    return {
      url: new URL(page.url()).pathname + new URL(page.url()).search,
      title: await page.title(),
      aria: clip(await page.locator('body').ariaSnapshot(), 15_000),
    }
  } finally {
    await browser.close()
    if (user) await deleteTestUser(user.id)
  }
}
