#!/usr/bin/env bun
import { main } from "./app"

main().catch((err) => {
  console.error("Rofiant Code failed to start:", err)
  process.exit(1)
})
