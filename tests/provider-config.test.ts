import { expect, test } from "bun:test"
import { OpenAICompatibleProvider } from "../src/llm/client"
import { listFreeModels } from "../src/llm/models"

test("provider uses credentials configured after login", async () => {
  const originalFetch = globalThis.fetch
  let request: { url: string; authorization: string | null } | undefined
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), authorization: new Headers(init?.headers).get("authorization") }
    return new Response("data: [DONE]\n\n")
  }

  try {
    const provider = new OpenAICompatibleProvider(undefined, "https://old.example/v1")
    provider.configure("new-token", "https://new.example/v1")
    for await (const _ of provider.stream({ model: "m", messages: [], tools: [] })) {
      // Drain stream.
    }
    expect(request).toEqual({ url: "https://new.example/v1/chat/completions", authorization: "Bearer new-token" })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("model picker uses OpenRouter catalog behind Rofiant proxy", async () => {
  const originalFetch = globalThis.fetch
  let url = ""
  globalThis.fetch = async (input) => {
    url = String(input)
    return Response.json({ data: [{ id: "free-model:free", context_length: 10 }, { id: "paid-model", context_length: 20 }] })
  }

  try {
    expect(await listFreeModels("https://www.rofiant.ca/api/v1")).toEqual([{ id: "free-model:free", contextLength: 10 }])
    expect(url).toBe("https://openrouter.ai/api/v1/models")
  } finally {
    globalThis.fetch = originalFetch
  }
})
