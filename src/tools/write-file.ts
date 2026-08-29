import type { z } from "zod"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { writeFileSchema } from "./schemas"
import type { Tool } from "./types"
import { resolveWorkspacePath } from "../utils/paths"
import { buildNewFileDiff } from "../utils/diff"

type Args = z.infer<typeof writeFileSchema>

export const writeFileTool: Tool<Args> = {
  name: "write_file",
  description:
    "Create a new file with the given content, or fully overwrite an existing one. For small changes to an existing file, use edit_file instead.",
  schema: writeFileSchema,

  permissionLevel(args) {
    return resolveWorkspacePath(args.path).insideWorkspace ? "modify" : "dangerous"
  },

  describe(args) {
    const resolved = resolveWorkspacePath(args.path)
    const exists = Bun.file(resolved.absolute).size > 0
    return `${exists ? "Overwriting" : "Creating"} ${resolved.relative}`
  },

  async execute(args, ctx) {
    const resolved = resolveWorkspacePath(args.path)
    const exists = await Bun.file(resolved.absolute).exists()
    const existingLines = exists ? (await Bun.file(resolved.absolute).text()).split("\n").length : 0

    const detail = exists
      ? `Overwriting ${resolved.relative} (${existingLines} existing lines → ${args.content.split("\n").length} new lines)`
      : buildNewFileDiff(resolved.relative, args.content)

    const result = await ctx.permissions.check({
      toolName: "write_file",
      level: this.permissionLevel(args),
      summary: this.describe(args),
      detail,
      key: "write_file",
      editableText: args.content,
    })
    if (!result.approved) {
      return { output: `User denied writing ${resolved.relative}.`, isError: true }
    }

    const finalContent = result.text ?? args.content
    mkdirSync(dirname(resolved.absolute), { recursive: true })
    await Bun.write(resolved.absolute, finalContent)
    return { output: `Wrote ${resolved.relative} (${finalContent.length} bytes)` }
  },
}
