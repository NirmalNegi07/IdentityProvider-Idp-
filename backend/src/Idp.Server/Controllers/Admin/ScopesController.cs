using Idp.Server.Models;
using Idp.Server.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Controllers.Admin;

/// <summary>
/// Manages custom scopes (e.g. "orders_api"). A scope's resources become the "aud" of
/// access tokens issued for it, which APIs such as the Express backend validate.
/// The standard scopes (openid, profile, email, roles, offline_access) are built in.
/// </summary>
[ApiController]
[Route("api/admin/scopes")]
[Authorize(Policy = AdminApi.Policy)]
public class ScopesController(IOpenIddictScopeManager manager) : ControllerBase
{
    public static readonly string[] BuiltInScopes =
        [Scopes.OpenId, Scopes.Profile, Scopes.Email, Scopes.Roles, Scopes.OfflineAccess];

    [HttpGet]
    public async Task<IReadOnlyList<ScopeDto>> List()
    {
        var result = new List<ScopeDto>();
        await foreach (var scope in manager.ListAsync())
        {
            result.Add(await ToDtoAsync(scope));
        }
        return result.OrderBy(s => s.Name).ToList();
    }

    /// <summary>All scopes a client can request, for pickers in the UI.</summary>
    [HttpGet("names")]
    public async Task<IReadOnlyList<string>> Names()
    {
        var names = new List<string>(BuiltInScopes);
        await foreach (var scope in manager.ListAsync())
        {
            names.Add((await manager.GetNameAsync(scope))!);
        }
        return names;
    }

    [HttpPost]
    public async Task<IActionResult> Create(ScopeSaveRequest request)
    {
        if (BuiltInScopes.Contains(request.Name) || await manager.FindByNameAsync(request.Name) is not null)
        {
            return Conflict(new { error = $"The scope '{request.Name}' already exists." });
        }

        var descriptor = new OpenIddictScopeDescriptor();
        Apply(descriptor, request);
        var scope = await manager.CreateAsync(descriptor);
        return Ok(await ToDtoAsync(scope));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, ScopeSaveRequest request)
    {
        var scope = await manager.FindByIdAsync(id);
        if (scope is null) return NotFound();

        var descriptor = new OpenIddictScopeDescriptor();
        await manager.PopulateAsync(descriptor, scope);

        if (descriptor.Name != request.Name)
        {
            if (descriptor.Name == AdminApi.Scope)
                return BadRequest(new { error = "The admin API scope cannot be renamed." });
            if (BuiltInScopes.Contains(request.Name) || await manager.FindByNameAsync(request.Name) is not null)
                return Conflict(new { error = $"The scope '{request.Name}' already exists." });
        }

        Apply(descriptor, request);
        await manager.UpdateAsync(scope, descriptor);
        return Ok(await ToDtoAsync(scope));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var scope = await manager.FindByIdAsync(id);
        if (scope is null) return NotFound();

        if (await manager.GetNameAsync(scope) == AdminApi.Scope)
        {
            return BadRequest(new { error = "The admin API scope cannot be deleted." });
        }

        await manager.DeleteAsync(scope);
        return NoContent();
    }

    private static void Apply(OpenIddictScopeDescriptor descriptor, ScopeSaveRequest request)
    {
        descriptor.Name = request.Name.Trim();
        descriptor.DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim();
        descriptor.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        descriptor.Resources.Clear();
        descriptor.Resources.UnionWith((request.Resources ?? []).Where(r => !string.IsNullOrWhiteSpace(r)).Select(r => r.Trim()));
    }

    private async Task<ScopeDto> ToDtoAsync(object scope)
    {
        var d = new OpenIddictScopeDescriptor();
        await manager.PopulateAsync(d, scope);
        return new ScopeDto((await manager.GetIdAsync(scope))!, d.Name!, d.DisplayName, d.Description,
            d.Resources.Order().ToList(), d.Name == AdminApi.Scope);
    }
}
