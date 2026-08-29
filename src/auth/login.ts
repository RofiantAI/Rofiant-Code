export interface RofiantTokens {
  accessToken: string
  refreshToken: string
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url]
  Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" }).exited.catch(() => {})
}

// Supabase puts tokens in the URL fragment (never sent to a server, see
// rofiant-website's auth/callback route) — this page reads it client-side
// and hands them to the local server over a same-origin fetch instead.
const CALLBACK_HTML = `<!doctype html><title>Rofiant Code</title>
<body style="font-family:monospace;background:#0d0e14;color:#c0caf5;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p id="msg">Signing in…</p>
<script>
  var hash = new URLSearchParams(location.hash.slice(1));
  var token = hash.get("access_token") || "";
  var refresh = hash.get("refresh_token") || "";
  fetch("/token?access_token=" + encodeURIComponent(token) + "&refresh_token=" + encodeURIComponent(refresh))
    .then(function () { document.getElementById("msg").textContent = token ? "Signed in — you can close this tab." : "Sign-in failed — you can close this tab."; })
    .catch(function () { document.getElementById("msg").textContent = "Sign-in failed — you can close this tab."; });
</script>
</body>`

const LOGIN_TIMEOUT_MS = 5 * 60_000

/** Opens the Rofiant login page in the browser and waits for it to hand a session back to a loopback server. */
export function loginWithRofiant(webUrl: string): Promise<RofiantTokens> {
  return new Promise((resolve, reject) => {
    let settled = false

    const server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url)
        if (url.pathname === "/callback") {
          return new Response(CALLBACK_HTML, { headers: { "content-type": "text/html" } })
        }
        if (url.pathname === "/token") {
          const accessToken = url.searchParams.get("access_token")
          const refreshToken = url.searchParams.get("refresh_token")
          if (!settled) {
            settled = true
            clearTimeout(timer)
            server.stop()
            if (accessToken && refreshToken) resolve({ accessToken, refreshToken })
            else reject(new Error("Rofiant login did not return a session."))
          }
          return new Response("ok")
        }
        return new Response("not found", { status: 404 })
      },
    })

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        server.stop()
        reject(new Error("Rofiant login timed out."))
      }
    }, LOGIN_TIMEOUT_MS)

    const loginUrl = new URL("/auth/login", webUrl)
    loginUrl.searchParams.set("client", "cli")
    loginUrl.searchParams.set("next", `http://127.0.0.1:${server.port}/callback`)
    openBrowser(loginUrl.toString())
  })
}
