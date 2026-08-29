import { describe, expect, test } from "bun:test"
import { resolveWorkspacePath } from "../src/utils/paths"

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
})
