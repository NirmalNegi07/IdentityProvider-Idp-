# Identity Provider (IDP)

A central OpenID Connect / OAuth 2.0 identity provider. Users sign in once and get single sign-on across every connected application (first targets: Moodle, a React SPA, and an Express app).

- **backend/**: ASP.NET Core (.NET 10) + OpenIddict 7 + MySQL. A pure API and OIDC server, with no UI.
- **frontend/**: React + Vite. The login, register and consent pages, plus the admin console.

## Repository layout

```
IDP/
├── backend/                     → see backend/README.md
│   ├── Idp.slnx, nuget.config, dotnet-tools.json
│   └── src/Idp.Server/          OIDC endpoints, account API, admin API, EF Core (MySQL)
├── frontend/                    → see frontend/idp-ui/README.md
│   └── idp-ui/                  Vite app, builds to frontend/idp-ui/dist
└── README.md                    (this file: architecture, setup, connecting apps, deployment)
```

## How the two parts fit together

The frontend and backend are separate apps, but **the browser must see them on a single origin**. The login pages depend on the IDP session cookie, and OIDC redirects such as `/login` and `/consent` are relative paths. So the backend's paths are proxied under the frontend's origin:

```
                    ┌──────────────── one public origin ────────────────┐
 Local:  browser ─▶ │ Vite dev server  http://localhost:5173            │
 Prod:   browser ─▶ │ nginx / IIS      https://auth.example.com         │
                    │   /                → React app (frontend)         │
                    │   /api/*           ┐                              │
                    │   /connect/*       ├→ Idp.Server (backend) ──────▶│──▶ MySQL
                    │   /.well-known/*   ┘                              │
                    └───────────────────────────────────────────────────┘
```

| | Local development | Production |
|---|---|---|
| Public URL (issuer) | `http://localhost:5173` | `https://<your domain>` |
| Frontend | Vite dev server (hot reload) | static files from `dist/`, served by nginx or IIS |
| Backend | `http://localhost:5000` | Kestrel on `http://localhost:5000`, reached only through the proxy |
| HTTPS | not used | required; TLS ends at nginx or IIS |

Plain HTTP is allowed **only** when `ASPNETCORE_ENVIRONMENT=Development`. In production the backend rejects non-HTTPS requests and marks every cookie `Secure`.

The admin console is itself an OIDC client of the IDP. It is the public client `idp-admin` and uses PKCE. It calls `/api/admin/*` with access tokens for the audience `idp-admin-api`.

## Local setup

Prerequisites: .NET 10 SDK, Node.js 20.19+ (22 recommended), MySQL 8.

```bash
# Terminal 1: backend
cd backend/src/Idp.Server
cp .env.example .env      # set DB_USER / DB_PASSWORD and ADMIN_EMAIL / ADMIN_PASSWORD
dotnet run                # http://localhost:5000; creates the DB, applies migrations, seeds the admin

# Terminal 2: frontend
cd frontend/idp-ui
npm install
npm run dev               # http://localhost:5173
```

Open **http://localhost:5173/admin** and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Always use port 5173 in the browser and in client apps, never 5000.

## Connecting applications

Create each application in **Admin → Applications → Add application**. The templates (Moodle, React SPA, Express web app, machine-to-machine) pre-fill sensible settings. For a confidential client the secret is shown **once**; use **New secret** to rotate it.

Apps only need the **issuer URL**: `http://localhost:5173` locally, your `https://` domain in production. Everything else is discovered from `/.well-known/openid-configuration`.

Claims in tokens and from `/connect/userinfo`, by scope:

| Scope | Claims |
|---|---|
| *(always)* | `sub` |
| `profile` | `name`, `given_name`, `family_name`, `preferred_username` |
| `email` | `email`, `email_verified` |
| `roles` | `role` (array) |

Add the `offline_access` scope to receive refresh tokens.

### Moodle (4.x)

1. In the IDP admin, add an application from the **Moodle** template:
   - Confidential client.
   - Redirect URI `<moodle-url>/admin/oauth2callback.php`.
   - PKCE off, because Moodle does not send it.
   - Consent *Implicit*.
2. In Moodle go to **Site administration → Server → OAuth 2 services → Create new custom service**:
   - **Client ID / secret:** from step 1.
   - **Service base URL:** the issuer, e.g. `https://auth.example.com`. Locally, use `http://localhost:5173`, which Moodle must be able to reach. Moodle discovers the endpoints from it.
   - **Scopes for login:** `openid profile email`. **Scopes for offline access:** `openid profile email offline_access`.
   - **This service will be used for:** *Login page and internal services*.
   - Untick **Require email verification** if Moodle should not send its own confirmation email.
3. Check **User field mappings**: `given_name → firstname`, `family_name → lastname`, `email → email`.
4. Enable **Site administration → Plugins → Authentication → OAuth 2**.

In production Moodle's server calls the IDP over HTTPS, so the domain needs a certificate that PHP/curl trusts, such as one from Let's Encrypt.

### React SPA (public client + PKCE)

Add an application from the **React SPA** template, e.g. with redirect `http://localhost:3001/callback`. CORS for that origin is enabled automatically.

```bash
npm install oidc-client-ts react-oidc-context
```

```tsx
import { AuthProvider, useAuth } from 'react-oidc-context'

const oidcConfig = {
  authority: 'http://localhost:5173',          // the IDP issuer (https://auth.example.com in prod)
  client_id: 'my-react-app',
  redirect_uri: 'http://localhost:3001/callback',
  post_logout_redirect_uri: 'http://localhost:3001/',
  scope: 'openid profile email roles offline_access',
  onSigninCallback: () => window.history.replaceState({}, document.title, '/'),
}

<AuthProvider {...oidcConfig}><App /></AuthProvider>

// in a component
const auth = useAuth()
auth.isAuthenticated ? auth.user?.profile.email : <button onClick={() => auth.signinRedirect()}>Sign in</button>
// sign out of every app: auth.signoutRedirect()
// call your API with: Authorization: `Bearer ${auth.user?.access_token}`
```

The app must run on a different port than the IDP's 5173, e.g. `vite --port 3001`.

### Express web app (confidential client)

Add an application from the **Express web app** template, with redirect `http://localhost:3000/auth/callback`.

```bash
npm install openid-client express-session
```

```js
import express from 'express'
import session from 'express-session'
import * as client from 'openid-client'

const ISSUER = new URL(process.env.IDP_ISSUER)      // http://localhost:5173 locally
const BASE = 'http://localhost:3000'
const config = await client.discovery(
  ISSUER, 'express-app', process.env.IDP_CLIENT_SECRET,
  undefined,
  // openid-client only allows http when told to; never in production
  ISSUER.protocol === 'http:' ? { execute: [client.allowInsecureRequests] } : undefined,
)

const app = express()
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }))

app.get('/login', async (req, res) => {
  const code_verifier = client.randomPKCECodeVerifier()
  const state = client.randomState()
  req.session.oidc = { code_verifier, state }
  res.redirect(client.buildAuthorizationUrl(config, {
    redirect_uri: `${BASE}/auth/callback`,
    scope: 'openid profile email roles offline_access',
    code_challenge: await client.calculatePKCECodeChallenge(code_verifier),
    code_challenge_method: 'S256',
    state,
  }).href)
})

app.get('/auth/callback', async (req, res) => {
  const { code_verifier, state } = req.session.oidc ?? {}
  const tokens = await client.authorizationCodeGrant(config, new URL(req.originalUrl, BASE), {
    pkceCodeVerifier: code_verifier,
    expectedState: state,
  })
  req.session.user = tokens.claims()   // sub, email, name, role…
  req.session.idToken = tokens.id_token
  res.redirect('/')
})

app.get('/logout', (req, res) => {
  const url = client.buildEndSessionUrl(config, {
    id_token_hint: req.session.idToken,
    post_logout_redirect_uri: `${BASE}/`,
  })
  req.session.destroy(() => res.redirect(url.href))
})
```

### Protecting an API (e.g. an Express backend)

1. **Admin → Scopes → Add scope**, e.g. name `courses_api`, resource `courses-api`.
2. Allow that scope on the client applications that call the API. The clients then request it.
3. Validate the access token in the API. Tokens are signed JWTs, not encrypted.

```js
import { createRemoteJWKSet, jwtVerify } from 'jose'
const ISSUER = process.env.IDP_ISSUER                // e.g. https://auth.example.com
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`))

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '')
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${ISSUER}/`,                         // the issuer claim ends with a slash
      audience: 'courses-api',
    })
    req.user = payload                              // payload.sub, payload.role, payload.scope…
    next()
  } catch {
    res.sendStatus(401)
  }
}
```

For service-to-service calls with no user, use the **Machine to machine** template with the `client_credentials` grant.

## Production deployment (no containers)

**1. Build both apps:**

```bash
cd frontend/idp-ui && npm ci && npm run build                   # → frontend/idp-ui/dist
cd ../../backend && dotnet publish src/Idp.Server -c Release -o /opt/idp/backend
cp -r ../frontend/idp-ui/dist /opt/idp/frontend
```

**2. Configure the backend.** Put a `.env` file in `/opt/idp/backend`, or set real environment variables:

```
IDP_ISSUER=https://auth.example.com
DB_HOST=… DB_NAME=… DB_USER=… DB_PASSWORD=…
ADMIN_EMAIL=… ADMIN_PASSWORD=…
CERT_PASSWORD=…
```

**3. Run the backend as a service** on `http://localhost:5000`, e.g. with systemd:

```ini
# /etc/systemd/system/idp.service
[Service]
WorkingDirectory=/opt/idp/backend
ExecStart=/usr/bin/dotnet /opt/idp/backend/Idp.Server.dll --urls http://localhost:5000
Environment=ASPNETCORE_ENVIRONMENT=Production
Restart=always
```

**4. Configure nginx** to serve the frontend and proxy the backend paths on the same domain:

```nginx
server {
    listen 443 ssl http2;
    server_name auth.example.com;
    ssl_certificate     /etc/letsencrypt/live/auth.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/auth.example.com/privkey.pem;

    root /opt/idp/frontend;

    location ~ ^/(api|connect|\.well-known)/ {
        proxy_pass         http://localhost:5000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri /index.html;    # client-side routes: /login, /admin/users…
    }
}

server {
    listen 80;
    server_name auth.example.com;
    return 301 https://$host$request_uri;
}
```

On Windows/IIS the setup is the same: use URL Rewrite + ARR for the three backend paths and a SPA fallback rule for everything else.

**5. Back up `/opt/idp/backend/keys/`.** It holds the token signing and encryption keys and the cookie data-protection keys. See [backend/README.md](backend/README.md).

## Not yet implemented

- Email confirmation and forgot-password (needs an email sender)
- MFA (TOTP)
- External logins (Google, Microsoft)
- Automatic pruning of expired tokens
- Audit log
