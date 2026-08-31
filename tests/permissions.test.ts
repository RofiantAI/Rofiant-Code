import { expect, test } from "bun:test"
import { PermissionManager } from "../src/permissions/permissions"

test("always-allow for modifying actions never approves a later dangerous action", async () => {
  let prompts = 0
  const permissions = new PermissionManager(async () => {
    prompts++
    return prompts === 1 ? { decision: "allow-always" } : { decision: "deny" }
  })

  expect((await permissions.check({ toolName: "shell", level: "modify", summary: "", key: "shell:git" })).approved).toBe(true)
  expect((await permissions.check({ toolName: "shell", level: "dangerous", summary: "", key: "shell:git" })).approved).toBe(false)
  expect(prompts).toBe(2)
})
