import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { stepCountIs, streamText, type LanguageModel, type LanguageModelUsage } from 'ai'
import type { AgentConfig } from './config'
import { rateLimitedFetch } from './rate-limit'
import type { AgentTools } from './tools'

export function createModel(config: AgentConfig, log: (line: string) => void): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'qwen',
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    includeUsage: true,
    fetch: rateLimitedFetch({ maxPerMinute: config.maxRequestsPerMinute, max429Retries: 5, log }),
  })
  return provider.chatModel(config.model)
}

export interface AgentRun {
  steps: number
  usage: LanguageModelUsage
}

export async function runAgent(options: {
  model: LanguageModel
  config: AgentConfig
  system: string
  prompt: string
  tools: AgentTools
  log: (line: string) => void
}): Promise<AgentRun> {
  const { model, config, tools, log } = options
  let failure: unknown

  // Streaming on purpose: some Qwen deployments only allow thinking mode on streamed calls.
  const result = streamText({
    model,
    tools,
    system: options.system,
    prompt: options.prompt,
    stopWhen: [
      stepCountIs(config.maxSteps),
      ({ steps }) => steps.at(-1)?.toolCalls.some((call) => call.toolName === 'finish') ?? false,
    ],
    providerOptions:
      config.enableThinking === undefined ? undefined : { qwen: { enable_thinking: config.enableThinking } },
    onStepFinish: (step) => {
      for (const call of step.toolCalls) {
        const input = JSON.stringify(call.input)
        log(`  step ${step.stepNumber + 1}: ${call.toolName} ${input.length > 140 ? `${input.slice(0, 140)}…` : input}`)
      }
      if (step.text.trim()) log(`  step ${step.stepNumber + 1}: (text) ${step.text.trim().slice(0, 200)}`)
    },
    onError: ({ error }) => {
      failure = error
    },
  })

  await result.consumeStream()
  if (failure) throw failure

  return { steps: (await result.steps).length, usage: await result.totalUsage }
}
