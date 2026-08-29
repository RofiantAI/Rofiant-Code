import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { discoverSkills, parseSkill, renderSkillPrompt } from "../src/skills"

const root = join(import.meta.dir, ".scratch", "skills")

afterEach(() => rmSync(root, { recursive: true, force: true }))

function install(base: string, name: string, description: string, body: string): string {
  const location = join(base, name, "SKILL.md")
  mkdirSync(join(base, name), { recursive: true })
  writeFileSync(location, `---\nname: ${name}\ndescription: ${description}\n---\n${body}\n`)
  return location
}

describe("skills", () => {
  test("parses YAML frontmatter and strips it from instructions", () => {
    const location = install(root, "review", ">\n  Review code carefully.", "Check callers first.")
    expect(parseSkill(location)).toMatchObject({
      name: "review",
      description: "Review code carefully.\n",
      content: "Check callers first.",
    })
  })

  test("discovers global and project skills with project override", () => {
    const home = join(root, "home")
    const workspace = join(root, "workspace")
    install(join(home, ".agents", "skills"), "review", "Global review", "global")
    const project = install(join(workspace, ".rofiant", "skills"), "review", "Project review", "project")
    install(join(workspace, ".codex", "skills"), "test", "Run tests", "test body")

    expect(discoverSkills(workspace, home)).toEqual([
      { name: "review", description: "Project review", location: project, content: "project" },
      expect.objectContaining({ name: "test", description: "Run tests" }),
    ])
  })

  test("renders skill instructions with invocation arguments", () => {
    const skill = parseSkill(install(root, "review", "Review", "Check callers."))!
    expect(renderSkillPrompt(skill, "src/app.ts")).toContain("Check callers.\n\nUser request:\nsrc/app.ts")
  })
})
