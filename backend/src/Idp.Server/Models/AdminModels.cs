using System.ComponentModel.DataAnnotations;

namespace Idp.Server.Models;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

// ---------- Applications (OIDC clients) ----------

public record ApplicationDto(
    string Id,
    string ClientId,
    string? DisplayName,
    string ClientType,
    string ConsentType,
    IReadOnlyList<string> RedirectUris,
    IReadOnlyList<string> PostLogoutRedirectUris,
    IReadOnlyList<string> GrantTypes,
    IReadOnlyList<string> Scopes,
    bool RequirePkce,
    bool IsSystem,
    /// <summary>Users who currently have access (a valid authorization) to this application.</summary>
    int UserCount);

/// <summary>A user as seen from one application: when they first signed in to it and whether they still have access.</summary>
public record ApplicationUserDto(
    string Id,
    string Email,
    string? FirstName,
    string? LastName,
    IReadOnlyList<string> Roles,
    bool IsLockedOut,
    bool HasAccess,
    DateTimeOffset? FirstAccessAt,
    DateTimeOffset? LastUsedAt);

public record ApplicationUserGrantRequest([Required] string UserId);

public record ApplicationSaveRequest(
    [Required, MaxLength(100), RegularExpression("^[A-Za-z0-9._:-]+$")] string ClientId,
    [MaxLength(200)] string? DisplayName,
    [Required] string ClientType,
    [Required] string ConsentType,
    List<string>? RedirectUris,
    List<string>? PostLogoutRedirectUris,
    List<string>? GrantTypes,
    List<string>? Scopes,
    bool RequirePkce,
    /// <summary>Optional on create (one is generated for confidential clients); ignored on update.</summary>
    string? ClientSecret);

/// <summary>Returned once when a client is created or its secret rotated. The secret is never shown again.</summary>
public record ApplicationSecretResponse(ApplicationDto Application, string? ClientSecret);

// ---------- Scopes ----------

public record ScopeDto(string Id, string Name, string? DisplayName, string? Description, IReadOnlyList<string> Resources, bool IsSystem);

public record ScopeSaveRequest(
    [Required, MaxLength(100), RegularExpression("^[A-Za-z0-9._:-]+$")] string Name,
    [MaxLength(200)] string? DisplayName,
    [MaxLength(500)] string? Description,
    List<string>? Resources);

// ---------- Users ----------

public record UserDto(
    string Id,
    string Email,
    string? FirstName,
    string? LastName,
    bool EmailConfirmed,
    bool IsLockedOut,
    IReadOnlyList<string> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt);

public record UserCreateRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required] string Password,
    [MaxLength(100)] string? FirstName,
    [MaxLength(100)] string? LastName,
    bool EmailConfirmed,
    List<string>? Roles);

public record UserUpdateRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [MaxLength(100)] string? FirstName,
    [MaxLength(100)] string? LastName,
    bool EmailConfirmed,
    List<string>? Roles);

public record SetPasswordRequest([Required] string Password);

// ---------- Roles ----------

public record RoleDto(string Id, string Name, int UserCount, bool IsSystem);

public record RoleCreateRequest([Required, MaxLength(100)] string Name);

// ---------- Dashboard ----------

public record StatsDto(int Users, int Applications, int Scopes, int Roles, int LockedUsers, int NewUsersLast7Days);
