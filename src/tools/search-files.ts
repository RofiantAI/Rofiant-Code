import type { z } from "zod"
import { lstatSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { searchFilesSchema } from "./schemas"
import type { Tool } from "./types"
import { workspaceRoot } from "../utils/paths"

type Args = z.infer<typeof searchFilesSchema>

const IGNORED = new Set(["node_modules", ".git", "dist", "build", "target", ".next", ".cache"])

async function searchWithRipgrep(args: Args): Promise<string[] | null> {
  const rg = Bun.which("rg")
  if (!rg) return null

  const cmdArgs = ["--line-number", "--no-heading", "--color", "never", "--max-count", "5"]
  if (args.glob) cmdArgs.push("-g", args.glob)
  cmdArgs.push("--", args.query, ".")

  const proc = Bun.spawn([rg, ...cmdArgs], { cwd: workspaceRoot, stdout: "pipe", stderr: "pipe" })
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  if (exitCode > 1) return null // 0 = matches, 1 = no matches, >1 = error — fall back on real errors
  if (stdout.trim() === "") return []
  return stdout.trim().split("\n").slice(0, args.limit)
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")
  return new RegExp(`^${escaped}$`)
}

function searchFallback(args: Args): string[] {
  const results: string[] = []
  const globRe = args.glob ? globToRegExp(args.glob) : null
  let needle: RegExp
  try {
    needle = new RegExp(args.query)
  } catch {
    needle = new RegExp(args.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  }

  function walk(dir: string): void {
    if (results.length >= args.limit) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const entry of entries) {
      if (results.length >= args.limit) return
      if (IGNORED.has(entry)) continue
      const full = join(dir, entry)
      let stat
      try {
        stat = lstatSync(full)
      } catch {
        continue
      }
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        walk(full)
        continue
      }
      if (globRe && !globRe.test(entry)) continue
      if (stat.size > 2_000_000) continue

      let content: string
      try {
        content = readFileSync(full, "utf8")
      } catch {
        continue
      }
      const rel = full.slice(workspaceRoot.length + 1)
      const lines = content.split("\n")
      for (let i = 0; i < lines.length && results.length < args.limit; i++) {
        if (needle.test(lines[i]!)) results.push(`${rel}:${i + 1}:${lines[i]}`)
      }
    }
  }

  walk(workspaceRoot)
  return results
}

export const searchFilesTool: Tool<Args> = {
  name: "search_files",
  description: "Search project source code for a text or regex pattern. Uses ripgrep when available.",
  schema: searchFilesSchema,

  permissionLevel() {
    return "safe"
  },

  describe(args) {
    return `Searching "${args.query}"${args.glob ? ` in ${args.glob}` : ""}`
  },

  async execute(args) {
    const rgResults = await searchWithRipgrep(args)
    const results = rgResults ?? searchFallback(args)

    if (results.length === 0) return { output: `No matches for "${args.query}"` }
    return { output: `${results.length} match${results.length === 1 ? "" : "es"} for "${args.query}"\n\n${results.join("\n")}` }
  },
}
