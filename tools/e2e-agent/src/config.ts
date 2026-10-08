export interface AgentConfig {
  /** Model id as the provider names it, e.g. `qwen3.6-27b` on Alibaba Cloud Model Studio. */
  model: string
  /** OpenAI-compatible base URL (ends in /v1). */
  baseURL: string
  apiKey: string
  /** Qwen's `enable_thinking`; unset leaves the provider default. */
  enableThinking?: boolean
  /** Hard cap on model round-trips for the whole run. */
  maxSteps: number
  /** Hard cap on run_spec calls per spec, so the fix loop always ends. */
  maxRunsPerSpec: number
  specTimeoutMs: number
}

const DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

export function loadConfig(env: NodeJS.ProcessEnv, overrides: Partial<AgentConfig> = {}): AgentConfig {
  const config: AgentConfig = {
    model: env.E2E_AGENT_MODEL || 'qwen3.6-27b',
    baseURL: env.E2E_AGENT_BASE_URL || DEFAULT_BASE_URL,
    apiKey: env.E2E_AGENT_API_KEY ?? '',
    enableThinking: env.E2E_AGENT_ENABLE_THINKING ? env.E2E_AGENT_ENABLE_THINKING === 'true' : undefined,
    maxSteps: Number(env.E2E_AGENT_MAX_STEPS || 40),
    maxRunsPerSpec: Number(env.E2E_AGENT_MAX_RUNS_PER_SPEC || 5),
    specTimeoutMs: 120_000,
    ...overrides,
  }
  return config
}
