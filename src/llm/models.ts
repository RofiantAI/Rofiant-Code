export interface FreeModelInfo {
  id: string
  contextLength: number
}

interface OpenRouterModel {
  id: string
  context_length?: number
  supported_parameters?: string[]
}

/** The public catalog remains available when chat requests use the Rofiant proxy. */
export async function listFreeModels(baseUrl: string): Promise<FreeModelInfo[] | null> {
  const catalogUrl = baseUrl.includes("openrouter.ai") ? baseUrl : "https://openrouter.ai/api/v1"

  try {
    const res = await fetch(`${catalogUrl.replace(/\/$/, "")}/models`)
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
