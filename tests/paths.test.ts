import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { resolveWorkspacePath, workspaceRoot } from "../src/utils/paths"

describe("resolveWorkspacePath", () => {
  test("relative path inside the workspace", () => {
    const r = resolveWorkspacePath("src/index.ts")
    expect(r.insideWorkspace).toBe(true)
    expect(r.relative).toBe("src/index.ts")
  })

  test("blocks traversal outside the workspace", () => {
    const r = resolveWorkspacePath("../../etc/passwd")
    expect(r.insideWorkspace).toBe(false)
  })

  test("workspace root itself is inside", () => {
    const r = resolveWorkspacePath(".")
    expect(r.insideWorkspace).toBe(true)
  })

  test("symlinks cannot disguise an outside path as workspace-local", () => {
    const scratch = join(workspaceRoot, "tests", ".scratch")
    mkdirSync(scratch, { recursive: true })
    const outside = mkdtempSync(join(tmpdir(), "rofiant-outside-"))
    const link = join(scratch, `outside-${crypto.randomUUID()}`)
    writeFileSync(join(outside, "secret.txt"), "secret")
    symlinkSync(outside, link)
    try {
      expect(resolveWorkspacePath(join(link, "secret.txt")).insideWorkspace).toBe(false)
    } finally {
      rmSync(link)
      rmSync(outside, { recursive: true, force: true })
    }
  })
})
