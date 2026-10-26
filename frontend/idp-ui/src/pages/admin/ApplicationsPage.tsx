import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
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
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Application | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Application | null>(null)
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<{ clientId: string; secret: string } | null>(null)

  const load = useCallback(() => {
    adminApi.applications.list().then(setApps).catch((err) => setError(errorMessage(err)))
  }, [])
  useEffect(load, [load])

  async function rotate(app: Application) {
    try {
      const res = await adminApi.applications.rotateSecret(app.id)
      setSecret({ clientId: app.clientId, secret: res.clientSecret! })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await adminApi.applications.remove(deleting.id)
      setDeleting(null)
      load()
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description="Client applications that sign users in through this IDP (Moodle, React and Express apps, APIs…)."
        actions={<Button onClick={() => setEditing('new')}>Add application</Button>}
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        {!apps ? (
          <LoadingBlock />
        ) : apps.length === 0 ? (
          <EmptyState>No applications yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {apps.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{app.displayName ?? app.clientId}</span>
                    <Badge tone={app.clientType === 'confidential' ? 'indigo' : 'slate'}>{app.clientType}</Badge>
                    {app.isSystem && <Badge tone="amber">system</Badge>}
                  </div>
                  <div className="mt-1 font-mono text-xs text-slate-500">{app.clientId}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">
                    {app.grantTypes.join(', ')} · {app.redirectUris[0] ?? 'no redirect URI'}
                    {app.redirectUris.length > 1 && ` (+${app.redirectUris.length - 1})`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {app.clientType === 'confidential' && (
                    <Button variant="secondary" size="sm" onClick={() => rotate(app)}>New secret</Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setEditing(app)}>Edit</Button>
                  {!app.isSystem && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setDeleting(app)}>
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <ApplicationForm
          app={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(clientId, newSecret) => {
            setEditing(null)
            if (newSecret) setSecret({ clientId, secret: newSecret })
            load()
          }}
        />
      )}

      <Modal open={!!secret} title="Client secret" onClose={() => setSecret(null)} footer={<Button onClick={() => setSecret(null)}>Done</Button>}>
        <Alert kind="warning">Copy this secret now. It is stored hashed and will not be shown again.</Alert>
        <Field label="Client ID"><CopyField value={secret?.clientId ?? ''} /></Field>
        <Field label="Client secret"><CopyField value={secret?.secret ?? ''} /></Field>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete application"
        message={<>Delete <strong>{deleting?.displayName ?? deleting?.clientId}</strong>? Users will no longer be able to sign in to it.</>}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function ApplicationForm({
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
            <div className="mb-2 text-sm font-medium text-slate-700">Start from a template</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className="rounded-md p-2.5 text-left ring-1 ring-slate-200 hover:bg-indigo-50 hover:ring-indigo-300"
                >
                  <div className="text-sm font-medium">{p.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{p.description}</div>
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
          <legend className="mb-2 text-sm font-medium text-slate-700">Grant types</legend>
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
          <legend className="mb-2 text-sm font-medium text-slate-700">Allowed scopes</legend>
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
