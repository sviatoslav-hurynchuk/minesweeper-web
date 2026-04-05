namespace Minesweeper.API.Models;

public class MatchHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public GameMode GameMode { get; set; }
    public Guid Player1Id { get; set; }
    public Guid Player2Id { get; set; }
    public Guid? WinnerId { get; set; }
    public long DurationMs { get; set; }
    public string? SettingsSnapshot { get; set; }
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;

    // navigation properties
    public User Player1 { get; set; } = null!;
    public User Player2 { get; set; } = null!;
    public User? Winner { get; set; }
}