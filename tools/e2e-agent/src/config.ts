export interface AgentConfig {
  /** Model id as the provider names it, e.g. `qwen3.6-27b` on Alibaba Cloud Model Studio. */
  model: string
  /** OpenAI-compatible base URL (ends in /v1). Required: the key only works with its own provider. */
  baseURL: string
  apiKey: string
  /** Qwen's `enable_thinking`; unset leaves the provider default. */
  enableThinking?: boolean
  /** Hard cap on model round-trips for the whole run. */
  maxSteps: number
  /** Hard cap on run_spec calls per spec, so the fix loop always ends. */
  maxRunsPerSpec: number
  /** Space model requests to stay under the provider's per-minute limit; 0 = no pacing. */
  maxRequestsPerMinute: number
  specTimeoutMs: number
}

export function loadConfig(env: NodeJS.ProcessEnv, overrides: Partial<AgentConfig> = {}): AgentConfig {
  const config: AgentConfig = {
    model: env.E2E_AGENT_MODEL || 'qwen3.6-27b',
    baseURL: env.E2E_AGENT_BASE_URL ?? '',
    apiKey: env.E2E_AGENT_API_KEY ?? '',
    enableThinking: env.E2E_AGENT_ENABLE_THINKING ? env.E2E_AGENT_ENABLE_THINKING === 'true' : undefined,
    maxSteps: Number(env.E2E_AGENT_MAX_STEPS || 40),
    maxRunsPerSpec: Number(env.E2E_AGENT_MAX_RUNS_PER_SPEC || 5),
    maxRequestsPerMinute: Number(env.E2E_AGENT_MAX_RPM || 0),
    specTimeoutMs: 120_000,
    ...overrides,
  }
  return config
}
