import { describe, expect, test, afterAll } from "bun:test"
import { OpenAICompatibleProvider } from "../src/llm/client"
import type { LLMEvent } from "../src/llm/types"

function sse(chunks: object[]): string {
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n"
}

let server: ReturnType<typeof Bun.serve> | undefined
afterAll(() => server?.stop(true))

function startMock(body: string, status = 200) {
  server = Bun.serve({
    port: 0,
    fetch() {
      return new Response(body, { status, headers: { "content-type": "text/event-stream" } })
    },
  })
  return `http://localhost:${server.port}`
}

async function collect(events: AsyncIterable<LLMEvent>): Promise<LLMEvent[]> {
  const out: LLMEvent[] = []
  for await (const e of events) out.push(e)
  return out
}

describe("OpenAICompatibleProvider.stream", () => {
  test("streams plain text deltas", async () => {
    const body = sse([
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }] },
    ])
    const baseUrl = startMock(body)
    const provider = new OpenAICompatibleProvider("test-key", baseUrl)

    const events = await collect(provider.stream({ model: "m", messages: [], tools: [], signal: undefined }))
    const text = events.filter((e) => e.type === "text-delta").map((e) => (e as any).text).join("")

    expect(text).toBe("Hello")
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "stop" })
  })

  test("reassembles a tool call streamed across multiple chunks", async () => {
    const body = sse([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "read_file", arguments: "" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"path":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"src/x.ts"}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
    ])
    const baseUrl = startMock(body)
    const provider = new OpenAICompatibleProvider("test-key", baseUrl)

    const events = await collect(provider.stream({ model: "m", messages: [], tools: [], signal: undefined }))

    const start = events.find((e) => e.type === "tool-call-start")
    expect(start).toMatchObject({ id: "call_1", name: "read_file" })

    const args = events
      .filter((e) => e.type === "tool-call-delta")
      .map((e) => (e as any).argsDelta)
      .join("")
    expect(JSON.parse(args)).toEqual({ path: "src/x.ts" })

    expect(events.some((e) => e.type === "tool-call-end" && e.id === "call_1")).toBe(true)
    expect(events.at(-1)).toEqual({ type: "done", finishReason: "tool_calls" })
  })

  test("surfaces non-2xx responses as an error event instead of throwing", async () => {
    const baseUrl = startMock("server exploded", 500)
    const provider = new OpenAICompatibleProvider("test-key", baseUrl)

    const events = await collect(provider.stream({ model: "m", messages: [], tools: [], signal: undefined }))
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe("error")
  })
})
