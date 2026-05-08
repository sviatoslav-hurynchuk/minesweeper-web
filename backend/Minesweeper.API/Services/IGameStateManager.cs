using System.Collections.Concurrent;
using Minesweeper.API.Hubs;
using Minesweeper.API.Models;

namespace Minesweeper.API.Services
{
    public interface IGameStateManager
    {
        ConcurrentDictionary<Guid, GameState> ActiveMatches { get; }
        ConcurrentDictionary<string, PlayerData> OnlinePlayers { get; }
        ConcurrentDictionary<string, byte> Reservations { get; }
    }
}
