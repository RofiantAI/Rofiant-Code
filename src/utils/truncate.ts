/** Keeps output bounded before it goes anywhere near the model's context window. */
export function truncateLines(text: string, maxLines: number, keep: "head" | "tail" = "tail"): string {
  const lines = text.split("\n")
  if (lines.length <= maxLines) return text

  if (keep === "head") {
    return lines.slice(0, maxLines).join("\n") + `\n\n[output truncated — showing first ${maxLines} of ${lines.length} lines]`
  }
  const shown = lines.slice(-maxLines)
  return `[output truncated — showing last ${maxLines} of ${lines.length} lines]\n\n` + shown.join("\n")
}

export function truncateChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars) + `\n\n[output truncated — ${text.length - maxChars} more characters]`
}
