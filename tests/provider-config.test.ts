import { expect, test } from "bun:test"
import { OpenAICompatibleProvider } from "../src/llm/client"

test("provider uses credentials configured after login", async () => {
  const originalFetch = globalThis.fetch
  let request: { url: string; authorization: string | null; body: Record<string, unknown> } | undefined
  globalThis.fetch = async (input, init) => {
    request = {
      url: String(input),
      authorization: new Headers(init?.headers).get("authorization"),
      body: JSON.parse(String(init?.body)),
    }
    return new Response("data: [DONE]\n\n")
  }

  try {
    const provider = new OpenAICompatibleProvider(undefined, "https://old.example/v1")
    provider.configure("new-token", "https://new.example/v1")
    for await (const _ of provider.stream({ model: "m", messages: [], tools: [] })) {
      // Drain stream.
    }
    expect(request?.url).toBe("https://new.example/v1/chat/completions")
    expect(request?.authorization).toBe("Bearer new-token")
    expect(request?.body.reasoning_effort).toBeUndefined()
  } finally {
    globalThis.fetch = originalFetch
  }
})
