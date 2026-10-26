using System.ComponentModel.DataAnnotations;

namespace Idp.Server.Models;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password,
    bool RememberMe,
    string? ReturnUrl);

public record RegisterRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required] string Password,
    [MaxLength(100)] string? FirstName,
    [MaxLength(100)] string? LastName,
    string? ReturnUrl);

public record RedirectResponse(string RedirectUrl);

public record CurrentUserResponse(bool IsAuthenticated, string? Id, string? Email, string? Name, IList<string> Roles);

public record UiSettingsResponse(bool AllowRegistration);

public record ConsentScope(string Name, string DisplayName, string? Description);

public record ConsentInfoResponse(string ClientId, string ApplicationName, IReadOnlyList<ConsentScope> Scopes);
