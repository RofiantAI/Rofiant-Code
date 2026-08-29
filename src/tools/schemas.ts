import { z } from "zod"

export const readFileSchema = z.object({
  path: z.string().describe("File path, relative to the project root"),
  startLine: z.number().int().positive().optional().describe("1-indexed first line to read"),
  endLine: z.number().int().positive().optional().describe("1-indexed last line to read (inclusive)"),
})

export const listFilesSchema = z.object({
  path: z.string().default(".").describe("Directory path, relative to the project root"),
  depth: z.number().int().min(1).max(6).default(2).describe("How many directory levels to descend"),
  showIgnored: z.boolean().default(false).describe("Include node_modules/.git/dist/etc"),
})

export const searchFilesSchema = z.object({
  query: z.string().describe("Text or regex pattern to search for"),
  glob: z.string().optional().describe("Glob to filter which files are searched, e.g. '*.ts'"),
  limit: z.number().int().positive().max(200).default(50).describe("Max number of matches to return"),
})

export const writeFileSchema = z.object({
  path: z.string().describe("File path to create, relative to the project root"),
  content: z.string().describe("Full file content"),
})

export const editFileSchema = z.object({
  path: z.string().describe("File path to edit, relative to the project root"),
  oldText: z.string().describe("Exact existing text to replace, including surrounding context. Must match exactly once."),
  newText: z.string().describe("Replacement text"),
})

export const shellSchema = z.object({
  command: z.string().describe("Shell command to run from the project root"),
  timeoutMs: z.number().int().positive().max(120_000).default(30_000),
})

export const gitDiffSchema = z.object({
  mode: z.enum(["diff", "diff-stat", "status"]).default("diff"),
  staged: z.boolean().default(false),
})

export const todoWriteSchema = z.object({
  todos: z
    .array(
      z.object({
        content: z.string().describe("Short task description"),
        status: z.enum(["pending", "in_progress", "completed"]),
      }),
    )
    .describe("The full task list, replacing whatever was tracked before"),
})
