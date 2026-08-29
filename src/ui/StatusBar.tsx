import { Show } from "solid-js"
import { theme } from "./theme"

export interface StatusBarProps {
  model: string
  mode: "build" | "plan"
  branch: string | null
  totalTokens: number
  maxContextTokens: number
  busy: boolean
  skipPermissions: boolean
}

export function StatusBar(props: StatusBarProps) {
  const pct = () => Math.min(100, Math.round((props.totalTokens / props.maxContextTokens) * 100))

  const parts = () =>
    [
      props.model,
      props.mode === "plan" ? "plan" : null,
      props.branch ? `git:${props.branch}` : null,
      `${pct()}% context`,
      props.busy ? "working…" : null,
    ]
      .filter(Boolean)
      .join("  ·  ")

  return (
    <box flexShrink={0} flexDirection="row" paddingLeft={1} paddingRight={1}>
      <text fg={props.mode === "plan" ? theme.success : theme.dim}>{parts()}</text>
      <Show when={props.skipPermissions}>
        <text fg={theme.error}>{"  ·  SKIP ALL PERMISSIONS"}</text>
      </Show>
    </box>
  )
}
