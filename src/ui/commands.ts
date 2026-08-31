export interface SlashCommand {
  name: string
  description: string
  argHint?: string
}

import type { Skill } from "../skills"

/** Single source of truth for both /help text and the "/" autocomplete popover. */
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "/help", description: "Show available commands" },
  { name: "/new", description: "Start a new session" },
  { name: "/clear", description: "Clear the visible chat (keeps conversation history)" },
  { name: "/model", description: "Show the current model and open a picker to switch — /model <id> to set directly" },
  { name: "/effort", description: "Show or set reasoning effort", argHint: "[none|low|medium|high|xhigh]" },
  { name: "/login", description: "Sign in to Rofiant or add a third-party API key" },
  { name: "/compact", description: "Summarize the conversation, replacing history with the summary" },
  { name: "/status", description: "Show project, git, provider and model info" },
  { name: "/diff", description: "Show git changes made this session" },
  { name: "/sessions", description: "List recent sessions for this project" },
  { name: "/usage", description: "Show token usage for this session and this project, by model" },
  { name: "/update", description: "Download and install the latest Rofiant Code release" },
  { name: "/skip-permissions", description: "Toggle auto-approving every tool call — asks to confirm before turning on" },
  { name: "/exit", description: "Exit" },
]

export function slashCommands(skills: Skill[] = []): SlashCommand[] {
  const builtins = new Set(SLASH_COMMANDS.map((command) => command.name.slice(1)))
  return [
    ...SLASH_COMMANDS,
    ...skills.filter((skill) => !builtins.has(skill.name)).map((skill) => ({ name: `/${skill.name}`, description: skill.description })),
  ]
}

export function matchSlashCommands(query: string, skills: Skill[] = []): SlashCommand[] {
  const needle = query.toLowerCase()
  return slashCommands(skills).filter((c) => c.name.slice(1).toLowerCase().startsWith(needle))
}
