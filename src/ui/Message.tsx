import type { ChatEntry } from "./types"
import { theme, syntaxStyle } from "./theme"

export type NonToolEntry = Exclude<ChatEntry, { kind: "tool" } | { kind: "subagent" }>

export function Message(props: { entry: NonToolEntry }) {
  const e = props.entry

  return (
    <box flexDirection="column" marginBottom={1}>
      {e.kind === "user" && (
        <text>
          <span style={{ fg: theme.dim }}>{"› "}</span>
          <span style={{ fg: theme.text }}>{e.text}</span>
        </text>
      )}
      {e.kind === "assistant" && e.text.length > 0 && (
        <box flexDirection="column" marginTop={1}>
          <box flexDirection="row">
            <text fg={theme.text}>{"● "}</text>
            <box flexGrow={1}>
              <markdown content={e.text} syntaxStyle={syntaxStyle} />
            </box>
          </box>
          {e.footer && (
            <box marginTop={1} marginLeft={2}>
              <text fg={theme.dim}>{`* ${e.footer}`}</text>
            </box>
          )}
        </box>
      )}
      {e.kind === "recap" && (
        <text>
          <span style={{ fg: theme.logo, bold: true }}>recap: </span>
          <span style={{ fg: theme.dim }}>{e.text} (disable recaps — ctrl+p → Recaps)</span>
        </text>
      )}
      {e.kind === "info" && <text fg={theme.dim}>{e.text}</text>}
      {e.kind === "error" && (
        <text fg={theme.error}>
          {"✗ "}
          {e.text}
        </text>
      )}
    </box>
  )
}
