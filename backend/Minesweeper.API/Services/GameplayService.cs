using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Hubs;

namespace Minesweeper.API.Services
{
    public interface IGameplayService
    {
        Task SendCursorPositionAsync(Guid matchId, string connectionId, int? cellIndex);
        Task RevealCellAsync(Guid matchId, string connectionId, int x, int y);
        Task ToggleFlagAsync(Guid matchId, string connectionId, int index, bool isFlagged);
        Task LeaveMatchAsync(Guid matchId);
    }

    public class GameplayService : IGameplayService
    {
        private readonly IGameStateManager _state;
        private readonly IHubContext<GameHub> _hubContext;

        public GameplayService(IGameStateManager state, IHubContext<GameHub> hubContext)
        {
            _state = state;
            _hubContext = hubContext;
        }

        public async Task SendCursorPositionAsync(Guid matchId, string connectionId, int? cellIndex)
        {
            if (!_state.ActiveMatches.TryGetValue(matchId, out var match)) return;
            if (!match.Players.ContainsKey(connectionId)) return;

            await _hubContext.Clients.GroupExcept(matchId.ToString(), connectionId)
                                   .SendAsync("OpponentCursorMoved", cellIndex);
        }

        public async Task RevealCellAsync(Guid matchId, string connectionId, int x, int y)
        {
            if (!_state.ActiveMatches.TryGetValue(matchId, out var match)) return;

            var opponentId = match.Players.Keys.FirstOrDefault(id => id != connectionId) ?? string.Empty;

            var clientProxy = _hubContext.Clients.Client(connectionId);
            var opponentProxy = string.IsNullOrEmpty(opponentId) ? null! : _hubContext.Clients.Client(opponentId);
            var groupProxy = _hubContext.Clients.Group(matchId.ToString());

            await match.ModeStrategy.HandleRevealAsync(match, connectionId, x, y, clientProxy, opponentProxy, groupProxy);
        }

        public async Task ToggleFlagAsync(Guid matchId, string connectionId, int index, bool isFlagged)
        {
            if (!_state.ActiveMatches.TryGetValue(matchId, out var match)) return;
            if (!match.Players.ContainsKey(connectionId)) return;

            if (match.GameMode == "CoOp")
            {
                await _hubContext.Clients.GroupExcept(matchId.ToString(), connectionId)
                                       .SendAsync("FlagToggled", index, isFlagged);
            }
        }

        public async Task LeaveMatchAsync(Guid matchId)
        {
            if (_state.ActiveMatches.TryRemove(matchId, out _))
            {
                await _hubContext.Clients.Group(matchId.ToString()).SendAsync("MatchFinished", new { Status = "Abandoned" });
            }
        }
    }
}
