using System.Security.Cryptography.X509Certificates;
using Idp.Server.Data;
using Idp.Server.Infrastructure;
using Idp.Server.Options;
using Idp.Server.Services;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

EnvFile.Load();
var builder = WebApplication.CreateBuilder(args);
EnvFile.AddFriendlyVariables(builder.Configuration);

var idpOptions = builder.Configuration.GetSection(IdpOptions.SectionName).Get<IdpOptions>() ?? new IdpOptions();
builder.Services.Configure<IdpOptions>(builder.Configuration.GetSection(IdpOptions.SectionName));

// ---------- Database (MySQL) ----------
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseMySQL(builder.Configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured."));
    options.UseOpenIddict();
});

// ---------- Users (ASP.NET Core Identity) ----------
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.SignIn.RequireConfirmedAccount = false;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Local development runs on plain http://localhost; production must be served over HTTPS
// (TLS is terminated by the reverse proxy in front of this app, see the README).
var isDevelopment = builder.Environment.IsDevelopment();
var cookieSecurity = isDevelopment ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;

// The IDP session cookie. Lax so it is sent when apps redirect the browser to /connect/authorize.
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "idp.session";
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = cookieSecurity;
    options.ExpireTimeSpan = TimeSpan.FromHours(8);
    options.SlidingExpiration = true;
    options.LoginPath = "/login";
    options.AccessDeniedPath = "/login";

    // API calls get status codes instead of redirects to the login page.
    options.Events.OnRedirectToLogin = context => ApiAwareRedirect(context, StatusCodes.Status401Unauthorized);
    options.Events.OnRedirectToAccessDenied = context => ApiAwareRedirect(context, StatusCodes.Status403Forbidden);
});

// Re-check the security stamp often so locked users / reset passwords end IDP sessions quickly.
builder.Services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.FromMinutes(5));

// Keys protecting the session/anti-forgery cookies. Kept with the token certificates so that
// restarts (and every server, if you run several behind a load balancer) can read existing cookies.
builder.Services.AddDataProtection()
    .SetApplicationName("Idp.Server")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.GetFullPath(idpOptions.Certificates.DataProtectionPath)));

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-XSRF-TOKEN";
    options.Cookie.Name = "idp.af";
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = cookieSecurity;
});

// ---------- OpenID Connect server (OpenIddict) ----------
builder.Services.AddOpenIddict()
    .AddCore(options => options.UseEntityFrameworkCore()
        .UseDbContext<ApplicationDbContext>()
        // Oracle's MySQL provider emits invalid SQL for bulk UPDATE/DELETE with joins (used for
        // token revocation on code replay and pruning), so let OpenIddict update rows one by one.
        .DisableBulkOperations())
    .AddServer(options =>
    {
        if (!string.IsNullOrWhiteSpace(idpOptions.Issuer))
        {
            options.SetIssuer(new Uri(idpOptions.Issuer));
        }

        options.SetAuthorizationEndpointUris("connect/authorize")
            .SetTokenEndpointUris("connect/token")
            .SetUserInfoEndpointUris("connect/userinfo")
            .SetEndSessionEndpointUris("connect/endsession")
            .SetIntrospectionEndpointUris("connect/introspect")
            .SetRevocationEndpointUris("connect/revoke");

        options.AllowAuthorizationCodeFlow()
            .AllowRefreshTokenFlow()
            .AllowClientCredentialsFlow();

        options.RegisterScopes(Scopes.OpenId, Scopes.Profile, Scopes.Email, Scopes.Roles, Scopes.OfflineAccess);
        options.RegisterClaims(Claims.Subject, Claims.Name, Claims.GivenName, Claims.FamilyName,
            Claims.PreferredUsername, Claims.Email, Claims.EmailVerified, Claims.Role);

        var tokens = idpOptions.Tokens;
        options.SetAccessTokenLifetime(TimeSpan.FromMinutes(tokens.AccessTokenMinutes))
            .SetIdentityTokenLifetime(TimeSpan.FromMinutes(tokens.IdentityTokenMinutes))
            .SetRefreshTokenLifetime(TimeSpan.FromDays(tokens.RefreshTokenDays))
            .SetAuthorizationCodeLifetime(TimeSpan.FromMinutes(tokens.AuthorizationCodeMinutes));

        var certs = idpOptions.Certificates;
        options.AddSigningCertificate(CertificateLoader.LoadOrCreate(
                certs.SigningPath, certs.Password, "IDP Signing", X509KeyUsageFlags.DigitalSignature))
            .AddEncryptionCertificate(CertificateLoader.LoadOrCreate(
                certs.EncryptionPath, certs.Password, "IDP Encryption", X509KeyUsageFlags.KeyEncipherment));

        // Plain signed JWT access tokens, so APIs (e.g. Express) can validate them with the JWKS endpoint.
        options.DisableAccessTokenEncryption();

        var aspNetCore = options.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableUserInfoEndpointPassthrough()
            .EnableEndSessionEndpointPassthrough()
            .EnableStatusCodePagesIntegration();

        // OpenIddict rejects non-HTTPS requests by default; allow http only for local development.
        if (isDevelopment)
        {
            aspNetCore.DisableTransportSecurityRequirement();
        }
    })
    // Validates access tokens sent to this server's own admin API.
    .AddValidation(options =>
    {
        options.UseLocalServer();
        options.UseAspNetCore();
        options.AddAudiences(AdminApi.Resource);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AdminApi.Policy, policy => policy
        .AddAuthenticationSchemes(OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)
        .RequireAuthenticatedUser()
        .RequireClaim(Claims.Role, Roles.Admin));
});

// Browser-based clients on other origins (e.g. the React app) call /connect/token and /connect/userinfo.
builder.Services.AddMemoryCache();
builder.Services.AddCors();
builder.Services.AddSingleton<ICorsPolicyProvider, ClientCorsPolicyProvider>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    // Needed behind nginx/IIS: TLS ends at the proxy, X-Forwarded-Proto tells this app the public scheme is https.
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
});

builder.Services.AddControllers();
builder.Services.AddScoped<UserClaimsFactory>();
builder.Services.AddHostedService<SeedWorker>();

var app = builder.Build();

app.UseForwardedHeaders();
if (!isDevelopment)
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

// This server only exposes /api, /connect and /.well-known. The React UI (frontend/idp-ui) is a
// separate app served from the same public origin: Vite's dev server proxies these paths here in
// development, and the reverse proxy (nginx/IIS) does the same in production. Redirects such as
// /login and /consent are relative, so they land on the UI.
app.UseRouting();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

static Task ApiAwareRedirect(Microsoft.AspNetCore.Authentication.RedirectContext<Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationOptions> context, int statusCode)
{
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.StatusCode = statusCode;
    }
    else
    {
        context.Response.Redirect(context.RedirectUri);
    }
    return Task.CompletedTask;
}
