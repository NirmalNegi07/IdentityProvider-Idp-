import { createContext, useContext } from 'react'
import type { Application } from './adminApi'

/** The registered applications, loaded once by the admin layout and shared by the sidebar and pages. */
export interface ApplicationsState {
  apps: Application[] | null
  error: string | null
  /** Re-fetch after anything that changes an application or its user count. */
  reload: () => void
}

export const ApplicationsContext = createContext<ApplicationsState>({ apps: null, error: null, reload: () => {} })

export const useApplications = () => useContext(ApplicationsContext)
