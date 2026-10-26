using Idp.Server.Data;
using Idp.Server.Options;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Services;

/// <summary>
/// Applies database migrations and seeds what the IDP needs to be administrable:
/// the Admin/User roles, the first admin account and the admin UI client.
/// </summary>
public class SeedWorker(IServiceProvider services, IOptions<IdpOptions> options, ILogger<SeedWorker> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = services.CreateAsyncScope();
        var provider = scope.ServiceProvider;
        var settings = options.Value;

        await provider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync(cancellationToken);

        var roleManager = provider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { Roles.Admin, Roles.User })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        await SeedAdminUserAsync(provider.GetRequiredService<UserManager<ApplicationUser>>(), settings.Admin);

        var scopeManager = provider.GetRequiredService<IOpenIddictScopeManager>();
        if (await scopeManager.FindByNameAsync(AdminApi.Scope, cancellationToken) is null)
        {
            await scopeManager.CreateAsync(new OpenIddictScopeDescriptor
            {
                Name = AdminApi.Scope,
                DisplayName = "IDP administration API",
                Resources = { AdminApi.Resource },
            }, cancellationToken);
        }

        await SeedAdminClientAsync(provider.GetRequiredService<IOpenIddictApplicationManager>(), settings, cancellationToken);
    }

    private async Task SeedAdminUserAsync(UserManager<ApplicationUser> userManager, AdminSeedOptions admin)
    {
        if ((await userManager.GetUsersInRoleAsync(Roles.Admin)).Count > 0)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(admin.Password))
        {
            logger.LogWarning("No administrator exists. Set Idp:Admin:Email and Idp:Admin:Password to create one.");
            return;
        }

        var user = await userManager.FindByEmailAsync(admin.Email);
        if (user is null)
        {
            user = new ApplicationUser { UserName = admin.Email, Email = admin.Email, EmailConfirmed = true, FirstName = "Administrator" };
            var result = await userManager.CreateAsync(user, admin.Password);
            if (!result.Succeeded)
            {
                logger.LogError("Could not create the administrator: {Errors}", string.Join(" ", result.Errors.Select(e => e.Description)));
                return;
            }
        }

        await userManager.AddToRolesAsync(user, [Roles.Admin, Roles.User]);
        logger.LogInformation("Created administrator {Email}.", admin.Email);
    }

    /// <summary>The admin UI is itself an OIDC client (public SPA, code flow + PKCE) of this IDP.</summary>
    private static async Task SeedAdminClientAsync(IOpenIddictApplicationManager manager, IdpOptions settings, CancellationToken cancellationToken)
    {
        var baseUrl = (settings.Issuer ?? "http://localhost:5173").TrimEnd('/');

        var descriptor = new OpenIddictApplicationDescriptor
        {
            ClientId = AdminApi.ClientId,
            DisplayName = "IDP Admin Console",
            ClientType = ClientTypes.Public,
            ConsentType = ConsentTypes.Implicit,
            ApplicationType = ApplicationTypes.Web,
            RedirectUris = { new Uri($"{baseUrl}/admin/callback") },
            PostLogoutRedirectUris = { new Uri($"{baseUrl}/admin") },
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.Endpoints.Revocation,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Email,
                Permissions.Scopes.Roles,
                Permissions.Prefixes.Scope + AdminApi.Scope,
            },
            Requirements = { Requirements.Features.ProofKeyForCodeExchange },
        };

        var existing = await manager.FindByClientIdAsync(AdminApi.ClientId, cancellationToken);
        if (existing is null)
        {
            await manager.CreateAsync(descriptor, cancellationToken);
        }
        else
        {
            // Keep the redirect URIs in sync with the configured issuer.
            await manager.UpdateAsync(existing, descriptor, cancellationToken);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
