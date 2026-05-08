using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Hubs;
using Minesweeper.API.Models;
using Minesweeper.API.Strategies;

namespace Minesweeper.API.Services
{
    public interface IMatchService
    {
        Task StartSoloMatchAsync(string connectionId, int width, int height, int minesCount);
        Task AcceptChallengeAsync(string acceptorId, string challengerConnectionId, string mode);
    }

    public class MatchService : IMatchService
    {
        private readonly IGameStateManager _state;
        private readonly IHubContext<GameHub> _hubContext;

        public MatchService(IGameStateManager state, IHubContext<GameHub> hubContext)
        {
            _state = state;
            _hubContext = hubContext;
        }

        public async Task StartSoloMatchAsync(string connectionId, int width, int height, int minesCount)
        {
            var client = _hubContext.Clients.Client(connectionId);

            const int MaxDim = 50;
            if (width <= 0 || height <= 0 || width > MaxDim || height > MaxDim)
            {
                await client.SendAsync("ErrorMessage", "Некоректні розміри поля."); return;
            }
            if (minesCount <= 0 || minesCount >= (width * height) - 9)
            {
                await client.SendAsync("ErrorMessage", "Некоректна кількість мін."); return;
            }
            if (_state.ActiveMatches.Values.Any(m => m.Players.ContainsKey(connectionId)))
            {
                await client.SendAsync("ErrorMessage", "Ви вже граєте в іншому матчі."); return;
            }

            Guid matchId = Guid.NewGuid();
            var match = new GameState { MatchId = matchId, GameMode = "Solo", ModeStrategy = new SoloStrategy() };

            string username = _state.GetOnlinePlayers().GetValueOrDefault(connectionId)?.Username ?? "Solo Player";
            match.Players.TryAdd(connectionId, new PlayerData { ConnectionId = connectionId, Username = username });

            match.ModeStrategy.InitializeGame(match, width, height, minesCount);
            _state.ActiveMatches.TryAdd(matchId, match);

            await _hubContext.Groups.AddToGroupAsync(connectionId, matchId.ToString());
            match.StartTime = DateTime.UtcNow;

            await client.SendAsync("GameStarted", new
            {
                MatchId = matchId.ToString(),
                Mode = "Solo",
                Rows = height,
                Cols = width,
                TotalMines = minesCount
            });
        }

        public async Task AcceptChallengeAsync(string acceptorId, string challengerConnectionId, string mode)
        {
            var acceptorClient = _hubContext.Clients.Client(acceptorId);
            if (!_state.GetOnlinePlayers().TryGetValue(challengerConnectionId, out var challenger))
            {
                await acceptorClient.SendAsync("ErrorMessage", "Гравець вийшов з мережі."); return;
            }

            bool challengerReserved = false;
            bool acceptorReserved = false;

            try
            {
                challengerReserved = _state.Reservations.TryAdd(challengerConnectionId, 1);
                if (challengerReserved) acceptorReserved = _state.Reservations.TryAdd(acceptorId, 1);

                if (!challengerReserved || !acceptorReserved)
                {
                    await acceptorClient.SendAsync("ErrorMessage", "Неможливо почати матч: хтось вже обробляє запит."); return;
                }

                if (_state.ActiveMatches.Values.Any(m => m.Players.ContainsKey(challengerConnectionId) || m.Players.ContainsKey(acceptorId)))
                {
                    await acceptorClient.SendAsync("ErrorMessage", "Один з гравців вже грає."); return;
                }

                await StartPvPMatchInternalAsync(Guid.NewGuid(), mode, challengerConnectionId, acceptorId);
            }
            finally
            {
                if (acceptorReserved) _state.Reservations.TryRemove(acceptorId, out _);
                if (challengerReserved) _state.Reservations.TryRemove(challengerConnectionId, out _);
            }
        }

        private async Task StartPvPMatchInternalAsync(Guid matchId, string mode, string player1Id, string player2Id)
        {
            var match = new GameState
            {
                MatchId = matchId,
                GameMode = mode,
                ModeStrategy = mode == "PvP" ? new PvpSpeedrunStrategy() : new CoOpStrategy()
            };

            match.Players.TryAdd(player1Id, new PlayerData { ConnectionId = player1Id, Username = _state.GetOnlinePlayers().GetValueOrDefault(player1Id)?.Username ?? "Player 1" });
            match.Players.TryAdd(player2Id, new PlayerData { ConnectionId = player2Id, Username = _state.GetOnlinePlayers().GetValueOrDefault(player2Id)?.Username ?? "Player 2" });

            match.ModeStrategy.InitializeGame(match, 16, 16, 40);
            _state.ActiveMatches.TryAdd(matchId, match);

            await _hubContext.Groups.AddToGroupAsync(player1Id, matchId.ToString());
            await _hubContext.Groups.AddToGroupAsync(player2Id, matchId.ToString());
            match.StartTime = DateTime.UtcNow;

            await _hubContext.Clients.Group(matchId.ToString()).SendAsync("GameStarted", new { MatchId = matchId.ToString(), Mode = mode, Rows = 16, Cols = 16, match.TotalMines });
        }
    }
}

