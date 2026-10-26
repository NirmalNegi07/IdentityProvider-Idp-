import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Card, CopyField, LoadingBlock, PageHeader } from '../../components/ui'
import { adminApi, type Stats } from '../../lib/adminApi'
import { errorMessage } from '../../lib/http'

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi.stats().then(setStats).catch((err) => setError(errorMessage(err)))
  }, [])

  const origin = window.location.origin

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of this identity provider." />
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

      <Card className="mt-8 p-5">
        <h2 className="text-sm font-semibold text-slate-900">Connection details for applications</h2>
        <p className="mt-1 text-sm text-slate-500">
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
      <Card className="p-5 transition-shadow hover:shadow-md">
        <div className="text-sm text-slate-500">{label}</div>
        <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
      </Card>
    </Link>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium text-slate-500">{label}</dt>
      <dd><CopyField value={value} /></dd>
    </div>
  )
}
