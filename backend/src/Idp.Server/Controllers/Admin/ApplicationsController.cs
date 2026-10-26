using System.Security.Cryptography;
using Idp.Server.Data;
using Idp.Server.Infrastructure;
using Idp.Server.Models;
using Idp.Server.Options;
using Idp.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using OpenIddict.Abstractions;
using OpenIddict.EntityFrameworkCore.Models;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Controllers.Admin;

/// <summary>Manages the client applications (relying parties) such as Moodle, React and Express apps.</summary>
[ApiController]
[Route("api/admin/applications")]
[Authorize(Policy = AdminApi.Policy)]
public class ApplicationsController(
    IOpenIddictApplicationManager manager,
    IOpenIddictAuthorizationManager authorizationManager,
    IOpenIddictTokenManager tokenManager,
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    UserClaimsFactory claimsFactory,
    IMemoryCache cache) : ControllerBase
{
    private static readonly string[] SupportedGrantTypes =
        [GrantTypes.AuthorizationCode, GrantTypes.RefreshToken, GrantTypes.ClientCredentials];

    private static readonly string[] SupportedConsentTypes =
        [ConsentTypes.Implicit, ConsentTypes.Explicit, ConsentTypes.External, ConsentTypes.Systematic];

    // Scopes that OpenIddict allows without an explicit scope permission.
    private static readonly string[] UnpermissionedScopes = [Scopes.OpenId, Scopes.OfflineAccess];

    [HttpGet]
    public async Task<IReadOnlyList<ApplicationDto>> List()
    {
        // One query for every application's user count rather than one per application.
        var counts = await Authorizations
            .Where(a => a.Status == Statuses.Valid && a.Subject != null)
            .Select(a => new { ApplicationId = a.Application!.Id, a.Subject })
            .Distinct()
            .GroupBy(a => a.ApplicationId)
            .Select(g => new { ApplicationId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.ApplicationId!, x => x.Count);

        var result = new List<ApplicationDto>();
        await foreach (var application in manager.ListAsync())
        {
            var id = (await manager.GetIdAsync(application))!;
            result.Add(await ToDtoAsync(application, counts.GetValueOrDefault(id)));
        }
        return result.OrderBy(a => a.DisplayName ?? a.ClientId).ToList();
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id) =>
        await manager.FindByIdAsync(id) is { } application ? Ok(await ToDtoWithCountAsync(application)) : NotFound();

    [HttpPost]
    public async Task<IActionResult> Create(ApplicationSaveRequest request)
    {
        if (await manager.FindByClientIdAsync(request.ClientId) is not null)
        {
            return Conflict(new { error = $"A client with id '{request.ClientId}' already exists." });
        }

        var descriptor = new OpenIddictApplicationDescriptor();
        if (Apply(descriptor, request) is { } error)
        {
            return BadRequest(new { error });
        }

        string? secret = null;
        if (request.ClientType == ClientTypes.Confidential)
        {
            secret = string.IsNullOrWhiteSpace(request.ClientSecret) ? GenerateSecret() : request.ClientSecret;
            descriptor.ClientSecret = secret;
        }

        var application = await manager.CreateAsync(descriptor);
        ClientCorsPolicyProvider.Invalidate(cache);
        return Ok(new ApplicationSecretResponse(await ToDtoWithCountAsync(application), secret));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, ApplicationSaveRequest request)
    {
        var application = await manager.FindByIdAsync(id);
        if (application is null) return NotFound();

        var descriptor = new OpenIddictApplicationDescriptor();
        await manager.PopulateAsync(descriptor, application);

        if (descriptor.ClientId != request.ClientId)
        {
            if (descriptor.ClientId == AdminApi.ClientId)
            {
                return BadRequest(new { error = "The client id of the admin UI cannot be changed." });
            }
            if (await manager.FindByClientIdAsync(request.ClientId) is not null)
            {
                return Conflict(new { error = $"A client with id '{request.ClientId}' already exists." });
            }
        }

        var wasConfidential = descriptor.ClientType == ClientTypes.Confidential;
        if (Apply(descriptor, request) is { } error)
        {
            return BadRequest(new { error });
        }

        // Switching client type means adding or dropping the secret.
        string? secret = null;
        if (request.ClientType == ClientTypes.Public)
        {
            descriptor.ClientSecret = null;
        }
        else if (!wasConfidential)
        {
            descriptor.ClientSecret = secret = GenerateSecret();
        }

        await manager.UpdateAsync(application, descriptor);
        ClientCorsPolicyProvider.Invalidate(cache);
        return Ok(new ApplicationSecretResponse(await ToDtoWithCountAsync(application), secret));
    }

    [HttpPost("{id}/rotate-secret")]
    public async Task<IActionResult> RotateSecret(string id)
    {
        var application = await manager.FindByIdAsync(id);
        if (application is null) return NotFound();

        if (!await manager.HasClientTypeAsync(application, ClientTypes.Confidential))
        {
            return BadRequest(new { error = "Public clients do not have a secret." });
        }

        var descriptor = new OpenIddictApplicationDescriptor();
        await manager.PopulateAsync(descriptor, application);
        var secret = GenerateSecret();
        descriptor.ClientSecret = secret;
        await manager.UpdateAsync(application, descriptor);

        return Ok(new ApplicationSecretResponse(await ToDtoWithCountAsync(application), secret));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var application = await manager.FindByIdAsync(id);
        if (application is null) return NotFound();

        if (await manager.GetClientIdAsync(application) == AdminApi.ClientId)
        {
            return BadRequest(new { error = "The admin UI client cannot be deleted." });
        }

        await manager.DeleteAsync(application);
        ClientCorsPolicyProvider.Invalidate(cache);
        return NoContent();
    }

    /// <summary>
    /// Users of one application. Every sign-in through the IDP stores a permanent OpenIddict
    /// authorization for (user, application), so those rows are the application's user list.
    /// </summary>
    [HttpGet("{id}/users")]
    public async Task<IActionResult> Users(string id, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        if (await manager.FindByIdAsync(id) is null) return NotFound();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var grants = Authorizations
            .Where(a => a.Application!.Id == id && a.Subject != null)
            .GroupBy(a => a.Subject!)
            .Select(g => new
            {
                UserId = g.Key,
                FirstAccess = g.Min(a => a.CreationDate),
                ValidCount = g.Count(a => a.Status == Statuses.Valid),
            });

        var query = from g in grants
                    join u in db.Users on g.UserId equals u.Id
                    select new { User = u, g.FirstAccess, g.ValidCount };

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.User.Email!.Contains(term) || x.User.FirstName!.Contains(term) || x.User.LastName!.Contains(term));
        }

        var total = await query.CountAsync();
        var rows = await query.OrderBy(x => x.User.Email).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var ids = rows.Select(r => r.User.Id).ToList();
        var roles = await (from ur in db.UserRoles
                           join r in db.Roles on ur.RoleId equals r.Id
                           where ids.Contains(ur.UserId)
                           select new { ur.UserId, r.Name }).ToListAsync();
        var rolesByUser = roles.ToLookup(r => r.UserId, r => r.Name!);

        // Codes, refresh and access tokens are stored per application, so the newest one is the last sign-in or refresh.
        var lastUsed = await db.Set<OpenIddictEntityFrameworkCoreToken>()
            .Where(t => t.Application!.Id == id && t.Subject != null && ids.Contains(t.Subject))
            .GroupBy(t => t.Subject!)
            .Select(g => new { UserId = g.Key, Last = g.Max(t => t.CreationDate) })
            .ToDictionaryAsync(x => x.UserId, x => x.Last);

        var now = DateTimeOffset.UtcNow;
        var items = rows.Select(r => new ApplicationUserDto(
            r.User.Id,
            r.User.Email!,
            r.User.FirstName,
            r.User.LastName,
            rolesByUser[r.User.Id].Order().ToList(),
            r.User.LockoutEnd is { } end && end > now,
            r.ValidCount > 0,
            AsUtc(r.FirstAccess),
            AsUtc(lastUsed.GetValueOrDefault(r.User.Id)))).ToList();

        return Ok(new PagedResult<ApplicationUserDto>(items, total, page, pageSize));
    }

    /// <summary>
    /// Gives a user access to the application ahead of their first sign-in. Required for applications
    /// with the "external" consent type, which only admit users an administrator has approved.
    /// </summary>
    [HttpPost("{id}/users")]
    public async Task<IActionResult> GrantUser(string id, ApplicationUserGrantRequest request)
    {
        var application = await manager.FindByIdAsync(id);
        if (application is null) return NotFound();

        var user = await userManager.FindByIdAsync(request.UserId);
        if (user is null) return BadRequest(new { error = "The user does not exist." });

        var app = await ToDtoAsync(application, 0);
        if (!app.GrantTypes.Contains(GrantTypes.AuthorizationCode))
        {
            return BadRequest(new { error = "This application does not sign users in, so it has no users." });
        }

        var existing = await authorizationManager.FindAsync(
            subject: user.Id, client: id, status: Statuses.Valid, type: AuthorizationTypes.Permanent, scopes: null).AnyAsync();
        if (!existing)
        {
            // Cover every scope the application may request, or the authorize endpoint won't match this grant.
            var scopes = app.Scopes.ToList();
            if (app.GrantTypes.Contains(GrantTypes.RefreshToken)) scopes.Add(Scopes.OfflineAccess);

            var identity = await claimsFactory.PopulateAsync(UserClaimsFactory.CreateEmptyIdentity(), user);
            await authorizationManager.CreateAsync(identity, user.Id, id, AuthorizationTypes.Permanent, [.. scopes.Distinct()]);
        }

        return NoContent();
    }

    /// <summary>
    /// Removes a user's access to one application: revokes their stored consent and every token issued to
    /// that application, which signs them out of it. Other applications and the IDP session are untouched.
    /// </summary>
    [HttpDelete("{id}/users/{userId}")]
    public async Task<IActionResult> RevokeUser(string id, string userId)
    {
        if (await manager.FindByIdAsync(id) is null) return NotFound();

        await foreach (var token in tokenManager.FindAsync(subject: userId, client: id, status: null, type: null))
        {
            await tokenManager.TryRevokeAsync(token);
        }
        await foreach (var authorization in authorizationManager.FindAsync(subject: userId, client: id, status: null, type: null, scopes: null))
        {
            await authorizationManager.TryRevokeAsync(authorization);
        }

        return NoContent();
    }

    private IQueryable<OpenIddictEntityFrameworkCoreAuthorization> Authorizations => db.Set<OpenIddictEntityFrameworkCoreAuthorization>();

    private static DateTimeOffset? AsUtc(DateTime? value) =>
        value is { } v ? new DateTimeOffset(DateTime.SpecifyKind(v, DateTimeKind.Utc)) : null;

    /// <summary>Translates the friendly request into OpenIddict permissions/requirements. Returns an error message if invalid.</summary>
    private static string? Apply(OpenIddictApplicationDescriptor descriptor, ApplicationSaveRequest request)
    {
        if (request.ClientType is not (ClientTypes.Public or ClientTypes.Confidential))
            return "Client type must be 'public' or 'confidential'.";
        if (!SupportedConsentTypes.Contains(request.ConsentType))
            return $"Consent type must be one of: {string.Join(", ", SupportedConsentTypes)}.";

        var grantTypes = (request.GrantTypes ?? []).Distinct().ToList();
        if (grantTypes.Count == 0)
            return "Select at least one grant type.";
        if (grantTypes.FirstOrDefault(g => !SupportedGrantTypes.Contains(g)) is { } unsupported)
            return $"Unsupported grant type '{unsupported}'.";
        if (grantTypes.Contains(GrantTypes.ClientCredentials) && request.ClientType == ClientTypes.Public)
            return "Public clients cannot use the client_credentials grant.";

        var usesCodeFlow = grantTypes.Contains(GrantTypes.AuthorizationCode);
        if (grantTypes.Contains(GrantTypes.RefreshToken) && !usesCodeFlow)
            return "The refresh_token grant requires the authorization_code grant.";

        var redirectUris = new List<Uri>();
        var postLogoutUris = new List<Uri>();
        foreach (var (input, target) in (request.RedirectUris ?? []).Select(u => (u, redirectUris))
                     .Concat((request.PostLogoutRedirectUris ?? []).Select(u => (u, postLogoutUris))))
        {
            if (string.IsNullOrWhiteSpace(input)) continue;
            if (!Uri.TryCreate(input.Trim(), UriKind.Absolute, out var uri) || !string.IsNullOrEmpty(uri.Fragment))
                return $"'{input}' is not a valid absolute URI (fragments are not allowed).";
            target.Add(uri);
        }
        if (usesCodeFlow && redirectUris.Count == 0)
            return "The authorization_code grant requires at least one redirect URI.";

        descriptor.ClientId = request.ClientId.Trim();
        descriptor.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        descriptor.ClientType = request.ClientType;
        descriptor.ConsentType = request.ConsentType;
        descriptor.ApplicationType = ApplicationTypes.Web;

        descriptor.RedirectUris.Clear();
        descriptor.RedirectUris.UnionWith(redirectUris);
        descriptor.PostLogoutRedirectUris.Clear();
        descriptor.PostLogoutRedirectUris.UnionWith(postLogoutUris);

        descriptor.Permissions.Clear();
        descriptor.Permissions.Add(Permissions.Endpoints.Token);
        descriptor.Permissions.Add(Permissions.Endpoints.Revocation);
        if (request.ClientType == ClientTypes.Confidential)
        {
            descriptor.Permissions.Add(Permissions.Endpoints.Introspection);
        }
        if (usesCodeFlow)
        {
            descriptor.Permissions.Add(Permissions.Endpoints.Authorization);
            descriptor.Permissions.Add(Permissions.Endpoints.EndSession);
            descriptor.Permissions.Add(Permissions.ResponseTypes.Code);
        }
        foreach (var grant in grantTypes)
        {
            descriptor.Permissions.Add(Permissions.Prefixes.GrantType + grant);
        }
        foreach (var scope in (request.Scopes ?? []).Where(s => !string.IsNullOrWhiteSpace(s)).Except(UnpermissionedScopes))
        {
            descriptor.Permissions.Add(Permissions.Prefixes.Scope + scope.Trim());
        }

        descriptor.Requirements.Clear();
        // Public clients using the code flow (SPAs, mobile) must always use PKCE.
        if (request.RequirePkce || (usesCodeFlow && request.ClientType == ClientTypes.Public))
        {
            descriptor.Requirements.Add(Requirements.Features.ProofKeyForCodeExchange);
        }

        return null;
    }

    private async Task<ApplicationDto> ToDtoWithCountAsync(object application)
    {
        var id = (await manager.GetIdAsync(application))!;
        var count = await Authorizations
            .Where(a => a.Application!.Id == id && a.Status == Statuses.Valid && a.Subject != null)
            .Select(a => a.Subject)
            .Distinct()
            .CountAsync();
        return await ToDtoAsync(application, count);
    }

    private async Task<ApplicationDto> ToDtoAsync(object application, int userCount)
    {
        var d = new OpenIddictApplicationDescriptor();
        await manager.PopulateAsync(d, application);

        IReadOnlyList<string> WithPrefix(string prefix) =>
            d.Permissions.Where(p => p.StartsWith(prefix, StringComparison.Ordinal)).Select(p => p[prefix.Length..]).Order().ToList();

        var scopes = WithPrefix(Permissions.Prefixes.Scope).ToList();
        scopes.Insert(0, Scopes.OpenId);

        return new ApplicationDto(
            Id: (await manager.GetIdAsync(application))!,
            ClientId: d.ClientId!,
            DisplayName: d.DisplayName,
            ClientType: d.ClientType ?? ClientTypes.Public,
            ConsentType: d.ConsentType ?? ConsentTypes.Implicit,
            RedirectUris: d.RedirectUris.Select(u => u.OriginalString).Order().ToList(),
            PostLogoutRedirectUris: d.PostLogoutRedirectUris.Select(u => u.OriginalString).Order().ToList(),
            GrantTypes: WithPrefix(Permissions.Prefixes.GrantType),
            Scopes: scopes,
            RequirePkce: d.Requirements.Contains(Requirements.Features.ProofKeyForCodeExchange),
            IsSystem: d.ClientId == AdminApi.ClientId,
            UserCount: userCount);
    }

    private static string GenerateSecret() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
