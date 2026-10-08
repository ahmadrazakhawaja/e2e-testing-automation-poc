import { existsSync, readFileSync, rmSync } from 'node:fs'
import { specPath, toRepoRelative } from './paths'
import { runSpec } from './playwright'
import type { RunState } from './tools'

export interface SpecOutcome {
  name: string
  path: string
  /** added: kept in the PR. suspected_app_bug / not_added: removed, shown in the report instead. */
  status: 'added' | 'suspected_app_bug' | 'not_added'
  agentStatus?: string
  summary: string
  tests: number
  error?: string
  content?: string
}

/**
 * Don't trust the model's own verdict: re-run every spec it wrote twice in a row. Only specs that pass
 * both times stay on disk; everything else is removed and described in the report.
 */
export async function verifySpecs(state: RunState, options: { baseURL: string; timeoutMs: number }): Promise<SpecOutcome[]> {
  const claims = new Map(state.finish?.specs.map((s) => [s.name, s]))
  const outcomes: SpecOutcome[] = []

  for (const name of [...state.written].sort()) {
    const file = specPath(name)
    if (!existsSync(file)) continue
    const claim = claims.get(name)
    const result = await runSpec(file, { ...options, repeatEach: 2 })
    const tests = new Set(result.tests.map((t) => t.title)).size
    const base = { name, path: toRepoRelative(file), agentStatus: claim?.status, summary: claim?.summary ?? '', tests }

    if (result.passed) {
      outcomes.push({ ...base, status: 'added' })
      continue
    }
    const error = result.loadErrors[0] ?? result.tests.find((t) => t.outcome !== 'passed')?.error ?? 'Unknown failure'
    outcomes.push({
      ...base,
      status: claim?.status === 'suspected_app_bug' ? 'suspected_app_bug' : 'not_added',
      error,
      content: readFileSync(file, 'utf8'),
    })
    rmSync(file)
  }
  return outcomes
}
