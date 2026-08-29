const CONTEXT = 3

/** Unified diff for a known contiguous replacement — no general diff algorithm needed. */
export function buildReplaceDiff(
  relPath: string,
  fileLines: string[],
  startLine: number, // 1-indexed, first line of oldLines within fileLines
  oldLines: string[],
  newLines: string[],
): string {
  const oldStartIdx = startLine - 1
  const ctxBeforeStart = Math.max(0, oldStartIdx - CONTEXT)
  const ctxAfterEnd = Math.min(fileLines.length, oldStartIdx + oldLines.length + CONTEXT)

  const before = fileLines.slice(ctxBeforeStart, oldStartIdx)
  const after = fileLines.slice(oldStartIdx + oldLines.length, ctxAfterEnd)

  const oldCount = before.length + oldLines.length + after.length
  const newCount = before.length + newLines.length + after.length
  const oldStart = ctxBeforeStart + 1
  const newStart = ctxBeforeStart + 1

  const body = [
    ...before.map((l) => ` ${l}`),
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
    ...after.map((l) => ` ${l}`),
  ]

  return [
    `--- a/${relPath}`,
    `+++ b/${relPath}`,
    `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`,
    ...body,
  ].join("\n")
}

/** Unified diff for a brand-new file — every line is an addition. */
export function buildNewFileDiff(relPath: string, content: string): string {
  const lines = content.split("\n")
  return [
    `--- /dev/null`,
    `+++ b/${relPath}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((l) => `+${l}`),
  ].join("\n")
}
