import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { editFileTool } from "../src/tools/edit-file"
import { PermissionManager } from "../src/permissions/permissions"
import { workspaceRoot } from "../src/utils/paths"

// workspaceRoot is captured once at process start (by design — the CLI's
// working directory is fixed for its lifetime), so tests write under it
// instead of chdir-ing, which resolveWorkspacePath would never see.
const scratchRoot = join(workspaceRoot, "tests", ".scratch")

function makeCtx(approve: boolean) {
  return {
    permissions: new PermissionManager(async () => (approve ? { decision: "allow" as const } : { decision: "deny" as const })),
    signal: new AbortController().signal,
  }
}

function withScratchFile(content: string, run: (relPath: string, absPath: string) => Promise<void>) {
  return async () => {
    const dir = mkdtempSync(join(scratchRoot, "edit-"))
    const absPath = join(dir, "auth.ts")
    writeFileSync(absPath, content)
    try {
      await run(join("tests", ".scratch", dir.split("/").pop()!, "auth.ts"), absPath)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}

describe("editFileTool", () => {
  mkdirSync(scratchRoot, { recursive: true })

  test(
    "replaces a unique match and writes the file",
    withScratchFile("const token = response.token\n", async (relPath, absPath) => {
      const result = await editFileTool.execute(
        { path: relPath, oldText: "const token = response.token", newText: "const token = response.data.token" },
        makeCtx(true),
      )
      expect(result.isError).toBeFalsy()
      expect(readFileSync(absPath, "utf8")).toContain("response.data.token")
    }),
  )

  test(
    "errors when oldText isn't found",
    withScratchFile("const token = response.token\n", async (relPath) => {
      const result = await editFileTool.execute(
        { path: relPath, oldText: "does not exist anywhere", newText: "x" },
        makeCtx(true),
      )
      expect(result.isError).toBe(true)
    }),
  )

  test(
    "errors when oldText matches more than once",
    withScratchFile("dup\ndup\n", async (relPath) => {
      const result = await editFileTool.execute({ path: relPath, oldText: "dup", newText: "x" }, makeCtx(true))
      expect(result.isError).toBe(true)
      expect(result.output).toContain("more than once")
    }),
  )

  test(
    "denied permission leaves the file untouched",
    withScratchFile("const token = response.token\n", async (relPath, absPath) => {
      const result = await editFileTool.execute(
        { path: relPath, oldText: "const token = response.token", newText: "changed" },
        makeCtx(false),
      )
      expect(result.isError).toBe(true)
      expect(readFileSync(absPath, "utf8")).toContain("response.token")
    }),
  )
})
