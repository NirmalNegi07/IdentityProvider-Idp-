import { useEffect, type ReactNode } from 'react'
import { AuthProvider, useAuth } from 'react-oidc-context'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, LoadingBlock } from '../../components/ui'
import { adminUserManager, hasRole } from '../../lib/oidc'
import { ApplicationsPage } from './ApplicationsPage'
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
        <AdminLayout>
          <Routes>
            <Route index element={<DashboardPage />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="scopes" element={<ScopesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="roles" element={<RolesPage />} />
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </AdminLayout>
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

const nav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/applications', label: 'Applications' },
  { to: '/admin/scopes', label: 'Scopes' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/roles', label: 'Roles' },
]

function AdminLayout({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const profile = auth.user?.profile

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <div className="flex items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" className="size-6" />
            <span className="hidden sm:inline">IDP Admin</span>
          </div>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 md:inline">{profile?.email}</span>
            <Button variant="secondary" size="sm" onClick={() => void auth.signoutRedirect()}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
