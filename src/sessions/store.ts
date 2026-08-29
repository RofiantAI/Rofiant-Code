import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { dataDir } from "../utils/paths"
import type { LLMMessage } from "../llm/types"
import type { ModelUsage, Session, SessionSummary } from "./types"

export class SessionStore {
  private db: Database

  constructor(dbPath?: string) {
    const dir = dataDir()
    mkdirSync(dir, { recursive: true })
    this.db = new Database(dbPath ?? join(dir, "sessions.db"))
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project_path TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        messages TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0
      )
    `)
  }

  create(projectPath: string, model: string): Session {
    const now = Date.now()
    const session: Session = {
      id: randomUUID(),
      projectPath,
      model,
      createdAt: now,
      updatedAt: now,
      messages: [],
      promptTokens: 0,
      completionTokens: 0,
    }
    this.db.run(
      `INSERT INTO sessions (id, project_path, model, created_at, updated_at, messages, prompt_tokens, completion_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, session.projectPath, session.model, session.createdAt, session.updatedAt, "[]", 0, 0],
    )
    return session
  }

  save(session: Session): void {
    session.updatedAt = Date.now()
    this.db.run(
      `UPDATE sessions SET model = ?, updated_at = ?, messages = ?, prompt_tokens = ?, completion_tokens = ? WHERE id = ?`,
      [
        session.model,
        session.updatedAt,
        JSON.stringify(session.messages),
        session.promptTokens,
        session.completionTokens,
        session.id,
      ],
    )
  }

  load(id: string): Session | null {
    const row = this.db
      .query(
        `SELECT id, project_path, model, created_at, updated_at, messages, prompt_tokens, completion_tokens
         FROM sessions WHERE id = ?`,
      )
      .get(id) as SessionRow | null
    return row ? rowToSession(row) : null
  }

  listForProject(projectPath: string, limit = 20): SessionSummary[] {
    const rows = this.db
      .query(
        `SELECT id, project_path, model, created_at, updated_at, messages
         FROM sessions WHERE project_path = ? ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(projectPath, limit) as SessionRow[]
    return rows.map((r) => ({
      id: r.id,
      projectPath: r.project_path,
      model: r.model,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      messageCount: (JSON.parse(r.messages) as LLMMessage[]).length,
    }))
  }

  /** Token usage for this project, broken down by model — one row per model ever used, highest usage first. */
  usageByModel(projectPath: string): ModelUsage[] {
    const rows = this.db
      .query(
        `SELECT model, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens, COUNT(*) AS session_count
         FROM sessions WHERE project_path = ?
         GROUP BY model
         ORDER BY (SUM(prompt_tokens) + SUM(completion_tokens)) DESC`,
      )
      .all(projectPath) as UsageRow[]
    return rows.map((r) => ({
      model: r.model,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      sessionCount: r.session_count,
    }))
  }

  close(): void {
    this.db.close()
  }
}

interface SessionRow {
  id: string
  project_path: string
  model: string
  created_at: number
  updated_at: number
  messages: string
  prompt_tokens: number
  completion_tokens: number
}

interface UsageRow {
  model: string
  prompt_tokens: number
  completion_tokens: number
  session_count: number
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectPath: row.project_path,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: JSON.parse(row.messages) as LLMMessage[],
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
  }
}
