import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, LoadingBlock } from '../../components/ui'
import { accountApi, type ConsentInfo } from '../../lib/accountApi'
import { errorMessage } from '../../lib/http'
import { AuthLayout } from './AuthLayout'

/**
 * Shown for clients with "explicit" or "systematic" consent. The original authorization
 * request parameters are posted back to /connect/authorize together with the user's decision.
 */
export function ConsentPage() {
  const [params] = useSearchParams()
  const [info, setInfo] = useState<ConsentInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    accountApi
      .consent(params.get('client_id') ?? '', params.get('scope') ?? '')
      .then(setInfo)
      .catch((err) => setError(errorMessage(err)))
  }, [params])

  if (error) {
    return (
      <AuthLayout title="Something went wrong">
        <Alert>{error}</Alert>
      </AuthLayout>
    )
  }
  if (!info) return <LoadingBlock />

  return (
    <AuthLayout title={`Allow ${info.applicationName}?`} subtitle={<><strong>{info.applicationName}</strong> is requesting access to your account.</>}>
      <form method="post" action="/connect/authorize" onSubmit={() => setSubmitting(true)}>
        {[...params.entries()].map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <p className="text-sm font-medium text-slate-700">This will allow it to:</p>
        <ul className="mt-3 space-y-3">
          {info.scopes.map((s) => (
            <li key={s.name} className="flex gap-3 text-sm">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden>
                <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
              </svg>
              <span>
                <span className="text-slate-800">{s.displayName}</span>
                {s.description && <span className="block text-xs text-slate-500">{s.description}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex gap-3">
          <Button type="submit" name="submit.Deny" value="Deny" variant="secondary" className="flex-1" disabled={submitting}>Deny</Button>
          <Button type="submit" name="submit.Accept" value="Accept" className="flex-1" disabled={submitting}>Allow</Button>
        </div>
      </form>
    </AuthLayout>
  )
}
