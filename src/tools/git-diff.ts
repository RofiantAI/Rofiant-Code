import type { z } from "zod"
import { gitDiffSchema } from "./schemas"
import type { Tool } from "./types"
import * as git from "../utils/git"
import { truncateLines } from "../utils/truncate"

type Args = z.infer<typeof gitDiffSchema>

export const gitDiffTool: Tool<Args> = {
  name: "git_diff",
  description: "Inspect changes made in the working tree: a diff, a diff --stat summary, or git status.",
  schema: gitDiffSchema,

  permissionLevel() {
    return "safe"
  },

  describe(args) {
    if (args.mode === "status") return "Checking git status"
    return `Checking git diff${args.staged ? " --staged" : ""}`
  },

  async execute(args) {
    if (!(await git.isGitRepo())) {
      return { output: "Not a git repository." }
    }
    if (args.mode === "status") {
      const files = await git.statusPorcelain()
      return { output: files.length === 0 ? "Working tree clean." : files.join("\n") }
    }
    const text = await git.diff({ staged: args.staged, stat: args.mode === "diff-stat" })
    return { output: text.trim() === "" ? "No changes." : truncateLines(text, 800, "tail") }
  },
}
