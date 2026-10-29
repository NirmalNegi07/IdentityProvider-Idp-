import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, ConfirmDialog, Input, LoadingBlock } from '../../components/ui'
import { adminApi, type Role } from '../../lib/adminApi'
import { errorMessage } from '../../lib/http'

/** Roles given to LAHI IDP users. Shown as the Roles tab of the LAHI IDP page. */
export function RolesPage() {
  const [roles, setRoles] = useState<Role[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Role | null>(null)

  const load = useCallback(() => {
    adminApi.roles.list().then(setRoles).catch((err) => setError(errorMessage(err)))
  }, [])
  useEffect(load, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adminApi.roles.create(name)
      setName('')
      load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await adminApi.roles.remove(deleting.id)
      load()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
      setDeleting(null)
    }
  }

  return (
    <>
      <p className="mb-4 max-w-2xl text-sm text-base-600">
        <b>Admin</b> can open this console. Other roles, such as Teacher, are sent in the <code className="text-xs">role</code> claim to applications that ask for the <code className="text-xs">roles</code> scope.
      </p>
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card className="max-w-2xl">
        <form onSubmit={create} className="flex gap-2 border-b border-line p-4">
          <Input placeholder="New role name, e.g. Teacher" value={name} required onChange={(e) => setName(e.target.value)} />
          <Button type="submit" loading={busy && !deleting}>Add</Button>
        </form>
        {!roles ? (
          <LoadingBlock />
        ) : (
          <ul className="divide-y divide-line/70">
            {roles.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex-1 font-medium">{r.name}</span>
                {r.isSystem && <Badge tone="amber">built-in</Badge>}
                <span className="w-20 text-right text-sm text-base-500">{r.userCount} {r.userCount === 1 ? 'user' : 'users'}</span>
                <div className="w-16 text-right">
                  {!r.isSystem && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10" onClick={() => setDeleting(r)}>Delete</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleting}
        title="Delete role"
        message={<>Delete <strong>{deleting?.name}</strong>? It will be removed from {deleting?.userCount} user(s).</>}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}
