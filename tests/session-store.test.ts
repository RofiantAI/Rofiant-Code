import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SessionStore } from "../src/sessions/store"

function makeStore(): { store: SessionStore; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-sessions-"))
  return { store: new SessionStore(join(dir, "sessions.db")), dir }
}

describe("SessionStore.usageByModel", () => {
  test("aggregates tokens per model, ordered by total usage descending", () => {
    const { store, dir } = makeStore()
    try {
      const project = "/proj/a"

      const s1 = store.create(project, "model-a")
      s1.promptTokens = 100
      s1.completionTokens = 20
      store.save(s1)

      const s2 = store.create(project, "model-a")
      s2.promptTokens = 50
      s2.completionTokens = 10
      store.save(s2)

      const s3 = store.create(project, "model-b")
      s3.promptTokens = 1000
      s3.completionTokens = 200
      store.save(s3)

      const usage = store.usageByModel(project)

      expect(usage).toEqual([
        { model: "model-b", promptTokens: 1000, completionTokens: 200, sessionCount: 1 },
        { model: "model-a", promptTokens: 150, completionTokens: 30, sessionCount: 2 },
      ])
    } finally {
      store.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("does not mix usage across different project paths", () => {
    const { store, dir } = makeStore()
    try {
      const a = store.create("/proj/a", "shared-model")
      a.promptTokens = 10
      store.save(a)

      const b = store.create("/proj/b", "shared-model")
      b.promptTokens = 999
      store.save(b)

      expect(store.usageByModel("/proj/a")).toEqual([
        { model: "shared-model", promptTokens: 10, completionTokens: 0, sessionCount: 1 },
      ])
    } finally {
      store.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("empty for a project with no sessions", () => {
    const { store, dir } = makeStore()
    try {
      expect(store.usageByModel("/proj/nothing")).toEqual([])
    } finally {
      store.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
