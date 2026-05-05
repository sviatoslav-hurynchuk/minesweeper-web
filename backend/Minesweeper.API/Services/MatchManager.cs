using Minesweeper.API.Models;
using System.Collections.Concurrent;

namespace Minesweeper.API.Services
{
    public class MatchManager : IMatchManager
    {
        public ConcurrentDictionary<Guid, GameState> ActiveMatches { get; } = new();
        public ConcurrentDictionary<string, PlayerData> OnlinePlayers { get; } = new();
        private readonly ConcurrentDictionary<string, byte> _reservations = new();

        public bool TryReserve(string p1, string p2)
        {
            if (_reservations.TryAdd(p1, 1))
            {
                if (_reservations.TryAdd(p2, 1)) return true;
                _reservations.TryRemove(p1, out _);
            }
            return false;
        }

        public void ReleaseReservation(string p1, string p2)
        {
            _reservations.TryRemove(p1, out _);
            _reservations.TryRemove(p2, out _);
        }

        public void AddOnlinePlayer(string connectionId, PlayerData player) =>
            OnlinePlayers.AddOrUpdate(connectionId, player, (_, _) => player);

        public bool RemoveOnlinePlayer(string connectionId) =>
            OnlinePlayers.TryRemove(connectionId, out _);
    }
}