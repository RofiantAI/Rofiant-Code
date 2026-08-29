export type PermissionLevel = "safe" | "modify" | "dangerous"

export interface PermissionRequest {
  toolName: string
  level: PermissionLevel
  /** One-line description of what's about to happen, e.g. "Edit src/auth.ts". */
  summary: string
  /** Optional longer detail shown under the summary: a diff, a shell command, etc. */
  detail?: string
  /** Cache key for "always allow" — scoped narrowly enough to stay meaningful. */
  key: string
  /** Present only when the proposed text can be opened in $EDITOR before applying (edit_file/write_file). */
  editableText?: string
  /** Hides the "always" option — for one-off confirmations that don't represent a repeatable tool call. */
  hideAlways?: boolean
}

export type PermissionOutcome =
  | { decision: "allow" | "allow-always" }
  | { decision: "deny" }
  | { decision: "edit"; text: string }

export type PermissionHandler = (req: PermissionRequest) => Promise<PermissionOutcome>

export interface PermissionResult {
  approved: boolean
  /** User-edited replacement text, when they chose [E]dit. */
  text?: string
}

/**
 * The application, not the model, is the source of truth on permissions.
 * Tools report a level; this class decides whether execution proceeds.
 */
export class PermissionManager {
  private alwaysAllowed = new Set<string>()

  constructor(private handler: PermissionHandler) {}

  async check(req: PermissionRequest): Promise<PermissionResult> {
    if (req.level === "safe") return { approved: true }
    if (this.alwaysAllowed.has(req.key)) return { approved: true }

    const outcome = await this.handler(req)
    if (outcome.decision === "allow-always") this.alwaysAllowed.add(req.key)
    if (outcome.decision === "deny") return { approved: false }
    if (outcome.decision === "edit") return { approved: true, text: outcome.text }
    return { approved: true }
  }
}
