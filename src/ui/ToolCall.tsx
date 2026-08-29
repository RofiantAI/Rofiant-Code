import type { ChatEntry } from "./types"
import { theme } from "./theme"
import { Diff, extractDiff, filetypeFromPath } from "./Diff"
import { truncateLines } from "../utils/truncate"

const MAX_DISPLAY_LINES = 14

export function ToolCall(props: { entry: Extract<ChatEntry, { kind: "tool" }>; diffWrap: boolean }) {
  const e = props.entry
  const symbol = () => (e.status === "running" ? "●" : e.result?.isError ? "✗" : "✓")
  const color = () => (e.status === "running" ? theme.dim : e.result?.isError ? theme.error : theme.success)

  const isTodo = () => e.name === "todo_write"
  const parsed = () => (e.result && !e.result.isError && !isTodo() ? extractDiff(e.result.output) : null)

  return (
    <box flexDirection="column" marginBottom={1}>
      <text fg={color()}>
        {symbol()} {e.describe}
      </text>

      {e.status === "done" && parsed() && (
        <box marginTop={1} marginLeft={2}>
          <Diff diffText={parsed()!.diffText} filetype={filetypeFromPath(e.describe)} wrapMode={props.diffWrap ? "word" : "none"} />
        </box>
      )}

      {e.status === "done" && isTodo() && !e.result?.isError && (
        <box marginTop={0} marginLeft={2}>
          <text fg={theme.dim}>{e.result!.output}</text>
        </box>
      )}

      {e.status === "done" && e.result?.isError && (
        <box marginTop={0} marginLeft={2}>
          <text fg={theme.dim}>{truncateLines(e.result.output, MAX_DISPLAY_LINES, "tail")}</text>
        </box>
      )}
    </box>
  )
}
