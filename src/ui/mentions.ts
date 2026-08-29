import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { workspaceRoot } from "../utils/paths"

const IGNORED = new Set(["node_modules", ".git", "dist", "build", "target", ".next", ".cache"])
const MAX_INDEXED_FILES = 4000

function walk(dir: string, out: string[]): void {
  if (out.length >= MAX_INDEXED_FILES) return
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (IGNORED.has(entry)) continue
    const full = join(dir, entry)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (isDir) walk(full, out)
    else out.push(relative(workspaceRoot, full).split(sep).join("/"))
    if (out.length >= MAX_INDEXED_FILES) return
  }
}

// ponytail: indexed once per process and never refreshed — files created after
// startup won't autocomplete. Rebuild on a fs watch event if that bites.
let fileIndex: string[] | null = null

export function matchFiles(query: string, limit = 20): string[] {
  if (!fileIndex) {
    fileIndex = []
    walk(workspaceRoot, fileIndex)
    fileIndex.sort()
  }
  const needle = query.toLowerCase()
  const matches = needle ? fileIndex.filter((f) => f.toLowerCase().includes(needle)) : fileIndex
  return matches.slice(0, limit)
}

export interface SubagentDef {
  name: string
  description: string
  readOnly: boolean
  systemPrompt: string
}

export const SUBAGENTS: SubagentDef[] = [
  {
    name: "explore",
    description: "Read-only investigation — search and read files, no edits",
    readOnly: true,
    systemPrompt:
      "You are a fast, read-only investigation subagent running inside the user's project. Find exactly what " +
      "was asked and report back concisely: file paths with line numbers and a short summary of what's there. " +
      "You have no write or shell tools — don't attempt edits, just report findings.",
  },
  {
    name: "general",
    description: "Full-capability task agent — can edit files and run shell commands",
    readOnly: false,
    systemPrompt:
      "You are a focused task subagent working inside the user's project. Complete the delegated task fully " +
      "using the tools available, then report back a concise summary of what you did and the outcome.",
  },
]

export function matchSubagents(query: string): SubagentDef[] {
  const needle = query.toLowerCase()
  return SUBAGENTS.filter((s) => s.name.startsWith(needle))
}
