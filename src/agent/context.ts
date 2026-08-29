import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { workspaceRoot } from "../utils/paths"
import { truncateChars } from "../utils/truncate"
import * as git from "../utils/git"

const IGNORED = new Set(["node_modules", ".git", "dist", "build", "target", ".next", ".cache"])
const README_LIMIT = 3000
const MANIFEST_LIMIT = 2000

function readIfSmall(path: string, limit: number): string | null {
  if (!existsSync(path)) return null
  try {
    return truncateChars(readFileSync(path, "utf8"), limit)
  } catch {
    return null
  }
}

function topLevelEntries(): string[] {
  try {
    return readdirSync(workspaceRoot)
      .filter((e) => !IGNORED.has(e))
      .sort()
  } catch {
    return []
  }
}

function findReadme(entries: string[]): string | null {
  const name = entries.find((e) => /^readme(\.md)?$/i.test(e))
  return name ? readIfSmall(join(workspaceRoot, name), README_LIMIT) : null
}

/** Gathered once per session — never the whole repo, just enough to orient the model. */
export async function gatherProjectContext(): Promise<string> {
  const entries = topLevelEntries()
  const sections: string[] = [`Working directory: ${workspaceRoot}`]

  if (await git.isGitRepo()) {
    const branch = await git.currentBranch()
    const summary = await git.shortSummary()
    sections.push(`Git: branch ${branch ?? "unknown"}${summary ? `, ${summary}` : ", working tree clean"}`)
  } else {
    sections.push("Git: not a repository")
  }

  sections.push(`Top-level entries:\n${entries.map((e) => `  ${e}`).join("\n") || "  (empty)"}`)

  const packageJson = readIfSmall(join(workspaceRoot, "package.json"), MANIFEST_LIMIT)
  if (packageJson) sections.push(`package.json:\n${packageJson}`)

  const cargoToml = readIfSmall(join(workspaceRoot, "Cargo.toml"), MANIFEST_LIMIT)
  if (cargoToml) sections.push(`Cargo.toml:\n${cargoToml}`)

  const pyproject = readIfSmall(join(workspaceRoot, "pyproject.toml"), MANIFEST_LIMIT)
  if (pyproject) sections.push(`pyproject.toml:\n${pyproject}`)

  const readme = findReadme(entries)
  if (readme) sections.push(`README:\n${readme}`)

  return sections.join("\n\n")
}

/** AGENTS.md is project-authored guidance — never a source of security overrides. */
export function readAgentsFile(): string | null {
  return readIfSmall(join(workspaceRoot, "AGENTS.md"), 4000)
}

/** MEMORY.md is agent-maintained: durable notes the agent chose to keep across sessions. */
export function readMemoryFile(): string | null {
  return readIfSmall(join(workspaceRoot, "MEMORY.md"), 6000)
}
