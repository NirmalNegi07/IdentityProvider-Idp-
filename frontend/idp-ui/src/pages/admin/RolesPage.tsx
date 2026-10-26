import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, ConfirmDialog, Input, LoadingBlock, PageHeader } from '../../components/ui'
import { adminApi, type Role } from '../../lib/adminApi'
import { errorMessage } from '../../lib/http'

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
      <PageHeader
        title="Roles"
        description={<>Roles are sent to applications in the <code className="text-xs">role</code> claim when they request the <code className="text-xs">roles</code> scope.</>}
      />
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
                <span className="w-20 text-right text-sm text-stone-500">{r.userCount} {r.userCount === 1 ? 'user' : 'users'}</span>
                <div className="w-16 text-right">
                  {!r.isSystem && (
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => setDeleting(r)}>Delete</Button>
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
