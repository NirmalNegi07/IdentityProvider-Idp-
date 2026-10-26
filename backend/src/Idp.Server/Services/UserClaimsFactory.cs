using System.Collections.Immutable;
using System.Security.Claims;
using Idp.Server.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Services;

/// <summary>Builds the claims identity that OpenIddict turns into ID/access tokens.</summary>
public class UserClaimsFactory(UserManager<ApplicationUser> userManager)
{
    public static ClaimsIdentity CreateEmptyIdentity() => new(
        authenticationType: TokenValidationParameters.DefaultAuthenticationType,
        nameType: Claims.Name,
        roleType: Claims.Role);

    /// <summary>Adds (or refreshes) the user's profile claims on <paramref name="identity"/>.</summary>
    public async Task<ClaimsIdentity> PopulateAsync(ClaimsIdentity identity, ApplicationUser user)
    {
        identity.SetClaim(Claims.Subject, user.Id)
            .SetClaim(Claims.Email, user.Email)
            .SetClaim(Claims.Name, user.DisplayName)
            .SetClaim(Claims.GivenName, user.FirstName)
            .SetClaim(Claims.FamilyName, user.LastName)
            .SetClaim(Claims.PreferredUsername, user.UserName)
            .SetClaims(Claims.Role, [.. await userManager.GetRolesAsync(user)]);

        identity.RemoveClaims(Claims.EmailVerified);
        identity.AddClaim(new Claim(Claims.EmailVerified, user.EmailConfirmed ? "true" : "false", ClaimValueTypes.Boolean));

        identity.SetDestinations(GetDestinations);
        return identity;
    }

    /// <summary>Decides which claims go into the access token and which also go into the ID token.</summary>
    public static IEnumerable<string> GetDestinations(Claim claim)
    {
        var principal = claim.Subject!;

        switch (claim.Type)
        {
            case Claims.Name or Claims.GivenName or Claims.FamilyName or Claims.PreferredUsername:
                yield return Destinations.AccessToken;
                if (principal.HasScope(Scopes.Profile)) yield return Destinations.IdentityToken;
                yield break;

            case Claims.Email or Claims.EmailVerified:
                yield return Destinations.AccessToken;
                if (principal.HasScope(Scopes.Email)) yield return Destinations.IdentityToken;
                yield break;

            case Claims.Role:
                yield return Destinations.AccessToken;
                if (principal.HasScope(Scopes.Roles)) yield return Destinations.IdentityToken;
                yield break;

            // Never leak the security stamp into tokens.
            case "AspNet.Identity.SecurityStamp":
                yield break;

            default:
                yield return Destinations.AccessToken;
                yield break;
        }
    }

    public static ImmutableArray<string> ToImmutable(IEnumerable<string> values) => [.. values];
}
