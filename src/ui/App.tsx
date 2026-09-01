import { createEffect, createMemo, createSignal, onMount, Show } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid"
import { loadConfig, type Config } from "../config"
import type { LLMProvider } from "../llm/types"
import type { ToolDefinition } from "../llm/types"
import type { Tool, ToolResult } from "../tools/types"
import { READ_ONLY_TOOLS } from "../tools"
import type { Session } from "../sessions/types"
import type { SessionStore } from "../sessions/store"
import type { PermissionOutcome, PermissionRequest } from "../permissions/permissions"
import { PermissionManager } from "../permissions/permissions"
import { Agent } from "../agent/agent"
import { expandAttachments } from "../agent/attachments"
import { workspaceRoot, toDisplayPath } from "../utils/paths"
import * as git from "../utils/git"
import { checkForUpdate, checkUpdateStatus } from "../utils/update-check"
import pkg from "../../package.json"
import { listModels, type FreeModelInfo } from "../llm/models"
import { theme, setThemeMode } from "./theme"
import { Chat } from "./Chat"
import { Input } from "./Input"
import { StatusBar } from "./StatusBar"
import { Permission } from "./Permission"
import { WorkingIndicator } from "./WorkingIndicator"
import { ModelSelector } from "./ModelSelector"
import { ProviderSelector } from "./ProviderSelector"
import { LoginRequiredModal } from "./LoginRequiredModal"
import { Splash } from "./Splash"
import { slashCommands } from "./commands"
import { SUBAGENTS, type SubagentDef } from "./mentions"
import { replayMessages } from "./replay"
import type { ChatEntry } from "./types"
import { SettingsModal, type SettingAction } from "./SettingsModal"
import { loadSettings, saveSettings, type AppSettings } from "../settings"
import type { Skill } from "../skills"
import { renderSkillPrompt } from "../skills"
import { fileURLToPath } from "node:url"

/** Bundled with the app itself, not the user's workspace — resolved relative to this module, not cwd. */
const LOGO_PATH = fileURLToPath(new URL("../../public/logo.png", import.meta.url))

/** The little "* Worked for 12s · done 1:06 PM" line under a finished assistant turn. */
function turnFooter(startedAt: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000))
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  return `Worked for ${seconds}s · done ${time}`
}

/** Ambient working recap shows roughly this often, not after every single turn. */
const RECAP_EVERY_N_TURNS = 6

export interface AppProps {
  config: Config
  provider: LLMProvider
  tools: Map<string, Tool<any>>
  toolDefinitions: ToolDefinition[]
  systemPrompt: string
  session: Session
  sessionStore: SessionStore
  resumed: boolean
  dangerouslySkipPermissions: boolean
  skills: Skill[]
}

function buildHelpText(skills: Skill[]): string {
  const commands = slashCommands(skills)
  const width = Math.max(...commands.map((command) => command.name.length)) + 2
  const commandLines = commands.map((command) => `  ${command.name.padEnd(width)}${command.description}`).join("\n")
  return `Commands:\n${commandLines}\n\n${HELP_KEYS_AND_FLAGS}`
}

const HELP_KEYS_AND_FLAGS = `Keys:
  Enter        Send message
  Shift+Enter  Newline
  Tab          Switch build / plan mode
  Ctrl+P       Open settings
  @file        Attach a file's contents — autocompletes as you type, works anywhere in the message
  $agent       Send the whole message to a subagent instead — ${SUBAGENTS.map((s) => `$${s.name}`).join(", ")}
  Up / Down    Recall input history (from an empty prompt)
  Ctrl+C       Cancel the running task, or exit if nothing is running
  Ctrl+L       Clear screen
  Esc          Interrupt the current task

Flags:
  --continue / -c                 Resume the most recent session for this directory
  --dangerously-skip-permissions  Auto-approve every action (trusted/disposable environments only)

Skills:
  Install project skills at .rofiant/skills/<name>/SKILL.md
  Install global skills at ~/.config/rofiant/skills/<name>/SKILL.md
  Compatible .agents, .claude, .codex, and .opencode skill directories are also detected at startup
  Run /<name> [request] to invoke one`

/** `$name <task>` at the very start of a message redirects it to a one-shot subagent instead of the main agent. */
function matchSubagentDispatch(text: string): { def: SubagentDef; task: string } | null {
  const m = text.match(/^\$(\S+)\s+([\s\S]+)$/)
  if (!m) return null
  const def = SUBAGENTS.find((s) => s.name === m[1])
  if (!def) return null
  return { def, task: m[2]!.trim() }
}

export function App(props: AppProps) {
  const [entries, setEntries] = createStore<ChatEntry[]>(
    props.resumed ? replayMessages(props.session.messages) : [],
  )
  const [appSettings, setAppSettings] = createStore(loadSettings())
  createEffect(() => setThemeMode(appSettings.theme))
  const [model, setModelSignal] = createSignal(props.session.model)
  const [suggestionsOpen, setSuggestionsOpen] = createSignal(false)
  const [settingsOpen, setSettingsOpen] = createSignal(false)
  const [branch, setBranch] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [totalTokens, setTotalTokens] = createSignal(props.session.promptTokens + props.session.completionTokens)
  const [inputHistory, setInputHistory] = createSignal<string[]>([])
  const [pending, setPending] = createSignal<{ req: PermissionRequest; resolve: (o: PermissionOutcome) => void } | null>(
    null,
  )
  const [modelPicker, setModelPicker] = createSignal<FreeModelInfo[] | null>(null)
  const [providerPicker, setProviderPicker] = createSignal(false)
  const [loginRequired, setLoginRequired] = createSignal(false)
  const [skipPermissions, setSkipPermissions] = createSignal(props.dangerouslySkipPermissions)

  let session = props.session
  let currentAbort: AbortController | null = null
  let ctrlCArmed = false
  let turnsSinceRecap = 0

  const renderer = useRenderer()
  const dimensions = useTerminalDimensions()
  const hasConversation = createMemo(() => entries.some((e) => e.kind !== "info"))
  const mode = () => appSettings.mode

  // The splash's block-font logo is drawn by a framebuffer-backed renderable; when it unmounts
  // (first real message sent) the terminal cells it occupied don't reliably get cleared, leaving
  // a ghost of the logo behind. renderer.resize() no-ops when width/height match the current
  // size (see CliRenderer.processResize), so resizing to the current size does nothing — bump
  // the height by one cell and back to force the full repaint.
  createEffect((prev: boolean | undefined) => {
    const has = hasConversation()
    if (has && prev === false) {
      const { width, height } = dimensions()
      renderer.resize(width, Math.max(1, height - 1))
      renderer.resize(width, height)
    }
    return has
  })

  const permissions = new PermissionManager((req) => {
    if (skipPermissions()) return Promise.resolve({ decision: "allow" as const })
    return new Promise<PermissionOutcome>((resolve) => {
      setPending({ req, resolve })
    })
  })

  const agent = new Agent(
    {
      provider: props.provider,
      model: props.session.model,
      tools: props.tools,
      toolDefinitions: props.toolDefinitions,
      permissions,
      systemPrompt: props.systemPrompt,
      maxContextTokens: props.config.maxContextTokens,
      reasoningEffort: appSettings.reasoningEffort === "none" ? undefined : appSettings.reasoningEffort,
    },
    props.session.messages,
  )

  createEffect(() => {
    agent.setAllowedTools(mode() === "plan" ? [...READ_ONLY_TOOLS] : null)
  })

  createEffect(() => {
    renderer.setTerminalTitle(appSettings.terminalTitle ? `Rofiant Code — ${workspaceRoot}` : "")
  })

  onMount(async () => {
    setBranch(await git.currentBranch())
    checkForUpdate(props.config.githubRepo).then((update) => {
      if (update) {
        info(
          `⬆ Update available: v${update.current} → v${update.latest}\n` +
            `${update.url}\n` +
            `Update whenever you're ready — nothing here does it for you, and there's nothing to do to skip it.`,
        )
      }
    })
    if (props.dangerouslySkipPermissions) {
      info("⚠ Permissions bypassed — every tool call will run without confirmation.")
    }
    if (props.resumed) {
      info(`Resumed session ${session.id.slice(0, 8)} (${entries.length} entries)`)
    }
  })

  function addEntry(entry: ChatEntry): void {
    setEntries(entries.length, entry)
  }

  function info(text: string): void {
    addEntry({ kind: "info", id: crypto.randomUUID(), text })
  }

  function errorEntry(text: string): void {
    addEntry({ kind: "error", id: crypto.randomUUID(), text })
  }

  /** Fire-and-forget: a decorative aside, never worth surfacing an error or blocking on. */
  function maybeRecap(): void {
    if (!appSettings.recaps) return
    turnsSinceRecap += 1
    if (turnsSinceRecap < RECAP_EVERY_N_TURNS) return
    turnsSinceRecap = 0

    agent
      .recap(new AbortController().signal)
      .then((text) => {
        if (text) addEntry({ kind: "recap", id: crypto.randomUUID(), text })
      })
      .catch(() => {})
  }

  function appendAssistantText(id: string, delta: string): void {
    setEntries(
      produce((arr) => {
        const item = arr.find((e) => e.id === id)
        if (item && item.kind === "assistant") item.text += delta
      }),
    )
  }

  function setAssistantFooter(id: string, footer: string): void {
    setEntries(
      produce((arr) => {
        const item = arr.find((e) => e.id === id)
        if (item && item.kind === "assistant") item.footer = footer
      }),
    )
  }

  function completeToolEntry(id: string, result: ToolResult): void {
    setEntries(
      produce((arr) => {
        const item = arr.find((e) => e.id === id)
        if (item && item.kind === "tool") {
          item.status = "done"
          item.result = result
        }
      }),
    )
  }

  function saveSession(): void {
    session.messages = agent.getMessages()
    session.promptTokens = agent.promptTokens
    session.completionTokens = agent.completionTokens
    props.sessionStore.save(session)
  }

  /** Every exit path funnels through here so the resume hint is never skipped or duplicated. */
  function exitApp(): void {
    // messages[0] is always the system prompt — more than that means there's something to resume.
    const hasHistory = session.messages.length > 1
    if (hasHistory) saveSession()
    renderer.destroy()
    if (hasHistory) console.log(`\nSession saved — resume it next time with --continue (or -c).`)
    process.exit(0)
  }

  function selectModel(id: string): void {
    setModelSignal(id)
    agent.setModel(id)
    session.model = id
    saveSession()
    info(`Model set to ${id}`)
  }

  function updateSetting(next: Partial<AppSettings>): void {
    setAppSettings(next)
    if (!saveSettings({ ...appSettings })) errorEntry("Could not save settings.")
  }

  function toggleMode(): void {
    updateSetting({ mode: mode() === "build" ? "plan" : "build" })
  }

  async function handleSubmit(text: string): Promise<void> {
    if (busy()) return
    setInputHistory((h) => [...h, text])
    addEntry({ kind: "user", id: crypto.randomUUID(), text })

    if (text.startsWith("/")) {
      await runSlashCommand(text)
      return
    }

    const dispatch = matchSubagentDispatch(text)
    if (dispatch) {
      await runSubagent(dispatch.def, dispatch.task)
      return
    }

    await runAgent(text)
  }

  async function runAgent(promptText: string, userText = promptText): Promise<void> {
    const controller = new AbortController()
    currentAbort = controller
    setBusy(true)

    const startedAt = Date.now()
    const assistantId = crypto.randomUUID()
    let assistantAdded = false

    try {
      for await (const event of agent.send(expandAttachments(userText), controller.signal, expandAttachments(promptText))) {
        switch (event.type) {
          case "text-delta":
            if (!assistantAdded) {
              addEntry({ kind: "assistant", id: assistantId, text: "" })
              assistantAdded = true
            }
            appendAssistantText(assistantId, event.text)
            break
          case "tool-start":
            addEntry({ kind: "tool", id: event.id, name: event.name, describe: event.describe, status: "running" })
            break
          case "tool-end":
            completeToolEntry(event.id, event.result)
            break
          case "usage":
            setTotalTokens(agent.promptTokens + agent.completionTokens)
            break
          case "error":
            errorEntry(event.message)
            break
          case "turn-end":
            if (assistantAdded) {
              setAssistantFooter(assistantId, turnFooter(startedAt))
              maybeRecap()
            }
            break
        }
      }
    } finally {
      setBusy(false)
      currentAbort = null
      saveSession()
    }
  }

  async function runCompact(): Promise<void> {
    const controller = new AbortController()
    currentAbort = controller
    setBusy(true)

    const id = crypto.randomUUID()
    addEntry({ kind: "assistant", id, text: "" })

    try {
      await agent.compact(controller.signal, (delta) => appendAssistantText(id, delta))
      setTotalTokens(agent.promptTokens + agent.completionTokens)
      info("Context compacted — earlier history replaced with the summary above.")
    } catch (err) {
      errorEntry((err as Error).message)
    } finally {
      setBusy(false)
      currentAbort = null
      saveSession()
    }
  }

  // ponytail: runs out-of-band and isn't folded back into the main agent's history or the
  // saved session (mirrors /compact's throwaway request) — a subagent is a side quest, not
  // part of the conversation the model needs to remember. Persist its transcript if that bites.
  async function runSubagent(def: SubagentDef, rawTask: string): Promise<void> {
    const controller = new AbortController()
    currentAbort = controller
    setBusy(true)

    const id = crypto.randomUUID()
    addEntry({ kind: "subagent", id, name: def.name, task: rawTask, status: "running", text: "", toolCount: 0 })

    const subagent = new Agent(
      {
        provider: props.provider,
        model: model(),
        tools: props.tools,
        toolDefinitions: props.toolDefinitions,
        permissions,
        systemPrompt: def.systemPrompt,
        maxContextTokens: props.config.maxContextTokens,
      },
      [],
    )
    if (def.readOnly) subagent.setAllowedTools([...READ_ONLY_TOOLS])

    function updateSubagent(fn: (e: Extract<ChatEntry, { kind: "subagent" }>) => void): void {
      setEntries(
        produce((arr) => {
          const item = arr.find((e) => e.id === id)
          if (item && item.kind === "subagent") fn(item)
        }),
      )
    }

    try {
      for await (const event of subagent.send(expandAttachments(rawTask), controller.signal)) {
        switch (event.type) {
          case "text-delta":
            updateSubagent((e) => (e.text += event.text))
            break
          case "tool-end":
            updateSubagent((e) => (e.toolCount += 1))
            break
          case "usage":
            setTotalTokens(totalTokens() + event.promptTokens + event.completionTokens)
            break
          case "error":
            updateSubagent((e) => (e.status = "error"))
            errorEntry(event.message)
            break
        }
      }
      updateSubagent((e) => {
        if (e.status === "running") e.status = "done"
      })
    } finally {
      setBusy(false)
      currentAbort = null
    }
  }

  async function runSlashCommand(raw: string): Promise<void> {
    const [cmd, ...rest] = raw.slice(1).trim().split(/\s+/)
    const arg = rest.join(" ")

    switch (cmd) {
      case "help":
        info(buildHelpText(props.skills))
        break

      case "new":
        session = props.sessionStore.create(workspaceRoot, model())
        agent.reset(props.systemPrompt)
        setEntries([])
        setTotalTokens(0)
        info(`New session started (${session.id.slice(0, 8)})`)
        break

      case "clear":
        setEntries([])
        break

      case "model":
        if (arg) {
          selectModel(arg)
          break
        }
        {
          const list = await listModels(props.config.baseUrl, props.config.apiKey)
          if (list && list.length > 0) {
            setModelPicker(list)
          } else {
            info(
              `Current model: ${model()}` +
                (list
                  ? ""
                  : "\n\n(Couldn't reach the provider's model list — set one directly: /model <id>)"),
            )
          }
        }
        break

      case "effort": {
        const levels = ["none", "low", "medium", "high", "xhigh"] as const
        if (!arg) {
          info(`Current reasoning effort: ${appSettings.reasoningEffort}`)
        } else if (!(levels as readonly string[]).includes(arg)) {
          errorEntry(`Invalid effort: ${arg}. Use one of: ${levels.join(", ")}`)
        } else {
          updateSetting({ reasoningEffort: arg as (typeof levels)[number] })
          agent.setReasoningEffort(arg === "none" ? undefined : arg)
          info(`Reasoning effort set to ${arg}`)
        }
        break
      }

      case "login":
        setProviderPicker(true)
        break

      case "compact":
        if (busy()) {
          errorEntry("Already working — try again once the current task finishes.")
        } else {
          await runCompact()
        }
        break

      case "status": {
        const files = await git.statusPorcelain()
        info(
          [
            `Directory: ${workspaceRoot}`,
            `Git branch: ${branch() ?? "n/a"}`,
            `Provider: ${props.config.baseUrl}`,
            `Model: ${model()}`,
            `Mode: ${mode()}`,
            `Changed files: ${files.length}`,
          ].join("\n"),
        )
        break
      }

      case "diff": {
        const text = await git.diff({})
        info(text.trim() === "" ? "No changes." : text)
        break
      }

      case "sessions": {
        const list = props.sessionStore.listForProject(workspaceRoot)
        if (list.length === 0) {
          info("No saved sessions for this project yet.")
        } else {
          info(
            `Recent sessions — resume the latest with \`--continue\`:\n\n` +
              list
                .map((s) => `  ${s.id.slice(0, 8)}  ${new Date(s.updatedAt).toLocaleString()}  ${s.messageCount} messages`)
                .join("\n"),
          )
        }
        break
      }

      case "usage": {
        const byModel = props.sessionStore.usageByModel(workspaceRoot)
        const projectPrompt = byModel.reduce((sum, r) => sum + r.promptTokens, 0)
        const projectCompletion = byModel.reduce((sum, r) => sum + r.completionTokens, 0)
        const projectSessions = byModel.reduce((sum, r) => sum + r.sessionCount, 0)
        const num = (n: number) => n.toLocaleString()
        const modelWidth = Math.max(10, ...byModel.map((r) => r.model.length)) + 2

        const lines = [
          `This session — ${model()}`,
          `  Prompt      ${num(agent.promptTokens).padStart(9)}`,
          `  Completion  ${num(agent.completionTokens).padStart(9)}`,
          `  Total       ${num(agent.promptTokens + agent.completionTokens).padStart(9)}`,
          "",
          `This project — ${projectSessions} session${projectSessions === 1 ? "" : "s"}, ${num(projectPrompt + projectCompletion)} tokens total`,
          ...byModel.map(
            (r) =>
              `  ${r.model.padEnd(modelWidth)} ${num(r.promptTokens).padStart(9)} + ${num(r.completionTokens).padStart(9)} = ${num(r.promptTokens + r.completionTokens).padStart(10)}  (${r.sessionCount} session${r.sessionCount === 1 ? "" : "s"})`,
          ),
        ]
        info(lines.join("\n"))
        break
      }

      case "update": {
        const update = await checkUpdateStatus(props.config.githubRepo)
        if (update.status === "available") {
          info(`Updating v${update.current} → v${update.latest}…`)
          setBusy(true)
          try {
            // Re-runs the same installer users would curl|bash by hand — it already
            // does an atomic swap with backup/rollback, so this is safe mid-session.
            const proc = Bun.spawn(
              ["bash", "-c", `curl -fsSL https://raw.githubusercontent.com/${props.config.githubRepo}/main/install.sh | bash`],
              { stdout: "pipe", stderr: "pipe" },
            )
            const [stdout, stderr, code] = await Promise.all([
              new Response(proc.stdout).text(),
              new Response(proc.stderr).text(),
              proc.exited,
            ])
            if (code === 0) {
              info(`Updated to v${update.latest}. Restart rofiant to use it.`)
            } else {
              errorEntry(`Update failed:\n${(stderr || stdout).trim().slice(-2000)}`)
            }
          } finally {
            setBusy(false)
          }
        } else if (update.status === "current") {
          info(`Rofiant Code v${update.current} is up to date.`)
        } else {
          errorEntry("Could not check for updates. Verify your network and ROFIANT_GITHUB_REPO.")
        }
        break
      }

      case "skip-permissions":
        if (skipPermissions()) {
          setSkipPermissions(false)
          info("Permission checks re-enabled.")
        } else {
          setPending({
            req: {
              toolName: "skip-permissions",
              level: "dangerous",
              summary: "Skip all permission checks for the rest of this session?",
              detail: "Every edit, write, and shell command will run without asking — including destructive ones.",
              key: "skip-permissions",
              hideAlways: true,
            },
            resolve: (outcome) => {
              if (outcome.decision === "allow") {
                setSkipPermissions(true)
                info("⚠ Skip all permissions enabled — every tool call will run without confirmation.")
              }
            },
          })
        }
        break

      case "exit":
        exitApp()
        break

      default:
        {
          const skill = props.skills.find((item) => item.name === cmd)
          if (skill) {
            await runAgent(renderSkillPrompt(skill, arg), raw)
            break
          }
          errorEntry(`Unknown command: /${cmd ?? ""}. Try /help.`)
        }
    }
  }

  const settingActions = (): SettingAction[] => [
    {
      title: "Model",
      description: "Choose model used for new requests",
      category: "Agent",
      value: model(),
      onSelect: () => {
        setSettingsOpen(false)
        void runSlashCommand("/model")
      },
    },
    {
      title: "Provider",
      description: "Sign in or switch LLM provider",
      category: "Agent",
      value: "",
      onSelect: () => {
        setSettingsOpen(false)
        void runSlashCommand("/login")
      },
    },
    {
      title: "Agent mode",
      description: "Build allows edits; Plan is read-only",
      category: "Agent",
      value: mode() === "build" ? "Build" : "Plan",
      onSelect: toggleMode,
    },
    {
      title: "Visual style",
      description: "Toggle vivid splash effects",
      category: "Appearance",
      value: appSettings.visualMode === "vivid" ? "Vivid" : "Minimal",
      onSelect: () => updateSetting({ visualMode: appSettings.visualMode === "vivid" ? "minimal" : "vivid" }),
    },
    {
      title: "Theme",
      description: "Dark or light color palette",
      category: "Appearance",
      value: appSettings.theme === "light" ? "Light" : "Dark",
      onSelect: () => updateSetting({ theme: appSettings.theme === "light" ? "dark" : "light" }),
    },
    {
      title: "Diff wrapping",
      description: "Wrap long diff lines to terminal width",
      category: "Appearance",
      value: appSettings.diffWrap ? "On" : "Off",
      onSelect: () => updateSetting({ diffWrap: !appSettings.diffWrap }),
    },
    {
      title: "Terminal title",
      description: "Set terminal tab title to project",
      category: "System",
      value: appSettings.terminalTitle ? "On" : "Off",
      onSelect: () => updateSetting({ terminalTitle: !appSettings.terminalTitle }),
    },
    {
      title: "Recaps",
      description: "Occasional ambient summary of what's been done and what's next",
      category: "System",
      value: appSettings.recaps ? "On" : "Off",
      onSelect: () => updateSetting({ recaps: !appSettings.recaps }),
    },
    {
      title: "Skip permissions",
      description: "Run edits, writes, and shell commands without asking",
      category: "System",
      value: skipPermissions() ? "On" : "Off",
      onSelect: () => void runSlashCommand("/skip-permissions"),
    },
    {
      title: "New session",
      description: "Start a fresh session and clear the chat",
      category: "System",
      value: "",
      onSelect: () => {
        setSettingsOpen(false)
        void runSlashCommand("/new")
      },
    },
  ]

  useKeyboard((key) => {
    const name = key.name.toLowerCase()

    // Own global shortcuts here: chat scroll/focus can keep child textarea handlers from receiving them.
    if (key.ctrl && name === "p" && !busy() && !pending() && !modelPicker() && !settingsOpen() && !providerPicker() && !loginRequired()) {
      key.preventDefault()
      setSettingsOpen(true)
      return
    }

    if (key.ctrl && name === "c") {
      const current = pending()
      if (current) {
        current.resolve({ decision: "deny" })
        setPending(null)
      }
      if (modelPicker()) setModelPicker(null)
      if (providerPicker()) setProviderPicker(false)
      if (loginRequired()) setLoginRequired(false)
      if (busy()) {
        currentAbort?.abort()
        ctrlCArmed = false
        return
      }
      if (ctrlCArmed) {
        exitApp()
      }
      ctrlCArmed = true
      info("Press Ctrl+C again to exit")
      setTimeout(() => {
        ctrlCArmed = false
      }, 2000)
      return
    }

    if (pending() || modelPicker() || settingsOpen() || providerPicker() || loginRequired()) return // that component owns the keyboard while it's open

    if (key.ctrl && name === "l") {
      setEntries([])
      return
    }
    if (name === "escape" && busy()) {
      currentAbort?.abort()
      return
    }
    if (name === "tab" && !busy() && !suggestionsOpen()) {
      toggleMode()
    }
  })

  return (
    <box position="relative" flexDirection="column" width="100%" height="100%">
      <Show
        when={hasConversation()}
        fallback={
          <Splash
            model={model()}
            mode={mode()}
            onSubmit={handleSubmit}
            history={inputHistory()}
            disabled={busy() || pending() !== null || settingsOpen() || modelPicker() !== null || providerPicker() || loginRequired()}
            onCommandPaletteOpenChange={setSuggestionsOpen}
            onOpenCommandPalette={() => setSettingsOpen(true)}
            paletteOpen={suggestionsOpen()}
            terminalHeight={dimensions().height}
            visualMode={appSettings.visualMode}
            skills={props.skills}
          />
        }
      >
        <box flexShrink={0} flexDirection="row" alignItems="center" paddingLeft={1} paddingRight={1} marginBottom={1} gap={1}>
          <box width={12} height={6} flexShrink={0} overflow="hidden">
            <image source={LOGO_PATH} width="100%" height="100%" fit="fit" protocol="blocks" />
          </box>
          <box flexDirection="column">
            <text>
              <span style={{ fg: theme.logo, bold: true }}>Rofiant Code</span>
              <span style={{ fg: theme.dim }}> v{pkg.version}</span>
            </text>
            <text fg={theme.dim}>{model()}</text>
            <text fg={theme.dim}>{toDisplayPath(workspaceRoot)}</text>
          </box>
        </box>

        <Chat entries={entries} diffWrap={appSettings.diffWrap} />

        <Show when={pending()}>
          {(p: () => { req: PermissionRequest; resolve: (o: PermissionOutcome) => void }) => (
            <Permission
              req={p().req}
              diffWrap={appSettings.diffWrap}
              onResolve={(outcome) => {
                p().resolve(outcome)
                setPending(null)
              }}
            />
          )}
        </Show>

        <WorkingIndicator active={busy() && !pending()} animate={appSettings.visualMode === "vivid"} />

        <Input
          onSubmit={handleSubmit}
          history={inputHistory()}
          disabled={busy() || pending() !== null || modelPicker() !== null || settingsOpen() || providerPicker() || loginRequired()}
          onCommandPaletteOpenChange={setSuggestionsOpen}
          onOpenCommandPalette={() => setSettingsOpen(true)}
          skills={props.skills}
        />
        <StatusBar
          model={model()}
          mode={mode()}
          branch={branch()}
          totalTokens={totalTokens()}
          maxContextTokens={props.config.maxContextTokens}
          busy={busy()}
          skipPermissions={skipPermissions()}
        />
      </Show>
      <Show when={settingsOpen()}>
        <SettingsModal actions={settingActions()} onClose={() => setSettingsOpen(false)} />
      </Show>
      <Show when={modelPicker()}>
        {(list: () => FreeModelInfo[]) => (
          <ModelSelector
            current={model()}
            models={list()}
            onSelect={(id) => {
              selectModel(id)
              setModelPicker(null)
            }}
            onCancel={() => setModelPicker(null)}
          />
        )}
      </Show>
      <Show when={loginRequired()}>
        <LoginRequiredModal onClose={() => setLoginRequired(false)} />
      </Show>
      <Show when={providerPicker()}>
        <ProviderSelector
          webUrl={props.config.webUrl}
          onClose={() => setProviderPicker(false)}
          onDone={(message) => {
            const previousBaseUrl = props.config.baseUrl
            const config = loadConfig()
            Object.assign(props.config, config)
            props.provider.configure?.(config.apiKey, config.baseUrl)
            if (config.baseUrl !== previousBaseUrl && config.model !== model()) selectModel(config.model)
            setProviderPicker(false)
            info(message)
          }}
        />
      </Show>
    </box>
  )
}
