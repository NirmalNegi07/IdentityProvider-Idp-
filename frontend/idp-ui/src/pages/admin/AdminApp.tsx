import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthProvider, useAuth } from 'react-oidc-context'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AppearancePicker } from '../../components/AppearancePicker'
import { AppsIcon, HomeIcon, MenuIcon, PlusIcon, RolesIcon, ScopesIcon, SignOutIcon, UsersIcon } from '../../components/icons'
import { Alert, Button, LoadingBlock } from '../../components/ui'
import { adminApi, type Application } from '../../lib/adminApi'
import { ApplicationsContext, useApplications } from '../../lib/applications'
import { errorMessage } from '../../lib/http'
import { adminUserManager, hasRole } from '../../lib/oidc'
import { ApplicationDetailPage } from './ApplicationDetailPage'
import { AppIcon, ApplicationsPage } from './ApplicationsPage'
import { DashboardPage } from './DashboardPage'
import { RolesPage } from './RolesPage'
import { ScopesPage } from './ScopesPage'
import { UsersPage } from './UsersPage'

export function AdminApp() {
  const navigate = useNavigate()
  return (
    <AuthProvider
      userManager={adminUserManager}
      onSigninCallback={(user) => {
        const returnTo = (user?.state as { returnTo?: string } | undefined)?.returnTo ?? '/admin'
        navigate(returnTo, { replace: true })
      }}
    >
      <RequireAdmin>
        <ApplicationsProvider>
          <AdminLayout>
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="applications/:id" element={<ApplicationDetailPage />} />
              <Route path="scopes" element={<ScopesPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="*" element={<DashboardPage />} />
            </Routes>
          </AdminLayout>
        </ApplicationsProvider>
      </RequireAdmin>
    </AuthProvider>
  )
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  const isCallback = location.pathname === '/admin/callback'

  useEffect(() => {
    if (!isCallback && !auth.isLoading && !auth.isAuthenticated && !auth.activeNavigator && !auth.error) {
      void auth.signinRedirect({ state: { returnTo: location.pathname + location.search } })
    }
  }, [auth, isCallback, location])

  if (auth.error) {
    return (
      <Centered>
        <Alert>Sign-in failed: {auth.error.message}</Alert>
        <Button className="mt-4" onClick={() => void auth.signinRedirect()}>Try again</Button>
      </Centered>
    )
  }

  if (auth.isLoading || !auth.isAuthenticated) return <LoadingBlock />

  if (!hasRole(auth.user?.profile, 'Admin')) {
    return (
      <Centered>
        <Alert kind="warning">Your account ({auth.user?.profile.email}) does not have the Admin role.</Alert>
        <Button variant="secondary" className="mt-4" onClick={() => void auth.signoutRedirect()}>Sign out</Button>
      </Centered>
    )
  }

  return <>{children}</>
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto mt-24 max-w-md px-4 text-center">{children}</div>
}

function ApplicationsProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    adminApi.applications
      .list()
      .then((list) => {
        setApps(list)
        setError(null)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [])
  useEffect(reload, [reload])

  const value = useMemo(() => ({ apps, error, reload }), [apps, error, reload])
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>
}

function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation()
  // The mobile menu remembers the page it was opened on, so navigating anywhere closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const menuOpen = menuOpenOn === location.pathname
  const setMenuOpen = (open: boolean) => setMenuOpenOn(open ? location.pathname : null)

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 z-40 hidden h-screen w-64 shrink-0 border-r border-sidebar-line bg-sidebar text-sidebar-fg lg:block">
        <Sidebar />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onMouseDown={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-line bg-sidebar text-sidebar-fg shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <Sidebar />
          </aside>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-accent-100 to-transparent" aria-hidden />
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line/60 bg-canvas/40 px-4 backdrop-blur sm:px-6">
          <button
            className="-ml-1 rounded-md p-1.5 text-base-600 hover:bg-base-900/5 lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          <Breadcrumbs />
        </header>
        <main className="relative w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  )
}

function Sidebar() {
  const auth = useAuth()
  const { apps } = useApplications()
  const email = auth.user?.profile.email ?? ''

  return (
    <div className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <img src="/favicon.svg" alt="" className="size-7" />
        <div className="leading-tight">
          <div className="font-bold tracking-tight">LAHI IDP</div>
          <div className="text-xs text-sidebar-muted">Admin console</div>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2.5 py-2" aria-label="Admin">
        <div className="space-y-0.5">
          <SideLink to="/admin" end icon={<HomeIcon />}>Dashboard</SideLink>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">Applications</span>
            <Link
              to="/admin/applications?add=1"
              className="rounded p-0.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
              title="Add application"
              aria-label="Add application"
            >
              <PlusIcon />
            </Link>
          </div>
          <div className="space-y-0.5">
            <SideLink to="/admin/applications" end icon={<AppsIcon />}>All applications</SideLink>
            {apps?.map((app) => {
              const name = app.displayName ?? app.clientId
              return (
                <SideLink key={app.id} to={`/admin/applications/${app.id}`} icon={<AppIcon name={name} size="xs" />}>
                  <span className="flex-1 truncate">{name}</span>
                  {app.grantTypes.includes('authorization_code') && (
                    <span className="rounded-full bg-sidebar-hover px-1.5 text-[11px] tabular-nums text-sidebar-muted">{app.userCount}</span>
                  )}
                </SideLink>
              )
            })}
          </div>
        </div>

        <div>
          <div className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">Identity</div>
          <div className="space-y-0.5">
            <SideLink to="/admin/users" icon={<UsersIcon />}>Users</SideLink>
            <SideLink to="/admin/roles" icon={<RolesIcon />}>Roles</SideLink>
            <SideLink to="/admin/scopes" icon={<ScopesIcon />}>Scopes</SideLink>
          </div>
        </div>
      </nav>

      <div className="flex items-center gap-2.5 border-t border-sidebar-line px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-700 text-sm font-semibold text-accent-fg">
          {email.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{email}</div>
          <div className="text-xs text-sidebar-muted">Administrator</div>
        </div>
        <AppearancePicker inSidebar />
        <button
          className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
          onClick={() => void auth.signoutRedirect()}
          title="Sign out"
          aria-label="Sign out"
        >
          <SignOutIcon />
        </button>
      </div>
    </div>
  )
}

function SideLink({ to, end, icon, children }: { to: string; end?: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm ${
          isActive ? 'bg-sidebar-active font-semibold text-sidebar-active-fg' : 'text-sidebar-fg hover:bg-sidebar-hover'
        }`
      }
    >
      {icon}
      {children}
    </NavLink>
  )
}

const sections: Record<string, string> = {
  applications: 'Applications',
  users: 'Users',
  roles: 'Roles',
  scopes: 'Scopes',
}

/** "LAHI IDP / Applications / Moodle", built from the URL. */
function Breadcrumbs() {
  const location = useLocation()
  const { apps } = useApplications()
  const [, , section, id] = location.pathname.split('/')

  const crumbs: { label: string; to?: string }[] = [{ label: 'LAHI IDP', to: '/admin' }]
  if (!section) crumbs.push({ label: 'Dashboard' })
  else if (sections[section]) {
    crumbs.push({ label: sections[section], to: id ? `/admin/${section}` : undefined })
    if (id && section === 'applications') {
      const app = apps?.find((a) => a.id === id)
      crumbs.push({ label: app ? (app.displayName ?? app.clientId) : '…' })
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1.5">
          {i > 0 && <span className="text-base-400">/</span>}
          {c.to ? (
            <Link to={c.to} className="truncate text-base-500 hover:text-base-900">{c.label}</Link>
          ) : (
            <span className="truncate font-semibold text-base-900">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
