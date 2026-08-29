import type { z } from "zod"
import { editFileSchema } from "./schemas"
import type { Tool } from "./types"
import { resolveWorkspacePath } from "../utils/paths"
import { buildReplaceDiff } from "../utils/diff"

type Args = z.infer<typeof editFileSchema>

export const editFileTool: Tool<Args> = {
  name: "edit_file",
  description:
    "Make a targeted edit to an existing file by replacing an exact block of text with a new one. " +
    "oldText must appear exactly once in the file, with enough surrounding context to be unambiguous. " +
    "Never use this to rewrite a whole file — use write_file for that.",
  schema: editFileSchema,

  permissionLevel(args) {
    return resolveWorkspacePath(args.path).insideWorkspace ? "modify" : "dangerous"
  },

  describe(args) {
    return `Editing ${resolveWorkspacePath(args.path).relative}`
  },

  async execute(args, ctx) {
    const resolved = resolveWorkspacePath(args.path)
    const file = Bun.file(resolved.absolute)
    if (!(await file.exists())) {
      return { output: `File not found: ${resolved.relative}`, isError: true }
    }

    const content = await file.text()
    const firstIdx = content.indexOf(args.oldText)
    if (firstIdx === -1) {
      return {
        output: `Could not find the given oldText in ${resolved.relative}. It must match the file exactly, including whitespace.`,
        isError: true,
      }
    }
    if (content.indexOf(args.oldText, firstIdx + 1) !== -1) {
      return {
        output: `oldText matches ${resolved.relative} more than once. Include more surrounding context so the match is unique.`,
        isError: true,
      }
    }

    const startLine = content.slice(0, firstIdx).split("\n").length
    const fileLines = content.split("\n")
    const oldLines = args.oldText.split("\n")
    const newLines = args.newText.split("\n")
    const diffText = buildReplaceDiff(resolved.relative, fileLines, startLine, oldLines, newLines)

    const result = await ctx.permissions.check({
      toolName: "edit_file",
      level: this.permissionLevel(args),
      summary: this.describe(args),
      detail: diffText,
      key: "edit_file",
      editableText: args.newText,
    })
    if (!result.approved) {
      return { output: `User denied the edit to ${resolved.relative}.`, isError: true }
    }

    const finalNewText = result.text ?? args.newText
    const updated = content.slice(0, firstIdx) + finalNewText + content.slice(firstIdx + args.oldText.length)
    await Bun.write(resolved.absolute, updated)

    const finalDiff =
      finalNewText === args.newText
        ? diffText
        : buildReplaceDiff(resolved.relative, fileLines, startLine, oldLines, finalNewText.split("\n"))
    return { output: `Edited ${resolved.relative}\n\n${finalDiff}` }
  },
}
