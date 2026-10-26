import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

/**
 * The admin console signs in through this IDP like any other app:
 * a public client using the authorization code flow with PKCE.
 */
export const adminUserManager = new UserManager({
  authority: window.location.origin,
  client_id: 'idp-admin',
  redirect_uri: `${window.location.origin}/admin/callback`,
  post_logout_redirect_uri: `${window.location.origin}/admin`,
  response_type: 'code',
  scope: 'openid profile email roles offline_access idp_admin_api',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
})

export function hasRole(profile: object | undefined, role: string): boolean {
  const roles = (profile as { role?: unknown } | undefined)?.role
  return Array.isArray(roles) ? roles.includes(role) : roles === role
}
