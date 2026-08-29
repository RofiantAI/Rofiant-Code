import { SyntaxStyle } from "@opentui/core"

/** Shared across every markdown/code/diff renderable — creating one per component is wasteful. */
export const syntaxStyle = SyntaxStyle.create()

const ORANGE = "#e8823c"

/** Minimal, muted palette. No gradients, no rainbow — one accent color and a gray scale. */
export const theme = {
  accent: ORANGE,
  dim: "#6b7280",
  border: "#3b4252",
  success: "#9ece6a",
  error: "#f7768e",
  warning: "#e0af68",
  text: "#c0caf5",
  bg: undefined, // inherit terminal background
  /** Same color as `accent` — kept as its own name because the wordmark's two tones are a distinct concept. */
  logo: ORANGE,
  /** Grey, not near-white — leaves headroom below the shimmer highlight so the wave reads clearly against it. */
  logoDim: "#8a8f9c",
  splashBg: "#0d0e14",
  /** Lighter than splashBg on purpose — the input needs to read as a raised box, not blend into the page. */
  splashInputBg: "#1a1b26",
  /** Highlight the logo shimmer wave lerps toward — bright enough to read as a shine over both wordmark tones. */
  shimmer: "#fff2d9",
} as const
