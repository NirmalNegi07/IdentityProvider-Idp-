import { readJson } from './http'
import { adminUserManager } from './oidc'

// Bearer-token endpoints of the admin API (/api/admin/*).

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface Application {
  id: string
  clientId: string
  displayName: string | null
  clientType: 'public' | 'confidential'
  consentType: 'implicit' | 'explicit' | 'external' | 'systematic'
  redirectUris: string[]
  postLogoutRedirectUris: string[]
  grantTypes: string[]
  scopes: string[]
  requirePkce: boolean
  isSystem: boolean
  /** Users who currently have access to this application. */
  userCount: number
}

export type ApplicationInput = Omit<Application, 'id' | 'isSystem' | 'userCount'> & { clientSecret?: string | null }

/** A user as seen from one application. */
export interface ApplicationUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  roles: string[]
  isLockedOut: boolean
  hasAccess: boolean
  firstAccessAt: string | null
  lastUsedAt: string | null
}

export interface ApplicationWithSecret {
  application: Application
  clientSecret: string | null
}

export interface Scope {
  id: string
  name: string
  displayName: string | null
  description: string | null
  resources: string[]
  isSystem: boolean
}

export type ScopeInput = Omit<Scope, 'id' | 'isSystem'>

export interface User {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  emailConfirmed: boolean
  isLockedOut: boolean
  roles: string[]
  createdAt: string
  lastLoginAt: string | null
}

export interface UserInput {
  email: string
  firstName: string
  lastName: string
  emailConfirmed: boolean
  roles: string[]
  password?: string
}

export interface Role {
  id: string
  name: string
  userCount: number
  isSystem: boolean
}

export interface Stats {
  users: number
  applications: number
  scopes: number
  roles: number
  lockedUsers: number
  newUsersLast7Days: number
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const user = await adminUserManager.getUser()
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${user?.access_token ?? ''}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return readJson<T>(res)
}

export const adminApi = {
  stats: () => request<Stats>('GET', '/stats'),

  applications: {
    list: () => request<Application[]>('GET', '/applications'),
    get: (id: string) => request<Application>('GET', `/applications/${id}`),
    create: (input: ApplicationInput) => request<ApplicationWithSecret>('POST', '/applications', input),
    update: (id: string, input: ApplicationInput) => request<ApplicationWithSecret>('PUT', `/applications/${id}`, input),
    rotateSecret: (id: string) => request<ApplicationWithSecret>('POST', `/applications/${id}/rotate-secret`),
    remove: (id: string) => request<void>('DELETE', `/applications/${id}`),
    users: (id: string, params: { search?: string; page: number; pageSize: number }) =>
      request<Paged<ApplicationUser>>(
        'GET',
        `/applications/${id}/users?${new URLSearchParams({ search: params.search ?? '', page: String(params.page), pageSize: String(params.pageSize) })}`,
      ),
    grantUser: (id: string, userId: string) => request<void>('POST', `/applications/${id}/users`, { userId }),
    revokeUser: (id: string, userId: string) => request<void>('DELETE', `/applications/${id}/users/${userId}`),
  },

  scopes: {
    list: () => request<Scope[]>('GET', '/scopes'),
    names: () => request<string[]>('GET', '/scopes/names'),
    create: (input: ScopeInput) => request<Scope>('POST', '/scopes', input),
    update: (id: string, input: ScopeInput) => request<Scope>('PUT', `/scopes/${id}`, input),
    remove: (id: string) => request<void>('DELETE', `/scopes/${id}`),
  },

  users: {
    list: (params: { search?: string; page: number; pageSize: number }) =>
      request<Paged<User>>(
        'GET',
        `/users?${new URLSearchParams({ search: params.search ?? '', page: String(params.page), pageSize: String(params.pageSize) })}`,
      ),
    create: (input: UserInput) => request<User>('POST', '/users', input),
    update: (id: string, input: UserInput) => request<User>('PUT', `/users/${id}`, input),
    setPassword: (id: string, password: string) => request<void>('POST', `/users/${id}/password`, { password }),
    lock: (id: string) => request<User>('POST', `/users/${id}/lock`),
    unlock: (id: string) => request<User>('POST', `/users/${id}/unlock`),
    remove: (id: string) => request<void>('DELETE', `/users/${id}`),
  },

  roles: {
    list: () => request<Role[]>('GET', '/roles'),
    create: (name: string) => request<Role>('POST', '/roles', { name }),
    remove: (id: string) => request<void>('DELETE', `/roles/${id}`),
  },
}
