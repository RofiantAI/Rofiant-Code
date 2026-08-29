import { theme, syntaxStyle } from "./theme"

export interface DiffProps {
  diffText: string
  filetype?: string
  wrapMode?: "word" | "none"
}

export function Diff(props: DiffProps) {
  return (
    <diff
      diff={props.diffText}
      view="unified"
      showLineNumbers
      wrapMode={props.wrapMode ?? "word"}
      syntaxStyle={syntaxStyle}
      filetype={props.filetype}
      addedSignColor={theme.success}
      removedSignColor={theme.error}
    />
  )
}

/** Pulls the "--- a/..." unified diff block out of a tool result, if it ends with one. */
export function extractDiff(output: string): { before: string; diffText: string } | null {
  const idx = output.indexOf("--- a/")
  const idxNew = output.indexOf("--- /dev/null")
  const start = idx === -1 ? idxNew : idxNew === -1 ? idx : Math.min(idx, idxNew)
  if (start === -1) return null
  return { before: output.slice(0, start).trim(), diffText: output.slice(start).trim() }
}

export function filetypeFromPath(path: string): string | undefined {
  const ext = path.split(".").pop()
  return ext && ext !== path ? ext : undefined
}
