import { createMemo, createSignal, For, Show } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { theme } from "./theme"
import { isPrintable } from "./SettingsModal"
import { loginWithRofiant } from "../auth/login"
import { loadAuth, saveAuth } from "../auth/store"

type ProviderKind = "rofiant" | "apikey" | "logout"

interface ProviderItem {
  id: string
  label: string
  group: string | null
  kind: ProviderKind
}

const PROVIDER_ITEMS: ProviderItem[] = [
  { id: "rofiant", label: "Rofiant", group: null, kind: "rofiant" },
  { id: "openai", label: "OpenAI API key", group: "Bring your own key", kind: "apikey" },
  { id: "anthropic", label: "Anthropic API key", group: "Bring your own key", kind: "apikey" },
]

// This client only speaks the OpenAI-compatible /chat/completions wire format
// (see llm/client.ts) — real Anthropic support needs a different adapter, so
// the key is saved but won't do anything until that adapter exists.
const PROVIDER_BASE_URL: Record<"openai" | "anthropic", string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
}

export interface ProviderSelectorProps {
  webUrl: string
  onClose: () => void
  onDone: (message: string) => void
}

export function ProviderSelector(props: ProviderSelectorProps) {
  const [index, setIndex] = createSignal(0)
  const [phase, setPhase] = createSignal<"list" | "logging-in" | "key-entry">("list")
  const [apiKeyProvider, setApiKeyProvider] = createSignal<"openai" | "anthropic" | null>(null)
  const [apiKey, setApiKey] = createSignal("")
  // Which saved login is currently active, matching config.ts's precedence (a provider API
  // key wins over a Rofiant session if somehow both are saved) — re-read after logging out
  // so that row flips back to a normal login option without closing the modal.
  const [activeId, setActiveId] = createSignal<string | null>(loadAuth().provider?.name ?? (loadAuth().rofiant ? "rofiant" : null))

  const items = createMemo<ProviderItem[]>(() =>
    PROVIDER_ITEMS.map((item) => (item.id === activeId() ? { ...item, label: `Log out of ${item.label}`, kind: "logout" as const } : item)),
  )

  function logOut(id: string): void {
    const auth = loadAuth()
    if (id === "rofiant") delete auth.rofiant
    else delete auth.provider
    if (!saveAuth(auth)) {
      props.onDone("Could not save logout.")
      return
    }
    setActiveId(null)
    props.onDone("Logged out.")
  }

  function selectItem(item: ProviderItem): void {
    if (item.kind === "logout") {
      logOut(item.id)
      return
    }
    if (item.kind === "rofiant") {
      setPhase("logging-in")
      loginWithRofiant(props.webUrl).then(
        (tokens) => {
          if (!saveAuth({ ...loadAuth(), rofiant: tokens })) {
            props.onDone("Could not save Rofiant login.")
            return
          }
          setActiveId("rofiant")
          props.onDone("Signed in to Rofiant.")
        },
        (err: Error) => props.onDone(`Rofiant login failed: ${err.message}`),
      )
      return
    }
    if (item.kind === "apikey") {
      setApiKeyProvider(item.id as "openai" | "anthropic")
      setApiKey("")
      setPhase("key-entry")
      return
    }
  }

  function submitApiKey(): void {
    const name = apiKeyProvider()
    const key = apiKey().trim()
    if (!name || !key) return
    if (!saveAuth({ ...loadAuth(), provider: { name, apiKey: key, baseUrl: PROVIDER_BASE_URL[name] } })) {
      props.onDone("Could not save API key.")
      return
    }
    setActiveId(name)
    props.onDone(
      name === "anthropic"
        ? "Anthropic key saved. Note: this build only speaks the OpenAI-compatible chat API, so it won't work until an Anthropic adapter exists."
        : "OpenAI key saved.",
    )
  }

  useKeyboard((key) => {
    if (key.name === "escape") {
      props.onClose()
      return
    }

    if (phase() === "key-entry") {
      if (key.name === "return") {
        submitApiKey()
      } else if (key.name === "backspace") {
        setApiKey((k) => k.slice(0, -1))
      } else if (!key.ctrl && !key.meta && !key.super && isPrintable(key.sequence)) {
        setApiKey((k) => k + key.sequence)
      }
      return
    }

    if (phase() !== "list") return

    const name = key.name.toLowerCase()
    if (name === "up") setIndex((i) => (i <= 0 ? items().length - 1 : i - 1))
    else if (name === "down") setIndex((i) => (i + 1 >= items().length ? 0 : i + 1))
    else if (name === "return") selectItem(items()[index()]!)
  })

  const rows = createMemo(() => {
    const out: Array<{ header: string | null; item: ProviderItem; itemIndex: number }> = []
    let lastGroup: string | null | undefined
    items().forEach((item, itemIndex) => {
      out.push({ header: item.group !== lastGroup ? item.group : null, item, itemIndex })
      lastGroup = item.group
    })
    return out
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
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text}>{phase() === "key-entry" ? `${apiKeyProvider()} API key` : "Select provider"}</text>
          <text fg={theme.dim}>esc</text>
        </box>

        <Show when={phase() === "list"}>
          <text fg={theme.dim}>Search</text>

          <scrollbox maxHeight={18} scrollbarOptions={{ visible: false }} marginTop={1}>
            <For each={rows()}>
              {(row) => {
                const selected = () => row.itemIndex === index()
                return (
                  <>
                    <Show when={row.header}>
                      <text fg={theme.logo}>{row.header}</text>
                    </Show>
                    <box backgroundColor={selected() ? theme.logo : undefined} paddingLeft={row.item.group ? 0 : 0}>
                      <text fg={selected() ? theme.splashBg : theme.text}>{row.item.label}</text>
                    </box>
                  </>
                )
              }}
            </For>
          </scrollbox>

          <box marginTop={1}>
            <text fg={theme.dim}>Up/Down move · Enter select · Esc cancel</text>
          </box>
        </Show>

        <Show when={phase() === "logging-in"}>
          <box marginTop={1}>
            <text fg={theme.text}>Opening browser to sign in to Rofiant…</text>
            <text fg={theme.dim}>Waiting for you to finish in the browser. Esc cancels.</text>
          </box>
        </Show>

        <Show when={phase() === "key-entry"}>
          <box marginTop={1} flexDirection="column">
            <text fg={theme.dim}>Paste your API key, then Enter</text>
            <box flexDirection="row" marginTop={1} border={["bottom"]} borderColor={theme.border}>
              <text fg={theme.text}>{"•".repeat(apiKey().length)}</text>
              <text fg={theme.logo}>▏</text>
            </box>
          </box>
        </Show>
      </box>
    </box>
  )
}
