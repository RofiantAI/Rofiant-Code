import { z } from "zod"
import type { Tool } from "./types"
import type { ToolDefinition } from "../llm/types"
import { readFileTool } from "./read-file"
import { listFilesTool } from "./list-files"
import { searchFilesTool } from "./search-files"
import { writeFileTool } from "./write-file"
import { editFileTool } from "./edit-file"
import { shellTool } from "./shell"
import { gitDiffTool } from "./git-diff"
import { todoWriteTool } from "./todo"

export type { Tool, ToolContext, ToolResult } from "./types"

// biome-ignore lint: heterogeneous tool args are intentionally erased to unknown here
const registry: Tool<any>[] = [
  readFileTool,
  listFilesTool,
  searchFilesTool,
  writeFileTool,
  editFileTool,
  shellTool,
  gitDiffTool,
  todoWriteTool,
]

/** Tools available in read-only "plan" mode — nothing that touches disk or a shell. */
export const READ_ONLY_TOOLS = new Set(["read_file", "list_files", "search_files", "git_diff", "todo_write", "skill"])

export const tools = new Map(registry.map((t) => [t.name, t]))

export function toolDefinitions(extra: Tool<any>[] = []): ToolDefinition[] {
  return [...registry, ...extra].map((t) => ({
    name: t.name,
    description: t.description,
    parameters: z.toJSONSchema(t.schema, { target: "draft-7" }) as Record<string, unknown>,
  }))
}
