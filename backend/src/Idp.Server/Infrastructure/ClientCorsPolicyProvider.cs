using Idp.Server.Options;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Infrastructure;

/// <summary>
/// Browser-based clients (SPAs) call the token, userinfo and revocation endpoints cross-origin.
/// Rather than maintaining a separate CORS list, allow the origins of the redirect URIs of every
/// registered public client (plus Idp:CorsOrigins), so a SPA works as soon as an admin adds it.
/// </summary>
public class ClientCorsPolicyProvider(IServiceScopeFactory scopeFactory, IMemoryCache cache, IOptions<IdpOptions> options) : ICorsPolicyProvider
{
    private const string CacheKey = "idp:cors-origins";

    public async Task<CorsPolicy?> GetPolicyAsync(HttpContext context, string? policyName)
    {
        var origin = context.Request.Headers.Origin.ToString();
        if (string.IsNullOrEmpty(origin)) return null;

        // Only the endpoints that SPAs call directly; the account and admin APIs stay same-origin.
        var path = context.Request.Path;
        if (!path.StartsWithSegments("/connect") && !path.StartsWithSegments("/.well-known")) return null;

        var allowed = await cache.GetOrCreateAsync(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1);
            return await LoadAllowedOriginsAsync();
        });

        return allowed!.Contains(origin)
            ? new CorsPolicyBuilder().WithOrigins(origin).AllowAnyHeader().AllowAnyMethod().Build()
            : null;
    }

    /// <summary>Called when applications change so new SPA origins are allowed immediately.</summary>
    public static void Invalidate(IMemoryCache cache) => cache.Remove(CacheKey);

    private async Task<HashSet<string>> LoadAllowedOriginsAsync()
    {
        var origins = new HashSet<string>(options.Value.CorsOrigins.Select(o => o.TrimEnd('/')), StringComparer.OrdinalIgnoreCase);

        await using var scope = scopeFactory.CreateAsyncScope();
        var manager = scope.ServiceProvider.GetRequiredService<IOpenIddictApplicationManager>();
        await foreach (var application in manager.ListAsync())
        {
            if (!await manager.HasClientTypeAsync(application, ClientTypes.Public)) continue;

            foreach (var uri in await manager.GetRedirectUrisAsync(application))
            {
                if (Uri.TryCreate(uri, UriKind.Absolute, out var parsed))
                {
                    origins.Add(parsed.GetLeftPart(UriPartial.Authority));
                }
            }
        }

        return origins;
    }
}
