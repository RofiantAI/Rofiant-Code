<h1 align="center">Rofiant Code</h1>

<p align="center">
  <img src="public/logo.png" alt="Rofiant Code" width="180">
</p>

<p align="center"><strong>Your terminal-native AI coding agent</strong></p>

<p align="center">
  <a href="https://rofiant.ca">Website</a> ·
  <a href="https://github.com/RofiantAI/Rofiant-Code/releases">Releases</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

Rofiant Code is an AI coding assistant built for the terminal. It can inspect a project, search and edit files, run commands, review Git changes, delegate focused work to subagents, and preserve sessions between runs.

By default, built-in file writes and shell commands not classified as read-only require permission. You can approve matching actions for the rest of a session or explicitly bypass prompts.

---

## Quick Start

### macOS / Linux

```bash
git clone https://github.com/RofiantAI/Rofiant-Code.git
cd Rofiant-Code
./install.sh
```

### Windows PowerShell

```powershell
git clone https://github.com/RofiantAI/Rofiant-Code.git
cd Rofiant-Code
.\install.ps1
```

Run Rofiant Code from the project you want to work on:

```bash
cd your-project
rofiant
```

Rofiant Code requires [Bun](https://bun.sh/docs/installation) and an OpenAI-compatible model endpoint. Configure one before launch:

```bash
export AI_API_KEY="your-key"
export AI_BASE_URL="https://openrouter.ai/api/v1"
export AI_MODEL="z-ai/glm-5.2:free"
rofiant
```

You can also run `/login` inside the TUI to save an OpenAI API key locally, then restart Rofiant Code to use it.

> Rofiant Code currently uses the OpenAI-compatible `/chat/completions` protocol. Direct Anthropic Messages API support is not available yet.

---

## Core Features

### Build and Plan Modes

| Mode | Description |
|------|-------------|
| **Build** | Full coding mode with permission prompts based on each tool's risk classification |
| **Plan** | Read-only exploration using file search, file reads, Git diff, and task tracking |

Press `Tab` to switch modes.

### Project Tools

- Read, list, and search project files
- Create and edit files through reviewable permission prompts
- Run shell commands from the project root
- Inspect Git status, stats, and diffs
- Keep a visible task list for multi-step work

Commands are classified as safe, modifying, or dangerous. Modifying and dangerous commands prompt by default; an “always allow” choice or permission bypass can approve later actions without another prompt.

### Sessions and Context

- Sessions are stored locally in SQLite and scoped to the current project
- `rofiant --continue` resumes the latest project session
- Old tool output is collapsed when context approaches its configured budget
- `/compact` replaces earlier conversation history with a model-generated summary
- `AGENTS.md` and `MEMORY.md` are loaded as project guidance when present
- `/usage` reports prompt and completion tokens by model

### Skills

Rofiant Code discovers `SKILL.md` files from common agent directories:

| Scope | Locations |
|-------|-----------|
| Project | `.rofiant/skills/`, `.agents/skills/`, `.claude/skills/`, `.codex/skills/`, `.opencode/skills/` |
| User | `~/.config/rofiant/skills/`, `~/.agents/skills/`, `~/.claude/skills/`, `~/.codex/skills/`, `~/.opencode/skills/` |

Invoke a discovered skill with `/<skill-name> [request]`.

### Subagents

Send a task to a focused one-shot subagent by starting the message with its name:

| Agent | Description |
|-------|-------------|
| `$explore` | Read-only repository investigation |
| `$general` | Full-capability coding task |

Example:

```text
$explore find where authentication state is stored
```

### Terminal UI

- Streaming model output and tool activity
- Inline permission review and editable file proposals; targeted edits and new files include diffs
- `@file` attachment autocomplete
- Searchable `Ctrl+P` settings palette
- Model picker for OpenRouter free models
- Vivid and minimal visual modes

---

## Commands

| Command | Description |
|---------|-------------|
| `/help` | Show commands and shortcuts |
| `/new` | Start a new session |
| `/model [id]` | View or change the model |
| `/login` | Open the provider sign-in and API-key selector |
| `/compact` | Summarize and replace earlier history |
| `/status` | Show project, Git, provider, and model information |
| `/diff` | Show Git changes |
| `/sessions` | List recent project sessions |
| `/usage` | Show token usage |
| `/update` | Check for a newer GitHub release |
| `/skip-permissions` | Toggle permission bypass after confirmation |
| `/exit` | Exit Rofiant Code |

Run `/help` for the complete current list.

---

## Configuration

Rofiant Code reads configuration from environment variables. Copy [.env.example](.env.example) when developing locally.

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_API_KEY` | — | Provider API key |
| `AI_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible API base URL |
| `AI_MODEL` | `z-ai/glm-5.2:free` | Model ID |
| `AI_MAX_CONTEXT_TOKENS` | `100000` | Context trimming budget |
| `ROFIANT_GITHUB_REPO` | `RofiantAI/Rofiant-Code` | Release update source |
| `ROFIANT_WEB_URL` | `https://rofiant.ca` | Rofiant login URL |
| `ROFIANT_DANGEROUSLY_SKIP_PERMISSIONS` | — | Set to `1` to bypass permission prompts |

### Local Data

| Platform | Default directory |
|----------|-------------------|
| Linux / macOS | `$XDG_DATA_HOME/rofiant`, or `~/.local/share/rofiant` when unset |
| Windows | `%APPDATA%\rofiant` |

This directory contains `auth.json`, `settings.json`, `sessions.db`, and optional debug logs. A newly created `auth.json` requests mode `0600` on POSIX systems.

### Skipping Permission Prompts

For trusted, disposable environments only:

```bash
rofiant --dangerously-skip-permissions
```

You can also set `ROFIANT_DANGEROUSLY_SKIP_PERMISSIONS=1` or use `/skip-permissions` during a session.

**This is dangerous.** Permission bypass lets model-generated commands read, modify, or delete data without confirmation. Never enable it in an untrusted workspace.

---

## Privacy

Conversation messages—including resumed history, attached file contents, and tool output—are sent to the configured model provider. The provider API key is sent as a Bearer credential to `AI_BASE_URL` with each model request.

Session, settings, and authentication files are stored locally. File tools and shell commands can read local data; tool results included in the conversation are sent to the provider, and shell commands can also transmit data directly.

See [SECURITY.md](SECURITY.md) to report a vulnerability privately.

---

## Development

```bash
bun install --frozen-lockfile
bun run dev
bun run check
```

`bun run check` runs TypeScript validation and the complete test suite. Streaming tests open a loopback port.

---

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

---

## License

Source code is licensed under the [GNU General Public License v3.0 only](LICENSE).
