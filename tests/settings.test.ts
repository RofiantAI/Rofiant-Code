import { expect, test } from "bun:test"
import { join } from "node:path"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../src/settings"

test("settings persist and invalid files fall back safely", () => {
  const dir = mkdtempSync(join(tmpdir(), "rofiant-settings-"))
  const path = join(dir, "settings.json")
  const settings = { ...DEFAULT_SETTINGS, mode: "plan" as const, diffWrap: false }

  expect(saveSettings(settings, path)).toBe(true)
  expect(loadSettings(path)).toEqual(settings)
  expect(loadSettings(join(dir, "missing.json"))).toEqual(DEFAULT_SETTINGS)
})
