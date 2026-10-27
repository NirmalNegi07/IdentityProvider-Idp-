import { useSyncExternalStore } from 'react'

// Colour theme and light/dark mode, applied as html[data-theme] and html[data-mode] (see index.css).

export type ThemeId = 'posthog' | 'github' | 'linear' | 'atlassian' | 'vercel' | 'slack' | 'discord' | 'spotify' | 'stripe' | 'twitch'
export type ModePreference = 'light' | 'dark' | 'system'

export interface Appearance {
  theme: ThemeId
  mode: ModePreference
}

/**
 * Themes inspired by well-known products. `swatch` is [accent, light background, dark background, sidebar]
 * for the picker; colourful themes paint the sidebar in both modes.
 */
export const THEMES: { id: ThemeId; name: string; hint: string; group: 'Colourful' | 'Classic'; swatch: [string, string, string, string?] }[] = [
  { id: 'slack', name: 'Slack', hint: 'Aubergine sidebar, green', group: 'Colourful', swatch: ['#047857', '#f7f2f7', '#1a1d21', '#4a154b'] },
  { id: 'discord', name: 'Discord', hint: 'Blurple everywhere', group: 'Colourful', swatch: ['#5865f2', '#eef0fb', '#313338', '#404eed'] },
  { id: 'spotify', name: 'Spotify', hint: 'Black sidebar, bright green', group: 'Colourful', swatch: ['#1db954', '#eef8f1', '#121212', '#000000'] },
  { id: 'stripe', name: 'Stripe', hint: 'Navy sidebar, violet', group: 'Colourful', swatch: ['#635bff', '#f1f4fb', '#0b1220', '#0a2540'] },
  { id: 'twitch', name: 'Twitch', hint: 'Purple on near-black', group: 'Colourful', swatch: ['#9146ff', '#f5f0ff', '#0e0e10', '#1f1f23'] },
  { id: 'posthog', name: 'PostHog', hint: 'Warm paper, orange', group: 'Classic', swatch: ['#c2410c', '#eeefe9', '#1d1f27'] },
  { id: 'github', name: 'GitHub', hint: 'Cool grey, green', group: 'Classic', swatch: ['#15803d', '#f6f8fa', '#0d1117'] },
  { id: 'linear', name: 'Linear', hint: 'Zinc, indigo', group: 'Classic', swatch: ['#4338ca', '#f4f5f8', '#0f1011'] },
  { id: 'atlassian', name: 'Atlassian', hint: 'Slate, blue', group: 'Classic', swatch: ['#1d4ed8', '#f7f8f9', '#1d2125'] },
  { id: 'vercel', name: 'Vercel', hint: 'Black and white', group: 'Classic', swatch: ['#171717', '#fafafa', '#000000'] },
]

const STORAGE_KEY = 'lahi-idp.appearance'
const DEFAULT: Appearance = { theme: 'stripe', mode: 'system' }
const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function load(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Appearance> | null
    return {
      theme: THEMES.some((t) => t.id === saved?.theme) ? saved!.theme! : DEFAULT.theme,
      mode: saved?.mode === 'light' || saved?.mode === 'dark' || saved?.mode === 'system' ? saved.mode : DEFAULT.mode,
    }
  } catch {
    // Storage blocked (private window, previews): fall back to the default look.
    return DEFAULT
  }
}

let current = load()
const listeners = new Set<() => void>()

export const resolvedMode = (mode: ModePreference): 'light' | 'dark' =>
  mode === 'system' ? (darkQuery?.matches ? 'dark' : 'light') : mode

function apply() {
  const root = document.documentElement
  root.dataset.theme = current.theme
  root.dataset.mode = resolvedMode(current.mode)
}

/** Call once before the first render so the page never flashes the wrong colours. */
export function initAppearance() {
  apply()
  darkQuery?.addEventListener('change', () => {
    if (current.mode === 'system') {
      apply()
      listeners.forEach((l) => l())
    }
  })
}

export function setAppearance(next: Partial<Appearance>) {
  current = { ...current, ...next }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not persisted; still applies for this visit.
  }
  apply()
  listeners.forEach((l) => l())
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
  )
}
