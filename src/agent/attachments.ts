import { readFileSync } from "node:fs"
import { resolveWorkspacePath } from "../utils/paths"
import { truncateLines } from "../utils/truncate"

const MAX_ATTACHMENT_LINES = 400
const MENTION_RE = /@(\S+)/g

/** `@path` tokens referenced anywhere in a message, de-duplicated, in first-seen order. */
export function extractAttachments(text: string): string[] {
  const paths: string[] = []
  for (const m of text.matchAll(MENTION_RE)) {
    if (!paths.includes(m[1]!)) paths.push(m[1]!)
  }
  return paths
}

/** Appends the content of every `@path` mention so the model sees it without an extra read_file round-trip. */
export function expandAttachments(text: string): string {
  const paths = extractAttachments(text)
  if (paths.length === 0) return text

  const blocks = paths.map((p) => {
    const resolved = resolveWorkspacePath(p)
    if (!resolved.insideWorkspace) return `--- @${p} ---\n(outside the workspace, skipped)`
    try {
      const content = readFileSync(resolved.absolute, "utf8")
      return `--- @${resolved.relative} ---\n${truncateLines(content, MAX_ATTACHMENT_LINES, "head")}`
    } catch {
      return `--- @${p} ---\n(could not read this file)`
    }
  })

  return `${text}\n\n${blocks.join("\n\n")}`
}
