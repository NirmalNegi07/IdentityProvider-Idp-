import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Button, Checkbox, Field, Input } from '../../components/ui'
import { accountApi } from '../../lib/accountApi'
import { errorMessage } from '../../lib/http'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const [params] = useSearchParams()
  const returnUrl = params.get('returnUrl')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [allowRegistration, setAllowRegistration] = useState(false)

  useEffect(() => {
    accountApi.settings().then((s) => setAllowRegistration(s.allowRegistration)).catch(() => {})
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { redirectUrl } = await accountApi.login({ email, password, rememberMe, returnUrl })
      // Full navigation: the redirect usually continues the OIDC flow at /connect/authorize.
      window.location.assign(redirectUrl)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const registerLink = returnUrl ? `/register?${new URLSearchParams({ returnUrl })}` : '/register'

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your account to continue"
      footer={
        allowRegistration && (
          <>
            Don&apos;t have an account?{' '}
            <Link to={registerLink} className="font-medium text-indigo-600 hover:text-indigo-500">Create one</Link>
          </>
        )
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        {params.get('loggedOut') && !error && <Alert kind="success">You have been signed out.</Alert>}
        {error && <Alert>{error}</Alert>}
        <Field label="Email">
          <Input type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Checkbox label="Keep me signed in" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
        <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
      </form>
    </AuthLayout>
  )
}
