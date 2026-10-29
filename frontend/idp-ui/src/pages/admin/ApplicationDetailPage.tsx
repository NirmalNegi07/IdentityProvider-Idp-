import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, ConfirmDialog, CopyField, EmptyState, Field, Input, LoadingBlock, Modal } from '../../components/ui'
import { table } from '../../components/table'
import { adminApi, type Application, type ApplicationUser, type Paged, type User } from '../../lib/adminApi'
import { useApplications } from '../../lib/applications'
import { errorMessage } from '../../lib/http'
import { AppIcon, ApplicationForm, SecretModal } from './ApplicationsPage'

const PAGE_SIZE = 20

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never')
const fullName = (u: { firstName: string | null; lastName: string | null }) => [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'

type Tab = 'users' | 'settings'

export function ApplicationDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'settings' ? 'settings' : 'users'

  const [app, setApp] = useState<Application | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<{ clientId: string; secret: string } | null>(null)
  const [rotating, setRotating] = useState(false)
  const { reload: reloadSidebar } = useApplications()

  const load = useCallback(() => {
    adminApi.applications.get(id).then(setApp).catch((err) => setError(errorMessage(err)))
  }, [id])

  // Refresh this page and the sidebar's name and user count together.
  const refresh = () => {
    load()
    reloadSidebar()
  }
  useEffect(load, [load])

  async function rotate() {
    if (!app) return
    setBusy(true)
    try {
      const res = await adminApi.applications.rotateSecret(app.id)
      setSecret({ clientId: app.clientId, secret: res.clientSecret! })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      setRotating(false)
    }
  }

  async function remove() {
    if (!app) return
    setBusy(true)
    try {
      await adminApi.applications.remove(app.id)
      reloadSidebar()
      navigate('/admin/applications')
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
      setBusy(false)
    }
  }

  if (!app) {
    return (
      <>
        {error ? <Alert>{error}</Alert> : <LoadingBlock />}
      </>
    )
  }

  const name = app.displayName ?? app.clientId
  const signsUsersIn = app.grantTypes.includes('authorization_code')

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <AppIcon name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-base-900">{name}</h1>
            <Badge tone={app.clientType === 'confidential' ? 'brand' : 'neutral'}>{app.clientType}</Badge>
            {app.isSystem && <Badge tone="amber">system</Badge>}
          </div>
          <div className="mt-0.5 font-mono text-xs text-base-500">{app.clientId}</div>
        </div>
        <div className="flex gap-2">
          {app.clientType === 'confidential' && <Button variant="secondary" onClick={() => setRotating(true)}>New secret</Button>}
          <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
          {!app.isSystem && (
            <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300" onClick={() => setDeleting(true)}>Delete</Button>
          )}
        </div>
      </div>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="mb-5 flex gap-1 border-b border-base-200" role="tablist">
        <TabButton active={tab === 'users'} onClick={() => setParams({})}>
          Users {signsUsersIn && <span className="ml-1.5 rounded-full bg-base-100 px-1.5 text-xs tabular-nums text-base-600">{app.userCount}</span>}
        </TabButton>
        <TabButton active={tab === 'settings'} onClick={() => setParams({ tab: 'settings' })}>Settings</TabButton>
      </div>

      {tab === 'users' ? (
        signsUsersIn ? (
          <UsersTab app={app} onChanged={refresh} />
        ) : (
          <Card><EmptyState>This is a service application. It calls APIs as itself and has no users.</EmptyState></Card>
        )
      ) : (
        <SettingsTab app={app} />
      )}

      {editing && (
        <ApplicationForm
          app={app}
          onClose={() => setEditing(false)}
          onSaved={(clientId, newSecret) => {
            setEditing(false)
            if (newSecret) setSecret({ clientId, secret: newSecret })
            refresh()
          }}
        />
      )}

      <SecretModal secret={secret} onClose={() => setSecret(null)} />

      <ConfirmDialog
        open={rotating}
        title="Create a new client secret"
        confirmLabel="Create new secret"
        message={<>The current secret stops working immediately, so sign-in to <strong>{name}</strong> fails until you paste the new secret into {name}&apos;s settings.</>}
        busy={busy}
        onConfirm={rotate}
        onClose={() => setRotating(false)}
      />

      <ConfirmDialog
        open={deleting}
        title="Delete application"
        message={<>Delete <strong>{name}</strong>? Users will no longer be able to sign in to it.</>}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(false)}
      />
    </>
  )
}

export function TabButton({ active, onClick, tour, children }: { active: boolean; onClick: () => void; tour?: string; children: ReactNode }) {
  return (
    <button
      data-tour={tour}
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex items-center border-b-2 px-3 py-2 text-sm font-medium ${active ? 'border-accent-700 text-accent-text' : 'border-transparent text-base-500 hover:text-base-800'}`}
    >
      {children}
    </button>
  )
}

function UsersTab({ app, onChanged }: { app: Application; onChanged: () => void }) {
  const [data, setData] = useState<Paged<ApplicationUser> | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [revoking, setRevoking] = useState<ApplicationUser | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminApi.applications.users(app.id, { search: query, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err)))
  }, [app.id, query, page])
  useEffect(load, [load])

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setQuery(search)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      load()
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function revoke() {
    if (!revoking) return
    setBusy(true)
    await run(() => adminApi.applications.revokeUser(app.id, revoking.id))
    setBusy(false)
    setRevoking(null)
  }

  const name = app.displayName ?? app.clientId
  const approvedOnly = app.consentType === 'external'
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Input type="search" placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <p className="flex-1 text-xs text-base-500">
            {approvedOnly
              ? `Only users added here can sign in to ${name}.`
              : `Users appear here after their first sign-in to ${name}. You can also add them in advance.`}
          </p>
          <Button onClick={() => setAdding(true)}>Add user</Button>
        </div>
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>{query ? 'No users match your search.' : `No one has signed in to ${name} yet.`}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={table.head}>
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="hidden px-5 py-3 md:table-cell">First access</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Last used</th>
                  <th className="px-5 py-3">Access</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className={table.body}>
                {data.items.map((u) => (
                  <tr key={u.id} className={table.row}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        {fullName(u)}
                      </div>
                      <div className="text-xs text-base-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => <Badge key={r} tone={r === 'Admin' ? 'brand' : 'neutral'}>{r}</Badge>)}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-base-500 md:table-cell">{formatDate(u.firstAccessAt)}</td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-base-500 lg:table-cell">{formatDate(u.lastUsedAt)}</td>
                    <td className="px-5 py-3">
                      {u.isLockedOut ? (
                        <Badge tone="red">Account locked</Badge>
                      ) : u.hasAccess ? (
                        <Badge tone="green">Has access</Badge>
                      ) : (
                        <Badge tone="amber">Access removed</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      {u.hasAccess ? (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setRevoking(u)}>Remove access</Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => run(() => adminApi.applications.grantUser(app.id, u.id))}>Restore access</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-base-500">
            <span>{data.total} users · page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {adding && (
        <AddUserModal
          appName={name}
          onClose={() => setAdding(false)}
          onAdd={async (userId) => {
            await adminApi.applications.grantUser(app.id, userId)
            load()
            onChanged()
          }}
        />
      )}

      <ConfirmDialog
        open={!!revoking}
        title="Remove access"
        confirmLabel="Remove access"
        message={
          <>
            Remove <strong>{revoking?.email}</strong>&apos;s access to {name}? Their LAHI IDP tokens for {name} stop working. A session {name} already started
            lasts until {name} ends it.
            {approvedOnly
              ? ' They will not be able to sign in again until you restore access.'
              : ' They can still sign in again, because this app lets any LAHI IDP user in. Set “Who can sign in” to approved users only to stop that.'}
          </>
        }
        busy={busy}
        onConfirm={revoke}
        onClose={() => setRevoking(null)}
      />
    </>
  )
}

function AddUserModal({ appName, onClose, onAdd }: { appName: string; onClose: () => void; onAdd: (userId: string) => Promise<void> }) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  return (
    <Modal open title={`Add users to ${appName}`} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Done</Button>}>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-base-100 p-1" role="tablist">
        {(['existing', 'new'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${mode === m ? 'bg-surface text-base-900 shadow-sm' : 'text-base-500 hover:text-base-800'}`}
          >
            {m === 'existing' ? 'Existing user' : 'New user'}
          </button>
        ))}
      </div>
      {mode === 'existing' ? <ExistingUserPicker onAdd={onAdd} /> : <NewUserForm appName={appName} onAdd={onAdd} />}
    </Modal>
  )
}

function ExistingUserPicker({ onAdd }: { onAdd: (userId: string) => Promise<void> }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<User[] | null>(null)
  const [added, setAdded] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      adminApi.users.list({ search, page: 1, pageSize: 8 }).then((r) => setResults(r.items)).catch((err) => setError(errorMessage(err)))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  async function add(user: User) {
    setError(null)
    try {
      await onAdd(user.id)
      setAdded((a) => [...a, user.id])
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <>
      <p className="text-sm text-base-600">Give someone who already has a LAHI IDP account access to this application.</p>
      {error && <Alert>{error}</Alert>}
      <Input id="add-user-search" type="search" autoFocus placeholder="Search LAHI IDP users by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {!results ? (
        <LoadingBlock />
      ) : results.length === 0 ? (
        <p className="py-4 text-center text-sm text-base-500">No users found. Use “New user” to create one.</p>
      ) : (
        <ul className="divide-y divide-line/70 rounded-md ring-1 ring-base-200">
          {results.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{fullName(u)}</div>
                <div className="truncate text-xs text-base-500">{u.email}</div>
              </div>
              {added.includes(u.id) ? (
                <Badge tone="green">Added</Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => add(u)}>Add</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function NewUserForm({ appName, onAdd }: { appName: string; onAdd: (userId: string) => Promise<void> }) {
  const empty = { firstName: '', lastName: '', email: '', password: '' }
  const [form, setForm] = useState(empty)
  const [created, setCreated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await adminApi.users.create({ ...form, emailConfirmed: true, roles: ['User'] })
      await onAdd(user.id)
      setCreated(user.email)
      setForm(empty)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-base-600">
        Creates a LAHI IDP account and gives it access to {appName}. The same account can be added to other applications later.
      </p>
      {created && <Alert kind="success">Created {created} and added them to {appName}.</Alert>}
      {error && <Alert>{error}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><Input id="new-user-first-name" value={form.firstName} onChange={set('firstName')} /></Field>
        <Field label="Last name"><Input id="new-user-last-name" value={form.lastName} onChange={set('lastName')} /></Field>
      </div>
      <Field label="Email"><Input id="new-user-email" type="email" required value={form.email} onChange={set('email')} /></Field>
      <Field label="Password" hint="At least 8 characters, with upper and lower case letters and a number.">
        <Input id="new-user-password" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>Create and add to {appName}</Button>
    </form>
  )
}

function SettingsTab({ app }: { app: Application }) {
  const consent: Record<Application['consentType'], string> = {
    implicit: 'No consent screen (first-party app)',
    explicit: 'Ask once, remember the answer',
    systematic: 'Ask every time',
    external: 'Approved users only',
  }
  return (
    <Card className="p-5">
      <dl className="grid gap-5 md:grid-cols-2">
        <Setting label="Client ID"><CopyField value={app.clientId} /></Setting>
        <Setting label="Client type">
          {app.clientType === 'confidential' ? 'Confidential: runs on a server and signs in with a client secret' : 'Public: runs in the browser or on a device, uses PKCE'}
        </Setting>
        <Setting label="Who can sign in">{consent[app.consentType]}</Setting>
        <Setting label="PKCE">{app.requirePkce ? 'Required' : 'Not required'}</Setting>
        <Setting label="Grant types"><List items={app.grantTypes} /></Setting>
        <Setting label="Allowed scopes"><List items={app.scopes} /></Setting>
        <Setting label="Redirect URIs"><List items={app.redirectUris} mono /></Setting>
        <Setting label="Post-logout redirect URIs"><List items={app.postLogoutRedirectUris} mono /></Setting>
      </dl>
    </Card>
  )
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-base-500">{label}</dt>
      <dd className="text-sm text-base-800">{children}</dd>
    </div>
  )
}

function List({ items, mono }: { items: string[]; mono?: boolean }) {
  if (items.length === 0) return <span className="text-base-400">None</span>
  return (
    <ul className="space-y-0.5">
      {items.map((i) => <li key={i} className={mono ? 'break-all font-mono text-xs' : undefined}>{i}</li>)}
    </ul>
  )
}
