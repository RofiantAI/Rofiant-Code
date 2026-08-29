import { describe, expect, test } from "bun:test"
import { buildReplaceDiff } from "../src/utils/diff"

describe("buildReplaceDiff", () => {
  test("produces a parseable unified diff hunk with context", () => {
    const fileLines = ["import a", "import b", "", "const token = response.token", "", "export { token }"]
    const diffText = buildReplaceDiff("src/auth.ts", fileLines, 4, ["const token = response.token"], [
      "const token = response.data.token",
    ])

    expect(diffText).toContain("--- a/src/auth.ts")
    expect(diffText).toContain("+++ b/src/auth.ts")
    expect(diffText).toContain("-const token = response.token")
    expect(diffText).toContain("+const token = response.data.token")
    // context lines around the change are preserved
    expect(diffText).toContain(" import b")
    expect(diffText).toContain(" export { token }")
  })
})
