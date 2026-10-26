using Idp.Server.Data;
using Idp.Server.Models;
using Idp.Server.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace Idp.Server.Controllers.Admin;

/// <summary>Roles are issued to applications in the "role" claim (when the "roles" scope is requested).</summary>
[ApiController]
[Route("api/admin/roles")]
[Authorize(Policy = AdminApi.Policy)]
public class RolesController(ApplicationDbContext db, RoleManager<IdentityRole> roleManager) : ControllerBase
{
    private static readonly string[] SystemRoles = [Roles.Admin, Roles.User];

    [HttpGet]
    public async Task<IReadOnlyList<RoleDto>> List()
    {
        var counts = await db.UserRoles.GroupBy(ur => ur.RoleId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        return (await db.Roles.AsNoTracking().OrderBy(r => r.Name).ToListAsync())
            .Select(r => new RoleDto(r.Id, r.Name!, counts.GetValueOrDefault(r.Id), SystemRoles.Contains(r.Name)))
            .ToList();
    }

    [HttpPost]
    public async Task<IActionResult> Create(RoleCreateRequest request)
    {
        var name = request.Name.Trim();
        if (await roleManager.RoleExistsAsync(name))
        {
            return Conflict(new { error = $"The role '{name}' already exists." });
        }

        var role = new IdentityRole(name);
        var result = await roleManager.CreateAsync(role);
        return result.Succeeded
            ? Ok(new RoleDto(role.Id, role.Name!, 0, false))
            : BadRequest(new { error = string.Join(" ", result.Errors.Select(e => e.Description)) });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var role = await roleManager.FindByIdAsync(id);
        if (role is null) return NotFound();
        if (SystemRoles.Contains(role.Name))
        {
            return BadRequest(new { error = $"The built-in role '{role.Name}' cannot be deleted." });
        }

        await roleManager.DeleteAsync(role);
        return NoContent();
    }
}
