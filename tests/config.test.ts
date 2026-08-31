import { expect, test } from "bun:test"
import { join } from "node:path"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { loadConfig } from "../src/config"
import { saveAuth } from "../src/auth/store"

// .env sets AI_API_KEY/AI_BASE_URL for real local dev use, which would otherwise win over
// every saved-auth case below and mask what this file is actually testing.
function withoutAiEnv<T>(fn: () => T): T {
  const savedKey = Bun.env.AI_API_KEY
  const savedUrl = Bun.env.AI_BASE_URL
  const savedModel = Bun.env.AI_MODEL
  delete Bun.env.AI_API_KEY
  delete Bun.env.AI_BASE_URL
  delete Bun.env.AI_MODEL
  try {
    return fn()
  } finally {
    if (savedKey !== undefined) Bun.env.AI_API_KEY = savedKey
    if (savedUrl !== undefined) Bun.env.AI_BASE_URL = savedUrl
    if (savedModel !== undefined) Bun.env.AI_MODEL = savedModel
  }
}

test("a saved Rofiant session is used as apiKey against www.rofiant.ca, when no provider key or env var is set", () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-config-"))
  const path = join(dir, "auth.json")
  saveAuth({ rofiant: { accessToken: "tok_abc", refreshToken: "ref_abc" } }, path)

  const config = withoutAiEnv(() => loadConfig(path))
  expect(config.apiKey).toBe("tok_abc")
  expect(config.baseUrl).toBe("https://www.rofiant.ca/api/v1")
})

test("a saved Rofiant session never uses an unpaired AI_BASE_URL", () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-config-"))
  const path = join(dir, "auth.json")
  saveAuth({ rofiant: { accessToken: "tok_abc", refreshToken: "ref_abc" } }, path)
  const savedKey = Bun.env.AI_API_KEY
  const savedUrl = Bun.env.AI_BASE_URL
  delete Bun.env.AI_API_KEY
  Bun.env.AI_BASE_URL = "https://openrouter.ai/api/v1"

  try {
    const config = loadConfig(path)
    expect(config.apiKey).toBe("tok_abc")
    expect(config.baseUrl).toBe("https://www.rofiant.ca/api/v1")
  } finally {
    if (savedKey !== undefined) Bun.env.AI_API_KEY = savedKey
    else delete Bun.env.AI_API_KEY
    if (savedUrl !== undefined) Bun.env.AI_BASE_URL = savedUrl
    else delete Bun.env.AI_BASE_URL
  }
})

test("a saved provider key wins over a saved Rofiant session", () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-config-"))
  const path = join(dir, "auth.json")
  saveAuth(
    {
      rofiant: { accessToken: "tok_abc", refreshToken: "ref_abc" },
      provider: { name: "openai", apiKey: "sk-provider", baseUrl: "https://api.openai.com/v1" },
    },
    path,
  )

  const config = withoutAiEnv(() => loadConfig(path))
  expect(config.apiKey).toBe("sk-provider")
  expect(config.baseUrl).toBe("https://api.openai.com/v1")
  expect(config.model).toBe("gpt-5-mini")
})

test("an old unsupported Anthropic entry is ignored", () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-config-"))
  const path = join(dir, "auth.json")
  saveAuth({ provider: { name: "anthropic", apiKey: "sk-ant", baseUrl: "https://api.anthropic.com/v1" } }, path)

  const config = withoutAiEnv(() => loadConfig(path))
  expect(config.apiKey).toBeUndefined()
  expect(config.baseUrl).toBe("https://openrouter.ai/api/v1")
})

test("with no saved auth, falls back to OpenRouter with no apiKey", () => {
  const path = join(mkdtempSync(join(tmpdir(), "rofiant-config-")), "missing.json")
  const config = withoutAiEnv(() => loadConfig(path))
  expect(config.apiKey).toBeUndefined()
  expect(config.baseUrl).toBe("https://openrouter.ai/api/v1")
})
