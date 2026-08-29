import type { z } from "zod"
import { todoWriteSchema } from "./schemas"
import type { Tool } from "./types"

type Args = z.infer<typeof todoWriteSchema>

const MARKERS = { pending: "[ ]", in_progress: "[~]", completed: "[x]" } as const

export function formatTodos(todos: Args["todos"]): string {
  if (todos.length === 0) return "(no tasks)"
  return todos.map((t) => `${MARKERS[t.status]} ${t.content}`).join("\n")
}

export const todoWriteTool: Tool<Args> = {
  name: "todo_write",
  description:
    "Replace the tracked task list with the given one. Use this to plan and track progress on any multi-step " +
    "task — mark exactly one item in_progress at a time, and mark items completed as soon as they're done, " +
    "not in a batch at the end. Skip this entirely for single-step requests.",
  schema: todoWriteSchema,

  permissionLevel() {
    return "safe"
  },

  describe(args) {
    const active = args.todos.find((t) => t.status === "in_progress")
    return active ? `Updating tasks — ${active.content}` : `Updating tasks (${args.todos.length})`
  },

  async execute(args) {
    return { output: formatTodos(args.todos) }
  },
}
