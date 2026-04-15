using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Models;
using Minesweeper.API.Strategies;
using System.Collections.Concurrent;

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
        private static readonly ConcurrentDictionary<Guid, GameState> ActiveMatches = new();
        private static readonly ConcurrentDictionary<string, PlayerData> OnlinePlayers = new();

        // --- LOBBY METHODS ---

        public async Task JoinLobby(string username, string userId)
        {
            var player = new PlayerData { ConnectionId = Context.ConnectionId, Username = username, UserId = userId };
            OnlinePlayers.AddOrUpdate(Context.ConnectionId, player, (_, _) => player);
            await Clients.All.SendAsync("LobbyUpdated", OnlinePlayers.Values);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (OnlinePlayers.TryRemove(Context.ConnectionId, out _))
            {
                await Clients.All.SendAsync("LobbyUpdated", OnlinePlayers.Values);
            }
            // Auto-leave match if disconnected
            var activeMatch = ActiveMatches.Values.ToList().FirstOrDefault(m => m.Players.ContainsKey(Context.ConnectionId));
            if (activeMatch != null) await LeaveMatch(activeMatch.MatchId);

            await base.OnDisconnectedAsync(exception);
        }

        public async Task ChallengePlayer(string targetConnectionId, string mode)
        {
            if (OnlinePlayers.TryGetValue(Context.ConnectionId, out var challenger))
            {
                await Clients.Client(targetConnectionId).SendAsync("ChallengeReceived", challenger.Username, Context.ConnectionId, mode);
            }
        }

        public async Task AcceptChallenge(string challengerConnectionId, string mode)
        {
            if (!OnlinePlayers.TryGetValue(challengerConnectionId, out var challenger))
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Гравець вийшов з мережі.");
                return;
            }

            // 2. Перевіряємо, чи ініціатор вже не грає в іншому матчі
            bool isChallengerBusy = ActiveMatches.Values.Any(m => m.Players.ContainsKey(challengerConnectionId));

            if (isChallengerBusy)
            {
                // Повідомляємо тому, хто намагався прийняти, що він запізнився
                await Clients.Caller.SendAsync("ErrorMessage", "Неможливо почати матч: опонент вже грає в іншому матчі.");
                return;
            }
            Guid matchId = Guid.NewGuid();
            await StartMatch(matchId, mode, challengerConnectionId, Context.ConnectionId);
        }

        // --- GAMEPLAY METHODS ---

        public async Task SendCursorPosition(string matchId, int? cellIndex)
        {
            await Clients.GroupExcept(matchId, Context.ConnectionId)
                         .SendAsync("OpponentCursorMoved", cellIndex);
        }

        public async Task RevealCell(Guid matchId, int x, int y)
        {
            if (!ActiveMatches.TryGetValue(matchId, out var match)) return;
            string connectionId = Context.ConnectionId;
            var opponentId = match.Players.Keys.FirstOrDefault(id => id != connectionId) ?? string.Empty;

            var clientProxy = Clients.Caller;
            var opponentProxy = string.IsNullOrEmpty(opponentId) ? null! : Clients.Client(opponentId);
            var groupProxy = Clients.Group(matchId.ToString());

            await match.ModeStrategy.HandleRevealAsync(match, connectionId, x, y, clientProxy, opponentProxy, groupProxy);
        }

        public async Task ToggleFlag(Guid matchId, int index, bool isFlagged)
        {
            if (!ActiveMatches.TryGetValue(matchId, out var match)) return;

            if (match.GameMode == "CoOp")
            {
                await Clients.GroupExcept(matchId.ToString(), Context.ConnectionId)
                             .SendAsync("FlagToggled", index, isFlagged);
            }
        }

        public async Task LeaveMatch(Guid matchId)
        {
            if (ActiveMatches.TryRemove(matchId, out var match))
            {
                await Clients.Group(matchId.ToString()).SendAsync("MatchFinished", new { Status = "Defeat" });
            }
        }

        // --- MATCH INITIALIZATION METHODS ---

        public async Task StartSoloMatch(int width, int height, int minesCount)
        {
            var connectionId = Context.ConnectionId;
            Guid matchId = Guid.NewGuid();

            var match = new GameState
            {
                MatchId = matchId,
                GameMode = "Solo",
                ModeStrategy = new SoloStrategy()
            };

            string username = OnlinePlayers.GetValueOrDefault(connectionId)?.Username ?? "Solo Player";
            match.Players.TryAdd(connectionId, new PlayerState { ConnectionId = connectionId, Username = username });

            match.ModeStrategy.InitializeGame(match, width, height, minesCount);
            ActiveMatches.TryAdd(matchId, match);

            // Додаємо в групу, щоб логіка LeaveMatch і Group розсилок працювала коректно
            await Groups.AddToGroupAsync(connectionId, matchId.ToString());

            await Clients.Caller.SendAsync("GameStarted", new
            {
                MatchId = matchId.ToString(),
                Mode = "Solo",
                Rows = height, // У фронтенді ми очікуємо Rows = height
                Cols = width   // У фронтенді ми очікуємо Cols = width
            });
        }

        public async Task StartMatch(Guid matchId, string mode, string player1Id, string player2Id)
        {
            var match = new GameState
            {
                MatchId = matchId,
                GameMode = mode,
                ModeStrategy = mode == "PvP" ? new PvpSpeedrunStrategy() : new CoOpStrategy()
            };

            match.Players.TryAdd(player1Id, new PlayerState { ConnectionId = player1Id, Username = OnlinePlayers.GetValueOrDefault(player1Id)?.Username ?? "Player 1" });
            match.Players.TryAdd(player2Id, new PlayerState { ConnectionId = player2Id, Username = OnlinePlayers.GetValueOrDefault(player2Id)?.Username ?? "Player 2" });

            match.ModeStrategy.InitializeGame(match, 16, 16, 40);
            ActiveMatches.TryAdd(matchId, match);

            await Groups.AddToGroupAsync(player1Id, matchId.ToString());
            await Groups.AddToGroupAsync(player2Id, matchId.ToString());

            await Clients.Group(matchId.ToString()).SendAsync("GameStarted", new
            {
                MatchId = matchId.ToString(),
                Mode = mode,
                Rows = 16,
                Cols = 16
            });
        }
    }
}