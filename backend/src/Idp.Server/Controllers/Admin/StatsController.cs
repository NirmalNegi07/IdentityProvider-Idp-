using Idp.Server.Data;
using Idp.Server.Models;
using Idp.Server.Options;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;

namespace Idp.Server.Controllers.Admin;

[ApiController]
[Route("api/admin/stats")]
[Authorize(Policy = AdminApi.Policy)]
public class StatsController(
    ApplicationDbContext db,
    IOpenIddictApplicationManager applications,
    IOpenIddictScopeManager scopes) : ControllerBase
{
    [HttpGet]
    public async Task<StatsDto> Get()
    {
        var now = DateTimeOffset.UtcNow;
        var weekAgo = now.AddDays(-7);

        return new StatsDto(
            Users: await db.Users.CountAsync(),
            Applications: (int)await applications.CountAsync(),
            Scopes: (int)await scopes.CountAsync(),
            Roles: await db.Roles.CountAsync(),
            LockedUsers: await db.Users.CountAsync(u => u.LockoutEnd != null && u.LockoutEnd > now),
            NewUsersLast7Days: await db.Users.CountAsync(u => u.CreatedAt >= weekAgo));
    }
}
