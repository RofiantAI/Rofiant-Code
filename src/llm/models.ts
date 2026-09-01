export interface FreeModelInfo {
  id: string
  contextLength: number
}

interface OpenRouterModel {
  id: string
  context_length?: number
  supported_parameters?: string[]
}

/** OpenRouter's model catalog is public and unauthenticated — list it directly even when chat
 * requests go through a proxy (e.g. Rofiant) that fronts OpenRouter but has no /models route. */
export async function listModels(baseUrl: string, apiKey?: string): Promise<FreeModelInfo[] | null> {
  try {
    const hostname = new URL(baseUrl).hostname
    const openRouterCatalog =
      hostname === "openrouter.ai" ||
      hostname === "rofiant.ca" ||
      hostname.endsWith(".rofiant.ca") ||
      hostname.endsWith(".supabase.co")
    const catalogUrl = openRouterCatalog && hostname !== "openrouter.ai" ? "https://openrouter.ai/api/v1" : baseUrl
    const res = await fetch(`${catalogUrl.replace(/\/$/, "")}/models`, {
      headers: apiKey && catalogUrl === baseUrl ? { authorization: `Bearer ${apiKey}` } : undefined,
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data?: OpenRouterModel[] }
    return (json.data ?? [])
      .filter((m) => !openRouterCatalog || m.id.endsWith(":free"))
      .map((m) => ({ id: m.id, contextLength: m.context_length ?? 0 }))
      .sort((a, b) => a.id.localeCompare(b.id))
  } catch {
    return null
  }
}
