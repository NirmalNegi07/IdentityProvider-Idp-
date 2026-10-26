import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  CopyField,
  EmptyState,
  Field,
  Input,
  linesToList,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '../../components/ui'
import { adminApi, type Application, type ApplicationInput } from '../../lib/adminApi'
import { useApplications } from '../../lib/applications'
import { errorMessage } from '../../lib/http'

const GRANT_TYPES = [
  { value: 'authorization_code', label: 'Authorization code', description: 'Users sign in through the IDP (all interactive apps).' },
  { value: 'refresh_token', label: 'Refresh token', description: 'Lets the app renew tokens without a new login (offline_access scope).' },
  { value: 'client_credentials', label: 'Client credentials', description: 'Service-to-service calls with no user (confidential clients only).' },
]

const CONSENT_TYPES = [
  { value: 'implicit', label: 'Implicit: no consent screen (first-party apps)' },
  { value: 'explicit', label: 'Explicit: ask once, remember the answer' },
  { value: 'systematic', label: 'Systematic: ask every time' },
  { value: 'external', label: 'External: only pre-approved users' },
]

interface Preset {
  label: string
  description: string
  apply: (base: ApplicationInput) => ApplicationInput
}

const PRESETS: Preset[] = [
  {
    label: 'Moodle',
    description: 'PHP web app using Moodle OAuth 2 services',
    apply: (b) => ({
      ...b,
      displayName: b.displayName || 'Moodle',
      clientId: b.clientId || 'moodle',
      clientType: 'confidential',
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUris: b.redirectUris.length ? b.redirectUris : ['https://moodle.example.com/admin/oauth2callback.php'],
      postLogoutRedirectUris: b.postLogoutRedirectUris.length ? b.postLogoutRedirectUris : ['https://moodle.example.com/'],
      requirePkce: false,
    }),
  },
  {
    label: 'React SPA',
    description: 'Browser app, public client with PKCE',
    apply: (b) => ({
      ...b,
      clientType: 'public',
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['openid', 'profile', 'email', 'roles', 'offline_access'],
      redirectUris: b.redirectUris.length ? b.redirectUris : ['http://localhost:5173/callback'],
      postLogoutRedirectUris: b.postLogoutRedirectUris.length ? b.postLogoutRedirectUris : ['http://localhost:5173/'],
      requirePkce: true,
    }),
  },
  {
    label: 'Express web app',
    description: 'Server-rendered Node.js app, confidential client',
    apply: (b) => ({
      ...b,
      clientType: 'confidential',
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['openid', 'profile', 'email', 'roles', 'offline_access'],
      redirectUris: b.redirectUris.length ? b.redirectUris : ['http://localhost:3000/auth/callback'],
      postLogoutRedirectUris: b.postLogoutRedirectUris.length ? b.postLogoutRedirectUris : ['http://localhost:3000/'],
      requirePkce: true,
    }),
  },
  {
    label: 'Machine to machine',
    description: 'Backend service calling an API, no user',
    apply: (b) => ({
      ...b,
      clientType: 'confidential',
      grantTypes: ['client_credentials'],
      scopes: [],
      redirectUris: [],
      postLogoutRedirectUris: [],
      requirePkce: false,
    }),
  },
]

const emptyInput = (): ApplicationInput => ({
  clientId: '',
  displayName: '',
  clientType: 'confidential',
  consentType: 'implicit',
  redirectUris: [],
  postLogoutRedirectUris: [],
  grantTypes: ['authorization_code', 'refresh_token'],
  scopes: ['openid', 'profile', 'email'],
  requirePkce: true,
})

export function ApplicationsPage() {
  const { apps, error, reload } = useApplications()
  const [params, setParams] = useSearchParams()
  const [secret, setSecret] = useState<{ clientId: string; secret: string } | null>(null)
  // The sidebar's "+" opens this page with ?add=1.
  const adding = params.has('add')
  const setAdding = (open: boolean) => setParams(open ? { add: '1' } : {})

  return (
    <>
      <PageHeader
        title="Applications"
        description="Products that sign users in through LAHI IDP. Open one to see and manage its users."
        actions={<Button onClick={() => setAdding(true)}>Add application</Button>}
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      {!apps ? (
        <Card><LoadingBlock /></Card>
      ) : apps.length === 0 ? (
        <Card><EmptyState>No applications yet.</EmptyState></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => <ApplicationCard key={app.id} app={app} />)}
        </div>
      )}

      {adding && (
        <ApplicationForm
          app={null}
          onClose={() => setAdding(false)}
          onSaved={(clientId, newSecret) => {
            setAdding(false)
            if (newSecret) setSecret({ clientId, secret: newSecret })
            reload()
          }}
        />
      )}

      <SecretModal secret={secret} onClose={() => setSecret(null)} />
    </>
  )
}

function ApplicationCard({ app }: { app: Application }) {
  const name = app.displayName ?? app.clientId
  const signsUsersIn = app.grantTypes.includes('authorization_code')
  return (
    <Link to={`/admin/applications/${app.id}`} className="group">
      <Card className="flex h-full flex-col p-5 shadow-[0_2px_0_0_var(--color-line)] transition-[border-color,transform] group-hover:-translate-y-0.5 group-hover:border-stone-400">
        <div className="flex items-start gap-3">
          <AppIcon name={name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-stone-900">{name}</div>
            <div className="truncate font-mono text-xs text-stone-500">{app.clientId}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={app.clientType === 'confidential' ? 'brand' : 'neutral'}>{app.clientType}</Badge>
          {app.requirePkce && <Badge>PKCE</Badge>}
          {app.isSystem && <Badge tone="amber">system</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
          <span className="text-stone-600">
            {signsUsersIn ? (
              <><span className="font-semibold tabular-nums text-stone-900">{app.userCount}</span> {app.userCount === 1 ? 'user' : 'users'}</>
            ) : (
              'Service app, no users'
            )}
          </span>
          <span className="font-semibold text-orange-700 group-hover:text-orange-800">Open →</span>
        </div>
      </Card>
    </Link>
  )
}

/** A coloured initial, so applications are easy to tell apart at a glance. */
export function AppIcon({ name, size = 'md' }: { name: string; size?: 'xs' | 'md' | 'lg' }) {
  const palette = ['bg-orange-100 text-orange-800', 'bg-teal-100 text-teal-800', 'bg-amber-100 text-amber-900', 'bg-rose-100 text-rose-800', 'bg-sky-100 text-sky-800']
  const tone = palette[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length]
  const sizes = { xs: 'size-[18px] rounded text-[10px]', md: 'size-10 rounded-lg text-base', lg: 'size-12 rounded-lg text-xl' }
  return (
    <div className={`flex shrink-0 items-center justify-center font-bold ${tone} ${sizes[size]}`} aria-hidden>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}

export function SecretModal({ secret, onClose }: { secret: { clientId: string; secret: string } | null; onClose: () => void }) {
  return (
    <Modal open={!!secret} title="Client secret" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <Alert kind="warning">Copy this secret now. It is stored hashed and will not be shown again.</Alert>
      <Field label="Client ID"><CopyField value={secret?.clientId ?? ''} /></Field>
      <Field label="Client secret"><CopyField value={secret?.secret ?? ''} /></Field>
    </Modal>
  )
}

export function ApplicationForm({
  app,
  onClose,
  onSaved,
}: {
  app: Application | null
  onClose: () => void
  onSaved: (clientId: string, secret: string | null) => void
}) {
  const [input, setInput] = useState<ApplicationInput>(() => (app ? { ...app } : emptyInput()))
  const [redirects, setRedirects] = useState((app?.redirectUris ?? []).join('\n'))
  const [postLogout, setPostLogout] = useState((app?.postLogoutRedirectUris ?? []).join('\n'))
  const [scopeNames, setScopeNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminApi.scopes.names().then(setScopeNames).catch(() => {})
  }, [])

  const toggle = (key: 'grantTypes' | 'scopes', value: string) =>
    setInput((i) => ({ ...i, [key]: i[key].includes(value) ? i[key].filter((v) => v !== value) : [...i[key], value] }))

  function applyPreset(preset: Preset) {
    const next = preset.apply({ ...input, redirectUris: linesToList(redirects), postLogoutRedirectUris: linesToList(postLogout) })
    setInput(next)
    setRedirects(next.redirectUris.join('\n'))
    setPostLogout(next.postLogoutRedirectUris.join('\n'))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = { ...input, redirectUris: linesToList(redirects), postLogoutRedirectUris: linesToList(postLogout) }
    try {
      const res = app ? await adminApi.applications.update(app.id, body) : await adminApi.applications.create(body)
      onSaved(res.application.clientId, res.clientSecret)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const usesCodeFlow = input.grantTypes.includes('authorization_code')
  const isPublic = input.clientType === 'public'

  return (
    <Modal
      open
      wide
      title={app ? `Edit ${app.displayName ?? app.clientId}` : 'Add application'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="app-form" loading={busy}>{app ? 'Save changes' : 'Create application'}</Button>
        </>
      }
    >
      <form id="app-form" className="space-y-5" onSubmit={submit}>
        {error && <Alert>{error}</Alert>}

        {!app && (
          <div>
            <div className="mb-2 text-sm font-medium text-stone-700">Start from a template</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="rounded-md p-2.5 text-left ring-1 ring-stone-200 hover:bg-orange-50 hover:ring-orange-300"
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="mt-0.5 text-xs text-stone-500">{p.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Display name">
            <Input value={input.displayName ?? ''} onChange={(e) => setInput({ ...input, displayName: e.target.value })} placeholder="Moodle LMS" />
          </Field>
          <Field label="Client ID" hint="Letters, digits and . _ : - only.">
            <Input
              required
              value={input.clientId}
              disabled={app?.isSystem}
              onChange={(e) => setInput({ ...input, clientId: e.target.value })}
              className="font-mono"
              placeholder="moodle"
            />
          </Field>
          <Field
            label="Client type"
            hint={isPublic ? 'Runs in the browser or on a device; cannot keep a secret.' : 'Runs on a server; authenticates with a client secret.'}
          >
            <Select value={input.clientType} disabled={app?.isSystem} onChange={(e) => setInput({ ...input, clientType: e.target.value as ApplicationInput['clientType'] })}>
              <option value="confidential">Confidential (server-side)</option>
              <option value="public">Public (SPA / mobile)</option>
            </Select>
          </Field>
          <Field label="Consent">
            <Select value={input.consentType} onChange={(e) => setInput({ ...input, consentType: e.target.value as ApplicationInput['consentType'] })}>
              {CONSENT_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">Grant types</legend>
          <div className="space-y-2">
            {GRANT_TYPES.map((g) => (
              <Checkbox
                key={g.value}
                label={g.label}
                description={g.description}
                checked={input.grantTypes.includes(g.value)}
                disabled={g.value === 'client_credentials' && isPublic}
                onChange={() => toggle('grantTypes', g.value)}
              />
            ))}
          </div>
        </fieldset>

        {usesCodeFlow && (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Redirect URIs" hint="One per line. Must match exactly what the app sends.">
              <Textarea rows={3} value={redirects} onChange={(e) => setRedirects(e.target.value)} />
            </Field>
            <Field label="Post-logout redirect URIs" hint="Where users may be sent after signing out.">
              <Textarea rows={3} value={postLogout} onChange={(e) => setPostLogout(e.target.value)} />
            </Field>
          </div>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-stone-700">Allowed scopes</legend>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {scopeNames.map((s) => (
              <Checkbox
                key={s}
                label={<span className="font-mono text-xs">{s}</span>}
                checked={input.scopes.includes(s)}
                disabled={s === 'openid'}
                onChange={() => toggle('scopes', s)}
              />
            ))}
          </div>
        </fieldset>

        {usesCodeFlow && (
          <Checkbox
            label="Require PKCE"
            description={isPublic ? 'Always required for public clients.' : 'Recommended. Disable only for apps that do not support it.'}
            checked={input.requirePkce || isPublic}
            disabled={isPublic}
            onChange={(e) => setInput({ ...input, requirePkce: e.target.checked })}
          />
        )}

        {!app && input.clientType === 'confidential' && (
          <Field label="Client secret (optional)" hint="Leave empty to generate a strong secret.">
            <Input value={input.clientSecret ?? ''} onChange={(e) => setInput({ ...input, clientSecret: e.target.value })} />
          </Field>
        )}
      </form>
    </Modal>
  )
}
