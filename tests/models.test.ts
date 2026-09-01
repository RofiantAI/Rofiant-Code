import { expect, test } from "bun:test"
import { listModels } from "../src/llm/models"

test("model catalog comes from the selected provider", async () => {
  const originalFetch = globalThis.fetch
  let url = ""
  let authorization: string | null = null
  globalThis.fetch = async (input, init) => {
    url = String(input)
    authorization = new Headers(init?.headers).get("authorization")
    return Response.json({ data: [{ id: "gpt-5-mini" }, { id: "vendor/free:free" }] })
  }
  try {
    const models = await listModels("https://api.openai.com/v1", "sk-test")
    expect(url).toBe("https://api.openai.com/v1/models")
    expect(authorization).toBe("Bearer sk-test")
    expect(models?.map((model) => model.id)).toEqual(["gpt-5-mini", "vendor/free:free"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("Rofiant uses OpenRouter's public free-model catalog", async () => {
  const originalFetch = globalThis.fetch
  let url = ""
  globalThis.fetch = async (input) => {
    url = String(input)
    return Response.json({ data: [{ id: "paid/model" }, { id: "free/model:free" }] })
  }
  try {
    const models = await listModels("https://www.rofiant.ca/api/v1", "private-token")
    expect(url).toBe("https://openrouter.ai/api/v1/models")
    expect(models?.map((model) => model.id)).toEqual(["free/model:free"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("the public Supabase ai-proxy default also uses OpenRouter's catalog", async () => {
  const originalFetch = globalThis.fetch
  let url = ""
  globalThis.fetch = async (input) => {
    url = String(input)
    return Response.json({ data: [{ id: "paid/model" }, { id: "free/model:free" }] })
  }
  try {
    const models = await listModels("https://oqqyqbftzesizwhbnspg.supabase.co/functions/v1/ai-proxy", undefined)
    expect(url).toBe("https://openrouter.ai/api/v1/models")
    expect(models?.map((model) => model.id)).toEqual(["free/model:free"])
  } finally {
    globalThis.fetch = originalFetch
  }
})
