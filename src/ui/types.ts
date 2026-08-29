import type { ToolResult } from "../tools/types"

export type ChatEntry =
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string; footer?: string }
  | { kind: "tool"; id: string; name: string; describe: string; status: "running" | "done"; result?: ToolResult }
  | { kind: "info"; id: string; text: string }
  | { kind: "recap"; id: string; text: string }
  | { kind: "error"; id: string; text: string }
  | {
      kind: "subagent"
      id: string
      name: string
      task: string
      status: "running" | "done" | "error"
      text: string
      toolCount: number
    }
