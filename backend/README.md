# IDP backend (Idp.Server)

ASP.NET Core (.NET 10) + OpenIddict 7 + ASP.NET Core Identity + EF Core on MySQL. This app serves only:

| Path | What |
|---|---|
| `/connect/*`, `/.well-known/*` | OpenID Connect endpoints: authorize, token, userinfo, endsession, introspect, revoke, discovery, JWKS |
| `/api/account/*` | Cookie-based login, register, logout and consent-info API used by the frontend's pages (anti-forgery protected) |
| `/api/admin/*` | Admin API: applications, scopes, users, roles, stats. Needs a bearer token with the `Admin` role. |

It has no UI. Browsers reach it through the frontend's origin; see the [root README](../README.md).

## Run locally

```bash
cd src/Idp.Server
cp .env.example .env     # fill in MySQL credentials and the first admin
dotnet run               # http://localhost:5000 (Development: plain http allowed)
```

On startup, `Services/SeedWorker.cs`:
- applies migrations, creating the database if needed;
- creates the `Admin` and `User` roles;
- creates the first admin, if no admin exists;
- creates the `idp_admin_api` scope and the `idp-admin` client, with redirect `<issuer>/admin/callback`.

## Configuration

Secrets go in `src/Idp.Server/.env` (gitignored). Real environment variables override it.

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | MySQL connection |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First administrator, created only while no Admin exists |
| `IDP_ISSUER` | Public URL. Locally: `http://localhost:5173` (set in `appsettings.Development.json`). Production: `https://<your domain>` |
| `CERT_PASSWORD` | Password for the generated `.pfx` key files |

Other settings live in `appsettings.json` under `Idp`:

| Setting | Purpose |
|---|---|
| `AllowRegistration` | Enables self-registration |
| `DefaultRole` | Role given to new self-registered users |
| `Tokens:*` | Token lifetimes |
| `Certificates:*` | Key file paths |
| `CorsOrigins` | Extra CORS origins. Origins of public clients' redirect URIs are allowed automatically. |

Override any of them with `Idp__Section__Key` environment variables.

### HTTP vs HTTPS

- **Development:** plain HTTP is accepted. Cookies are only marked `Secure` on HTTPS requests.
- **Any other environment:**
  - Non-HTTPS requests are rejected and cookies are always `Secure`.
  - TLS is expected to end at nginx or IIS, which forwards `X-Forwarded-Proto: https`.
  - Forwarded headers are trusted from loopback proxies only. If the proxy runs on another machine, configure `KnownProxies` in `Program.cs`.

## Keys (back these up)

Created on first start under `keys/` (gitignored):

| File | Purpose | If lost |
|---|---|---|
| `signing.pfx` | Signs tokens | Every issued token becomes invalid |
| `encryption.pfx` | Encrypts codes and refresh tokens | Pending codes and refresh tokens become invalid |
| `dataprotection/` | Protects the session and anti-forgery cookies | Everyone is signed out of the IDP |

If you run several instances, every instance must use the same `keys/` contents.

## Database migrations

Packages restore into `backend/.nuget/packages` (see `nuget.config`). `dotnet-ef` is a local tool.

```bash
cd backend
dotnet tool restore
cd src/Idp.Server
dotnet ef migrations add <Name> -o Data/Migrations
```

Migrations are applied automatically on startup.

### MySQL notes

- The EF Core provider is Oracle's `MySql.EntityFrameworkCore` 10.0.9. Pomelo has no EF Core 10 build, and OpenIddict on .NET 10 requires EF Core 10. Version 10.0.12 of the Oracle provider has a broken dependency on nuget.org.
- That provider generates invalid SQL for bulk `UPDATE`/`DELETE` statements with joins, so OpenIddict runs with `DisableBulkOperations()`. Code-replay revocation and app deletion are tested and work.
- User lockouts use a date 100 years ahead, because MySQL `datetime` cannot store `DateTimeOffset.MaxValue`.
- Indexed string columns are capped (`Subject` at 255) to stay under MySQL's 3072-byte index limit with utf8mb4.

## Code map

| Path | What |
|---|---|
| `Program.cs` | Service registration: Identity, OpenIddict server and validation, cookies, CORS, forwarded headers |
| `Controllers/AuthorizationController.cs` | Authorize (login/consent redirects), token, userinfo, endsession |
| `Controllers/AccountController.cs` | Login, register, logout and consent info for the frontend |
| `Controllers/Admin/*` | Admin API |
| `Services/UserClaimsFactory.cs` | Which user claims go into ID and access tokens |
| `Services/SeedWorker.cs` | Migrations and seed data |
| `Infrastructure/ClientCorsPolicyProvider.cs` | CORS for registered SPA origins |
| `Infrastructure/EnvFile.cs` | `.env` loading and friendly variable names |
| `Infrastructure/CertificateLoader.cs` | Creates and loads the signing and encryption certificates |
