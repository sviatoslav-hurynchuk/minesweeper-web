using System.Collections.Concurrent;
using Minesweeper.API.Hubs;
using Minesweeper.API.Models;

namespace Minesweeper.API.Services
{
    public class GameStateManager : IGameStateManager
    {
        public ConcurrentDictionary<Guid, GameState> ActiveMatches { get; } = new();
        private readonly ConcurrentDictionary<string, PlayerData> onlinePlayers = new();

        public ConcurrentDictionary<string, PlayerData> GetOnlinePlayers()
        {
            return onlinePlayers;
        }

        public ConcurrentDictionary<string, byte> Reservations { get; } = new();
    }
}
