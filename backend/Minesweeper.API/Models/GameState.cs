using Minesweeper.API.Strategies;
using System.Collections.Concurrent;

namespace Minesweeper.API.Models
{
    public class GameState
    {
        public Guid MatchId { get; set; }
        public string GameMode { get; set; } = string.Empty;

        public ConcurrentDictionary<string, PlayerData> Players { get; set; } = new();

        public IGameModeStrategy ModeStrategy { get; set; } = null!;
        public int TotalMines { get; set; }
        public DateTime? StartTime { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public bool IsPaused { get; set; }
    }
}