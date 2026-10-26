import { readJson } from './http'

// Cookie-authenticated endpoints used by the login, register and consent pages.

export interface CurrentUser {
  isAuthenticated: boolean
  id: string | null
  email: string | null
  name: string | null
  roles: string[]
}

export interface ConsentInfo {
  clientId: string
  applicationName: string
  scopes: { name: string; displayName: string; description: string | null }[]
}

function readCookie(name: string): string {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  // Anti-forgery tokens are bound to the signed-in user, so fetch a fresh one for every call.
  await fetch('/api/account/antiforgery', { credentials: 'same-origin' })
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return readJson<T>(res)
}

const get = async <T>(path: string) => readJson<T>(await fetch(path, { credentials: 'same-origin' }))

export const accountApi = {
  settings: () => get<{ allowRegistration: boolean }>('/api/account/settings'),
  me: () => get<CurrentUser>('/api/account/me'),
  consent: (clientId: string, scope: string) =>
    get<ConsentInfo>(`/api/account/consent?${new URLSearchParams({ client_id: clientId, scope })}`),
  login: (body: { email: string; password: string; rememberMe: boolean; returnUrl: string | null }) =>
    post<{ redirectUrl: string }>('/api/account/login', body),
  register: (body: { email: string; password: string; firstName: string; lastName: string; returnUrl: string | null }) =>
    post<{ redirectUrl: string }>('/api/account/register', body),
  logout: () => post<void>('/api/account/logout'),
}
