using Idp.Server.Data;
using Idp.Server.Infrastructure;
using Idp.Server.Models;
using Idp.Server.Options;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Idp.Server.Controllers;

/// <summary>
/// Cookie-based account API used by the React login/register/consent pages.
/// Signing in here creates the IDP session that /connect/authorize relies on.
/// </summary>
[ApiController]
[Route("api/account")]
public class AccountController(
    SignInManager<ApplicationUser> signInManager,
    UserManager<ApplicationUser> userManager,
    IOpenIddictApplicationManager applicationManager,
    IOpenIddictScopeManager scopeManager,
    IAntiforgery antiforgery,
    IOptions<IdpOptions> options) : ControllerBase
{
    private readonly IdpOptions _options = options.Value;

    [HttpGet("settings")]
    public UiSettingsResponse Settings() => new(_options.AllowRegistration);

    /// <summary>Issues the XSRF-TOKEN cookie the SPA echoes back in the X-XSRF-TOKEN header.</summary>
    [HttpGet("antiforgery")]
    public IActionResult Antiforgery()
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Cookies.Append("XSRF-TOKEN", tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Strict,
            Path = "/",
        });
        return NoContent();
    }

    [HttpGet("me")]
    public async Task<CurrentUserResponse> Me()
    {
        var user = User.Identity?.IsAuthenticated == true ? await userManager.GetUserAsync(User) : null;
        return user is null
            ? new(false, null, null, null, [])
            : new(true, user.Id, user.Email, user.DisplayName, await userManager.GetRolesAsync(user));
    }

    [HttpPost("login"), ValidateXsrf]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return Unauthorized(new { error = "Invalid email or password." });
        }

        var result = await signInManager.PasswordSignInAsync(user, request.Password, request.RememberMe, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            return Unauthorized(new { error = "This account is locked. Try again later or contact an administrator." });
        }
        if (result.IsNotAllowed)
        {
            return Unauthorized(new { error = "This account is not allowed to sign in yet." });
        }
        if (!result.Succeeded)
        {
            return Unauthorized(new { error = "Invalid email or password." });
        }

        user.LastLoginAt = DateTimeOffset.UtcNow;
        await userManager.UpdateAsync(user);

        return Ok(new RedirectResponse(SafeReturnUrl(request.ReturnUrl)));
    }

    [HttpPost("register"), ValidateXsrf]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        if (!_options.AllowRegistration)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "Self-registration is disabled." });
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            FirstName = request.FirstName?.Trim(),
            LastName = request.LastName?.Trim(),
            LastLoginAt = DateTimeOffset.UtcNow,
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(new { error = "Registration failed.", details = result.Errors.Select(e => e.Description) });
        }

        await userManager.AddToRoleAsync(user, _options.DefaultRole);
        await signInManager.SignInAsync(user, isPersistent: false);

        return Ok(new RedirectResponse(SafeReturnUrl(request.ReturnUrl)));
    }

    [HttpPost("logout"), ValidateXsrf]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }

    /// <summary>Describes the application and scopes shown on the consent screen.</summary>
    [HttpGet("consent")]
    public async Task<IActionResult> ConsentInfo([FromQuery(Name = "client_id")] string clientId, [FromQuery] string? scope)
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Unauthorized();
        }

        var application = await applicationManager.FindByClientIdAsync(clientId);
        if (application is null)
        {
            return NotFound(new { error = "Unknown application." });
        }

        var scopes = new List<ConsentScope>();
        foreach (var name in (scope ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            scopes.Add(name switch
            {
                Scopes.OpenId => new(name, "Sign you in", "Confirm your identity"),
                Scopes.Profile => new(name, "Your profile", "Name and username"),
                Scopes.Email => new(name, "Your email address", null),
                Scopes.Roles => new(name, "Your roles", null),
                Scopes.OfflineAccess => new(name, "Stay signed in", "Access your data while you are away"),
                _ => await scopeManager.FindByNameAsync(name) is { } s
                    ? new(name, await scopeManager.GetDisplayNameAsync(s) ?? name, await scopeManager.GetDescriptionAsync(s))
                    : new(name, name, null),
            });
        }

        return Ok(new ConsentInfoResponse(clientId, await applicationManager.GetDisplayNameAsync(application) ?? clientId, scopes));
    }

    /// <summary>Only allow redirects back into the IDP itself (normally /connect/authorize?...).</summary>
    private string SafeReturnUrl(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl) ? returnUrl : "/";
}
