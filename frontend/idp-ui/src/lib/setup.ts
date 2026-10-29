import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { adminApi, type Application } from './adminApi'
import { useApplications } from './applications'

// Progress of the Getting started checklist. Most steps tick themselves from real data; the one step
// that happens outside the IDP (pasting the details into the app) is ticked by hand and kept per browser.

const CONFIGURED_KEY = 'lahi-idp.guide.configured'

function readConfigured() {
  try {
    return localStorage.getItem(CONFIGURED_KEY) === '1'
  } catch {
    return false
  }
}

let configured = readConfigured()
const listeners = new Set<() => void>()

export function setConfigured(value: boolean) {
  configured = value
  try {
    localStorage.setItem(CONFIGURED_KEY, value ? '1' : '0')
  } catch {
    // Not persisted; still ticked for this visit.
  }
  listeners.forEach((l) => l())
}

/** Applications that sign people in, leaving out the admin console's own client. */
export const productApps = (apps: Application[] | null) =>
  (apps ?? []).filter((a) => !a.isSystem && a.grantTypes.includes('authorization_code'))

export function useSetupProgress() {
  const { apps } = useApplications()
  const { pathname } = useLocation()
  const [users, setUsers] = useState<number | null>(null)
  const isConfigured = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => configured,
  )

  // Re-count on every page change, so adding a user elsewhere ticks the step.
  useEffect(() => {
    adminApi.stats().then((s) => setUsers(s.users)).catch(() => {})
  }, [pathname])

  const products = productApps(apps)
  const steps = {
    user: users !== null && users > 1,
    app: products.length > 0,
    configure: products.length > 0 && isConfigured,
    test: products.some((a) => a.userCount > 0),
  }
  const done = Object.values(steps).filter(Boolean).length
  const total = Object.keys(steps).length

  return { loaded: apps !== null && users !== null, steps, done, total, complete: done === total, products }
}
