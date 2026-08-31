import { useKeyboard, useRenderer } from "@opentui/solid"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import type { PermissionOutcome, PermissionRequest } from "../permissions/permissions"
import { theme } from "./theme"
import { Diff } from "./Diff"

export interface PermissionProps {
  req: PermissionRequest
  onResolve: (outcome: PermissionOutcome) => void
  diffWrap: boolean
}

export function Permission(props: PermissionProps) {
  const renderer = useRenderer()
  const allowsAlways = () => !props.req.hideAlways && props.req.level !== "dangerous"

  // Hands the terminal to $EDITOR for the "[E] Edit" flow — the renderer owns
  // raw mode, so it must explicitly step aside while the child process runs.
  async function openEditor(): Promise<void> {
    const original = props.req.editableText ?? ""
    const tmpPath = join(tmpdir(), `rofiant-edit-${randomUUID()}.txt`)
    writeFileSync(tmpPath, original)
    const editor = Bun.env.EDITOR ?? Bun.env.VISUAL ?? (process.platform === "win32" ? "notepad.exe" : "vi")

    renderer.suspend()
    try {
      const proc = Bun.spawn([editor, tmpPath], { stdin: "inherit", stdout: "inherit", stderr: "inherit" })
      await proc.exited
    } finally {
      renderer.resume()
    }

    let edited = original
    try {
      edited = readFileSync(tmpPath, "utf8")
    } catch {
      // editor didn't save — fall back to the original proposal
    }
    try {
      unlinkSync(tmpPath)
    } catch {
      // best effort cleanup
    }

    props.onResolve({ decision: "edit", text: edited })
  }

  useKeyboard((key) => {
    const name = key.name.toLowerCase()
    if (name === "y" || name === "return") props.onResolve({ decision: "allow" })
    else if (name === "a" && allowsAlways()) props.onResolve({ decision: "allow-always" })
    else if (name === "n" || name === "escape") props.onResolve({ decision: "deny" })
    else if (name === "e" && props.req.editableText !== undefined) void openEditor()
  })

  const isDiff = () => (props.req.detail ?? "").startsWith("--- ")
  const accent = () => (props.req.level === "dangerous" ? theme.error : theme.warning)
  const alwaysLabel = () => (props.req.toolName === "shell" ? "Always run commands similar to this" : "Always allow this")

  return (
    <box flexShrink={0} flexDirection="column" border borderColor={accent()} padding={1} marginBottom={1}>
      <text fg={accent()}>{props.req.level === "dangerous" ? "Dangerous action" : "Permission needed"}</text>
      <text>{props.req.summary}</text>

      {props.req.detail && isDiff() && (
        <box marginTop={1}>
          <Diff diffText={props.req.detail} wrapMode={props.diffWrap ? "word" : "none"} />
        </box>
      )}
      {props.req.detail && !isDiff() && (
        <box marginTop={1}>
          <text fg={theme.dim}>{props.req.detail}</text>
        </box>
      )}

      <box marginTop={1}>
        <text fg={theme.dim}>
          {allowsAlways() ? `[Y] Yes   [A] ${alwaysLabel()}   [N] No` : "[Y] Yes   [N] No"}
          {props.req.editableText !== undefined ? "   [E] Edit" : ""}
        </text>
      </box>
    </box>
  )
}
