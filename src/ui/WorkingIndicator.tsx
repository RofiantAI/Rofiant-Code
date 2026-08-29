import { createEffect, createSignal, onCleanup, Show } from "solid-js"
import { theme } from "./theme"

const FRAMES = ["🧠", "💭", "⚙️", "✨", "🔍", "💡"]
const FRAME_MS = 350

export interface WorkingIndicatorProps {
  active: boolean
  /** Ties into the existing "vivid vs minimal" setting — minimal keeps the emoji static. */
  animate: boolean
}

/** Sits above the chat bar while the agent is running — the old "Working…" textarea placeholder moved out here. */
export function WorkingIndicator(props: WorkingIndicatorProps) {
  const [frame, setFrame] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | undefined

  createEffect(() => {
    if (props.active && props.animate) {
      timer = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), FRAME_MS)
    } else if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  })
  onCleanup(() => {
    if (timer) clearInterval(timer)
  })

  return (
    <Show when={props.active}>
      <box flexShrink={0} flexDirection="row" paddingLeft={1} marginBottom={1}>
        <text fg={theme.logo}>{FRAMES[frame()]} Working…</text>
      </box>
    </Show>
  )
}
