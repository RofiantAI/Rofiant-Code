import { expect, test } from "bun:test"
import { shellCommand } from "../src/tools/shell"
import { classifyCommand } from "../src/permissions/dangerous-commands"

test("shell uses native command interpreter", () => {
  expect(shellCommand("echo hi", "linux")).toEqual(["/bin/sh", "-c", "echo hi"])
  expect(shellCommand("echo hi", "win32")).toEqual(["cmd.exe", "/d", "/s", "/c", "echo hi"])
})

test("Windows inspection and destructive commands are classified", () => {
  expect(classifyCommand("dir src")).toBe("safe")
  expect(classifyCommand("rmdir /s /q build")).toBe("dangerous")
  expect(classifyCommand("winget install Git.Git")).toBe("dangerous")
})
