import { useSyncExternalStore } from 'react'

// The admin product tour: which step is open (or null when closed), and whether this browser has seen it.

const SEEN_KEY = 'lahi-idp.tour.seen'

export interface TourStep {
  /** Matches a data-tour="…" attribute. Steps without a target show in the middle of the screen. */
  target?: string
  /** Page the target lives on; the tour goes there first. */
  path?: string
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to LAHI IDP',
    body: 'LAHI IDP gives your users one login for Moodle and every LAHI product. This short tour shows where everything is. It takes about a minute.',
  },
  {
    target: 'nav-dashboard',
    path: '/admin',
    title: 'Dashboard',
    body: 'A summary of your users and applications, plus the issuer URL that applications need to connect.',
  },
  {
    target: 'nav-guide',
    title: 'Getting started',
    body: 'Step-by-step set-up: connect Moodle, test the first sign-in, and see what each admin action does. Your progress shows here.',
  },
  {
    target: 'nav-apps',
    title: 'Your applications',
    body: 'Every product that signs users in through LAHI IDP, such as Moodle, with its number of users. Open one to see its users and settings, or use + to add one.',
  },
  {
    target: 'add-app',
    path: '/admin/applications',
    title: 'Add an application',
    body: 'Pick a template such as Moodle and the right settings are filled in. You then get a client ID and secret to paste into the application.',
  },
  {
    target: 'nav-users',
    title: 'Users',
    body: 'One account per person, used for every connected application.',
  },
  {
    target: 'add-user',
    path: '/admin/users',
    title: 'Add a user',
    body: 'Create an account with a password. Moodle creates its own matching account the first time the user signs in.',
  },
  {
    target: 'user-actions',
    path: '/admin/users',
    title: 'Manage a user',
    body: 'Edit details, set a new password, lock the account or delete it. Locking blocks new sign-ins; a session already open in Moodle continues until it ends.',
  },
  {
    target: 'nav-roles',
    title: 'Roles',
    body: 'IDP roles such as Admin. Only Admins can open this console. Teacher and student roles stay in Moodle.',
  },
  {
    target: 'account',
    title: 'Your account and themes',
    body: 'Change the colour theme, switch between light and dark mode, replay this tour with the ? button, or sign out.',
  },
  {
    title: "You're all set",
    body: 'Next, open Getting started to connect Moodle. You can replay this tour any time from Getting started or the ? button at the bottom of the sidebar.',
  },
]

let step: number | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    // Storage blocked: don't keep popping the tour up on every visit.
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Not remembered; the tour may show again next visit.
  }
}

export function startTour() {
  step = 0
  emit()
}

export function goToStep(index: number) {
  step = Math.max(0, Math.min(index, TOUR_STEPS.length - 1))
  emit()
}

export function endTour() {
  step = null
  markSeen()
  emit()
}

export function useTourStep() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => step,
  )
}
