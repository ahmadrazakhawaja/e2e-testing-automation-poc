import { execFileSync } from 'node:child_process'
import { REPO_ROOT } from './paths'

export interface ChangeSet {
  base: string
  head: string
  files: string[]
  /** App routes whose page component changed, e.g. `/tasks`. */
  routes: string[]
  /** API endpoints whose handler changed, e.g. `POST /api/tasks`. */
  endpoints: string[]
  /** Layouts, components, composables, middleware: can affect any page. */
  sharedUi: string[]
}

export function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 })
}

// app/pages/tasks/[id].vue -> /tasks/:id ; app/pages/index.vue -> /
function pageToRoute(file: string): string {
  const segments = file
    .replace(/^app\/pages\//, '')
    .replace(/\.vue$/, '')
    .split('/')
    .filter((s) => s !== 'index')
    .map((s) => s.replace(/^\[(.+)\]$/, ':$1'))
  return '/' + segments.join('/')
}

// server/api/tasks/[id].patch.ts -> PATCH /api/tasks/:id
function handlerToEndpoint(file: string): string {
  const match = file.match(/^server\/api\/(.+?)(?:\.(get|post|put|patch|delete))?\.ts$/)!
  const route = match[1]!
    .split('/')
    .filter((s) => s !== 'index')
    .map((s) => s.replace(/^\[(.+)\]$/, ':$1'))
    .join('/')
  return `${(match[2] ?? 'any').toUpperCase()} /api/${route}`.replace(/\/$/, '')
}

export function getChangeSet(base: string, head: string): ChangeSet {
  // Three dots: only what the PR branch changed since it forked from base.
  const files = git(['diff', '--name-only', '--diff-filter=AMR', `${base}...${head}`])
    .split('\n')
    .filter(Boolean)

  return {
    base,
    head,
    files,
    routes: files.filter((f) => /^app\/pages\/.+\.vue$/.test(f)).map(pageToRoute),
    endpoints: files.filter((f) => /^server\/api\/.+\.ts$/.test(f)).map(handlerToEndpoint),
    sharedUi: files.filter((f) => /^app\/(layouts|components|composables|middleware)\/|^app\/app\.vue$/.test(f)),
  }
}

export function hasTestableChanges(changes: ChangeSet): boolean {
  return changes.routes.length + changes.endpoints.length + changes.sharedUi.length > 0
}

export function fileDiff(changes: ChangeSet, file: string): string {
  return git(['diff', `${changes.base}...${changes.head}`, '--', file])
}
