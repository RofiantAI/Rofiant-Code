import type { LLMMessage } from "../llm/types"

export interface Session {
  id: string
  projectPath: string
  model: string
  createdAt: number
  updatedAt: number
  messages: LLMMessage[]
  promptTokens: number
  completionTokens: number
}

export interface SessionSummary {
  id: string
  projectPath: string
  model: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export interface ModelUsage {
  model: string
  promptTokens: number
  completionTokens: number
  sessionCount: number
}
