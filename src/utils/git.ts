import { workspaceRoot } from "./paths"

async function run(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const proc = Bun.spawn(["git", ...args], {
      cwd: workspaceRoot,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { ok: exitCode === 0, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch {
    return { ok: false, stdout: "", stderr: "git not available" }
  }
}

export async function isGitRepo(): Promise<boolean> {
  const res = await run(["rev-parse", "--is-inside-work-tree"])
  return res.ok && res.stdout === "true"
}

export async function currentBranch(): Promise<string | null> {
  const res = await run(["rev-parse", "--abbrev-ref", "HEAD"])
  return res.ok ? res.stdout : null
}

export async function statusPorcelain(): Promise<string[]> {
  const res = await run(["status", "--porcelain"])
  if (!res.ok || res.stdout === "") return []
  return res.stdout.split("\n")
}

export async function diff(opts: { staged?: boolean; stat?: boolean } = {}): Promise<string> {
  const args = ["diff"]
  if (opts.staged) args.push("--staged")
  if (opts.stat) args.push("--stat")
  const res = await run(args)
  return res.ok ? res.stdout : res.stderr
}

export async function shortSummary(): Promise<string | null> {
  const files = await statusPorcelain()
  if (files.length === 0) return null
  const stat = await diff({ stat: true })
  const lastLine = stat.split("\n").at(-1) ?? ""
  return `${files.length} file${files.length === 1 ? "" : "s"} changed${lastLine.includes("changed") ? ` (${lastLine.trim()})` : ""}`
}
