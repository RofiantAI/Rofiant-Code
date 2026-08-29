export interface FreeModelInfo {
  id: string
  contextLength: number
}

interface OpenRouterModel {
  id: string
  context_length?: number
  supported_parameters?: string[]
}

/** Only meaningful against OpenRouter's /models endpoint — returns null for any other provider or on failure. */
export async function listFreeModels(baseUrl: string): Promise<FreeModelInfo[] | null> {
  if (!baseUrl.includes("openrouter.ai")) return null

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`)
    if (!res.ok) return null
    const json = (await res.json()) as { data?: OpenRouterModel[] }
    return (json.data ?? [])
      .filter((m) => m.id.endsWith(":free"))
      .map((m) => ({ id: m.id, contextLength: m.context_length ?? 0 }))
      .sort((a, b) => a.id.localeCompare(b.id))
  } catch {
    return null
  }
}
