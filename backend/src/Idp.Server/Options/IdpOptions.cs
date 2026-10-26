namespace Idp.Server.Options;

public class IdpOptions
{
    public const string SectionName = "Idp";

    /// <summary>Public base URL of the IDP (e.g. https://auth.example.com). Leave empty to infer from the request.</summary>
    public string? Issuer { get; set; }

    /// <summary>Whether end users can self-register from the login page.</summary>
    public bool AllowRegistration { get; set; } = true;

    /// <summary>Role given to self-registered users.</summary>
    public string DefaultRole { get; set; } = Roles.User;

    public AdminSeedOptions Admin { get; set; } = new();

    public CertificateOptions Certificates { get; set; } = new();

    public TokenLifetimeOptions Tokens { get; set; } = new();

    /// <summary>
    /// Extra origins allowed to call the OIDC endpoints from a browser. Origins of public clients'
    /// redirect URIs are allowed automatically.
    /// </summary>
    public string[] CorsOrigins { get; set; } = [];
}

public class AdminSeedOptions
{
    public string Email { get; set; } = "admin@localhost";
    public string Password { get; set; } = "";
}

public class CertificateOptions
{
    /// <summary>PFX used to sign tokens. Created automatically if it does not exist.</summary>
    public string SigningPath { get; set; } = "keys/signing.pfx";

    /// <summary>PFX used to encrypt tokens. Created automatically if it does not exist.</summary>
    public string EncryptionPath { get; set; } = "keys/encryption.pfx";

    public string? Password { get; set; }

    /// <summary>Folder for ASP.NET Core data protection keys (cookie encryption).</summary>
    public string DataProtectionPath { get; set; } = "keys/dataprotection";
}

public class TokenLifetimeOptions
{
    public int AccessTokenMinutes { get; set; } = 60;
    public int IdentityTokenMinutes { get; set; } = 20;
    public int RefreshTokenDays { get; set; } = 14;
    public int AuthorizationCodeMinutes { get; set; } = 5;
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string User = "User";
}

public static class AdminApi
{
    public const string Scope = "idp_admin_api";
    public const string Resource = "idp-admin-api";
    public const string ClientId = "idp-admin";
    public const string Policy = "AdminApi";
}
