import { For, Show, createSignal } from "solid-js"
import { useTimeline } from "@opentui/solid"
import pkg from "../../package.json"
import { theme } from "./theme"
import { Input } from "./Input"
import type { Skill } from "../skills"

export interface SplashProps {
  model: string
  mode: "build" | "plan"
  onSubmit: (text: string) => void
  history: string[]
  disabled: boolean
  onCommandPaletteOpenChange?: (open: boolean) => void
  onOpenCommandPalette?: () => void
  skills?: Skill[]
  visualMode: "vivid" | "minimal"
}

// Fixed scatter, not Math.random() — a stable background shouldn't reshuffle on every render.
// The centered content column is vertically centered and can run tall (block-font logo +
// input box + hint lines), so stars are confined to thin top/bottom bands that stay clear
// of it at any reasonable terminal height, rather than risking overlap across the middle.
const STARS: Array<{ top: `${number}%`; left: `${number}%` }> = [
  { top: "1%", left: "4%" }, { top: "3%", left: "17%" }, { top: "2%", left: "29%" },
  { top: "5%", left: "42%" }, { top: "1%", left: "61%" }, { top: "4%", left: "73%" },
  { top: "2%", left: "88%" }, { top: "6%", left: "9%" }, { top: "7%", left: "51%" },
  { top: "3%", left: "95%" }, { top: "8%", left: "35%" }, { top: "6%", left: "80%" },
  { top: "94%", left: "6%" }, { top: "92%", left: "20%" }, { top: "96%", left: "33%" },
  { top: "93%", left: "48%" }, { top: "97%", left: "60%" }, { top: "92%", left: "72%" },
  { top: "95%", left: "84%" }, { top: "91%", left: "12%" },
  { top: "94%", left: "41%" },
]

// One block-font ascii_font call only ever paints one color per glyph segment — it can't do a
// per-character gradient on its own — so the wordmark is split into one ascii_font per letter,
// each independently colored, with manual gap boxes standing in for the font's built-in
// letterspacing (1 cell between letters of a word, matching every built-in font's letterspace_size).
const LOGO_WORDS = [
  { text: "ROFIANT", base: theme.logo },
  { text: "CODE", base: theme.logoDim },
] as const

const LOGO_LETTERS = LOGO_WORDS.flatMap((word, wordIndex) =>
  word.text.split("").map((char, charIndex) => ({
    char,
    base: word.base,
    gapBefore: charIndex === 0 ? (wordIndex === 0 ? 0 : 2) : 1,
  })),
)
const LOGO_BASE_COLORS = LOGO_LETTERS.map((l) => l.base)

function mixColor(from: string, to: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  const a = parseInt(from.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const channel = (shift: number) => {
    const av = (a >> shift) & 0xff
    const bv = (b >> shift) & 0xff
    return Math.round(av + (bv - av) * clamped)
  }
  const mixed = (channel(16) << 16) | (channel(8) << 8) | channel(0)
  return `#${mixed.toString(16).padStart(6, "0")}`
}

// A highlight bump travels past the first letter (R) at t=0 and past the last (E) at t=1,
// overshooting both ends by 3 letter-widths so the gaussian fades in/out to ~base brightness
// at both edges instead of snapping to full brightness on R or holding full brightness on E
// when onComplete resets — a peak parked exactly on the edge letter has no room to fade.
const WAVE_WIDTH = 1.3 // letters of falloff on either side of the peak — how wide the highlight reads
const WAVE_OVERSHOOT = WAVE_WIDTH * 3
function waveFactor(index: number, total: number, t: number): number {
  const peak = -WAVE_OVERSHOOT + t * (total - 1 + 2 * WAVE_OVERSHOOT)
  return Math.exp(-((index - peak) ** 2) / (2 * WAVE_WIDTH * WAVE_WIDTH))
}

const TIPS = [
  "Run /model to switch models",
  "Tab switches between build and plan mode",
  "Type @ to attach a file, anywhere in your message",
  "Type $agent to send your message straight to a subagent",
  "Ctrl+P opens settings",
  "Run /compact to summarize a long conversation and free up context",
  "Run /skip-permissions to stop confirming every action — use with care",
  "Esc interrupts the current task",
  "Run /sessions to list recent sessions for this project",
  "Run /diff to see changes made this session",
]

export function Splash(props: SplashProps) {
  // Picked once per mount, not per render — a tip that changed on every keystroke would be noise, not a tip.
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)]

  const [letterColors, setLetterColors] = createSignal<string[]>(LOGO_BASE_COLORS)
  const wave = { t: 0 }
  const WAVE_DURATION_MS = 1500
  const WAVE_PAUSE_MS = 1800
  // Timeline itself defaults to duration: 1000, loop: false — independent of the item's own
  // duration/loop below. Without matching them here, the *container* stops driving updates
  // after 1s (mid-cycle), freezing the wave. Its duration is the full lap-plus-pause so the
  // pause is just dead time at the end of each Timeline cycle before resetItems() replays it.
  const shimmer = useTimeline({ autoplay: true, loop: true, duration: WAVE_DURATION_MS + WAVE_PAUSE_MS })
  shimmer.add(wave, {
    t: 1,
    duration: WAVE_DURATION_MS,
    ease: "linear",
    // No item-level loop: it runs once, holds at t=1, and sits quiet through the pause.
    // resetItems() re-arms it for the next Timeline cycle, but only rewinds bookkeeping
    // (started/completed) — the target's own t stays wherever it was, so it must be
    // rewound by hand here or the next lap would start from 1 and never move.
    // No color reset here: onComplete fires in the same synchronous tick as the final
    // onUpdate(t=1), so Solid batches both into one commit — an explicit reset here would
    // overwrite the faded-out frame before it ever paints, reading as a snap. The overshoot
    // in waveFactor already fades colors to ~base by t=1, so nothing to reset.
    onComplete: () => {
      wave.t = 0
    },
    onUpdate: () => {
      if (props.visualMode !== "vivid") return
      setLetterColors(LOGO_LETTERS.map((l, i) => mixColor(l.base, theme.shimmer, waveFactor(i, LOGO_LETTERS.length, wave.t) * 0.8)))
    },
  })

  return (
    <box position="relative" width="100%" height="100%" backgroundColor={theme.splashBg} flexDirection="column">
      <Show when={props.visualMode === "vivid"}>
        <For each={STARS}>
          {(s) => (
            <text position="absolute" top={s.top} left={s.left} fg={theme.border}>
              ✧
            </text>
          )}
        </For>
      </Show>

      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <Show
          when={props.visualMode === "vivid"}
          fallback={<text fg={theme.logo}>ROFIANT CODE</text>}
        >
          <box flexDirection="row">
            <For each={LOGO_LETTERS}>
              {(letter, i) => (
                <>
                  <Show when={letter.gapBefore > 0}>
                    <box width={letter.gapBefore} />
                  </Show>
                  <ascii_font text={letter.char} font="block" color={letterColors()[i()]} buffered={false} />
                </>
              )}
            </For>
          </box>
        </Show>

        <box width={78} marginTop={2} flexDirection="column">
          <Input
            variant="splash"
            onSubmit={props.onSubmit}
            history={props.history}
            disabled={props.disabled}
            footer={`${props.mode === "plan" ? "Plan" : "Build"} · ${props.model}`}
            footerColor={props.mode === "plan" ? theme.success : theme.logo}
            onCommandPaletteOpenChange={props.onCommandPaletteOpenChange}
            onOpenCommandPalette={props.onOpenCommandPalette}
            skills={props.skills}
          />

          <box marginTop={1} flexDirection="row" justifyContent="center">
            <text fg={theme.dim}>tab switch mode   ctrl+p settings   @ attach file   $ subagent   / commands</text>
          </box>
        </box>

        <box marginTop={2} flexDirection="row">
          <text fg={theme.logo}>● Tip </text>
          <text fg={theme.dim}>{tip}</text>
        </box>
      </box>

      <box position="absolute" bottom="1%" right="2%">
        <text fg={theme.dim}>{pkg.version}</text>
      </box>
    </box>
  )
}
