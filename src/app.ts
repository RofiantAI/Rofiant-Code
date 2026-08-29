import { render } from "@opentui/solid"
import { loadConfig } from "./config"
import { OpenAICompatibleProvider } from "./llm/client"
import { tools, toolDefinitions } from "./tools"
import { gatherProjectContext, readAgentsFile, readMemoryFile } from "./agent/context"
import { buildSystemPrompt } from "./agent/system-prompt"
import { SessionStore } from "./sessions/store"
import type { Session } from "./sessions/types"
import { workspaceRoot } from "./utils/paths"
import { logger } from "./utils/logger"
import { App } from "./ui/App"
import { createSkillTool, discoverSkills } from "./skills"

function parseFlags() {
  const argv = process.argv.slice(2)
  return {
    continueSession: argv.includes("--continue") || argv.includes("-c"),
    dangerouslySkipPermissions:
      argv.includes("--dangerously-skip-permissions") || Bun.env.ROFIANT_DANGEROUSLY_SKIP_PERMISSIONS === "1",
  }
}

export async function main(): Promise<void> {
  const config = loadConfig()
  const flags = parseFlags()
  const provider = new OpenAICompatibleProvider(config.apiKey, config.baseUrl)
  const sessionStore = new SessionStore()
  const skills = discoverSkills(workspaceRoot)
  const skillTool = createSkillTool(skills)
  const appTools = new Map(tools).set(skillTool.name, skillTool)

  const [projectContext, agentsMd, memoryMd] = await Promise.all([
    gatherProjectContext(),
    Promise.resolve(readAgentsFile()),
    Promise.resolve(readMemoryFile()),
  ])
  const systemPrompt = buildSystemPrompt(projectContext, agentsMd, memoryMd, skills)

  const [mostRecentSession] = sessionStore.listForProject(workspaceRoot, 1)

  let session: Session | null = null
  let resumed = false

  if (flags.continueSession) {
    const previous = mostRecentSession ? sessionStore.load(mostRecentSession.id) : null
    if (previous && previous.messages.length > 1) {
      // Fresh system prompt (AGENTS.md/MEMORY.md may have changed), old conversation kept.
      session = { ...previous, messages: [{ role: "system", content: systemPrompt }, ...previous.messages.slice(1)] }
      resumed = true
    }
  }

  // Whatever model this project's last session used wins over the AI_MODEL/built-in default —
  // that default only matters for a project's very first run, before any history exists.
  const model = session?.model ?? mostRecentSession?.model ?? config.model

  session ??= sessionStore.create(workspaceRoot, model)

  logger.info("starting", {
    workspaceRoot,
    model,
    baseUrl: config.baseUrl,
    resumed,
    dangerouslySkipPermissions: flags.dangerouslySkipPermissions,
  })

  await render(() =>
    App({
      config: { ...config, model },
      provider,
      tools: appTools,
      toolDefinitions: toolDefinitions([skillTool]),
      skills,
      systemPrompt,
      session,
      sessionStore,
      resumed,
      dangerouslySkipPermissions: flags.dangerouslySkipPermissions,
    }),
  )
}
