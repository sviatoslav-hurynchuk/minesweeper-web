using Minesweeper.API.Models;
using System.Collections.Concurrent;

namespace Minesweeper.API.Services
{
    public interface IMatchManager
    {
        ConcurrentDictionary<Guid, GameState> ActiveMatches { get; }
        ConcurrentDictionary<string, PlayerData> OnlinePlayers { get; }
        
        bool TryReserve(string p1, string p2);
        void ReleaseReservation(string p1, string p2);
        void AddOnlinePlayer(string connectionId, PlayerData player);
        bool RemoveOnlinePlayer(string connectionId);
    }
}