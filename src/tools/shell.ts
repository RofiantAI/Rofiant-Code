import type { z } from "zod"
import { shellSchema } from "./schemas"
import type { Tool } from "./types"
import { workspaceRoot } from "../utils/paths"
import { classifyCommand } from "../permissions/dangerous-commands"
import { truncateChars, truncateLines } from "../utils/truncate"

type Args = z.infer<typeof shellSchema>

export function shellCommand(command: string, platform = process.platform): string[] {
  return platform === "win32"
    ? ["cmd.exe", "/d", "/s", "/c", command]
    : ["/bin/sh", "-c", command]
}

export const shellTool: Tool<Args> = {
  name: "shell",
  description:
    "Run a shell command from the project root. Use for builds, tests, linters, and other project tooling. " +
    "Not for editing files — use edit_file/write_file for that.",
  schema: shellSchema,

  permissionLevel(args) {
    return classifyCommand(args.command)
  },

  describe(args) {
    return `Running ${args.command}`
  },

  async execute(args, ctx) {
    const result = await ctx.permissions.check({
      toolName: "shell",
      level: this.permissionLevel(args),
      summary: this.describe(args),
      detail: args.command,
      key: `shell:${args.command.trim().split(/\s+/)[0] ?? args.command}`,
    })
    if (!result.approved) {
      return { output: `User denied running: ${args.command}`, isError: true }
    }

    const start = performance.now()
    const proc = Bun.spawn(shellCommand(args.command), {
      cwd: workspaceRoot,
      stdout: "pipe",
      stderr: "pipe",
    })

    const timeout = setTimeout(() => proc.kill(), args.timeoutMs)
    const onAbort = () => proc.kill()
    ctx.signal.addEventListener("abort", onAbort)

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    clearTimeout(timeout)
    ctx.signal.removeEventListener("abort", onAbort)

    const durationMs = Math.round(performance.now() - start)
    const parts = [
      `$ ${args.command}`,
      `exit ${exitCode} · ${durationMs}ms`,
      "",
      truncateLines(truncateChars(stdout, 50_000), 500, "tail") || "(no stdout)",
    ]
    if (stderr.trim()) {
      parts.push("", "stderr:", truncateLines(truncateChars(stderr, 20_000), 200, "tail"))
    }

    return { output: parts.join("\n"), isError: exitCode !== 0 }
  },
}
