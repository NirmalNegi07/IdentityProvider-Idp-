using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Idp.Server.Infrastructure;

/// <summary>
/// Validates the X-XSRF-TOKEN header for cookie-authenticated API calls made by the React UI.
/// The token is issued by GET /api/account/antiforgery.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class ValidateXsrfAttribute : Attribute, IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        var antiforgery = context.HttpContext.RequestServices.GetRequiredService<IAntiforgery>();
        if (!await antiforgery.IsRequestValidAsync(context.HttpContext))
        {
            context.Result = new BadRequestObjectResult(new { error = "Invalid or missing anti-forgery token. Reload the page and try again." });
        }
    }
}
