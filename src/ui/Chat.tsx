import { For } from "solid-js"
import type { ChatEntry } from "./types"
import { Message } from "./Message"
import { ToolCall } from "./ToolCall"
import { Subagent } from "./Subagent"

export function Chat(props: { entries: ChatEntry[]; diffWrap: boolean }) {
  return (
    <scrollbox flexGrow={1} stickyScroll stickyStart="bottom" paddingLeft={1} paddingRight={1}>
      <For each={props.entries}>
        {(entry) =>
          entry.kind === "tool" ? <ToolCall entry={entry} diffWrap={props.diffWrap} /> : entry.kind === "subagent" ? <Subagent entry={entry} /> : <Message entry={entry} />
        }
      </For>
    </scrollbox>
  )
}
