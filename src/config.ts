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
  // /login persists either an OpenAI/Anthropic API key (auth.provider) or a Rofiant
  // session (auth.rofiant) — env vars still win when set, so a saved login never fights
  // an explicit override. Provider key wins over a Rofiant session if somehow both are saved.
  const auth = authPath ? loadAuth(authPath) : loadAuth()
  const saved = auth.provider
  const rofiant = auth.rofiant
  const webUrl = Bun.env.ROFIANT_WEB_URL ?? "https://rofiant.ca"

  return {
    apiKey: Bun.env.AI_API_KEY ?? saved?.apiKey ?? rofiant?.accessToken,
    baseUrl: Bun.env.AI_BASE_URL ?? saved?.baseUrl ?? (rofiant ? new URL("/api/v1", webUrl).toString() : "https://openrouter.ai/api/v1"),
    model: Bun.env.AI_MODEL ?? "z-ai/glm-5.2:free",
    maxContextTokens: Number(Bun.env.AI_MAX_CONTEXT_TOKENS ?? 100_000),
    githubRepo: Bun.env.ROFIANT_GITHUB_REPO ?? "RofiantAI/Rofiant-Code",
    webUrl,
  }
}
