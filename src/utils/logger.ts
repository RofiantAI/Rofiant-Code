import { appendFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { dataDir } from "./paths"

const debugEnabled = Bun.env.ROFIANT_DEBUG === "1"
const logPath = join(dataDir(), "rofiant-debug.log")

if (debugEnabled) {
  mkdirSync(dataDir(), { recursive: true })
}

function write(level: string, args: unknown[]): void {
  if (!debugEnabled) return
  const line = `[${new Date().toISOString()}] ${level} ${args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ")}\n`
  appendFileSync(logPath, line)
}

export const logger = {
  debug: (...args: unknown[]) => write("DEBUG", args),
  info: (...args: unknown[]) => write("INFO", args),
  error: (...args: unknown[]) => write("ERROR", args),
}
