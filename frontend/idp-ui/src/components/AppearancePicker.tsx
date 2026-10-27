import { useEffect, useRef, useState } from 'react'
import { resolvedMode, setAppearance, THEMES, useAppearance, type ModePreference } from '../lib/appearance'
import { CheckIcon, MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from './icons'

const MODES: { value: ModePreference; label: string; icon: () => React.JSX.Element }[] = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
]

/** Theme and light/dark picker. `placement` decides which way the panel opens from the button. */
export function AppearancePicker({ placement = 'up', inSidebar }: { placement?: 'up' | 'down'; inSidebar?: boolean }) {
  const { theme, mode } = useAppearance()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dark = resolvedMode(mode) === 'dark'

  return (
    <div ref={ref} className="relative">
      <button
        className={`rounded-md p-1.5 ${
          inSidebar ? 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg' : 'text-base-500 hover:bg-base-900/5 hover:text-base-900'
        }`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Appearance"
        aria-label="Appearance"
      >
        <PaletteIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Appearance"
          className={`absolute z-50 max-h-[80vh] w-72 overflow-y-auto rounded-xl border border-line bg-surface p-3 text-base-900 shadow-xl ${
            placement === 'up' ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-2'
          }`}
        >
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-500">Mode</div>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-base-900/5 p-1" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.value}
                role="radio"
                aria-checked={mode === m.value}
                onClick={() => setAppearance({ mode: m.value })}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${
                  mode === m.value ? 'bg-surface text-base-900 shadow-sm ring-1 ring-line' : 'text-base-600 hover:text-base-900'
                }`}
              >
                <m.icon />
                {m.label}
              </button>
            ))}
          </div>

          {(['Colourful', 'Classic'] as const).map((group) => (
            <div key={group}>
              <div className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-500">{group}</div>
              <div className="space-y-0.5" role="radiogroup" aria-label={`${group} themes`}>
                {THEMES.filter((t) => t.group === group).map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={theme === t.id}
                    onClick={() => setAppearance({ theme: t.id })}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left ${theme === t.id ? 'bg-base-900/5' : 'hover:bg-base-900/5'}`}
                  >
                    {/* Mini preview: sidebar strip, page background and accent dot. */}
                    <span
                      className="relative flex h-7 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-line"
                      style={{ background: dark ? t.swatch[2] : t.swatch[1] }}
                      aria-hidden
                    >
                      {t.swatch[3] && <span className="h-full w-2.5" style={{ background: t.swatch[3] }} />}
                      <span
                        className="absolute right-1 bottom-1 size-3 rounded-full"
                        style={{ background: t.id === 'vercel' && dark ? '#ededed' : t.swatch[0] }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-base-900">{t.name}</span>
                      <span className="block text-xs text-base-500">{t.hint}</span>
                    </span>
                    {theme === t.id && <span className="text-accent-text"><CheckIcon /></span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="mt-3 text-[11px] text-base-500">Colour themes inspired by these products. Saved in this browser.</p>
        </div>
      )}
    </div>
  )
}
