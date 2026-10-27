import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, LoadingBlock } from '../../components/ui'
import { accountApi, type CurrentUser } from '../../lib/accountApi'
import { AuthLayout } from './AuthLayout'

/** Landing page of the IDP itself: shows who is signed in to the central session. */
export function HomePage() {
  const navigate = useNavigate()
  const [me, setMe] = useState<CurrentUser | null>(null)

  useEffect(() => {
    accountApi.me().then(setMe).catch(() => setMe({ isAuthenticated: false, id: null, email: null, name: null, roles: [] }))
  }, [])

  if (!me) return <LoadingBlock />

  if (!me.isAuthenticated) {
    return (
      <AuthLayout title="Identity Provider" subtitle="Single sign-on for your organisation's applications">
        <Button className="w-full" onClick={() => navigate('/login')}>Sign in</Button>
      </AuthLayout>
    )
  }

  async function logout() {
    await accountApi.logout()
    window.location.assign('/login?loggedOut=true')
  }

  return (
    <AuthLayout title={`Hi, ${me.name}`} subtitle={<>Signed in as <strong>{me.email}</strong></>}>
      <p className="text-sm text-base-600">You are signed in. Applications connected to this identity provider will sign you in automatically.</p>
      <div className="mt-6 flex flex-col gap-2">
        {me.roles.includes('Admin') && (
          <Button onClick={() => navigate('/admin')}>Open admin console</Button>
        )}
        <Button variant="secondary" onClick={logout}>Sign out</Button>
      </div>
    </AuthLayout>
  )
}
