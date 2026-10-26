using MySql.Data.MySqlClient;

namespace Idp.Server.Infrastructure;

/// <summary>
/// Loads secrets from a <c>.env</c> file (KEY=VALUE per line) next to the app, then maps the
/// friendly variable names below onto configuration. Real environment variables always win,
/// so the same keys can be set by the host in production instead of using the file.
/// <list type="bullet">
/// <item>DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD → ConnectionStrings:Default</item>
/// <item>ADMIN_EMAIL, ADMIN_PASSWORD → Idp:Admin (first administrator, created on startup)</item>
/// <item>IDP_ISSUER → Idp:Issuer; CERT_PASSWORD → Idp:Certificates:Password</item>
/// </list>
/// Any other ASP.NET Core setting can be given with the usual <c>Section__Key</c> form.
/// </summary>
public static class EnvFile
{
    public static void Load()
    {
        var path = new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory }
            .Select(dir => Path.Combine(dir, ".env"))
            .FirstOrDefault(File.Exists);
        if (path is null) return;

        foreach (var rawLine in File.ReadAllLines(path))
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;

            var separator = line.IndexOf('=');
            if (separator <= 0) continue;

            var key = line[..separator].Trim();
            var value = line[(separator + 1)..].Trim();
            if (value.Length >= 2 && (value[0] == '"' && value[^1] == '"' || value[0] == '\'' && value[^1] == '\''))
            {
                value = value[1..^1];
            }

            if (Environment.GetEnvironmentVariable(key) is null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }

    public static void AddFriendlyVariables(ConfigurationManager configuration)
    {
        string? Env(string name) => Environment.GetEnvironmentVariable(name) is { Length: > 0 } v ? v : null;
        var settings = new Dictionary<string, string?>();

        if (Env("DB_NAME") is { } database)
        {
            settings["ConnectionStrings:Default"] = new MySqlConnectionStringBuilder
            {
                Server = Env("DB_HOST") ?? "localhost",
                Port = uint.Parse(Env("DB_PORT") ?? "3306"),
                Database = database,
                UserID = Env("DB_USER") ?? "root",
                Password = Env("DB_PASSWORD") ?? "",
            }.ConnectionString;
        }

        if (Env("ADMIN_EMAIL") is { } adminEmail) settings["Idp:Admin:Email"] = adminEmail;
        if (Env("ADMIN_PASSWORD") is { } adminPassword) settings["Idp:Admin:Password"] = adminPassword;
        if (Env("IDP_ISSUER") is { } issuer) settings["Idp:Issuer"] = issuer;
        if (Env("CERT_PASSWORD") is { } certPassword) settings["Idp:Certificates:Password"] = certPassword;

        if (settings.Count > 0)
        {
            configuration.AddInMemoryCollection(settings);
        }
    }
}
