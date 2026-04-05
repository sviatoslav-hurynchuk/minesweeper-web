namespace Minesweeper.API.Models;

public class SoloLeaderboard
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Difficulty Difficulty { get; set; }
    public long TimeSpentMs { get; set; }
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;

    // navigation properties
    public User User { get; set; } = null!;
}