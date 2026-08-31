import { homedir } from "node:os"
import { existsSync, realpathSync } from "node:fs"
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path"

/** The directory the CLI was launched from. Fixed for the process lifetime. */
export const workspaceRoot = process.cwd()
const realWorkspaceRoot = realpathSync(workspaceRoot)

function realTarget(path: string): string {
  let existing = path
  const missing: string[] = []
  while (!existsSync(existing)) {
    const parent = dirname(existing)
    if (parent === existing) return path
    missing.unshift(basename(existing))
    existing = parent
  }
  return resolve(realpathSync(existing), ...missing)
}

/** User data dir for sessions/logs, following XDG on linux/mac, %APPDATA% on windows. */
export function dataDir(): string {
  if (Bun.env.XDG_DATA_HOME) return join(Bun.env.XDG_DATA_HOME, "rofiant")
  if (process.platform === "win32" && Bun.env.APPDATA) return join(Bun.env.APPDATA, "rofiant")
  return join(homedir(), ".local", "share", "rofiant")
}

export interface ResolvedPath {
  absolute: string
  /** Path relative to the workspace root, using forward slashes. */
  relative: string
  /** False if the path escapes the workspace root. */
  insideWorkspace: boolean
}

/** Resolve a user/model-supplied path against the workspace root, refusing traversal by default. */
export function resolveWorkspacePath(input: string): ResolvedPath {
  const absolute = isAbsolute(input) ? normalize(input) : resolve(workspaceRoot, input)
  const rel = relative(workspaceRoot, absolute)
  const realRel = relative(realWorkspaceRoot, realTarget(absolute))
  const insideWorkspace = realRel === "" || (!realRel.startsWith("..") && !isAbsolute(realRel))
  return { absolute, relative: rel.split(sep).join("/"), insideWorkspace }
}

/** Shortens an absolute path under $HOME to a `~/...` form for display. */
export function toDisplayPath(absolute: string): string {
  const home = homedir()
  return absolute === home || absolute.startsWith(home + sep) ? `~${absolute.slice(home.length)}` : absolute
}
