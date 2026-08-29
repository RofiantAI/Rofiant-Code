import type { ChatEntry } from "./types"
import { theme, syntaxStyle } from "./theme"

export function Subagent(props: { entry: Extract<ChatEntry, { kind: "subagent" }> }) {
  const e = props.entry
  const symbol = () => (e.status === "running" ? "●" : e.status === "error" ? "✗" : "✓")
  const color = () => (e.status === "running" ? theme.dim : e.status === "error" ? theme.error : theme.success)
  const suffix = () => (e.status === "running" ? ` (${e.toolCount} tool call${e.toolCount === 1 ? "" : "s"})` : "")

  return (
    <box flexDirection="column" marginBottom={1}>
      <text fg={color()}>
        {symbol()} ${e.name}: {e.task}
        {suffix()}
      </text>
      {e.text.length > 0 && (
        <box marginTop={1} marginLeft={2}>
          <markdown content={e.text} syntaxStyle={syntaxStyle} />
        </box>
      )}
    </box>
  )
}
