import type { LanguageModel } from 'ai'
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test'

// A scripted "model" for exercising the whole pipeline (tools, loop, verify, report) without an API key.
// It deliberately makes a lint mistake and a wrong first attempt so the fix loop is exercised too.
const wrongSpec = `import { test, expect } from '@playwright/test'
test('x', async () => {})
`
const specV1 = `import { expect, test } from '../fixtures'

test('shows the empty state for a new user', async ({ page, signedInUser }) => {
  await page.goto('/tasks')
  await expect(page.getByTestId('tasks-empty')).toHaveText('Nothing to see here')
})
`
const specV2 = specV1.replace("toHaveText('Nothing to see here')", "toHaveText('No tasks yet. Add your first one above.')")

const script: { toolName: string; input: unknown }[] = [
  { toolName: 'git_diff', input: { path: 'app/pages/tasks.vue' } },
  { toolName: 'snapshot_page', input: { path: '/tasks', signedIn: true } },
  { toolName: 'write_spec', input: { name: 'mock-tasks', content: wrongSpec } },
  { toolName: 'write_spec', input: { name: 'mock-tasks', content: specV1 } },
  { toolName: 'run_spec', input: { name: 'mock-tasks' } },
  { toolName: 'write_spec', input: { name: 'mock-tasks', content: specV2 } },
  { toolName: 'run_spec', input: { name: 'mock-tasks' } },
  {
    toolName: 'finish',
    input: {
      specs: [{ name: 'mock-tasks', status: 'passing', summary: 'Mock run: empty state on /tasks' }],
      notes: 'Produced by the scripted mock model, not a real LLM.',
    },
  },
]

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
}

export function createMockModel(): LanguageModel {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: 'scripted-mock',
    doStream: script.map((step, i) => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'tool-call' as const, toolCallId: `call-${i}`, toolName: step.toolName, input: JSON.stringify(step.input) },
        { type: 'finish' as const, finishReason: { unified: 'tool-calls' as const, raw: undefined }, usage },
      ]),
    })),
  })
}
