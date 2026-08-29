import { describe, expect, test } from "bun:test"
import { Agent } from "../src/agent/agent"
import { PermissionManager } from "../src/permissions/permissions"
import type { AgentRequest, LLMEvent, LLMProvider } from "../src/llm/types"
import type { Tool } from "../src/tools/types"

function makeTool(name: string): Tool<Record<string, never>> {
  return {
    name,
    description: name,
    schema: { safeParse: (v: unknown) => ({ success: true, data: v as Record<string, never> }) } as any,
    permissionLevel: () => "safe",
    describe: () => name,
    execute: async () => ({ output: `${name} ran` }),
  }
}

describe("Agent.setAllowedTools (plan mode)", () => {
  test("only offers allowed tools to the model, and blocks execution of the rest", async () => {
    const requestedToolNames: string[][] = []
    let call = 0

    const provider: LLMProvider = {
      async *stream(request: AgentRequest): AsyncIterable<LLMEvent> {
        requestedToolNames.push(request.tools.map((t) => t.name))
        call += 1
        if (call === 1) {
          yield { type: "tool-call-start", id: "1", name: "write_file" }
          yield { type: "tool-call-delta", id: "1", argsDelta: "{}" }
          yield { type: "tool-call-end", id: "1" }
          yield { type: "done", finishReason: "tool_calls" }
        } else {
          yield { type: "text-delta", text: "ok" }
          yield { type: "done", finishReason: "stop" }
        }
      },
    }

    const agent = new Agent({
      provider,
      model: "m",
      tools: new Map([
        ["read_file", makeTool("read_file")],
        ["write_file", makeTool("write_file")],
      ]),
      toolDefinitions: [
        { name: "read_file", description: "", parameters: {} },
        { name: "write_file", description: "", parameters: {} },
      ],
      permissions: new PermissionManager(async () => ({ decision: "allow" })),
      systemPrompt: "sys",
      maxContextTokens: 100_000,
    })

    agent.setAllowedTools(["read_file"])

    const events = []
    for await (const e of agent.send("do it", new AbortController().signal)) events.push(e)

    expect(requestedToolNames[0]).toEqual(["read_file"])

    const toolEnd = events.find((e) => e.type === "tool-end")
    expect(toolEnd).toMatchObject({ result: { isError: true } })
    expect((toolEnd as any).result.output).toContain("not available")
  })
})

describe("Agent.compact", () => {
  test("replaces history with a single summary message", async () => {
    const provider: LLMProvider = {
      async *stream(): AsyncIterable<LLMEvent> {
        yield { type: "text-delta", text: "Summary: " }
        yield { type: "text-delta", text: "did X and Y." }
        yield { type: "done", finishReason: "stop" }
      },
    }

    const agent = new Agent(
      {
        provider,
        model: "m",
        tools: new Map(),
        toolDefinitions: [],
        permissions: new PermissionManager(async () => ({ decision: "allow" })),
        systemPrompt: "sys",
        maxContextTokens: 100_000,
      },
      [
        { role: "system", content: "sys" },
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi there" },
      ],
    )

    let streamed = ""
    await agent.compact(new AbortController().signal, (delta) => (streamed += delta))

    expect(streamed).toBe("Summary: did X and Y.")
    const messages = agent.getMessages()
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe("system")
    expect(messages[1]!.content).toContain("did X and Y.")
  })
})

describe("Agent.send prompt context", () => {
  test("sends injected instructions without persisting them as user text", async () => {
    let request: AgentRequest | undefined
    const provider: LLMProvider = {
      async *stream(value): AsyncIterable<LLMEvent> {
        request = value
        yield { type: "done", finishReason: "stop" }
      },
    }
    const agent = new Agent({
      provider,
      model: "m",
      tools: new Map(),
      toolDefinitions: [],
      permissions: new PermissionManager(async () => ({ decision: "allow" })),
      systemPrompt: "sys",
      maxContextTokens: 100_000,
    })

    for await (const _ of agent.send("/review src/app.ts", new AbortController().signal, "skill body")) {
      // drain
    }

    expect(request!.messages.at(-1)!.content).toBe("skill body")
    expect(agent.getMessages().at(-2)!.content).toBe("/review src/app.ts")
  })
})
