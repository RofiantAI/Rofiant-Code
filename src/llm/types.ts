export type Role = "system" | "user" | "assistant" | "tool"

export interface ToolCallRequest {
  id: string
  name: string
  /** Raw JSON string, as streamed by the model. May be incomplete until the call closes. */
  arguments: string
}

export interface LLMMessage {
  role: Role
  content: string | null
  toolCalls?: ToolCallRequest[]
  /** Set on role "tool": which call this result answers. */
  toolCallId?: string
  /** Set on role "tool": the tool name, for providers that want it. */
  name?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface AgentRequest {
  model: string
  messages: LLMMessage[]
  tools: ToolDefinition[]
  signal?: AbortSignal
  reasoningEffort?: string
}

export type LLMEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call-start"; id: string; name: string }
  | { type: "tool-call-delta"; id: string; argsDelta: string }
  | { type: "tool-call-end"; id: string }
  | { type: "usage"; promptTokens: number; completionTokens: number }
  | { type: "done"; finishReason: string }
  | { type: "error"; message: string }

export interface LLMProvider {
  configure?(apiKey: string | undefined, baseUrl: string): void
  stream(request: AgentRequest): AsyncIterable<LLMEvent>
}
