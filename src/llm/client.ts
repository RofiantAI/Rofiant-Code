import type { AgentRequest, LLMEvent, LLMMessage, LLMProvider } from "./types"
import { parseSSE } from "./streaming"

interface OpenAIChunkDelta {
  content?: string | null
  tool_calls?: Array<{
    index: number
    id?: string
    function?: { name?: string; arguments?: string }
  }>
}

interface OpenAIChunk {
  choices?: Array<{ delta?: OpenAIChunkDelta; finish_reason?: string | null }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function toOpenAIMessage(m: LLMMessage): Record<string, unknown> {
  if (m.role === "tool") {
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content ?? "" }
  }
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments },
      })),
    }
  }
  return { role: m.role, content: m.content ?? "" }
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    private apiKey: string | undefined,
    private baseUrl: string,
  ) {}

  configure(apiKey: string | undefined, baseUrl: string): void {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async *stream(request: AgentRequest): AsyncIterable<LLMEvent> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages.map(toOpenAIMessage),
          stream: true,
          stream_options: { include_usage: true },
          ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
          ...(request.tools.length > 0
            ? {
                tools: request.tools.map((t) => ({
                  type: "function",
                  function: { name: t.name, description: t.description, parameters: t.parameters },
                })),
              }
            : {}),
        }),
        signal: request.signal,
      })
    } catch (err) {
      yield { type: "error", message: `Connection failed: ${(err as Error).message}` }
      return
    }

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "")
      yield { type: "error", message: `API request failed (${res.status}): ${body.slice(0, 500)}` }
      return
    }

    // Tracks in-progress tool calls by their stream index, since only the
    // first chunk for a call carries its id/name; arguments arrive in pieces.
    const callIndexToId = new Map<number, string>()
    let finishReason = "stop"

    for await (const raw of parseSSE(res.body)) {
      const chunk = raw as OpenAIChunk
      const choice = chunk.choices?.[0]
      if (chunk.usage) {
        yield {
          type: "usage",
          promptTokens: chunk.usage.prompt_tokens ?? 0,
          completionTokens: chunk.usage.completion_tokens ?? 0,
        }
      }
      if (!choice) continue
      if (choice.finish_reason) finishReason = choice.finish_reason

      const delta = choice.delta
      if (!delta) continue

      if (delta.content) {
        yield { type: "text-delta", text: delta.content }
      }

      for (const tc of delta.tool_calls ?? []) {
        let id = callIndexToId.get(tc.index)
        if (!id) {
          id = tc.id ?? `call_${tc.index}`
          callIndexToId.set(tc.index, id)
          yield { type: "tool-call-start", id, name: tc.function?.name ?? "" }
        }
        if (tc.function?.arguments) {
          yield { type: "tool-call-delta", id, argsDelta: tc.function.arguments }
        }
      }
    }

    for (const id of callIndexToId.values()) {
      yield { type: "tool-call-end", id }
    }
    yield { type: "done", finishReason }
  }
}
