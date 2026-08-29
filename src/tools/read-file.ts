import type { z } from "zod"
import { readFileSchema } from "./schemas"
import type { Tool } from "./types"
import { resolveWorkspacePath } from "../utils/paths"
import { truncateLines } from "../utils/truncate"

type Args = z.infer<typeof readFileSchema>

const MAX_LINES = 2000

function looksBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8000))
  for (const b of sample) if (b === 0) return true
  return false
}

export const readFileTool: Tool<Args> = {
  name: "read_file",
  description:
    "Read a text file from the project, optionally a specific line range. Returns content with line numbers.",
  schema: readFileSchema,

  permissionLevel(args) {
    return resolveWorkspacePath(args.path).insideWorkspace ? "safe" : "dangerous"
  },

  describe(args) {
    return `Reading ${resolveWorkspacePath(args.path).relative || args.path}`
  },

  async execute(args) {
    const resolved = resolveWorkspacePath(args.path)
    const file = Bun.file(resolved.absolute)
    if (!(await file.exists())) {
      return { output: `File not found: ${resolved.relative}`, isError: true }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    if (looksBinary(bytes)) {
      return { output: `${resolved.relative} is a binary file (${bytes.length} bytes) — skipping content.` }
    }

    const text = new TextDecoder().decode(bytes)
    const allLines = text.split("\n")

    const start = Math.max(1, args.startLine ?? 1)
    const end = Math.min(allLines.length, args.endLine ?? allLines.length)
    let slice = allLines.slice(start - 1, end)

    const numbered = slice.map((line, i) => `${String(start + i).padStart(5, " ")}| ${line}`).join("\n")
    const truncated = truncateLines(numbered, MAX_LINES, "head")

    return { output: `${resolved.relative} (lines ${start}-${end} of ${allLines.length})\n\n${truncated}` }
  },
}
