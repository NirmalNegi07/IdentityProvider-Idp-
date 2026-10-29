import { useSearchParams } from 'react-router-dom'
import { TabButton } from './ApplicationDetailPage'
import { RolesPage } from './RolesPage'
import { UsersPage } from './UsersPage'

type Tab = 'users' | 'roles'

/** LAHI IDP's own page: its users and roles, kept apart from the applications that sign in through it. */
export function IdpPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'roles' ? 'roles' : 'users'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <img src="/favicon.svg" alt="" className="size-12" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-base-900">LAHI IDP</h1>
          <p className="mt-0.5 text-sm text-base-500">The identity provider: one account per person for every connected application.</p>
        </div>
      </div>

      <div className="mb-5 flex gap-1 border-b border-base-200" role="tablist">
        <TabButton active={tab === 'users'} tour="tab-users" onClick={() => setParams({})}>Users</TabButton>
        <TabButton active={tab === 'roles'} tour="tab-roles" onClick={() => setParams({ tab: 'roles' })}>Roles</TabButton>
      </div>

      {tab === 'users' ? <UsersPage /> : <RolesPage />}
    </>
  )
}
