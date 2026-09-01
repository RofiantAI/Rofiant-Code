// Proxies chat completions to the real provider, keeping PROVIDER_API_KEY out of client .env.
// ponytail: no auth gate — CLI default is login-free, so this endpoint is public and
// unmetered. Add per-IP rate limiting here if PROVIDER_API_KEY usage spikes.
const PROVIDER_URL = "https://openrouter.ai/api/v1/chat/completions"

Deno.serve(async (req) => {
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
