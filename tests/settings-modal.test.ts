import { describe, expect, test } from "bun:test"
import { filterSettingActions, type SettingAction } from "../src/ui/SettingsModal"

const actions: SettingAction[] = [
  { title: "Model", description: "Current model", category: "Agent", value: "glm", onSelect() {} },
  { title: "Diff wrapping", description: "Working-tree changes", category: "Appearance", value: "On", onSelect() {} },
]

describe("settings modal filtering", () => {
  test("matches every word across title, description, and category", () => {
    expect(filterSettingActions(actions, "agent current")).toEqual([actions[0]])
    expect(filterSettingActions(actions, "appearance changes")).toEqual([actions[1]])
    expect(filterSettingActions(actions, "missing")).toEqual([])
  })
})
