import type { LLMMessage } from "../llm/types"

const COLLAPSED_MARKER = "[older tool output omitted to save context]"
const KEEP_RECENT = 6 // never touch the tail of the conversation

/** Rough token estimate — good enough for budgeting, not for billing. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function estimateMessageTokens(m: LLMMessage): number {
  let n = estimateTokens(m.content ?? "")
  for (const tc of m.toolCalls ?? []) n += estimateTokens(tc.arguments) + estimateTokens(tc.name)
  return n
}

export function estimateHistoryTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}

/**
 * Keeps the conversation under budget by collapsing old tool-result content,
 * oldest first. Never drops or reorders messages, so tool_call/tool pairing
 * stays valid for providers that require it.
 */
export function trimHistory(messages: LLMMessage[], maxTokens: number): LLMMessage[] {
  if (estimateHistoryTokens(messages) <= maxTokens) return messages

  const cutoff = Math.max(0, messages.length - KEEP_RECENT)
  const result = [...messages]

  for (let i = 0; i < cutoff; i++) {
    const m = result[i]!
    if (m.role !== "tool" || m.content === COLLAPSED_MARKER) continue
    result[i] = { ...m, content: COLLAPSED_MARKER }
    if (estimateHistoryTokens(result) <= maxTokens) break
  }

  return result
}
