import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal } from '../../components/ui'
import { table } from '../../components/table'
import { adminApi, type Application, type Paged, type Role, type User, type UserInput } from '../../lib/adminApi'
import { useApplications } from '../../lib/applications'
import { errorMessage } from '../../lib/http'
import { productApps } from '../../lib/setup'
import { AppIcon } from './ApplicationsPage'

const PAGE_SIZE = 20

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never')

/** All LAHI IDP accounts. Shown as the Users tab of the LAHI IDP page. */
export function UsersPage() {
  const auth = useAuth()
  const currentUserId = auth.user?.profile.sub
  const { apps, reload: reloadApps } = useApplications()
  const products = productApps(apps)
  const [roles, setRoles] = useState<Role[]>([])
  const [data, setData] = useState<Paged<User> | null>(null)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [passwordFor, setPasswordFor] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminApi.users.list({ search: query, page, pageSize: PAGE_SIZE }).then(setData).catch((err) => setError(errorMessage(err)))
  }, [query, page])
  useEffect(load, [load])
  useEffect(() => {
    adminApi.roles.list().then(setRoles).catch(() => {})
  }, [])

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
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    await run(() => adminApi.users.remove(deleting.id))
    setBusy(false)
    setDeleting(null)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Input id="users-search" type="search" placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <p className="flex-1 text-xs text-base-500">Everyone with a LAHI IDP account, and the applications each person belongs to.</p>
          <Button data-tour="add-user" onClick={() => setEditing('new')}>Add user</Button>
        </div>
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>No users found.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={table.head}>
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Applications</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Last sign-in</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className={table.body}>
                {data.items.map((u, i) => (
                  <tr key={u.id} className={table.row}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 font-medium">
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                      </div>
                      <div className="text-xs text-base-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <AppChips apps={products.filter((a) => u.applicationIds?.includes(a.id))} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => <Badge key={r} tone={r === 'Admin' ? 'brand' : 'neutral'}>{r}</Badge>)}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-base-500 lg:table-cell">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-5 py-3">
                      {u.isLockedOut ? <Badge tone="red">Locked</Badge> : <Badge tone="green">Active</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="inline-flex gap-1.5" data-tour={i === 0 ? 'user-actions' : undefined}>
                        <Button variant="secondary" size="sm" onClick={() => setEditing(u)}>Edit</Button>
                        <Button variant="secondary" size="sm" onClick={() => setPasswordFor(u)}>Password</Button>
                        {u.id !== currentUserId &&
                          (u.isLockedOut ? (
                            <Button variant="secondary" size="sm" onClick={() => run(() => adminApi.users.unlock(u.id))}>Unlock</Button>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={() => run(() => adminApi.users.lock(u.id))}>Lock</Button>
                          ))}
                        {u.id !== currentUserId && (
                          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setDeleting(u)}>Delete</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm text-base-500">
            <span>
              {data.total} users · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      {editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          products={products}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
            reloadApps()
          }}
        />
      )}

      {passwordFor && <PasswordForm user={passwordFor} onClose={() => setPasswordFor(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title="Delete user"
        message={<>Delete <strong>{deleting?.email}</strong>? They can no longer sign in to any application. Sessions an app already started, such as in Moodle, last until that app ends them. This cannot be undone.</>}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function AppChips({ apps }: { apps: Application[] }) {
  if (apps.length === 0) return <span className="text-xs text-base-400">None yet</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {apps.map((a) => {
        const name = a.displayName ?? a.clientId
        return (
          <span key={a.id} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface py-0.5 pr-2 pl-1 text-xs font-medium">
            <AppIcon name={name} size="xs" />
            {name}
          </span>
        )
      })}
    </div>
  )
}

const accessHint = (app: Application) =>
  app.consentType === 'external'
    ? 'Only people ticked here can sign in to it.'
    : 'Anyone with a LAHI IDP account can sign in to it. Ticking adds them to its list now.'

function UserForm({ user, products, roles, onClose, onSaved }: { user: User | null; products: Application[]; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const auth = useAuth()
  const isSelf = user?.id === auth.user?.profile.sub
  const [input, setInput] = useState<UserInput>(() => ({
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    emailConfirmed: user?.emailConfirmed ?? true,
    roles: user?.roles ?? ['User'],
    password: '',
  }))
  const initialApps = products.filter((a) => user?.applicationIds?.includes(a.id)).map((a) => a.id)
  const [appIds, setAppIds] = useState<string[]>(initialApps)
  // Once the account exists, a retry after a failed app change must update it, not create it again.
  const [savedId, setSavedId] = useState<string | null>(user?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const saved = savedId ? await adminApi.users.update(savedId, input) : await adminApi.users.create(input)
      setSavedId(saved.id)
      for (const id of appIds.filter((a) => !initialApps.includes(a))) await adminApi.applications.grantUser(id, saved.id)
      for (const id of initialApps.filter((a) => !appIds.includes(a))) await adminApi.applications.revokeUser(id, saved.id)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const toggleRole = (name: string) =>
    setInput((i) => ({ ...i, roles: i.roles.includes(name) ? i.roles.filter((r) => r !== name) : [...i.roles, name] }))
  const roleHint = (name: string) =>
    name === 'Admin'
      ? isSelf ? 'Can open this admin console. You can\'t remove it from your own account.' : 'Can open this admin console. Only for people who manage LAHI IDP.'
      : name === 'User'
        ? 'Default role for everyone.'
        : 'Sent to applications that ask for roles.'

  const toggleApp = (id: string) => setAppIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]))

  return (
    <Modal
      open
      title={user ? `Edit ${user.email}` : 'Add user'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={busy}>{user ? 'Save' : 'Create user'}</Button>
        </>
      }
    >
      <form id="user-form" className="space-y-5" onSubmit={submit}>
        {!user && (
          <p className="text-sm text-base-600">
            This creates one LAHI IDP account. Choose below which applications the person belongs to.
          </p>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input id="user-first-name" value={input.firstName} onChange={(e) => setInput({ ...input, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input id="user-last-name" value={input.lastName} onChange={(e) => setInput({ ...input, lastName: e.target.value })} />
          </Field>
        </div>
        <Field label="Email">
          <Input id="user-email" type="email" required value={input.email} onChange={(e) => setInput({ ...input, email: e.target.value })} />
        </Field>
        {!user && (
          <Field label="Password" hint="At least 8 characters, with upper and lower case letters and a number.">
            <Input id="user-password" type="password" required autoComplete="new-password" value={input.password} onChange={(e) => setInput({ ...input, password: e.target.value })} />
          </Field>
        )}

        <fieldset className="rounded-lg border border-line p-3.5">
          <legend className="px-1 text-sm font-semibold text-base-800">Applications</legend>
          {products.length === 0 ? (
            <p className="text-sm text-base-500">No applications yet. Add one under Applications first.</p>
          ) : (
            <div className="space-y-3">
              {products.map((a) => {
                const name = a.displayName ?? a.clientId
                return (
                  <Checkbox
                    key={a.id}
                    id={`user-app-${a.id}`}
                    label={<span className="inline-flex items-center gap-1.5"><AppIcon name={name} size="xs" />{name}</span>}
                    description={accessHint(a)}
                    checked={appIds.includes(a.id)}
                    onChange={() => toggleApp(a.id)}
                  />
                )
              })}
            </div>
          )}
        </fieldset>

        <fieldset className="rounded-lg border border-line p-3.5">
          <legend className="px-1 text-sm font-semibold text-base-800">Roles</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((r) => (
              <Checkbox
                key={r.id}
                id={`user-role-${r.id}`}
                label={r.name}
                description={roleHint(r.name)}
                checked={input.roles.includes(r.name)}
                disabled={isSelf && r.name === 'Admin'}
                onChange={() => toggleRole(r.name)}
              />
            ))}
          </div>
        </fieldset>

        <Checkbox id="user-email-confirmed" label="Email confirmed" checked={input.emailConfirmed} onChange={(e) => setInput({ ...input, emailConfirmed: e.target.checked })} />
      </form>
    </Modal>
  )
}

function PasswordForm({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminApi.users.setPassword(user.id, password)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={`Set password for ${user.email}`}
      onClose={onClose}
      footer={
        done ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="password-form" loading={busy}>Set password</Button>
          </>
        )
      }
    >
      {done ? (
        <Alert kind="success">Password updated. The user must sign in to LAHI IDP again with the new password.</Alert>
      ) : (
        <form id="password-form" className="space-y-4" onSubmit={submit}>
          {error && <Alert>{error}</Alert>}
          <Field label="New password">
            <Input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </form>
      )}
    </Modal>
  )
}
