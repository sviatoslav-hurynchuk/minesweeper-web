using System.Collections.Concurrent;
using Minesweeper.API.Hubs;
using Minesweeper.API.Models;

namespace Minesweeper.API.Services
{
    public class GameStateManager : IGameStateManager
    {
        public ConcurrentDictionary<Guid, GameState> ActiveMatches { get; } = new();
        public ConcurrentDictionary<string, PlayerData> OnlinePlayers { get; } = new();
        public ConcurrentDictionary<string, byte> Reservations { get; } = new();
    }
}
