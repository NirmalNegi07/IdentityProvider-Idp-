using System.Security.Claims;
using Idp.Server.Data;
using Idp.Server.Services;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Controllers;

/// <summary>
/// Handles the OpenID Connect endpoints that need application logic. Discovery, JWKS,
/// introspection and revocation are fully handled by OpenIddict itself.
/// The login and consent screens live in the React UI (/login, /consent).
/// </summary>
[ApiExplorerSettings(IgnoreApi = true)]
public class AuthorizationController(
    IOpenIddictApplicationManager applicationManager,
    IOpenIddictAuthorizationManager authorizationManager,
    IOpenIddictScopeManager scopeManager,
    SignInManager<ApplicationUser> signInManager,
    UserManager<ApplicationUser> userManager,
    UserClaimsFactory claimsFactory) : Controller
{
    [HttpGet("~/connect/authorize"), HttpPost("~/connect/authorize")]
    [IgnoreAntiforgeryToken]
    public async Task<IActionResult> Authorize()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        // The user's IDP session is the ASP.NET Core Identity cookie.
        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ApplicationScheme);

        var mustReauthenticate = request.HasPromptValue(PromptValues.Login)
            || (request.MaxAge is not null && result.Properties?.IssuedUtc is { } issued
                && DateTimeOffset.UtcNow - issued > TimeSpan.FromSeconds(request.MaxAge.Value));

        if (!result.Succeeded || mustReauthenticate)
        {
            if (request.HasPromptValue(PromptValues.None))
            {
                return ForbidOidc(OpenIddictErrors(Errors.LoginRequired, "The user is not logged in."));
            }

            // Strip prompt=login so that, once logged in, the user isn't sent back to the login page in a loop.
            var parameters = GetRequestParameters();
            parameters.RemoveAll(p => p.Key == Parameters.Prompt);
            var remainingPrompts = request.GetPromptValues().Remove(PromptValues.Login);
            if (remainingPrompts.Length > 0)
            {
                parameters.Add(new(Parameters.Prompt, string.Join(' ', remainingPrompts)));
            }

            var returnUrl = QueryHelpers.AddQueryString(Request.PathBase + Request.Path, parameters);
            return Redirect(QueryHelpers.AddQueryString("/login", "returnUrl", returnUrl));
        }

        var user = await userManager.GetUserAsync(result.Principal!)
            ?? throw new InvalidOperationException("The user details cannot be retrieved.");

        if (!await signInManager.CanSignInAsync(user) || await userManager.IsLockedOutAsync(user))
        {
            await signInManager.SignOutAsync();
            return ForbidOidc(OpenIddictErrors(Errors.AccessDenied, "The user account is disabled."));
        }

        var application = await applicationManager.FindByClientIdAsync(request.ClientId!)
            ?? throw new InvalidOperationException("The client application cannot be found.");

        var authorizations = await authorizationManager.FindAsync(
            subject: user.Id,
            client: (await applicationManager.GetIdAsync(application))!,
            status: Statuses.Valid,
            type: AuthorizationTypes.Permanent,
            scopes: request.GetScopes()).ToListAsync();

        var consentType = await applicationManager.GetConsentTypeAsync(application);
        var consentGiven = Request.HasFormContentType && Request.Form.ContainsKey("submit.Accept");
        var consentDenied = Request.HasFormContentType && Request.Form.ContainsKey("submit.Deny");

        if (consentDenied)
        {
            return ForbidOidc(OpenIddictErrors(Errors.AccessDenied, "The user denied the authorization request."));
        }

        switch (consentType)
        {
            // External: only an administrator can grant access (by creating an authorization).
            case ConsentTypes.External when authorizations.Count is 0:
                return ForbidOidc(OpenIddictErrors(Errors.ConsentRequired,
                    "The logged in user is not allowed to access this client application."));

            // Explicit/Systematic: show the consent screen unless the user has already accepted.
            case ConsentTypes.Explicit when authorizations.Count is 0 && !consentGiven:
            case ConsentTypes.Systematic when !consentGiven:
                if (request.HasPromptValue(PromptValues.None))
                {
                    return ForbidOidc(OpenIddictErrors(Errors.ConsentRequired, "Interactive user consent is required."));
                }
                return Redirect(QueryHelpers.AddQueryString("/consent", GetRequestParameters()));
        }

        // Implicit consent, a stored authorization, or the user just accepted: issue the code.
        var identity = await claimsFactory.PopulateAsync(UserClaimsFactory.CreateEmptyIdentity(), user);
        identity.SetScopes(request.GetScopes());
        identity.SetResources(await scopeManager.ListResourcesAsync(identity.GetScopes()).ToListAsync());

        var authorization = authorizations.LastOrDefault()
            ?? await authorizationManager.CreateAsync(
                identity: identity,
                subject: user.Id,
                client: (await applicationManager.GetIdAsync(application))!,
                type: AuthorizationTypes.Permanent,
                scopes: identity.GetScopes());

        identity.SetAuthorizationId(await authorizationManager.GetIdAsync(authorization));
        identity.SetDestinations(UserClaimsFactory.GetDestinations);

        return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpPost("~/connect/token"), IgnoreAntiforgeryToken, Produces("application/json")]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (request.IsAuthorizationCodeGrantType() || request.IsRefreshTokenGrantType())
        {
            // Principal stored in the authorization code / refresh token.
            var result = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);

            var user = await userManager.FindByIdAsync(result.Principal!.GetClaim(Claims.Subject)!);
            if (user is null)
            {
                return ForbidOidc(OpenIddictErrors(Errors.InvalidGrant, "The token is no longer valid."));
            }

            if (!await signInManager.CanSignInAsync(user) || await userManager.IsLockedOutAsync(user))
            {
                return ForbidOidc(OpenIddictErrors(Errors.InvalidGrant, "The user is no longer allowed to sign in."));
            }

            // Re-read the profile so that refreshed tokens reflect the latest user/role changes.
            var identity = new ClaimsIdentity(result.Principal!.Claims,
                authenticationType: TokenValidationParameters.DefaultAuthenticationType, nameType: Claims.Name, roleType: Claims.Role);
            await claimsFactory.PopulateAsync(identity, user);

            return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        if (request.IsClientCredentialsGrantType())
        {
            // Machine-to-machine: the client itself is the subject.
            var application = await applicationManager.FindByClientIdAsync(request.ClientId!)
                ?? throw new InvalidOperationException("The client application cannot be found.");

            var identity = UserClaimsFactory.CreateEmptyIdentity();
            identity.SetClaim(Claims.Subject, await applicationManager.GetClientIdAsync(application));
            identity.SetClaim(Claims.Name, await applicationManager.GetDisplayNameAsync(application));
            identity.SetScopes(request.GetScopes());
            identity.SetResources(await scopeManager.ListResourcesAsync(identity.GetScopes()).ToListAsync());
            identity.SetDestinations(_ => [Destinations.AccessToken]);

            return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        }

        throw new InvalidOperationException("The specified grant type is not supported.");
    }

    [HttpGet("~/connect/userinfo"), HttpPost("~/connect/userinfo"), IgnoreAntiforgeryToken, Produces("application/json")]
    public async Task<IActionResult> UserInfo()
    {
        var result = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        var user = await userManager.FindByIdAsync(result.Principal!.GetClaim(Claims.Subject)!);
        if (user is null)
        {
            return ChallengeOidc(OpenIddictErrors(Errors.InvalidToken, "The specified access token is bound to an account that no longer exists."));
        }

        var principal = result.Principal!;
        var claims = new Dictionary<string, object>(StringComparer.Ordinal)
        {
            [Claims.Subject] = user.Id,
        };

        if (principal.HasScope(Scopes.Profile))
        {
            claims[Claims.Name] = user.DisplayName;
            claims[Claims.PreferredUsername] = user.UserName!;
            if (user.FirstName is not null) claims[Claims.GivenName] = user.FirstName;
            if (user.LastName is not null) claims[Claims.FamilyName] = user.LastName;
        }

        if (principal.HasScope(Scopes.Email))
        {
            claims[Claims.Email] = user.Email!;
            claims[Claims.EmailVerified] = user.EmailConfirmed;
        }

        if (principal.HasScope(Scopes.Roles))
        {
            claims[Claims.Role] = await userManager.GetRolesAsync(user);
        }

        return Ok(claims);
    }

    [HttpGet("~/connect/endsession"), HttpPost("~/connect/endsession"), IgnoreAntiforgeryToken]
    public async Task<IActionResult> EndSession()
    {
        await signInManager.SignOutAsync();

        // OpenIddict validates post_logout_redirect_uri and redirects there; otherwise back to the login page.
        return SignOut(
            authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties { RedirectUri = "/login?loggedOut=true" });
    }

    private List<KeyValuePair<string, StringValues>> GetRequestParameters() =>
        Request.HasFormContentType
            ? Request.Form.Where(p => !p.Key.StartsWith("submit.", StringComparison.Ordinal)).ToList()
            : Request.Query.ToList();

    private static AuthenticationProperties OpenIddictErrors(string error, string description) => new(new Dictionary<string, string?>
    {
        [OpenIddictServerAspNetCoreConstants.Properties.Error] = error,
        [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description,
    });

    private ForbidResult ForbidOidc(AuthenticationProperties properties) =>
        Forbid(properties, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);

    private ChallengeResult ChallengeOidc(AuthenticationProperties properties) =>
        Challenge(properties, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
}
