using Idp.Server.Data;
using Idp.Server.Models;
using Idp.Server.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = AdminApi.Policy)]
public class UsersController(
    ApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IOpenIddictAuthorizationManager authorizationManager,
    IOpenIddictTokenManager tokenManager) : ControllerBase
{
    private string CurrentUserId => User.GetClaim(Claims.Subject)!;

    [HttpGet]
    public async Task<PagedResult<UserDto>> List([FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u => u.Email!.Contains(term) || u.FirstName!.Contains(term) || u.LastName!.Contains(term));
        }

        var total = await query.CountAsync();
        var users = await query.OrderBy(u => u.Email).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var ids = users.Select(u => u.Id).ToList();
        var roles = await (from ur in db.UserRoles
                           join r in db.Roles on ur.RoleId equals r.Id
                           where ids.Contains(ur.UserId)
                           select new { ur.UserId, r.Name }).ToListAsync();
        var rolesByUser = roles.ToLookup(r => r.UserId, r => r.Name!);

        return new PagedResult<UserDto>(users.Select(u => ToDto(u, rolesByUser[u.Id].ToList())).ToList(), total, page, pageSize);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id) =>
        await userManager.FindByIdAsync(id) is { } user ? Ok(ToDto(user, await userManager.GetRolesAsync(user))) : NotFound();

    [HttpPost]
    public async Task<IActionResult> Create(UserCreateRequest request)
    {
        if (await ValidateRolesAsync(request.Roles) is { } roleError) return BadRequest(new { error = roleError });

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName?.Trim(),
            LastName = request.LastName?.Trim(),
            EmailConfirmed = request.EmailConfirmed,
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return IdentityError(result);

        if (request.Roles is { Count: > 0 })
        {
            await userManager.AddToRolesAsync(user, request.Roles.Distinct());
        }

        return Ok(ToDto(user, await userManager.GetRolesAsync(user)));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, UserUpdateRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();
        if (await ValidateRolesAsync(request.Roles) is { } roleError) return BadRequest(new { error = roleError });

        var newRoles = (request.Roles ?? []).Distinct().ToList();
        if (id == CurrentUserId && !newRoles.Contains(Roles.Admin))
        {
            return BadRequest(new { error = "You cannot remove the Admin role from your own account." });
        }

        user.FirstName = request.FirstName?.Trim();
        user.LastName = request.LastName?.Trim();
        user.EmailConfirmed = request.EmailConfirmed;
        if (!string.Equals(user.Email, request.Email, StringComparison.OrdinalIgnoreCase))
        {
            user.Email = request.Email;
            user.UserName = request.Email;
        }

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded) return IdentityError(result);

        var currentRoles = await userManager.GetRolesAsync(user);
        await userManager.RemoveFromRolesAsync(user, currentRoles.Except(newRoles));
        await userManager.AddToRolesAsync(user, newRoles.Except(currentRoles));

        return Ok(ToDto(user, await userManager.GetRolesAsync(user)));
    }

    [HttpPost("{id}/password")]
    public async Task<IActionResult> SetPassword(string id, SetPasswordRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, request.Password);
        if (!result.Succeeded) return IdentityError(result);

        await RevokeSessionsAsync(user);
        return NoContent();
    }

    /// <summary>Disables the account and revokes all of its tokens, which signs the user out of every application.</summary>
    [HttpPost("{id}/lock")]
    public async Task<IActionResult> Lock(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();
        if (id == CurrentUserId) return BadRequest(new { error = "You cannot lock your own account." });

        await userManager.SetLockoutEnabledAsync(user, true);
        // MySQL datetime cannot hold DateTimeOffset.MaxValue; a century is "forever" here.
        await userManager.SetLockoutEndDateAsync(user, DateTimeOffset.UtcNow.AddYears(100));
        await RevokeSessionsAsync(user);
        return Ok(ToDto(user, await userManager.GetRolesAsync(user)));
    }

    [HttpPost("{id}/unlock")]
    public async Task<IActionResult> Unlock(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        await userManager.SetLockoutEndDateAsync(user, null);
        await userManager.ResetAccessFailedCountAsync(user);
        return Ok(ToDto(user, await userManager.GetRolesAsync(user)));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();
        if (id == CurrentUserId) return BadRequest(new { error = "You cannot delete your own account." });

        await RevokeSessionsAsync(user);
        var result = await userManager.DeleteAsync(user);
        return result.Succeeded ? NoContent() : IdentityError(result);
    }

    private async Task RevokeSessionsAsync(ApplicationUser user)
    {
        // Invalidates the IDP cookie (checked by the security stamp validator)...
        await userManager.UpdateSecurityStampAsync(user);

        // ...and every refresh/access token and stored consent issued to client applications.
        await foreach (var token in tokenManager.FindBySubjectAsync(user.Id))
        {
            await tokenManager.TryRevokeAsync(token);
        }
        await foreach (var authorization in authorizationManager.FindBySubjectAsync(user.Id))
        {
            await authorizationManager.TryRevokeAsync(authorization);
        }
    }

    private async Task<string?> ValidateRolesAsync(IEnumerable<string>? roles)
    {
        foreach (var role in roles ?? [])
        {
            if (!await roleManager.RoleExistsAsync(role)) return $"The role '{role}' does not exist.";
        }
        return null;
    }

    private BadRequestObjectResult IdentityError(IdentityResult result) =>
        BadRequest(new { error = string.Join(" ", result.Errors.Select(e => e.Description)) });

    private static UserDto ToDto(ApplicationUser user, IEnumerable<string> roles) => new(
        user.Id,
        user.Email!,
        user.FirstName,
        user.LastName,
        user.EmailConfirmed,
        user.LockoutEnd is { } end && end > DateTimeOffset.UtcNow,
        roles.Order().ToList(),
        user.CreatedAt,
        user.LastLoginAt);
}
