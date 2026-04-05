using Microsoft.EntityFrameworkCore;
using Minesweeper.API.Models;
using System.Reflection.Emit;

namespace Minesweeper.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<SoloLeaderboard> SoloLeaderboards { get; set; }
    public DbSet<MatchHistory> MatchHistories { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<MatchHistory>()
            .HasOne(m => m.Player1)
            .WithMany()
            .HasForeignKey(m => m.Player1Id)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MatchHistory>()
            .HasOne(m => m.Player2)
            .WithMany()
            .HasForeignKey(m => m.Player2Id)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MatchHistory>()
            .HasOne(m => m.Winner)
            .WithMany()
            .HasForeignKey(m => m.WinnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}