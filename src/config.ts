import { loadAuth } from "./auth/store"

export interface Config {
  apiKey: string | undefined
  baseUrl: string
  model: string
  maxContextTokens: number
  /** "owner/repo" — where the startup update check looks for the latest GitHub release. */
  githubRepo: string
  /** Where /login sends the browser for the Rofiant option. */
  webUrl: string
}

export function loadConfig(authPath?: string): Config {
  // Credentials and endpoints are pairs. Never combine a saved Rofiant token with an
  // AI_BASE_URL inherited from the project: that leaks the token and breaks login.
  const auth = authPath ? loadAuth(authPath) : loadAuth()
  const saved = auth.provider
  const rofiant = auth.rofiant
  const envApiKey = Bun.env.AI_API_KEY
  // Apex domain redirects to www and fetch drops Authorization across origins.
  const webUrl = Bun.env.ROFIANT_WEB_URL ?? "https://www.rofiant.ca"
  const provider = envApiKey
    ? { apiKey: envApiKey, baseUrl: Bun.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1" }
    : saved
      ? { apiKey: saved.apiKey, baseUrl: saved.baseUrl }
      : rofiant
        ? { apiKey: rofiant.accessToken, baseUrl: new URL("/api/v1", webUrl).toString() }
        : { apiKey: undefined, baseUrl: Bun.env.AI_BASE_URL ?? "https://openrouter.ai/api/v1" }

  return {
    ...provider,
    model: Bun.env.AI_MODEL ?? "z-ai/glm-5.2:free",
    maxContextTokens: Number(Bun.env.AI_MAX_CONTEXT_TOKENS ?? 100_000),
    githubRepo: Bun.env.ROFIANT_GITHUB_REPO ?? "RofiantAI/Rofiant-Code",
    webUrl,
  }
}
