import type { ScrollBoxRenderable } from "@opentui/core"
import { createEffect, For } from "solid-js"
import { theme } from "./theme"

const NAME_WIDTH = 24
const MAX_DESCRIPTION = 72

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + "…"
}

/** Shared shape for the "/" command, "@" file, and "$" subagent popovers. */
export interface PopoverMatch {
  label: string
  description: string
}

export interface CommandPopoverProps {
  matches: PopoverMatch[]
  selectedIndex: number
}

export function CommandPopover(props: CommandPopoverProps) {
  let scrollRef: ScrollBoxRenderable | undefined

  createEffect(() => {
    scrollRef?.scrollChildIntoView(`popover-${props.selectedIndex}`)
  })

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      overflow="hidden"
      backgroundColor={theme.splashInputBg}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      marginBottom={1}
    >
      <scrollbox ref={scrollRef} height={Math.min(props.matches.length, 18)} scrollbarOptions={{ visible: false }}>
        <For each={props.matches}>
          {(item, i) => {
            const selected = () => i() === props.selectedIndex
            return (
              <box id={`popover-${i()}`} flexDirection="row" overflow="hidden" backgroundColor={selected() ? theme.logo : undefined}>
                <box width={NAME_WIDTH} flexShrink={0}>
                  <text wrapMode="none" fg={selected() ? theme.splashBg : theme.text}>
                    {truncate(item.label, NAME_WIDTH - 1)}
                  </text>
                </box>
                <text wrapMode="none" fg={selected() ? theme.splashBg : theme.dim}>
                  {truncate(item.description, MAX_DESCRIPTION)}
                </text>
              </box>
            )
          }}
        </For>
      </scrollbox>
    </box>
  )
}
