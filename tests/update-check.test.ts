import { expect, test } from "bun:test"
import { checkUpdateStatus } from "../src/utils/update-check"

const response = (tag: string, ok = true) =>
  (async () => new Response(JSON.stringify({ tag_name: tag, html_url: "https://example.com/release" }), { status: ok ? 200 : 404 })) as typeof fetch

test("update status distinguishes available, current, and unavailable", async () => {
  expect((await checkUpdateStatus("owner/repo", response("v9.0.0"))).status).toBe("available")
  expect((await checkUpdateStatus("owner/repo", response("v0.1.0"))).status).toBe("current")
  expect((await checkUpdateStatus("owner/repo", response("", false))).status).toBe("unavailable")
})
