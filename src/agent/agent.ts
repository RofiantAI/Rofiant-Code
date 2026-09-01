import type { LLMMessage, LLMProvider, ToolCallRequest, ToolDefinition } from "../llm/types"
import type { Tool } from "../tools/types"
import type { PermissionManager } from "../permissions/permissions"
import { trimHistory } from "./messages"
import type { AgentEvent } from "./loop"

export interface AgentOptions {
  provider: LLMProvider
  model: string
  tools: Map<string, Tool<any>>
  toolDefinitions: ToolDefinition[]
  permissions: PermissionManager
  systemPrompt: string
  maxContextTokens: number
  reasoningEffort?: string
}

interface PendingToolCall {
  name: string
  args: string
}

const COMPACT_PROMPT =
  "Summarize this entire conversation so far into a compact brief: what was asked, key findings, " +
  "decisions made, files changed, and the current state of the task. Be concise but keep anything " +
  "needed to continue the work. This summary will replace the full conversation history."

const RECAP_PROMPT =
  "Write a brief working recap for a user who's been half-watching, in 2-3 short plain-prose sentences " +
  "(no markdown, no preamble, no greeting): what this session's task/project is, what you just did, and " +
  "what's next — or that you're waiting on their next request if there's nothing pending."

/** The real agent loop: model turn -> optional tool calls -> tool results -> repeat until a final answer. */
export class Agent {
  private messages: LLMMessage[]
  private allowedTools: Set<string> | null = null
  promptTokens = 0
  completionTokens = 0

  constructor(private opts: AgentOptions, initialMessages: LLMMessage[] = []) {
    this.messages =
      initialMessages.length > 0 ? initialMessages : [{ role: "system", content: opts.systemPrompt }]
  }

  getMessages(): LLMMessage[] {
    return this.messages
  }

  setModel(model: string): void {
    this.opts.model = model
  }

  setReasoningEffort(effort: string | undefined): void {
    this.opts.reasoningEffort = effort
  }

  /** null = every tool available. A non-null set restricts both what's offered and what can run — e.g. plan mode. */
  setAllowedTools(names: string[] | null): void {
    this.allowedTools = names ? new Set(names) : null
  }

  reset(systemPrompt: string): void {
    this.messages = [{ role: "system", content: systemPrompt }]
    this.promptTokens = 0
    this.completionTokens = 0
  }

  private activeToolDefinitions(): ToolDefinition[] {
    if (!this.allowedTools) return this.opts.toolDefinitions
    return this.opts.toolDefinitions.filter((d) => this.allowedTools!.has(d.name))
  }

  async *send(userText: string, signal: AbortSignal, promptText = userText): AsyncGenerator<AgentEvent> {
    const userMessage: LLMMessage = { role: "user", content: userText }
    this.messages.push(userMessage)

    while (true) {
      if (signal.aborted) return

      const trimmed = trimHistory(this.messages, this.opts.maxContextTokens).map((message) =>
        message === userMessage ? { ...message, content: promptText } : message,
      )
      const pending = new Map<string, PendingToolCall>()
      const callOrder: string[] = []
      let assistantText = ""
      let sawError = false

      try {
        for await (const event of this.opts.provider.stream({
          model: this.opts.model,
          messages: trimmed,
          tools: this.activeToolDefinitions(),
          signal,
          reasoningEffort: this.opts.reasoningEffort,
        })) {
          switch (event.type) {
            case "text-delta":
              assistantText += event.text
              yield event
              break
            case "tool-call-start":
              pending.set(event.id, { name: event.name, args: "" })
              callOrder.push(event.id)
              break
            case "tool-call-delta": {
              const call = pending.get(event.id)
              if (call) call.args += event.argsDelta
              break
            }
            case "tool-call-end":
              break
            case "usage":
              this.promptTokens += event.promptTokens
              this.completionTokens += event.completionTokens
              yield event
              break
            case "error":
              sawError = true
              yield event
              break
            case "done":
              break
          }
        }
      } catch (err) {
        if (signal.aborted) return
        yield { type: "error", message: (err as Error).message }
        return
      }

      if (sawError) return
      if (signal.aborted) return

      const toolCalls: ToolCallRequest[] = callOrder.map((id) => {
        const call = pending.get(id)!
        return { id, name: call.name, arguments: call.args }
      })

      this.messages.push({
        role: "assistant",
        content: assistantText || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      })

      if (toolCalls.length === 0) {
        // A model can burn its whole output budget on hidden reasoning tokens and
        // return no visible text and no tool calls — that's not an error upstream
        // (finish_reason is often "stop"), so it would otherwise render as nothing.
        if (!assistantText) yield { type: "error", message: "Model returned an empty response. Try again." }
        yield { type: "turn-end" }
        return
      }

      for (const call of toolCalls) {
        if (signal.aborted) return

        const tool = this.opts.tools.get(call.name)
        const describe = tool ? safeDescribe(tool, call.arguments) : call.name
        yield { type: "tool-start", id: call.id, name: call.name, describe }

        const result = await this.runTool(tool, call.arguments, signal)

        this.messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result.output })
        yield { type: "tool-end", id: call.id, name: call.name, result }
      }
      // loop again: feed tool results back to the model
    }
  }

  /** Out-of-band summarization: replaces the whole history with a single brief. No tools, no streaming to the model. */
  async compact(signal: AbortSignal, onText?: (delta: string) => void): Promise<void> {
    const request = [...this.messages, { role: "user" as const, content: COMPACT_PROMPT }]
    let summary = ""

    for await (const event of this.opts.provider.stream({
      model: this.opts.model,
      messages: trimHistory(request, this.opts.maxContextTokens),
      tools: [],
      signal,
      reasoningEffort: this.opts.reasoningEffort,
    })) {
      if (event.type === "text-delta") {
        summary += event.text
        onText?.(event.text)
      } else if (event.type === "usage") {
        this.promptTokens += event.promptTokens
        this.completionTokens += event.completionTokens
      } else if (event.type === "error") {
        throw new Error(event.message)
      }
    }

    const systemMessage = this.messages[0]!
    this.messages = [
      systemMessage,
      { role: "user", content: `Summary of the conversation so far (context was compacted):\n\n${summary.trim()}` },
    ]
  }

  /** Ephemeral side query for the ambient "recap" banner — never touches real history, same as /btw. */
  async recap(signal: AbortSignal): Promise<string> {
    const request = [...this.messages, { role: "user" as const, content: RECAP_PROMPT }]
    let text = ""

    for await (const event of this.opts.provider.stream({
      model: this.opts.model,
      messages: trimHistory(request, this.opts.maxContextTokens),
      tools: [],
      signal,
      reasoningEffort: this.opts.reasoningEffort,
    })) {
      if (event.type === "text-delta") {
        text += event.text
      } else if (event.type === "usage") {
        this.promptTokens += event.promptTokens
        this.completionTokens += event.completionTokens
      } else if (event.type === "error") {
        throw new Error(event.message)
      }
    }

    return text.trim()
  }

  private async runTool(tool: Tool<any> | undefined, rawArgs: string, signal: AbortSignal) {
    if (!tool) {
      return { output: `Unknown tool: (no tool by that name)`, isError: true }
    }
    if (this.allowedTools && !this.allowedTools.has(tool.name)) {
      return { output: `${tool.name} is not available in the current mode.`, isError: true }
    }

    let parsedJson: unknown
    try {
      parsedJson = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs)
    } catch {
      return { output: `Invalid JSON arguments for ${tool.name}: ${rawArgs.slice(0, 200)}`, isError: true }
    }

    const parsed = tool.schema.safeParse(parsedJson)
    if (!parsed.success) {
      return { output: `Invalid arguments for ${tool.name}: ${parsed.error.message}`, isError: true }
    }

    try {
      return await tool.execute(parsed.data, { permissions: this.opts.permissions, signal })
    } catch (err) {
      return { output: `${tool.name} failed: ${(err as Error).message}`, isError: true }
    }
  }
}

function safeDescribe(tool: Tool<any>, rawArgs: string): string {
  try {
    const args = rawArgs.trim() === "" ? {} : JSON.parse(rawArgs)
    return tool.describe(args)
  } catch {
    return tool.name
  }
}
