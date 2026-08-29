// Proxies chat completions to the real provider, keeping PROVIDER_API_KEY out of client .env.
// GATEWAY_TOKEN gates access — this URL is public, so without it anyone could burn the provider key.
const PROVIDER_URL = "https://openrouter.ai/api/v1/chat/completions"

Deno.serve(async (req) => {
  const gatewayToken = Deno.env.get("GATEWAY_TOKEN")
  const auth = req.headers.get("authorization")
  if (!gatewayToken || auth !== `Bearer ${gatewayToken}`) {
    return new Response("Unauthorized", { status: 401 })
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
