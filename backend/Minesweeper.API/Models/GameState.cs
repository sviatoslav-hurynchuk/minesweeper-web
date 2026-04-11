using Minesweeper.API.Strategies;
using System.Collections.Concurrent;

namespace Minesweeper.API.Models
{
    public class GameState
    {
        public Guid MatchId { get; set; }
        public string GameMode { get; set; } = string.Empty;

        public ConcurrentDictionary<string, PlayerState> Players { get; set; } = new();

        public IGameModeStrategy ModeStrategy { get; set; } = null!;
    }
}