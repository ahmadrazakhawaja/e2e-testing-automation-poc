# e2e-agent

An AI agent that writes Playwright tests for the pages and API endpoints a pull request changed, runs
them against the running app, fixes them, and hands back only the ones that pass.

- **Loop:** [Vercel AI SDK](https://ai-sdk.dev) (`streamText` + our own tools), provider-agnostic.
- **Model:** Qwen3.6-27B on Alibaba Cloud Model Studio via its OpenAI-compatible API (configurable).
- **Runs:** as a GitHub Actions job (`.github/workflows/e2e-agent.yml`) — nothing to deploy — or locally.

## How a run works

1. `git diff base...head` → changed routes (`app/pages/**`), endpoints (`server/api/**`) and shared UI.
   No testable changes → writes a "nothing to test" report and exits without calling the model.
2. The model gets the change summary, `tests/e2e/CONVENTIONS.md` and `tests/e2e/fixtures.ts`, then works
   through its tools until it calls `finish` or hits the step limit.
3. **Verification (no model involved):** every spec it wrote is re-run twice. Only specs that pass both
   times stay in `tests/e2e/generated/`; the rest are deleted and described in the report.
4. Writes `.e2e-agent/report.json` and `.e2e-agent/report.md` (the agent PR's description).

## Tools

| Tool | What it does | Guard rails |
| --- | --- | --- |
| `list_files` / `read_file` | Browse the repo | Repo-relative only; `.env*`, `*.db`, `node_modules`, `.git`, build output refused |
| `git_diff` | The PR's diff for one file | Same path rules |
| `snapshot_page` | Opens an app path in Chromium (optionally as a fresh signed-in user) and returns its accessibility tree | App paths only (`/…`), throwaway user deleted afterwards |
| `write_spec` | Writes `tests/e2e/generated/<name>.spec.ts` | Name pattern enforced; lint rejects `@playwright/test` imports, `.only`, `waitForTimeout`, the demo user |
| `run_spec` | Runs one spec, returns per-test results and errors | Max runs per spec; runs with a minimal env (no API key, no GitHub token) |
| `delete_spec` | Drops a spec | Generated dir only |
| `finish` | Final per-spec status: `passing` / `suspected_app_bug` / `gave_up` | Ends the loop |

## Configuration (env)

| Variable | Default | Notes |
| --- | --- | --- |
| `E2E_AGENT_API_KEY` | — | Required unless `--mock`. GitHub: repository **secret** |
| `E2E_AGENT_MODEL` | `qwen3.6-27b` | Model id as your provider names it. GitHub: repository **variable** |
| `E2E_AGENT_BASE_URL` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Any OpenAI-compatible `/v1` URL; Model Studio also has per-workspace regional URLs. GitHub: **variable** |
| `E2E_AGENT_ENABLE_THINKING` | provider default | `true`/`false` → Qwen's `enable_thinking` |
| `E2E_AGENT_MAX_STEPS` | `40` | Model round-trips per run |
| `E2E_AGENT_MAX_RUNS_PER_SPEC` | `5` | Bounds the fix loop |

## Running locally

```bash
# 1. Start the app against the e2e database
export DATABASE_URL="file:$PWD/prisma/e2e.db"
npm run db:setup && NUXT_BUILD_DIR=.nuxt-e2e npm run build && PORT=3100 npm start &

# 2a. Real model
E2E_AGENT_API_KEY=… npm run agent -- --base master --base-url http://localhost:3100

# 2b. Scripted mock model: exercises tools, loop, verification and report without an API key
npm run agent -- --base master --base-url http://localhost:3100 --mock
```

Generated specs land in `tests/e2e/generated/`, the report in `.e2e-agent/`. `npm run agent:typecheck`
type-checks the agent.

## In CI

Add the **`e2e-agent` label** to a PR. The workflow then:

1. **generate** (read-only token): builds and starts the app, runs the agent, runs the full suite
   (existing + generated), uploads the specs and report.
2. **publish**: pushes the specs to `e2e-agent/pr-<number>` and opens (or updates) a PR **into the source
   PR's branch**, with the report as its description. If nothing passed, it comments the report on the
   source PR instead.

New pushes to the labelled PR re-run it and update the same agent PR. Setup:
- Secret `E2E_AGENT_API_KEY`; optional variables `E2E_AGENT_MODEL`, `E2E_AGENT_BASE_URL`.
- Settings → Actions → General → **Allow GitHub Actions to create and approve pull requests**.
- A label named `e2e-agent`.

PRs opened with the workflow token don't trigger other workflows, so the agent PR shows no CI checks;
the generate job already ran the full suite on exactly those files.
