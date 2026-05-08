using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Services;

namespace Minesweeper.API.Hubs
{
    public class GameHub : Hub
    {
        private readonly ILobbyService _lobbyService;
        private readonly IMatchService _matchService;
        private readonly IGameplayService _gameplayService;

        public GameHub(ILobbyService lobbyService, IMatchService matchService, IGameplayService gameplayService)
        {
            _lobbyService = lobbyService;
            _matchService = matchService;
            _gameplayService = gameplayService;
        }

        // --- LOBBY METHODS ---
        public async Task JoinLobby(string username, string userId) =>
            await _lobbyService.JoinLobbyAsync(Context.ConnectionId, username, userId);

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await _lobbyService.HandleDisconnectAsync(Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }

        public async Task ChallengePlayer(string targetConnectionId, string mode) =>
            await _lobbyService.ChallengePlayerAsync(Context.ConnectionId, targetConnectionId, mode);

        public async Task AcceptChallenge(string challengerConnectionId, string mode) =>
            await _matchService.AcceptChallengeAsync(Context.ConnectionId, challengerConnectionId, mode);

        // --- GAMEPLAY METHODS ---
        public async Task SendCursorPosition(Guid matchId, int? cellIndex) =>
            await _gameplayService.SendCursorPositionAsync(matchId, Context.ConnectionId, cellIndex);

        public async Task RevealCell(Guid matchId, int x, int y) =>
            await _gameplayService.RevealCellAsync(matchId, Context.ConnectionId, x, y);

        public async Task ToggleFlag(Guid matchId, int index, bool isFlagged) =>
            await _gameplayService.ToggleFlagAsync(matchId, Context.ConnectionId, index, isFlagged);

        public async Task LeaveMatch(Guid matchId) =>
            await _gameplayService.LeaveMatchAsync(matchId);

        // --- MATCH INITIALIZATION ---
        public async Task StartSoloMatch(int width, int height, int minesCount) =>
            await _matchService.StartSoloMatchAsync(Context.ConnectionId, width, height, minesCount);
    }
}