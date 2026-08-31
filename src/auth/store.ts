import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import { dataDir } from "../utils/paths"

const AuthSchema = z.object({
  rofiant: z.object({ accessToken: z.string(), refreshToken: z.string() }).optional(),
  // Keep accepting old Anthropic entries so another valid credential in the file still loads.
  provider: z.object({ name: z.enum(["openai", "anthropic"]), apiKey: z.string(), baseUrl: z.string() }).optional(),
})

export type AuthStore = z.infer<typeof AuthSchema>

function defaultPath(): string {
  return join(dataDir(), "auth.json")
}

export function loadAuth(path = defaultPath()): AuthStore {
  try {
    return AuthSchema.parse(JSON.parse(readFileSync(path, "utf8")))
  } catch {
    return {}
  }
}

/** Holds API keys and session tokens — kept out of group/other read (0o600), unlike settings.json. */
export function saveAuth(auth: AuthStore, path = defaultPath()): boolean {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(auth, null, 2) + "\n", { mode: 0o600 })
    return true
  } catch {
    return false
  }
}
