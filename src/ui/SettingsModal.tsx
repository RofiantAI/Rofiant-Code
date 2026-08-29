import type { ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { theme } from "./theme"

// A focusable <input> widget only receives keystrokes once OpenTUI's focus manager finishes
// attaching it — that hand-off isn't atomic with mounting, so keys typed in the same burst as
// the Ctrl+P that opens this modal (very easy to do) land before focus catches up and get
// silently dropped. useKeyboard is a raw, focus-independent listener that's live the instant
// this component mounts, so driving the query off it (like Up/Down/Escape already are here)
// closes that race instead of chasing a focus-timing fix.
export function isPrintable(sequence: string): boolean {
  return sequence.length === 1 && sequence.charCodeAt(0) >= 0x20 && sequence.charCodeAt(0) !== 0x7f
}

export interface SettingAction {
  title: string
  description: string
  category: string
  value: string
  onSelect: () => void
}

export function filterSettingActions(actions: SettingAction[], query: string): SettingAction[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return actions
  return actions.filter((action) => {
    const text = `${action.title} ${action.description} ${action.category}`.toLowerCase()
    return words.every((word) => text.includes(word))
  })
}

export function SettingsModal(props: { actions: SettingAction[]; onClose: () => void }) {
  const [query, setQuery] = createSignal("")
  const [selected, setSelected] = createSignal(0)
  const actions = createMemo(() => filterSettingActions(props.actions, query()))
  let scrollRef: ScrollBoxRenderable | undefined

  createEffect(() => {
    query()
    setSelected(0)
  })

  createEffect(() => {
    scrollRef?.scrollChildIntoView(`setting-${selected()}`)
  })

  function choose(): void {
    const action = actions()[selected()]
    if (!action) return
    action.onSelect()
  }

  useKeyboard((key) => {
    if (key.name === "escape") {
      key.preventDefault()
      props.onClose()
      return
    }
    if (key.name === "up") {
      key.preventDefault()
      setSelected((index) => (index <= 0 ? actions().length - 1 : index - 1))
      return
    }
    if (key.name === "down") {
      key.preventDefault()
      setSelected((index) => (index + 1 >= actions().length ? 0 : index + 1))
      return
    }
    if (key.name === "return") {
      key.preventDefault()
      choose()
      return
    }
    if (key.name === "backspace") {
      key.preventDefault()
      setQuery((q) => q.slice(0, -1))
      return
    }
    if (key.ctrl || key.meta || key.super) return
    if (isPrintable(key.sequence)) {
      key.preventDefault()
      setQuery((q) => q + key.sequence)
    }
  })

  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={100}
      alignItems="center"
      justifyContent="center"
      backgroundColor={theme.splashBg}
    >
      <box
        width="80%"
        maxWidth={88}
        maxHeight="80%"
        flexDirection="column"
        border
        borderColor={theme.logo}
        backgroundColor={theme.splashInputBg}
        padding={1}
      >
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text}>Settings</text>
          <text fg={theme.dim}>esc close</text>
        </box>
        <box flexDirection="row" marginTop={1} marginBottom={1} border={["bottom"]} borderColor={theme.border}>
          <Show when={query().length > 0} fallback={<text fg={theme.dim}>Search settings and commands</text>}>
            <text fg={theme.text}>{query()}</text>
          </Show>
          <text fg={theme.logo}>▏</text>
        </box>

        <scrollbox ref={scrollRef} maxHeight={18} scrollbarOptions={{ visible: false }}>
          <Show when={actions().length > 0} fallback={<text fg={theme.dim}>No matching settings</text>}>
            <For each={actions()}>
              {(action, index) => {
                const active = () => index() === selected()
                return (
                  <box
                    id={`setting-${index()}`}
                    flexDirection="row"
                    backgroundColor={active() ? theme.logo : undefined}
                    paddingLeft={1}
                    paddingRight={1}
                    onMouseUp={() => {
                      setSelected(index())
                      choose()
                    }}
                  >
                    <box width={20} flexShrink={0}>
                      <text wrapMode="none" fg={active() ? theme.splashBg : theme.text}>
                        {action.title}
                      </text>
                    </box>
                    <box flexGrow={1} overflow="hidden">
                      <text wrapMode="none" fg={active() ? theme.splashBg : theme.dim}>
                        {action.description}
                      </text>
                    </box>
                    <box width={12} flexShrink={0} justifyContent="flex-end">
                      <text wrapMode="none" fg={active() ? theme.splashBg : theme.logo}>
                        {action.value}
                      </text>
                    </box>
                  </box>
                )
              }}
            </For>
          </Show>
        </scrollbox>

        <box marginTop={1} flexDirection="row" justifyContent="space-between">
          <text fg={theme.logo}>{actions()[selected()]?.category ?? ""}</text>
          <text fg={theme.dim}>↑↓ select · enter run</text>
        </box>
      </box>
    </box>
  )
}
