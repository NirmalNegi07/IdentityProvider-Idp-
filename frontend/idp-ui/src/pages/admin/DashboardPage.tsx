import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppsIcon, RolesIcon, ScopesIcon, UsersIcon } from '../../components/icons'
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
          <StatCard tone="accent" icon={<UsersIcon />} label="Users" value={stats.users} sub={`${stats.newUsersLast7Days} new in the last 7 days`} to="/admin/users" />
          <StatCard tone="teal" icon={<AppsIcon />} label="Applications" value={stats.applications} to="/admin/applications" />
          <StatCard tone="sky" icon={<ScopesIcon />} label="Custom scopes" value={stats.scopes} to="/admin/scopes" />
          <StatCard tone="rose" icon={<RolesIcon />} label="Locked users" value={stats.lockedUsers} sub={`${stats.roles} roles defined`} to="/admin/users" />
        </div>
      )}

      <YourApplications />

      <Card className="mt-8 p-5">
        <h2 className="text-base font-bold text-base-900">Connection details for applications</h2>
        <p className="mt-1 text-sm text-base-500">
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

const STAT_TONES = {
  accent: { chip: 'bg-accent-600 text-accent-fg', wash: 'from-accent-100' },
  teal: { chip: 'bg-teal-600 text-white', wash: 'from-teal-100 dark:from-teal-500/15' },
  sky: { chip: 'bg-sky-600 text-white', wash: 'from-sky-100 dark:from-sky-500/15' },
  rose: { chip: 'bg-rose-600 text-white', wash: 'from-rose-100 dark:from-rose-500/15' },
}

function StatCard({ label, value, sub, to, icon, tone }: { label: string; value: number; sub?: string; to: string; icon: ReactNode; tone: keyof typeof STAT_TONES }) {
  const t = STAT_TONES[tone]
  return (
    <Link to={to}>
      <Card className={`h-full bg-linear-to-br ${t.wash} to-surface p-5 shadow-[0_2px_0_0_var(--color-line)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-base-400`}>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-base-600">{label}</div>
          <span className={`flex size-8 items-center justify-center rounded-lg ${t.chip}`}>{icon}</span>
        </div>
        <div className="mt-2 text-3xl font-bold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-base-600">{sub}</div>}
      </Card>
    </Link>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-base-500">{label}</dt>
      <dd><CopyField value={value} /></dd>
    </div>
  )
}

function YourApplications() {
  const { apps } = useApplications()
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-bold text-base-900">Your applications</h2>
        <Link to="/admin/applications" className="text-sm font-semibold text-accent-text hover:text-accent-text-hover">View all →</Link>
      </div>
      <Card>
        {!apps ? (
          <LoadingBlock />
        ) : apps.length === 0 ? (
          <EmptyState>No applications yet. <Link to="/admin/applications?add=1" className="font-semibold text-accent-text">Add the first one</Link>.</EmptyState>
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
                      <div className="truncate font-mono text-xs text-base-500">{app.clientId}</div>
                    </div>
                    <div className="text-right text-sm">
                      {signsUsersIn ? (
                        <><span className="font-bold tabular-nums">{app.userCount}</span> <span className="text-base-500">{app.userCount === 1 ? 'user' : 'users'}</span></>
                      ) : (
                        <span className="text-base-500">Service app</span>
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
