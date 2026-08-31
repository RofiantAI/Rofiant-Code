import type { z } from "zod"
import { lstatSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { listFilesSchema } from "./schemas"
import type { Tool } from "./types"
import { resolveWorkspacePath } from "../utils/paths"

type Args = z.infer<typeof listFilesSchema>

const IGNORED = new Set(["node_modules", ".git", "dist", "build", "target", ".next", ".cache"])

function walk(dir: string, depth: number, showIgnored: boolean, prefix: string, lines: string[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir).sort()
  } catch {
    return
  }

  for (const entry of entries) {
    if (!showIgnored && IGNORED.has(entry)) continue
    const full = join(dir, entry)
    let isDir = false
    try {
      isDir = lstatSync(full).isDirectory()
    } catch {
      continue
    }
    lines.push(`${prefix}${entry}${isDir ? "/" : ""}`)
    if (isDir && depth > 1) {
      walk(full, depth - 1, showIgnored, prefix + "  ", lines)
    }
  }
}

export const listFilesTool: Tool<Args> = {
  name: "list_files",
  description: "List files and directories under a path, up to a given depth. Ignores build/dependency folders by default.",
  schema: listFilesSchema,

  permissionLevel(args) {
    return resolveWorkspacePath(args.path).insideWorkspace ? "safe" : "dangerous"
  },

  describe(args) {
    return `Listing ${resolveWorkspacePath(args.path).relative || "."}`
  },

  async execute(args, ctx) {
    const resolved = resolveWorkspacePath(args.path)
    const permission = await ctx.permissions.check({
      toolName: "list_files",
      level: this.permissionLevel(args),
      summary: this.describe(args),
      key: `list_files:${resolved.absolute}`,
      hideAlways: !resolved.insideWorkspace,
    })
    if (!permission.approved) return { output: `User denied listing ${resolved.relative}.`, isError: true }

    try {
      if (!statSync(resolved.absolute).isDirectory()) {
        return { output: `Not a directory: ${resolved.relative}`, isError: true }
      }
    } catch {
      return { output: `Directory not found: ${resolved.relative}`, isError: true }
    }

    const lines: string[] = []
    walk(resolved.absolute, args.depth, args.showIgnored, "", lines)
    if (lines.length === 0) return { output: `${resolved.relative || "."} is empty` }
    return { output: `${resolved.relative || "."}\n\n${lines.join("\n")}` }
  },
}
