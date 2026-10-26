using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using OpenIddict.EntityFrameworkCore.Models;

namespace Idp.Server.Data;

public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(b =>
        {
            b.Property(u => u.FirstName).HasMaxLength(100);
            b.Property(u => u.LastName).HasMaxLength(100);
        });

        // OpenIddict's (ApplicationId, Status, Subject, Type) token index would exceed MySQL's
        // 3072-byte key limit with utf8mb4. Subjects are user GUIDs or client ids, so 255 is ample.
        builder.Entity<OpenIddictEntityFrameworkCoreToken>().Property(t => t.Subject).HasMaxLength(255);
        builder.Entity<OpenIddictEntityFrameworkCoreAuthorization>().Property(a => a.Subject).HasMaxLength(255);

        // MySQL cannot index unbounded text columns, so cap every string that takes part
        // in a key or index (Identity and OpenIddict leave several of them unbounded).
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            var indexed = entity.GetKeys().SelectMany(k => k.Properties)
                .Concat(entity.GetForeignKeys().SelectMany(k => k.Properties))
                .Concat(entity.GetIndexes().SelectMany(i => i.Properties))
                .Distinct();

            foreach (var property in indexed)
            {
                if (property.ClrType == typeof(string) && property.GetMaxLength() is null)
                {
                    property.SetMaxLength(255);
                }
            }
        }
    }
}
