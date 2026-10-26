using System.Security.Cryptography;
using Idp.Server.Infrastructure;
using Idp.Server.Models;
using Idp.Server.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Controllers.Admin;

/// <summary>Manages the client applications (relying parties) such as Moodle, React and Express apps.</summary>
[ApiController]
[Route("api/admin/applications")]
[Authorize(Policy = AdminApi.Policy)]
public class ApplicationsController(IOpenIddictApplicationManager manager, IMemoryCache cache) : ControllerBase
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
        var result = new List<ApplicationDto>();
        await foreach (var application in manager.ListAsync())
        {
            result.Add(await ToDtoAsync(application));
        }
        return result.OrderBy(a => a.DisplayName ?? a.ClientId).ToList();
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id) =>
        await manager.FindByIdAsync(id) is { } application ? Ok(await ToDtoAsync(application)) : NotFound();

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
        return Ok(new ApplicationSecretResponse(await ToDtoAsync(application), secret));
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
        return Ok(new ApplicationSecretResponse(await ToDtoAsync(application), secret));
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

        return Ok(new ApplicationSecretResponse(await ToDtoAsync(application), secret));
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

    private async Task<ApplicationDto> ToDtoAsync(object application)
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
            IsSystem: d.ClientId == AdminApi.ClientId);
    }

    private static string GenerateSecret() => Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
