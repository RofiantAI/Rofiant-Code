import { assert } from "jsr:@std/assert"
import { rateLimited } from "./index.ts"

// index.ts calls Deno.serve() at import time, which opens a listener the sanitizers
// would otherwise flag as a leak — this file only checks rateLimited(), not the server.
const opts = { sanitizeOps: false, sanitizeResources: false }

Deno.test("allows up to the limit then blocks", opts, () => {
  const ip = `test-${crypto.randomUUID()}`
  for (let i = 0; i < 20; i++) assert(!rateLimited(ip), `request ${i} should pass`)
  assert(rateLimited(ip), "request 21 should be blocked")
})

Deno.test("different IPs get independent limits", opts, () => {
  const a = `test-${crypto.randomUUID()}`
  const b = `test-${crypto.randomUUID()}`
  for (let i = 0; i < 20; i++) rateLimited(a)
  assert(rateLimited(a), "a should be exhausted")
  assert(!rateLimited(b), "b should be unaffected")
})
