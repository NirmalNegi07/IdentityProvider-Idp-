import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { endTour, goToStep, hasSeenTour, startTour, TOUR_STEPS, useTourStep } from '../lib/tour'
import { Button } from './ui'

const PAD = 6
const GAP = 14
const CARD_WIDTH = 340

/** The visible element for a data-tour name (the sidebar exists twice: desktop and mobile drawer). */
function findTarget(name: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)].find((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  })
}

/** Spotlight plus a pop-up card for the current tour step. Opens by itself on the first visit. */
export function Tour() {
  const index = useTourStep()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Where the current step's target was found; null rect means "show in the middle".
  const [found, setFound] = useState<{ index: number; rect: DOMRect | null } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardHeight, setCardHeight] = useState(0)

  useEffect(() => {
    if (!hasSeenTour()) startTour()
  }, [])

  const step = index === null ? null : TOUR_STEPS[index]

  // Go to the step's page, then wait for its target to render (lists load asynchronously).
  useEffect(() => {
    if (index === null || !step) return
    if (step.path && step.path !== pathname) {
      navigate(step.path)
      return
    }
    let frame = 0
    const started = performance.now()
    const look = () => {
      const el = step.target ? findTarget(step.target) : undefined
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        setFound({ index, rect: el.getBoundingClientRect() })
      } else if (step.target && performance.now() - started < 2500) {
        frame = requestAnimationFrame(look)
      } else {
        // No target, or it isn't on screen (e.g. the sidebar on a phone): show the step in the middle.
        setFound({ index, rect: null })
      }
    }
    frame = requestAnimationFrame(look)
    return () => cancelAnimationFrame(frame)
  }, [index, step, pathname, navigate])

  // Keep the spotlight on its target while the page scrolls or resizes.
  useEffect(() => {
    if (index === null || !step?.target) return
    const update = () => {
      const el = findTarget(step.target!)
      setFound({ index, rect: el ? el.getBoundingClientRect() : null })
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [index, step])

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight)
  }, [index, found])

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour()
      else if (e.key === 'ArrowRight' && index < TOUR_STEPS.length - 1) goToStep(index + 1)
      else if (e.key === 'ArrowLeft' && index > 0) goToStep(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index])

  const ready = index !== null && found?.index === index && (!step?.path || step.path === pathname)

  useEffect(() => {
    if (ready) cardRef.current?.focus()
  }, [ready, index])

  if (index === null || !step || !ready) return null
  const rect = found.rect

  const isFirst = index === 0
  const isLast = index === TOUR_STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(CARD_WIDTH, vw - 32)

  // Place the card to the right of the target if there's room, else below, else above.
  let cardStyle: React.CSSProperties
  if (rect) {
    const clampTop = (top: number) => Math.max(16, Math.min(top, vh - cardHeight - 16))
    const clampLeft = (left: number) => Math.max(16, Math.min(left, vw - width - 16))
    if (rect.right + GAP + width + 16 <= vw) {
      cardStyle = { left: rect.right + PAD + GAP, top: clampTop(rect.top + rect.height / 2 - cardHeight / 2) }
    } else if (rect.bottom + GAP + cardHeight + 16 <= vh) {
      cardStyle = { left: clampLeft(rect.left + rect.width / 2 - width / 2), top: rect.bottom + PAD + GAP }
    } else {
      cardStyle = { left: clampLeft(rect.left + rect.width / 2 - width / 2), top: clampTop(rect.top - PAD - GAP - cardHeight) }
    }
  } else {
    cardStyle = { left: (vw - width) / 2, top: Math.max(16, (vh - cardHeight) / 2) }
  }

  function finish() {
    endTour()
    if (isLast) navigate('/admin/guide')
  }

  return (
    <div className="fixed inset-0 z-[60]" aria-live="polite">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-accent-500 transition-all duration-200 motion-reduce:transition-none"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="fixed rounded-xl border border-line bg-surface p-5 shadow-2xl outline-none"
        style={{ ...cardStyle, width }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-accent-text">
            {isFirst || isLast ? 'Quick tour' : `Step ${index} of ${TOUR_STEPS.length - 2}`}
          </span>
          {!isLast && (
            <button onClick={endTour} className="text-xs font-medium text-base-500 hover:text-base-800">Skip tour</button>
          )}
        </div>
        <h2 id="tour-title" className="mt-2 text-lg font-bold text-base-900">{step.title}</h2>
        <p className="mt-1.5 text-sm text-base-600">{step.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden>
            {TOUR_STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-accent-600' : 'w-1.5 bg-base-300'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {isFirst ? (
              <>
                <Button variant="secondary" size="sm" onClick={endTour}>Not now</Button>
                <Button size="sm" onClick={() => goToStep(1)}>Start tour</Button>
              </>
            ) : isLast ? (
              <>
                <Button variant="secondary" size="sm" onClick={endTour}>Close</Button>
                <Button size="sm" onClick={finish}>Open Getting started</Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={() => goToStep(index - 1)}>Back</Button>
                <Button size="sm" onClick={() => goToStep(index + 1)}>Next</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
