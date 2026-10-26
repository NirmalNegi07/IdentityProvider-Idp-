import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, linesToList, LoadingBlock, Modal, PageHeader, Textarea } from '../../components/ui'
import { table } from '../../components/table'
import { adminApi, type Scope, type ScopeInput } from '../../lib/adminApi'
import { errorMessage } from '../../lib/http'

export function ScopesPage() {
  const [scopes, setScopes] = useState<Scope[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Scope | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Scope | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    adminApi.scopes.list().then(setScopes).catch((err) => setError(errorMessage(err)))
  }, [])
  useEffect(load, [load])

  async function remove() {
    if (!deleting) return
    setBusy(true)
    try {
      await adminApi.scopes.remove(deleting.id)
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
        title="Scopes"
        description={
          <>
            Custom scopes protect your APIs. The scope&apos;s <em>resources</em> become the <code className="text-xs">aud</code> claim of
            access tokens, which the API checks. Built-in: <code className="text-xs">openid profile email roles offline_access</code>.
          </>
        }
        actions={<Button onClick={() => setEditing('new')}>Add scope</Button>}
      />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <Card>
        {!scopes ? (
          <LoadingBlock />
        ) : scopes.length === 0 ? (
          <EmptyState>No custom scopes yet.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <thead className={table.head}>
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="hidden px-5 py-3 md:table-cell">Description</th>
                <th className="px-5 py-3">Resources (audience)</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className={table.body}>
              {scopes.map((s) => (
                <tr key={s.id} className={table.row}>
                  <td className="px-5 py-3">
                    <div className="font-mono text-xs font-medium">{s.name}</div>
                    <div className="text-xs text-stone-500">{s.displayName}</div>
                  </td>
                  <td className="hidden px-5 py-3 text-stone-600 md:table-cell">{s.description}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">{s.resources.map((r) => <Badge key={r}>{r}</Badge>)}</div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>Edit</Button>
                    {!s.isSystem && (
                      <Button variant="ghost" size="sm" className="ml-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting(s)}>Delete</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {editing && (
        <ScopeForm
          scope={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete scope"
        message={<>Delete <strong>{deleting?.name}</strong>? Applications that request it will get an <code>invalid_scope</code> error.</>}
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </>
  )
}

function ScopeForm({ scope, onClose, onSaved }: { scope: Scope | null; onClose: () => void; onSaved: () => void }) {
  const [input, setInput] = useState<ScopeInput>(() => scope ?? { name: '', displayName: '', description: '', resources: [] })
  const [resources, setResources] = useState((scope?.resources ?? []).join('\n'))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const body = { ...input, resources: linesToList(resources) }
    try {
      if (scope) await adminApi.scopes.update(scope.id, body)
      else await adminApi.scopes.create(body)
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      title={scope ? `Edit ${scope.name}` : 'Add scope'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="scope-form" loading={busy}>Save</Button>
        </>
      }
    >
      <form id="scope-form" className="space-y-4" onSubmit={submit}>
        {error && <Alert>{error}</Alert>}
        <Field label="Name" hint="What clients request, e.g. courses_api">
          <Input required className="font-mono" disabled={scope?.isSystem} value={input.name} onChange={(e) => setInput({ ...input, name: e.target.value })} />
        </Field>
        <Field label="Display name" hint="Shown on the consent screen.">
          <Input value={input.displayName ?? ''} onChange={(e) => setInput({ ...input, displayName: e.target.value })} />
        </Field>
        <Field label="Description">
          <Input value={input.description ?? ''} onChange={(e) => setInput({ ...input, description: e.target.value })} />
        </Field>
        <Field label="Resources" hint="One per line. Becomes the token audience, e.g. courses-api">
          <Textarea rows={3} value={resources} onChange={(e) => setResources(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}
