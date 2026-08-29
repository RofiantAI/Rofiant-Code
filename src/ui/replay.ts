import type { LLMMessage } from "../llm/types"
import type { ChatEntry } from "./types"

/** Rebuilds a visible transcript from a resumed session's raw messages — a --continue helper. */
export function replayMessages(messages: LLMMessage[]): ChatEntry[] {
  const entries: ChatEntry[] = []

  for (const m of messages) {
    if (m.role === "system") continue

    if (m.role === "user") {
      entries.push({ kind: "user", id: crypto.randomUUID(), text: m.content ?? "" })
    } else if (m.role === "assistant") {
      if (m.content) entries.push({ kind: "assistant", id: crypto.randomUUID(), text: m.content })
      for (const tc of m.toolCalls ?? []) {
        // The original "Reading src/x.ts"-style description wasn't persisted — the tool name is the best we have.
        entries.push({ kind: "tool", id: tc.id, name: tc.name, describe: tc.name, status: "running" })
      }
    } else if (m.role === "tool") {
      const entry = entries.find((e) => e.kind === "tool" && e.id === m.toolCallId)
      if (entry && entry.kind === "tool") {
        entry.status = "done"
        entry.result = { output: m.content ?? "" }
      }
    }
  }

  return entries
}
