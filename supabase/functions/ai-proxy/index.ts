// Proxies chat completions to the real provider, keeping PROVIDER_API_KEY out of client .env.
// No auth gate — CLI default is login-free, so this endpoint is public.
const PROVIDER_URL = "https://openrouter.ai/api/v1/chat/completions"

const RATE_LIMIT = 20 // requests per IP per window
const WINDOW_MS = 60_000

// ponytail: in-memory, per-isolate — resets on cold start and isn't shared across
// regions/instances, so it caps a single abusive client, not global spend. Move to
// a Postgres-backed counter (this project already has one) if that's not enough.
const hits = new Map<string, { count: number; windowStart: number }>()

export function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

Deno.serve(async (req) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  if (rateLimited(ip)) {
    return new Response("Rate limit exceeded", { status: 429 })
  }

  const res = await fetch(PROVIDER_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${Deno.env.get("PROVIDER_API_KEY")}`,
    },
    body: req.body,
  })

  return new Response(res.body, { status: res.status, headers: res.headers })
})
