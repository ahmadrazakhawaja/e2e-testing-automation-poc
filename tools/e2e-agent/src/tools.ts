import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tool } from 'ai'
import { z } from 'zod'
import type { ChangeSet } from './changes'
import { fileDiff } from './changes'
import type { AgentConfig } from './config'
import { GENERATED_DIR, resolveInRepo, SPEC_NAME, specPath, toRepoRelative } from './paths'
import { runSpec, snapshotPage, type SpecRunResult } from './playwright'

export const SPEC_STATUSES = ['passing', 'suspected_app_bug', 'gave_up'] as const

export interface FinishReport {
  specs: { name: string; status: (typeof SPEC_STATUSES)[number]; summary: string }[]
  notes?: string
}

/** Everything the tools record during a run; read afterwards by verify/report. */
export interface RunState {
  written: Set<string>
  runs: Map<string, number>
  lastResult: Map<string, SpecRunResult>
  finish?: FinishReport
}

export function createRunState(): RunState {
  return { written: new Set(), runs: new Map(), lastResult: new Map() }
}

const MAX_READ_LINES = 400
const MAX_SPEC_LINES = 400
const SKIP_DIRS = new Set(['node_modules', '.git', '.nuxt', '.nuxt-e2e', '.output', 'test-results', 'playwright-report'])

/** Deterministic rules from tests/e2e/CONVENTIONS.md, enforced instead of just prompted. */
export function lintSpec(content: string): string[] {
  const problems: string[] = []
  if (!/from ['"]\.\.\/fixtures['"]/.test(content)) problems.push(`Import test/expect from '../fixtures'.`)
  if (/from ['"]@playwright\/test['"]/.test(content)) problems.push(`Do not import from '@playwright/test'; use '../fixtures'.`)
  if (/\.(only)\(/.test(content)) problems.push('Remove .only().')
  if (/waitForTimeout\(/.test(content)) problems.push('Do not use page.waitForTimeout(); use web-first assertions.')
  if (/demo@example\.com|demoUser|[{,]\s*authenticated\s*[,}]/.test(content)) {
    problems.push('Do not use the seeded demo user; use the signedInUser or testUser fixture.')
  }
  if (content.split('\n').length > MAX_SPEC_LINES) problems.push(`Keep a spec under ${MAX_SPEC_LINES} lines.`)
  return problems
}

// Tools return { error } instead of throwing, so the model sees what went wrong and can correct itself.
async function safely<T>(fn: () => Promise<T> | T): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export function createTools(ctx: { config: AgentConfig; changes: ChangeSet; baseURL: string; state: RunState }) {
  const { config, changes, baseURL, state } = ctx

  return {
    list_files: tool({
      description: 'List files under a repository directory (recursive, max 200 entries).',
      inputSchema: z.object({ dir: z.string().describe('Repo-relative directory, e.g. "tests/e2e" or "app/pages"') }),
      execute: ({ dir }) =>
        safely(() => {
          const root = resolveInRepo(dir)
          const files: string[] = []
          const walk = (abs: string) => {
            for (const entry of readdirSync(abs, { withFileTypes: true })) {
              if (files.length >= 200 || SKIP_DIRS.has(entry.name)) continue
              const child = path.join(abs, entry.name)
              if (entry.isDirectory()) walk(child)
              else files.push(toRepoRelative(child))
            }
          }
          walk(root)
          return { files }
        }),
    }),

    read_file: tool({
      description: `Read a repository file with line numbers (max ${MAX_READ_LINES} lines per call).`,
      inputSchema: z.object({
        path: z.string().describe('Repo-relative path, e.g. "app/pages/tasks.vue"'),
        startLine: z.number().int().min(1).optional(),
      }),
      execute: ({ path: file, startLine = 1 }) =>
        safely(() => {
          const abs = resolveInRepo(file)
          if (!statSync(abs).isFile()) throw new Error(`Not a file: ${file}`)
          const lines = readFileSync(abs, 'utf8').split('\n')
          const end = Math.min(lines.length, startLine - 1 + MAX_READ_LINES)
          return {
            path: file,
            totalLines: lines.length,
            content: lines.slice(startLine - 1, end).map((l, i) => `${startLine + i}: ${l}`).join('\n'),
            ...(end < lines.length && { next: `More lines remain; call again with startLine ${end + 1}.` }),
          }
        }),
    }),

    git_diff: tool({
      description: 'Show what this pull request changed in one file (unified diff against the base branch).',
      inputSchema: z.object({ path: z.string() }),
      execute: ({ path: file }) =>
        safely(() => {
          resolveInRepo(file)
          const diff = fileDiff(changes, file)
          return { path: file, diff: diff.length > 20_000 ? `${diff.slice(0, 20_000)}\n…(truncated)` : diff || '(no changes)' }
        }),
    }),

    snapshot_page: tool({
      description:
        'Open a page of the running app in a real browser and return its accessibility tree (roles, accessible names, ' +
        'text). Use it before writing locators. With signedIn=true a fresh user with no tasks is signed in first.',
      inputSchema: z.object({
        path: z.string().describe('App path starting with "/", e.g. "/tasks"'),
        signedIn: z.boolean(),
      }),
      execute: ({ path: appPath, signedIn }) => safely(() => snapshotPage({ baseURL, path: appPath, signedIn })),
    }),

    write_spec: tool({
      description:
        'Create or overwrite tests/e2e/generated/<name>.spec.ts. The content is checked against the conventions ' +
        'and rejected with a list of problems if it breaks them.',
      inputSchema: z.object({
        name: z.string().regex(SPEC_NAME).describe('Lowercase-dashed name, e.g. "tasks-page"'),
        content: z.string().describe('Full TypeScript source of the spec file'),
      }),
      execute: ({ name, content }) =>
        safely(() => {
          const problems = lintSpec(content)
          if (problems.length) return { written: false, problems }
          mkdirSync(GENERATED_DIR, { recursive: true })
          writeFileSync(specPath(name), content.endsWith('\n') ? content : `${content}\n`)
          state.written.add(name)
          return { written: true, path: toRepoRelative(specPath(name)) }
        }),
    }),

    run_spec: tool({
      description:
        `Run one generated spec against the running app and get per-test results with error messages. ` +
        `Each spec can be run at most ${config.maxRunsPerSpec} times.`,
      inputSchema: z.object({ name: z.string().regex(SPEC_NAME) }),
      execute: ({ name }) =>
        safely(async () => {
          const file = specPath(name)
          if (!existsSync(file)) throw new Error(`No spec named "${name}"; write it with write_spec first.`)
          const used = state.runs.get(name) ?? 0
          if (used >= config.maxRunsPerSpec) {
            return { error: `Run limit reached for "${name}". Decide its status and call finish.` }
          }
          state.runs.set(name, used + 1)
          const result = await runSpec(file, { baseURL, timeoutMs: config.specTimeoutMs })
          state.lastResult.set(name, result)
          return { ...result, runsLeft: config.maxRunsPerSpec - used - 1 }
        }),
    }),

    delete_spec: tool({
      description: 'Delete a generated spec you no longer want to keep.',
      inputSchema: z.object({ name: z.string().regex(SPEC_NAME) }),
      execute: ({ name }) =>
        safely(() => {
          rmSync(specPath(name), { force: true })
          state.written.delete(name)
          return { deleted: true }
        }),
    }),

    finish: tool({
      description:
        'Call exactly once when you are done. List every spec you wrote with its status: "passing" (all tests pass), ' +
        '"suspected_app_bug" (the test is right but the app misbehaves — explain), or "gave_up".',
      inputSchema: z.object({
        specs: z.array(
          z.object({
            name: z.string().regex(SPEC_NAME),
            status: z.enum(SPEC_STATUSES),
            summary: z.string().max(600).describe('What the spec covers; for suspected bugs, what the app does wrong'),
          }),
        ),
        notes: z.string().max(2000).optional().describe('Anything a reviewer should know'),
      }),
      execute: (report) => {
        state.finish = report
        return { recorded: true }
      },
    }),
  }
}

export type AgentTools = ReturnType<typeof createTools>
