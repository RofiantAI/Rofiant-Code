export type CommandRisk = "safe" | "modify" | "dangerous"

// Read-only / inspection commands that never touch disk state.
const SAFE_PREFIXES = [
  "git status",
  "git diff",
  "git log",
  "git show",
  "git branch",
  "ls",
  "cat",
  "pwd",
  "echo",
  "which",
  "where",
  "dir",
  "type",
  "ver",
  "grep",
  "rg",
  "find",
  "wc",
  "head",
  "tail",
  "node --version",
  "bun --version",
]

// Patterns that always require explicit permission, no matter what.
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\b.*-[a-z]*r/i, // rm -r / -rf
  /\bsudo\b/i,
  /\bgit\s+push\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\bkill(all)?\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bcurl\b.*\|\s*(sh|bash|zsh)/i,
  /\bwget\b.*\|\s*(sh|bash|zsh)/i,
  /\b(npm|pnpm|yarn|bun)\s+(i|install|add|remove|uninstall)\b/i,
  /\b(apt|apt-get|brew|pacman|dnf|yum)\s+(install|remove|upgrade)\b/i,
  />\s*\/etc\//,
  /\benv\b.*-i\b/i,
  /\bdd\b\s+if=/i,
  /:\(\)\{.*\};:/, // fork bomb
  /\b(del|erase)\b.*\/(s|q)\b/i,
  /\b(rd|rmdir)\b.*\/s\b/i,
  /\b(format|diskpart|shutdown|taskkill|takeown|icacls)\b/i,
  /\breg\s+(delete|add)\b/i,
  /\b(winget|choco|scoop)\s+(install|uninstall|upgrade)\b/i,
  /\b(powershell|pwsh)\b.*\|/i,
]

export function isSafeCommand(command: string): boolean {
  const trimmed = command.trim()
  return SAFE_PREFIXES.some((p) => trimmed === p || trimmed.startsWith(p + " "))
}

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((re) => re.test(command))
}

export function classifyCommand(command: string): CommandRisk {
  if (isDangerousCommand(command)) return "dangerous"
  if (isSafeCommand(command)) return "safe"
  return "modify"
}
