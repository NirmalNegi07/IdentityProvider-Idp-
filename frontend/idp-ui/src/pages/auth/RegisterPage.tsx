import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, Button, Field, Input, LoadingBlock } from '../../components/ui'
import { accountApi } from '../../lib/accountApi'
import { ApiError, errorMessage } from '../../lib/http'
import { AuthLayout } from './AuthLayout'

export function RegisterPage() {
  const [params] = useSearchParams()
  const returnUrl = params.get('returnUrl')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    accountApi.settings().then((s) => setAllowed(s.allowRegistration)).catch(() => setAllowed(false))
  }, [])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setErrors(['The passwords do not match.'])
      return
    }
    setBusy(true)
    setErrors([])
    try {
      const { redirectUrl } = await accountApi.register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        returnUrl,
      })
      window.location.assign(redirectUrl)
    } catch (err) {
      setErrors(err instanceof ApiError && err.details.length ? err.details : [errorMessage(err)])
      setBusy(false)
    }
  }

  const loginLink = returnUrl ? `/login?${new URLSearchParams({ returnUrl })}` : '/login'

  if (allowed === null) return <LoadingBlock />

  if (!allowed) {
    return (
      <AuthLayout title="Registration closed" footer={<Link to={loginLink} className="font-medium text-indigo-600">Back to sign in</Link>}>
        <p className="text-sm text-slate-600">Self-registration is disabled. Ask an administrator to create an account for you.</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One account for all connected applications"
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginLink} className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        {errors.length > 0 && (
          <Alert>
            {errors.length === 1 ? errors[0] : <ul className="list-disc space-y-1 pl-4">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Last name">
            <Input autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters, with upper and lower case letters and a number.">
          <Input type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Confirm password">
          <Input type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} />
        </Field>
        <Button type="submit" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthLayout>
  )
}
