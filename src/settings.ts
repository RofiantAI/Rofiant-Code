import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { z } from "zod"
import { dataDir } from "./utils/paths"

const SettingsSchema = z.object({
  mode: z.enum(["build", "plan"]),
  visualMode: z.enum(["vivid", "minimal"]),
  theme: z.enum(["dark", "light"]),
  diffWrap: z.boolean(),
  terminalTitle: z.boolean(),
  recaps: z.boolean(),
  reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh"]),
})

export type AppSettings = z.infer<typeof SettingsSchema>

export const DEFAULT_SETTINGS: AppSettings = {
  mode: "build",
  visualMode: "vivid",
  theme: "dark",
  diffWrap: true,
  terminalTitle: true,
  recaps: true,
  reasoningEffort: "none",
}

function defaultPath(): string {
  return join(dataDir(), "settings.json")
}

export function loadSettings(path = defaultPath()): AppSettings {
  try {
    return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(path, "utf8")) })
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings, path = defaultPath()): boolean {
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(settings, null, 2) + "\n")
    return true
  } catch {
    return false
  }
}
