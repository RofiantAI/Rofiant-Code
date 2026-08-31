import { RenderableEvents, type KeyEvent, type TextareaRenderable } from "@opentui/core"
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { theme } from "./theme"
import { matchSlashCommands, slashCommands } from "./commands"
import { matchFiles, matchSubagents } from "./mentions"
import { CommandPopover, type PopoverMatch } from "./CommandPopover"
import type { Skill } from "../skills"

export interface InputProps {
  onSubmit: (text: string) => void
  history: string[]
  disabled: boolean
  /** "splash" drops the border for a flat filled box and adds a footer status line — used on the empty-state screen. */
  variant?: "default" | "splash"
  footer?: string
  footerColor?: string
  onOpenCommandPalette?: () => void
  /**
   * The app-level Tab (build/plan) handler is a separate global key listener that a child's
   * preventDefault/stopPropagation doesn't reach — this is how the popover tells it to stand down.
   */
  onCommandPaletteOpenChange?: (open: boolean) => void
  skills?: Skill[]
}

// The library default is a plain-editor binding (Enter = newline, Meta+Enter
// = submit) — a chat box wants the opposite, so Enter sends and Shift+Enter
// inserts a line.
const CHAT_KEY_BINDINGS = [
  { name: "return", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
  { name: "kpenter", action: "submit" as const },
  { name: "kpenter", shift: true, action: "newline" as const },
]

interface Token {
  kind: "command" | "file" | "agent"
  start: number
  query: string
}

interface Suggestion extends PopoverMatch {
  insert: string
}

export function Input(props: InputProps) {
  let ref: TextareaRenderable | undefined
  let historyIndex = -1 // -1 = not currently browsing history
  const splash = () => props.variant === "splash"

  const [text, setText] = createSignal("")
  const [cursorOffset, setCursorOffset] = createSignal(0)
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [popoverDismissed, setPopoverDismissed] = createSignal(false)

  createEffect(() => {
    if (!props.disabled) ref?.focus()
  })

  onMount(() => {
    const input = ref
    if (!input) return
    const refocus = () => queueMicrotask(() => !props.disabled && input.focus())
    input.on(RenderableEvents.BLURRED, refocus)
    onCleanup(() => input.off(RenderableEvents.BLURRED, refocus))
  })

  // "/" only completes as the very first word (a command line); "@" completes anywhere
  // (a file mention inside a sentence); "$" only at the start (it redirects the whole
  // message to a subagent, so it can't also be mid-sentence).
  const activeToken = createMemo((): Token | null => {
    const value = text()
    const offset = cursorOffset()

    if (value[0] === "/") {
      const firstSpace = value.indexOf(" ")
      const wordEnd = firstSpace === -1 ? value.length : firstSpace
      if (offset <= wordEnd) return { kind: "command", start: 0, query: value.slice(1, offset) }
      return null
    }

    let start = offset
    while (start > 0 && !/\s/.test(value[start - 1]!)) start--
    const lead = value[start]
    if (lead === "@") return { kind: "file", start, query: value.slice(start + 1, offset) }
    if (lead === "$" && start === 0) return { kind: "agent", start, query: value.slice(start + 1, offset) }
    return null
  })

  const matches = createMemo((): Suggestion[] => {
    if (popoverDismissed()) return []
    const token = activeToken()
    if (!token) return []
    switch (token.kind) {
      case "command":
        return matchSlashCommands(token.query, props.skills).map((c) => ({ insert: `${c.name} `, label: c.name, description: c.description }))
      case "file":
        return matchFiles(token.query).map((f) => ({ insert: `@${f} `, label: `@${f}`, description: "" }))
      case "agent":
        return matchSubagents(token.query).map((s) => ({ insert: `$${s.name} `, label: `$${s.name}`, description: s.description }))
    }
  })
  const clampedIndex = () => Math.min(selectedIndex(), Math.max(0, matches().length - 1))

  // Once a command name is fully typed and no argument follows yet, show its
  // arg hint right after the cursor — like a fish-shell inline suggestion.
  const argHint = createMemo((): { col: number; hint: string } | null => {
    const value = text()
    if (value[0] !== "/" || cursorOffset() !== value.length) return null
    const spaceIdx = value.indexOf(" ")
    const cmdWord = spaceIdx === -1 ? value.slice(1) : value.slice(1, spaceIdx)
    if (spaceIdx !== -1 && value.slice(spaceIdx + 1).trim() !== "") return null
    const cmd = slashCommands(props.skills).find((c) => c.name.slice(1) === cmdWord)
    if (!cmd?.argHint) return null
    return { col: value.length, hint: cmd.argHint }
  })

  createEffect(() => props.onCommandPaletteOpenChange?.(matches().length > 0))

  // The core event carries no payload — read the current value straight off the ref.
  function handleContentChange(): void {
    setText(ref?.plainText ?? "")
    setCursorOffset(ref?.cursorOffset ?? 0)
    setPopoverDismissed(false)
    setSelectedIndex(0)
  }

  function acceptMatch(): void {
    const token = activeToken()
    const match = matches()[clampedIndex()]
    if (!token || !match || !ref) return
    const value = ref.plainText
    const offset = cursorOffset()
    const next = value.slice(0, token.start) + match.insert + value.slice(offset)
    const newCursor = token.start + match.insert.length
    ref.setText(next)
    ref.cursorOffset = newCursor
    setText(next)
    setCursorOffset(newCursor)
  }

  function handleSubmit(): void {
    if (!ref) return
    const value = ref.plainText.trim()
    if (value === "") return
    ref.clear()
    setText("")
    setCursorOffset(0)
    historyIndex = -1
    props.onSubmit(value)
  }

  // History recall only kicks in from an empty buffer, so normal cursor
  // movement inside multi-line input is never intercepted.
  function handleKeyDown(event: KeyEvent): void {
    if (!ref) return

    if (event.ctrl && event.name === "p") {
      props.onOpenCommandPalette?.()
      event.preventDefault()
      return
    }

    if (matches().length > 0) {
      if (event.name === "up") {
        setSelectedIndex((i) => (i <= 0 ? matches().length - 1 : i - 1))
        event.preventDefault()
        return
      }
      if (event.name === "down") {
        setSelectedIndex((i) => (i + 1 >= matches().length ? 0 : i + 1))
        event.preventDefault()
        return
      }
      // If the typed token already exactly names the selected match, there's nothing to
      // complete — Tab still shouldn't insert a literal tab, but Enter should fall through
      // to the normal submit binding instead of re-filling identical text and going nowhere.
      const token = activeToken()!
      const selected = matches()[clampedIndex()]
      const typed = text().slice(token.start, cursorOffset())
      const alreadyComplete = selected !== undefined && typed === selected.label
      if (event.name === "tab") {
        if (!alreadyComplete) acceptMatch()
        event.preventDefault()
        return
      }
      if (event.name === "return" && !alreadyComplete) {
        acceptMatch()
        event.preventDefault()
        return
      }
      if (event.name === "escape") {
        setPopoverDismissed(true)
        event.preventDefault()
        return
      }
    }

    // Tab switches build/plan mode at the App level — never let it insert a literal tab.
    if (event.name === "tab") {
      event.preventDefault()
      return
    }
    if (props.history.length === 0) return

    if (event.name === "up" && ref.plainText === "") {
      historyIndex = historyIndex === -1 ? props.history.length - 1 : Math.max(0, historyIndex - 1)
      const next = props.history[historyIndex] ?? ""
      ref.setText(next)
      setText(next)
      setCursorOffset(next.length)
      event.preventDefault()
    } else if (event.name === "down" && historyIndex !== -1) {
      historyIndex += 1
      const done = historyIndex >= props.history.length
      const next = done ? "" : (props.history[historyIndex] ?? "")
      ref.setText(next)
      setText(next)
      setCursorOffset(next.length)
      if (done) historyIndex = -1
      event.preventDefault()
    }
  }

  return (
    <>
      <Show when={matches().length > 0}>
        <CommandPopover matches={matches()} selectedIndex={clampedIndex()} />
      </Show>
      <box
        flexShrink={0}
        flexDirection="column"
        position="relative"
        border={splash() ? ["left"] : true}
        borderColor={splash() ? theme.logo : theme.border}
        backgroundColor={splash() ? theme.splashInputBg : undefined}
        paddingLeft={splash() ? 2 : 1}
        paddingRight={splash() ? 2 : 1}
        paddingTop={splash() ? 1 : 0}
        paddingBottom={splash() ? 1 : 0}
      >
        {argHint() && (
          <text position="absolute" top={0} left={argHint()!.col} fg={theme.dim}>
            {` ${argHint()!.hint}`}
          </text>
        )}
        <textarea
          ref={ref}
          focused={!props.disabled}
          minHeight={1}
          maxHeight={6}
          placeholder={
            splash() ? "Type your message... (type / for commands)" : "Ask Rofiant Code…  (Enter to send, Shift+Enter for newline)"
          }
          placeholderColor={theme.dim}
          backgroundColor={splash() ? theme.splashInputBg : undefined}
          focusedBackgroundColor={splash() ? theme.splashInputBg : undefined}
          onSubmit={handleSubmit}
          onContentChange={() => handleContentChange()}
          onKeyDown={handleKeyDown}
          keyBindings={CHAT_KEY_BINDINGS}
        />
        {splash() && props.footer && (
          <box marginTop={1}>
            <text fg={props.footerColor ?? theme.logo}>{props.footer}</text>
          </box>
        )}
      </box>
    </>
  )
}
