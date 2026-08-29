import { describe, expect, test } from "bun:test"
import { trimHistory } from "../src/agent/messages"
import type { LLMMessage } from "../src/llm/types"

describe("trimHistory", () => {
  test("leaves history untouched when under budget", () => {
    const messages: LLMMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
    ]
    expect(trimHistory(messages, 10_000)).toBe(messages)
  })

  test("collapses old tool output first, keeps the recent tail intact", () => {
    const big = "x".repeat(4000)
    const messages: LLMMessage[] = [
      { role: "system", content: "sys" },
      { role: "tool", toolCallId: "1", content: big },
      { role: "tool", toolCallId: "2", content: big },
      { role: "tool", toolCallId: "3", content: big },
      { role: "tool", toolCallId: "4", content: big },
      { role: "tool", toolCallId: "5", content: big },
      { role: "assistant", content: "ok" },
      { role: "user", content: "recent question" },
      { role: "assistant", content: "recent answer" },
    ]
    const trimmed = trimHistory(messages, 100)

    // old tool output (outside the protected recent tail) gets collapsed
    expect(trimmed[1]!.content).toBe("[older tool output omitted to save context]")
    expect(trimmed[2]!.content).toBe("[older tool output omitted to save context]")

    // the protected recent tail is never touched, even mid-collapse
    expect(trimmed[7]!.content).toBe("recent question")
    expect(trimmed[8]!.content).toBe("recent answer")

    // message order and count are preserved — no pairing is broken
    expect(trimmed.length).toBe(messages.length)
  })
})
