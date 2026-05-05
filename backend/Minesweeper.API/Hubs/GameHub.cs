using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Models;
using Minesweeper.API.Strategies;
using Minesweeper.API.Services;

namespace Minesweeper.API.Hubs
{
    public class PlayerData
    {
        public required string ConnectionId { get; set; }
        public required string Username { get; set; }
        public required string UserId { get; set; }
    }

    public class GameHub : Hub
    {
        private readonly IMatchManager _matchManager;

        public GameHub(IMatchManager matchManager)
        {
            _matchManager = matchManager;
        }

        public async Task JoinLobby(string username, string userId)
        {
            var player = new PlayerData { ConnectionId = Context.ConnectionId, Username = username, UserId = userId };
            _matchManager.AddOnlinePlayer(Context.ConnectionId, player);
            await Clients.All.SendAsync("LobbyUpdated", _matchManager.OnlinePlayers.Values);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (_matchManager.RemoveOnlinePlayer(Context.ConnectionId))
            {
                await Clients.All.SendAsync("LobbyUpdated", _matchManager.OnlinePlayers.Values);
            }

            var activeMatch = _matchManager.ActiveMatches.Values.FirstOrDefault(m => m.Players.ContainsKey(Context.ConnectionId));
            if (activeMatch != null) await LeaveMatch(activeMatch.MatchId);

            await base.OnDisconnectedAsync(exception);
        }

        public async Task ChallengePlayer(string targetConnectionId, string mode)
        {
            if (_matchManager.OnlinePlayers.TryGetValue(Context.ConnectionId, out var challenger))
            {
                await Clients.Client(targetConnectionId).SendAsync("ChallengeReceived", challenger.Username, Context.ConnectionId, mode);
            }
        }

        public async Task AcceptChallenge(string challengerConnectionId, string mode)
        {
            if (!_matchManager.OnlinePlayers.TryGetValue(challengerConnectionId, out _))
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Гравець вийшов з мережі.");
                return;
            }

            if (!_matchManager.TryReserve(challengerConnectionId, Context.ConnectionId))
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Неможливо почати матч: гравці зайняті.");
                return;
            }

            try
            {
                bool isEitherBusy = _matchManager.ActiveMatches.Values.Any(m =>
                    m.Players.ContainsKey(challengerConnectionId) || m.Players.ContainsKey(Context.ConnectionId));

                if (isEitherBusy)
                {
                    await Clients.Caller.SendAsync("ErrorMessage", "Один з гравців вже у грі.");
                    return;
                }

                await StartMatch(Guid.NewGuid(), mode, challengerConnectionId, Context.ConnectionId);
            }
            finally
            {
                _matchManager.ReleaseReservation(challengerConnectionId, Context.ConnectionId);
            }
        }

        public async Task RevealCell(Guid matchId, int x, int y)
        {
            if (!_matchManager.ActiveMatches.TryGetValue(matchId, out var match)) return;
            
            var opponentId = match.Players.Keys.FirstOrDefault(id => id != Context.ConnectionId) ?? string.Empty;
            var opponentProxy = string.IsNullOrEmpty(opponentId) ? null! : Clients.Client(opponentId);

            await match.ModeStrategy.HandleRevealAsync(match, Context.ConnectionId, x, y, Clients.Caller, opponentProxy, Clients.Group(matchId.ToString()));
        }

        public async Task LeaveMatch(Guid matchId)
        {
            if (_matchManager.ActiveMatches.TryRemove(matchId, out _))
            {
                await Clients.Group(matchId.ToString()).SendAsync("MatchFinished", new { Status = "Abandoned" });
            }
        }

        public async Task StartSoloMatch(int width, int height, int minesCount)
        {
            // (Логіка валідації залишається такою ж, але використовуємо _matchManager.ActiveMatches)
            // ... (вирізано для стислості, просто заміни ActiveMatches на _matchManager.ActiveMatches)
        }

        public async Task StartMatch(Guid matchId, string mode, string player1Id, string player2Id)
        {
            var match = new GameState
            {
                MatchId = matchId,
                GameMode = mode,
                ModeStrategy = mode == "PvP" ? new PvpSpeedrunStrategy() : new CoOpStrategy()
            };

            match.Players.TryAdd(player1Id, new PlayerState { ConnectionId = player1Id, Username = _matchManager.OnlinePlayers.GetValueOrDefault(player1Id)?.Username ?? "P1" });
            match.Players.TryAdd(player2Id, new PlayerState { ConnectionId = player2Id, Username = _matchManager.OnlinePlayers.GetValueOrDefault(player2Id)?.Username ?? "P2" });

            match.ModeStrategy.InitializeGame(match, 16, 16, 40);
            _matchManager.ActiveMatches.TryAdd(matchId, match);

            await Groups.AddToGroupAsync(player1Id, matchId.ToString());
            await Groups.AddToGroupAsync(player2Id, matchId.ToString());

            match.StartTime = DateTime.UtcNow;
            await Clients.Group(matchId.ToString()).SendAsync("GameStarted", new { MatchId = matchId, Mode = mode, Rows = 16, Cols = 16, match.TotalMines });
        }
    }
}