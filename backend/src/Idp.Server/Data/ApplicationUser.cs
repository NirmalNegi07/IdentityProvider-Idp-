using Microsoft.AspNetCore.Identity;

namespace Idp.Server.Data;

public class ApplicationUser : IdentityUser
{
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastLoginAt { get; set; }

    public string DisplayName =>
        string.Join(' ', new[] { FirstName, LastName }.Where(s => !string.IsNullOrWhiteSpace(s))) is { Length: > 0 } name
            ? name
            : Email ?? UserName ?? Id;
}
