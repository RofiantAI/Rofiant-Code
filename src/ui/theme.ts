import { SyntaxStyle } from "@opentui/core"
import { createMutable } from "solid-js/store"

/** Shared across every markdown/code/diff renderable — creating one per component is wasteful. */
export const syntaxStyle = SyntaxStyle.create()

const ORANGE = "#e8823c"

/** Minimal, muted palette. No gradients, no rainbow — one accent color and a gray scale. */
const DARK = {
  accent: ORANGE,
  dim: "#6b7280",
  border: "#3b4252",
  success: "#9ece6a",
  error: "#f7768e",
  warning: "#e0af68",
  text: "#c0caf5",
  bg: undefined as string | undefined, // inherit terminal background
  /** Same color as `accent` — kept as its own name because the wordmark's two tones are a distinct concept. */
  logo: ORANGE,
  /** Grey, not near-white — leaves headroom below the shimmer highlight so the wave reads clearly against it. */
  logoDim: "#8a8f9c",
  splashBg: "#0d0e14",
  /** Lighter than splashBg on purpose — the input needs to read as a raised box, not blend into the page. */
  splashInputBg: "#1a1b26",
  /** Highlight the logo shimmer wave lerps toward — bright enough to read as a shine over both wordmark tones. */
  shimmer: "#fff2d9",
}

/** Same shape as DARK, recolored for a white/near-white terminal background. Semantic and text
 * colors are deepened — the dark palette's pastel tones fall below readable contrast on light bg. */
const LIGHT: typeof DARK = {
  accent: ORANGE,
  dim: "#6b7280",
  border: "#d1d5db",
  success: "#15803d",
  error: "#b91c1c",
  warning: "#b45309",
  text: "#1f2430",
  bg: undefined,
  logo: ORANGE,
  logoDim: "#565d6c",
  splashBg: "#f2f3f7",
  splashInputBg: "#ffffff",
  shimmer: "#ffb870",
}

export type ThemeMode = "dark" | "light"

export const theme = createMutable({ ...DARK })

export function setThemeMode(mode: ThemeMode): void {
  Object.assign(theme, mode === "light" ? LIGHT : DARK)
}
