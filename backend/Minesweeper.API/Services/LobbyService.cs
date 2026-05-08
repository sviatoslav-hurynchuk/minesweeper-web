using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Hubs;
using Minesweeper.API.Models;

namespace Minesweeper.API.Services
{
    public interface ILobbyService
    {
        Task JoinLobbyAsync(string connectionId, string username, string userId);
        Task HandleDisconnectAsync(string connectionId);
        Task ChallengePlayerAsync(string challengerId, string targetConnectionId, string mode);
    }

    public class LobbyService : ILobbyService
    {
        private readonly IGameStateManager _state;
        private readonly IHubContext<GameHub> _hubContext;
        private readonly IGameplayService _gameplayService;

        public LobbyService(IGameStateManager state, IHubContext<GameHub> hubContext, IGameplayService gameplayService)
        {
            _state = state;
            _hubContext = hubContext;
            _gameplayService = gameplayService;
        }

        public async Task JoinLobbyAsync(string connectionId, string username, string userId)
        {
            var player = new PlayerData { ConnectionId = connectionId, Username = username, UserId = userId };
            _state.GetOnlinePlayers().AddOrUpdate(connectionId, player, (_, _) => player);
            await _hubContext.Clients.All.SendAsync("LobbyUpdated", _state.GetOnlinePlayers().Values);
        }

        public async Task HandleDisconnectAsync(string connectionId)
        {
            if (_state.GetOnlinePlayers().TryRemove(connectionId, out _))
            {
                await _hubContext.Clients.All.SendAsync("LobbyUpdated", _state.GetOnlinePlayers().Values);
            }

            var activeMatch = _state.ActiveMatches.Values.FirstOrDefault(m => m.Players.ContainsKey(connectionId));
            if (activeMatch != null)
            {
                await _gameplayService.LeaveMatchAsync(activeMatch.MatchId);
            }
        }

        public async Task ChallengePlayerAsync(string challengerId, string targetConnectionId, string mode)
        {
            if (_state.GetOnlinePlayers().TryGetValue(challengerId, out var challenger))
            {
                await _hubContext.Clients.Client(targetConnectionId).SendAsync("ChallengeReceived", challenger.Username, challengerId, mode);
            }
        }
    }
}
