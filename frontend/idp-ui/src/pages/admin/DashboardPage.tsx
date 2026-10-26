import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, CopyField, EmptyState, LoadingBlock, PageHeader } from '../../components/ui'
import { adminApi, type Stats } from '../../lib/adminApi'
import { useApplications } from '../../lib/applications'
import { errorMessage } from '../../lib/http'
import { AppIcon } from './ApplicationsPage'

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.stats().then(setStats).catch((err) => setError(errorMessage(err)))
  }, [])

  const origin = window.location.origin

  return (
    <>
      <PageHeader title="Dashboard" description="One login for Moodle and every LAHI product." />
      {error && <Alert>{error}</Alert>}
      {!stats && !error && <LoadingBlock />}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Users" value={stats.users} sub={`${stats.newUsersLast7Days} new in the last 7 days`} to="/admin/users" />
          <StatCard label="Applications" value={stats.applications} to="/admin/applications" />
          <StatCard label="Custom scopes" value={stats.scopes} to="/admin/scopes" />
          <StatCard label="Locked users" value={stats.lockedUsers} sub={`${stats.roles} roles defined`} to="/admin/users" />
        </div>
      )}

      <YourApplications />

      <Card className="mt-8 p-5">
        <h2 className="text-base font-bold text-stone-900">Connection details for applications</h2>
        <p className="mt-1 text-sm text-stone-500">
          Most OpenID Connect libraries (and Moodle&apos;s OAuth 2 services) only need the issuer URL; everything else is discovered.
        </p>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <Detail label="Issuer / authority" value={origin} />
          <Detail label="Discovery document" value={`${origin}/.well-known/openid-configuration`} />
          <Detail label="Authorization endpoint" value={`${origin}/connect/authorize`} />
          <Detail label="Token endpoint" value={`${origin}/connect/token`} />
          <Detail label="Userinfo endpoint" value={`${origin}/connect/userinfo`} />
          <Detail label="Logout (end session) endpoint" value={`${origin}/connect/endsession`} />
        </dl>
      </Card>
    </>
  )
}

function StatCard({ label, value, sub, to }: { label: string; value: number; sub?: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="p-5 shadow-[0_2px_0_0_var(--color-line)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-stone-400">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
        <div className="mt-1.5 text-3xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
      </Card>
    </Link>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-stone-500">{label}</dt>
      <dd><CopyField value={value} /></dd>
    </div>
  )
}

function YourApplications() {
  const { apps } = useApplications()
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-stone-900">Your applications</h2>
        <Link to="/admin/applications" className="text-sm font-semibold text-orange-700 hover:text-orange-800">View all →</Link>
      </div>
      <Card>
        {!apps ? (
          <LoadingBlock />
        ) : apps.length === 0 ? (
          <EmptyState>No applications yet. <Link to="/admin/applications?add=1" className="font-semibold text-orange-700">Add the first one</Link>.</EmptyState>
        ) : (
          <ul className="divide-y divide-line/70">
            {apps.map((app) => {
              const name = app.displayName ?? app.clientId
              const signsUsersIn = app.grantTypes.includes('authorization_code')
              return (
                <li key={app.id}>
                  <Link to={`/admin/applications/${app.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-canvas/40">
                    <AppIcon name={name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{name}</div>
                      <div className="truncate font-mono text-xs text-stone-500">{app.clientId}</div>
                    </div>
                    <div className="text-right text-sm">
                      {signsUsersIn ? (
                        <><span className="font-bold tabular-nums">{app.userCount}</span> <span className="text-stone-500">{app.userCount === 1 ? 'user' : 'users'}</span></>
                      ) : (
                        <span className="text-stone-500">Service app</span>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </section>
  )
}
