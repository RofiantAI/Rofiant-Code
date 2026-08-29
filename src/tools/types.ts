import type { z } from "zod"
import type { PermissionLevel, PermissionManager } from "../permissions/permissions"

export interface ToolResult {
  output: string
  isError?: boolean
}

export interface ToolContext {
  permissions: PermissionManager
  signal: AbortSignal
}

export interface Tool<Args = unknown> {
  name: string
  description: string
  schema: z.ZodType<Args>
  /** Static risk level, or computed from the parsed args (e.g. shell commands). */
  permissionLevel(args: Args): PermissionLevel
  /** Human-readable one-liner for the permission prompt and the "● Doing X" status line. */
  describe(args: Args): string
  execute(args: Args, ctx: ToolContext): Promise<ToolResult>
}
