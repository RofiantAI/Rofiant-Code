import type { ToolResult } from "../tools/types"

export type AgentEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-start"; id: string; name: string; describe: string }
  | { type: "tool-end"; id: string; name: string; result: ToolResult }
  | { type: "turn-end" }
  | { type: "usage"; promptTokens: number; completionTokens: number }
  | { type: "error"; message: string }
