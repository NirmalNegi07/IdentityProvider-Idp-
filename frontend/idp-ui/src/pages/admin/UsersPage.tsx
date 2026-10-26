import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from 'react-oidc-context'
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, PageHeader } from '../../components/ui'
import { adminApi, type Paged, type Role, type User, type UserInput } from '../../lib/adminApi'
import { errorMessage } from '../../lib/http'

const PAGE_SIZE = 20

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Never')

export function UsersPage() {
  const auth = useAuth()
  const currentUserId = auth.user?.profile.sub
  const [data, setData] = useState<Paged<User> | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
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
      <PageHeader
        title="Users"
        description="Accounts that can sign in to every connected application."
        actions={<Button onClick={() => setEditing('new')}>Add user</Button>}
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        <div className="border-b border-slate-200 p-4">
          <Input type="search" placeholder="Search by email or name…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        </div>
        {!data ? (
          <LoadingBlock />
        ) : data.items.length === 0 ? (
          <EmptyState>No users found.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Last sign-in</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => <Badge key={r} tone={r === 'Admin' ? 'indigo' : 'slate'}>{r}</Badge>)}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3 text-slate-500 lg:table-cell">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-5 py-3">
                      {u.isLockedOut ? <Badge tone="red">Locked</Badge> : <Badge tone="green">Active</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setEditing(u)}>Edit</Button>
                        <Button variant="secondary" size="sm" onClick={() => setPasswordFor(u)}>Password</Button>
                        {u.id !== currentUserId &&
                          (u.isLockedOut ? (
                            <Button variant="secondary" size="sm" onClick={() => run(() => adminApi.users.unlock(u.id))}>Unlock</Button>
                          ) : (
                            <Button variant="secondary" size="sm" onClick={() => run(() => adminApi.users.lock(u.id))}>Lock</Button>
                          ))}
                        {u.id !== currentUserId && (
                          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(u)}>Delete</Button>
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
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
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
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      {passwordFor && <PasswordForm user={passwordFor} onClose={() => setPasswordFor(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title="Delete user"
        message={<>Delete <strong>{deleting?.email}</strong>? They will be signed out of all applications. This cannot be undone.</>}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function UserForm({ user, roles, onClose, onSaved }: { user: User | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const [input, setInput] = useState<UserInput>(() => ({
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    emailConfirmed: user?.emailConfirmed ?? true,
    roles: user?.roles ?? ['User'],
    password: '',
  }))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (user) await adminApi.users.update(user.id, input)
      else await adminApi.users.create(input)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const toggleRole = (name: string) =>
    setInput((i) => ({ ...i, roles: i.roles.includes(name) ? i.roles.filter((r) => r !== name) : [...i.roles, name] }))

  return (
    <Modal
      open
      title={user ? 'Edit user' : 'Add user'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={busy}>Save</Button>
        </>
      }
    >
      <form id="user-form" className="space-y-4" onSubmit={submit}>
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input value={input.firstName} onChange={(e) => setInput({ ...input, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={input.lastName} onChange={(e) => setInput({ ...input, lastName: e.target.value })} />
          </Field>
        </div>
        <Field label="Email">
          <Input type="email" required value={input.email} onChange={(e) => setInput({ ...input, email: e.target.value })} />
        </Field>
        {!user && (
          <Field label="Password" hint="At least 8 characters, with upper and lower case letters and a number.">
            <Input type="password" required autoComplete="new-password" value={input.password} onChange={(e) => setInput({ ...input, password: e.target.value })} />
          </Field>
        )}
        <Checkbox label="Email confirmed" checked={input.emailConfirmed} onChange={(e) => setInput({ ...input, emailConfirmed: e.target.checked })} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Roles</legend>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r) => (
              <Checkbox key={r.id} label={r.name} checked={input.roles.includes(r.name)} onChange={() => toggleRole(r.name)} />
            ))}
          </div>
        </fieldset>
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
        <Alert kind="success">Password updated. The user has been signed out of all applications.</Alert>
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
