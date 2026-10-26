# IDP frontend (idp-ui)

React 19 + Vite + Tailwind. It contains:

| Route | What |
|---|---|
| `/login`, `/register` | Sign-in and self-registration. These continue the OIDC flow via `returnUrl`. |
| `/consent` | Consent screen for apps configured with explicit or systematic consent |
| `/` | Shows who is signed in to the IDP session |
| `/admin/*` | Admin console: applications, scopes, users, roles. Signs in through the IDP as the OIDC client `idp-admin`. |

## Develop

Start the backend first (`backend/src/Idp.Server`, `dotnet run` → `http://localhost:5000`), then:

```bash
npm install
npm run dev        # http://localhost:5173 with hot reload
```

The dev server proxies `/api`, `/connect` and `/.well-known` to the backend (see `vite.config.ts`). This lets the browser treat UI and backend as one origin, which the session cookie and OIDC redirects require. To point at a backend elsewhere, create `.env.local` with:

```
IDP_BACKEND_URL=http://localhost:5000
```

## Build and deploy

```bash
npm run build      # type-checks, then writes static files to dist/
```

Serve `dist/` from the same domain as the backend: nginx or IIS serves the files and proxies the three backend paths. All other routes must fall back to `index.html`. See the nginx example in the [root README](../../README.md#production-deployment-no-containers).

`npm run preview` serves the production build locally on port 5173, with the same proxy.

## Code map

| Path | What |
|---|---|
| `src/lib/accountApi.ts` | Cookie + anti-forgery calls to `/api/account/*` (login, register, consent) |
| `src/lib/adminApi.ts` | Bearer-token calls to `/api/admin/*` |
| `src/lib/oidc.ts` | `oidc-client-ts` configuration for the admin console |
| `src/pages/auth/` | Login, register, consent and home pages |
| `src/pages/admin/` | Admin console pages |
| `src/components/ui.tsx` | Shared UI primitives (buttons, fields, modals, …) |
