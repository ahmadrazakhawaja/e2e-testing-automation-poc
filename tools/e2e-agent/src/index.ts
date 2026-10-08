import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { createModel, runAgent, type AgentRun } from './agent'
import { getChangeSet, hasTestableChanges } from './changes'
import { loadConfig } from './config'
import { createMockModel } from './mock-model'
import { GENERATED_DIR, REPO_ROOT } from './paths'
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt'
import { writeReport, type AgentReport } from './report'
import { createRunState, createTools } from './tools'
import { verifySpecs } from './verify'

const USAGE = `Usage: npm run agent -- --base <ref> [--head <ref>] [--base-url <url>] [--out <dir>] [--pr <number>] [--mock]

  --base       Base branch/commit the PR is compared against (required)
  --head       PR head (default: HEAD)
  --base-url   Running app to test (default: $E2E_BASE_URL)
  --out        Where report.json / report.md go (default: .e2e-agent)
  --pr         PR number, used in the report title
  --mock       Use a scripted mock model instead of the real one (no API key needed)

Model settings come from env: E2E_AGENT_API_KEY, E2E_AGENT_MODEL, E2E_AGENT_BASE_URL,
E2E_AGENT_ENABLE_THINKING, E2E_AGENT_MAX_STEPS, E2E_AGENT_MAX_RUNS_PER_SPEC.`

async function main() {
  const { values } = parseArgs({
    options: {
      base: { type: 'string' },
      head: { type: 'string', default: 'HEAD' },
      'base-url': { type: 'string', default: process.env.E2E_BASE_URL },
      out: { type: 'string', default: '.e2e-agent' },
      pr: { type: 'string' },
      mock: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help || !values.base || !values['base-url']) {
    console.log(USAGE)
    process.exit(values.help ? 0 : 2)
  }

  const baseURL = values['base-url']
  const outDir = path.resolve(REPO_ROOT, values.out)
  const config = loadConfig(process.env, values.mock ? { model: 'scripted-mock' } : {})
  if (!values.mock) {
    // Checked up front: a key sent to the wrong provider fails later with a misleading "invalid API key".
    const missing = ['E2E_AGENT_API_KEY', 'E2E_AGENT_BASE_URL'].filter((name) => !process.env[name])
    if (missing.length) {
      throw new Error(
        `Not set: ${missing.join(', ')} (or pass --mock). In GitHub Actions the key is a repository secret, ` +
          'E2E_AGENT_BASE_URL and E2E_AGENT_MODEL are repository variables (Variables tab, not Secrets).',
      )
    }
  }

  const changes = getChangeSet(values.base, values.head)
  const report: AgentReport = {
    pr: values.pr ? Number(values.pr) : undefined,
    model: config.model,
    changes,
    outcomes: [],
  }

  if (!hasTestableChanges(changes)) {
    report.skippedReason = 'No pages, API handlers or shared UI changed — nothing for the agent to test.'
    writeReport(outDir, report)
    console.log(report.skippedReason)
    return
  }

  const health = await fetch(new URL('/api/auth/me', baseURL)).catch(() => undefined)
  if (!health?.ok) throw new Error(`App is not reachable at ${baseURL} (start it first, see tools/e2e-agent/README.md)`)

  console.log(`Scope: ${[...changes.routes, ...changes.endpoints, ...changes.sharedUi].join(', ')}`)
  const pacing = config.maxRequestsPerMinute ? ` · ≤${config.maxRequestsPerMinute} requests/min` : ''
  console.log(`Model: ${config.model}${values.mock ? '' : ` via ${new URL(config.baseURL).host}`} · max ${config.maxSteps} steps${pacing}`)
  mkdirSync(GENERATED_DIR, { recursive: true })

  const state = createRunState()
  let run: AgentRun | undefined
  let loopFailed = false
  try {
    run = await runAgent({
      model: values.mock ? createMockModel() : createModel(config, console.log),
      config,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(changes, config),
      tools: createTools({ config, changes, baseURL, state }),
      log: console.log,
    })
  } catch (error) {
    // Keep whatever was written before the failure; verification below decides what survives.
    loopFailed = true
    console.error('Agent loop failed:', error instanceof Error ? error.message : error)
    report.notes = `The agent loop stopped with an error: ${error instanceof Error ? error.message : String(error)}`
  }
  if (run && !state.finish) console.warn(`Agent stopped after ${run.steps} steps without calling finish.`)

  console.log(`Verifying ${state.written.size} spec(s)…`)
  report.outcomes = await verifySpecs(state, { baseURL, timeoutMs: config.specTimeoutMs * 2 })
  report.steps = run?.steps
  report.usage = run?.usage
  report.notes = [report.notes, state.finish?.notes].filter(Boolean).join('\n\n') || undefined
  writeReport(outDir, report)

  for (const o of report.outcomes) console.log(`  ${o.status.padEnd(17)} ${o.path} (${o.tests} tests)`)
  console.log(`Report: ${path.relative(REPO_ROOT, outDir)}/report.md`)

  // A loop cut off by the provider (auth, endpoint, quota, rate limit) is an incomplete run, not an
  // outcome: fail the job so it shows up red. The report and any drafts are still written above.
  if (loopFailed) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
