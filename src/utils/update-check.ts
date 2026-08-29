import pkg from "../../package.json"

export interface UpdateInfo {
  current: string
  latest: string
  url: string
}

export type UpdateStatus =
  | ({ status: "available" } & UpdateInfo)
  | { status: "current"; current: string; latest: string }
  | { status: "unavailable"; current: string }

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0)
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

/**
 * Checks GitHub's latest release once at startup. Never throws and never blocks startup on
 * failure — an unconfigured/placeholder repo, no network, or no releases yet are all just
 * "nothing to report", same as being up to date.
 */
export async function checkUpdateStatus(repo: string, request: typeof fetch = fetch): Promise<UpdateStatus> {
  const current = pkg.version
  try {
    const res = await request(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return { status: "unavailable", current }

    const data = (await res.json()) as { tag_name?: string; html_url?: string }
    const latest = data.tag_name?.replace(/^v/, "")
    if (!latest) return { status: "unavailable", current }

    if (!isNewer(latest, current)) return { status: "current", current, latest }

    return { status: "available", current, latest, url: data.html_url ?? `https://github.com/${repo}/releases/latest` }
  } catch {
    return { status: "unavailable", current }
  }
}

export async function checkForUpdate(repo: string): Promise<UpdateInfo | null> {
  const result = await checkUpdateStatus(repo)
  return result.status === "available" ? result : null
}
