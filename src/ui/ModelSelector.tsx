import { createSignal, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { theme } from "./theme"
import type { FreeModelInfo } from "../llm/models"

export interface ModelSelectorProps {
  current: string
  models: FreeModelInfo[]
  onSelect: (id: string) => void
  onCancel: () => void
}

export function ModelSelector(props: ModelSelectorProps) {
  const startIndex = Math.max(
    0,
    props.models.findIndex((m) => m.id === props.current),
  )
  const [index, setIndex] = createSignal(startIndex)

  useKeyboard((key) => {
    const name = key.name.toLowerCase()
    if (name === "up") setIndex((i) => (i <= 0 ? props.models.length - 1 : i - 1))
    else if (name === "down") setIndex((i) => (i + 1 >= props.models.length ? 0 : i + 1))
    else if (name === "return") {
      const m = props.models[index()]
      if (m) props.onSelect(m.id)
    } else if (name === "escape") props.onCancel()
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
      <box width="80%" maxWidth={88} maxHeight="80%" flexDirection="column" border borderColor={theme.logo} backgroundColor={theme.splashInputBg} padding={1}>
        <text fg={theme.logo}>Select a model</text>
        <text fg={theme.dim}>Current: {props.current}</text>

        <scrollbox maxHeight={18} scrollbarOptions={{ visible: false }} marginTop={1}>
          <For each={props.models}>
            {(m, i) => {
              const selected = () => i() === index()
              return (
                <box flexDirection="row" overflow="hidden" backgroundColor={selected() ? theme.logo : undefined}>
                  <box width={48} flexShrink={0}>
                    <text wrapMode="none" fg={selected() ? theme.splashBg : theme.text}>
                      {m.id}
                      {m.id === props.current ? " ✓" : ""}
                    </text>
                  </box>
                  <text fg={selected() ? theme.splashBg : theme.dim}>{Math.round(m.contextLength / 1000)}K ctx</text>
                </box>
              )
            }}
          </For>
        </scrollbox>

        <box marginTop={1}>
          <text fg={theme.dim}>Up/Down move · Enter select · Esc cancel</text>
        </box>
      </box>
    </box>
  )
}
