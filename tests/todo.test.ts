import { describe, expect, test } from "bun:test"
import { formatTodos } from "../src/tools/todo"

describe("formatTodos", () => {
  test("renders a status marker per item", () => {
    const out = formatTodos([
      { content: "Explore auth module", status: "completed" },
      { content: "Fix token access bug", status: "in_progress" },
      { content: "Add regression test", status: "pending" },
    ])
    expect(out).toBe(
      "[x] Explore auth module\n[~] Fix token access bug\n[ ] Add regression test",
    )
  })

  test("empty list renders a placeholder", () => {
    expect(formatTodos([])).toBe("(no tasks)")
  })
})
