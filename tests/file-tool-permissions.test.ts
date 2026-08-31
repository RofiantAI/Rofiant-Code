import { expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { PermissionManager } from "../src/permissions/permissions"
import { readFileTool } from "../src/tools/read-file"
import { listFilesTool } from "../src/tools/list-files"

const denied = {
  permissions: new PermissionManager(async () => ({ decision: "deny" as const })),
  signal: new AbortController().signal,
}

test("outside-workspace reads require permission", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-read-"))
  const path = join(dir, "secret.txt")
  writeFileSync(path, "secret")
  const result = await readFileTool.execute({ path }, denied)
  expect(result.isError).toBe(true)
  expect(result.output).not.toContain("secret\n")
})

test("outside-workspace listings require permission", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-list-"))
  writeFileSync(join(dir, "secret.txt"), "secret")
  const result = await listFilesTool.execute({ path: dir, depth: 2, showIgnored: false }, denied)
  expect(result.isError).toBe(true)
  expect(result.output).not.toContain("secret.txt")
})
