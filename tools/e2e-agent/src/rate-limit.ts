const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function retryAfterMs(res: Response): number | undefined {
  const header = res.headers.get('retry-after')
  if (!header) return undefined
  const seconds = Number(header)
  if (!Number.isNaN(seconds)) return seconds * 1000
  const date = Date.parse(header)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

/**
 * A fetch for the model provider that (1) spaces requests out to stay under `maxPerMinute` (0 = no
 * pacing) and (2) on HTTP 429 waits as long as the provider asks, then retries. The SDK's own retries
 * back off for a few seconds only, which is too short for per-minute limits.
 */
export function rateLimitedFetch(options: {
  maxPerMinute: number
  max429Retries: number
  log: (line: string) => void
}): typeof fetch {
  const gapMs = options.maxPerMinute > 0 ? Math.ceil(60_000 / options.maxPerMinute) : 0
  let nextSlot = 0

  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      // Reserve the slot before awaiting, so concurrent calls queue up instead of racing.
      const now = Date.now()
      const wait = Math.max(0, nextSlot - now)
      nextSlot = Math.max(now, nextSlot) + gapMs
      if (wait > 0) await sleep(wait)

      const res = await fetch(input, init)
      if (res.status !== 429 || attempt >= options.max429Retries) return res

      const delay = retryAfterMs(res) ?? 60_000
      options.log(`  rate limited by the model provider, waiting ${Math.ceil(delay / 1000)}s (retry ${attempt + 1}/${options.max429Retries})`)
      await res.body?.cancel()
      nextSlot = Math.max(nextSlot, Date.now() + delay)
    }
  }
}
