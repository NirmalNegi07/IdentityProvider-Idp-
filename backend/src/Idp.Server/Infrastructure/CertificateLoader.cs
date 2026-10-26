using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Idp.Server.Infrastructure;

/// <summary>
/// Loads the token signing/encryption certificates from PFX files, creating self-signed
/// ones on first run. Keeping them on disk means tokens stay valid across restarts.
/// In production, point the paths at certificates you manage (and back them up).
/// </summary>
public static class CertificateLoader
{
    public static X509Certificate2 LoadOrCreate(string path, string? password, string subject, X509KeyUsageFlags usage)
    {
        var fullPath = Path.GetFullPath(path);

        if (!File.Exists(fullPath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

            using var rsa = RSA.Create(2048);
            var request = new CertificateRequest($"CN={subject}", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            request.CertificateExtensions.Add(new X509KeyUsageExtension(usage, critical: true));

            using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddYears(2));
            File.WriteAllBytes(fullPath, certificate.Export(X509ContentType.Pfx, password));
        }

        // Ephemeral key sets avoid writing private keys to the OS key store, but macOS does not support them.
        var flags = OperatingSystem.IsMacOS() ? X509KeyStorageFlags.DefaultKeySet : X509KeyStorageFlags.EphemeralKeySet;
        return X509CertificateLoader.LoadPkcs12FromFile(fullPath, password, flags);
    }
}
