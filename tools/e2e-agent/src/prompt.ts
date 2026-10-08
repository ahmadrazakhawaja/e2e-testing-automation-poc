import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ChangeSet } from './changes'
import type { AgentConfig } from './config'
import { GENERATED_DIR, REPO_ROOT } from './paths'

const here = path.dirname(fileURLToPath(import.meta.url))

export const SYSTEM_PROMPT = readFileSync(path.join(here, '../prompts/system.md'), 'utf8')

const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')
const list = (dir: string) => {
  try {
    return readdirSync(path.join(REPO_ROOT, dir)).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`)
  } catch {
    return []
  }
}
const bullets = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '- (none)')

export function buildUserPrompt(changes: ChangeSet, config: AgentConfig): string {
  return `# Pull request changes (${changes.base.slice(0, 7)}...${changes.head.slice(0, 7)})

## Routes whose page changed
${bullets(changes.routes)}

## API endpoints whose handler changed
${bullets(changes.endpoints)}

## Shared UI that changed (layouts, components, composables, middleware)
${bullets(changes.sharedUi)}

## All changed files
${bullets(changes.files)}

## Existing specs (already covered — do not duplicate)
${bullets([...list('tests/e2e'), ...list(path.relative(REPO_ROOT, GENERATED_DIR))].filter((f) => f.endsWith('.spec.ts')))}

## Page objects you can reuse
${bullets(list('tests/e2e/pages'))}

## Budget
At most ${config.maxRunsPerSpec} runs per spec and ${config.maxSteps} tool-using steps in total.

## tests/e2e/CONVENTIONS.md
${read('tests/e2e/CONVENTIONS.md')}

## tests/e2e/fixtures.ts
\`\`\`ts
${read('tests/e2e/fixtures.ts')}
\`\`\`
`
}
