import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import { z } from "zod"
import type { Tool } from "./tools/types"

export interface Skill {
  name: string
  description: string
  location: string
  content: string
}

const Frontmatter = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
})

function findSkillFiles(root: string, out: string[]): void {
  if (!existsSync(root)) return
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    let directory = false
    try {
      directory = statSync(path).isDirectory()
    } catch {
      continue
    }
    if (directory) findSkillFiles(path, out)
    else if (entry === "SKILL.md") out.push(path)
  }
}

export function parseSkill(location: string): Skill | null {
  const source = readFileSync(location, "utf8")
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return null

  try {
    const data = Frontmatter.safeParse(Bun.YAML.parse(match[1]!))
    if (!data.success) return null
    return { ...data.data, location, content: source.slice(match[0].length).trim() }
  } catch {
    return null
  }
}

/** Project skills override global skills with the same frontmatter name. */
export function discoverSkills(workspace: string, home = homedir()): Skill[] {
  const roots = [
    ...[".claude", ".agents", ".codex", ".opencode"].map((dir) => join(home, dir, "skills")),
    join(home, ".config", "rofiant", "skills"),
    ...[".claude", ".agents", ".codex", ".opencode", ".rofiant"].map((dir) => join(workspace, dir, "skills")),
  ]
  const skills = new Map<string, Skill>()

  for (const root of roots) {
    const files: string[] = []
    findSkillFiles(root, files)
    for (const file of files.sort()) {
      const skill = parseSkill(file)
      if (skill) skills.set(skill.name, skill)
    }
  }
  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function renderSkillPrompt(skill: Skill, request = ""): string {
  return [
    `Skill \"${skill.name}\" explicitly invoked by user. Follow its instructions for this turn.`,
    `Skill directory: ${dirname(skill.location)}`,
    "",
    skill.content,
    ...(request.trim() ? ["", "User request:", request.trim()] : []),
  ].join("\n")
}

export function createSkillTool(skills: Skill[]): Tool<{ name: string }> {
  const byName = new Map(skills.map((skill) => [skill.name, skill]))
  return {
    name: "skill",
    description: `Load one installed skill's full instructions. Available: ${skills.map((skill) => `${skill.name} (${skill.description})`).join(", ") || "none"}.`,
    schema: z.object({ name: z.string() }),
    permissionLevel: () => "safe",
    describe: ({ name }) => `Loading skill ${name}`,
    async execute({ name }) {
      const skill = byName.get(name)
      if (!skill) return { output: `Skill not found: ${name}`, isError: true }
      return { output: renderSkillPrompt(skill) }
    },
  }
}
