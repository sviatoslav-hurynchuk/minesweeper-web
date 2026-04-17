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

        // Словник для атомарного бронювання підключень під час створення матчу
        private static readonly ConcurrentDictionary<string, byte> Reservations = new();

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
            string acceptorId = Context.ConnectionId;

            if (!OnlinePlayers.TryGetValue(challengerConnectionId, out var challenger))
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Гравець вийшов з мережі.");
                return;
            }

            bool challengerReserved = false;
            bool acceptorReserved = false;

            try
            {
                // 1. Атомарне бронювання обох гравців
                challengerReserved = Reservations.TryAdd(challengerConnectionId, 1);
                if (challengerReserved)
                {
                    acceptorReserved = Reservations.TryAdd(acceptorId, 1);
                }

                if (!challengerReserved || !acceptorReserved)
                {
                    await Clients.Caller.SendAsync("ErrorMessage", "Неможливо почати матч: один з гравців вже обробляє інший запит.");
                    return;
                }

                // 2. Перевіряємо, чи жоден з гравців вже не знаходиться в активному матчі
                bool isEitherBusy = ActiveMatches.Values.Any(m =>
                    m.Players.ContainsKey(challengerConnectionId) ||
                    m.Players.ContainsKey(acceptorId));

                if (isEitherBusy)
                {
                    await Clients.Caller.SendAsync("ErrorMessage", "Неможливо почати матч: один з гравців вже грає в іншому матчі.");
                    return;
                }

                // 3. Запускаємо гру
                Guid matchId = Guid.NewGuid();
                await StartMatch(matchId, mode, challengerConnectionId, acceptorId);
            }
            finally
            {
                // Знімаємо бронювання
                if (acceptorReserved) Reservations.TryRemove(acceptorId, out _);
                if (challengerReserved) Reservations.TryRemove(challengerConnectionId, out _);
            }
        }

        // --- GAMEPLAY METHODS ---

        public async Task SendCursorPosition(Guid matchId, int? cellIndex)
        {
            if (!ActiveMatches.TryGetValue(matchId, out var match)) return;
            if (!match.Players.ContainsKey(Context.ConnectionId)) return;
            await Clients.GroupExcept(matchId.ToString(), Context.ConnectionId)
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
            if (!match.Players.ContainsKey(Context.ConnectionId)) return;

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

            // 1. Валідація розмірів поля (щоб не покласти сервер величезними масивами)
            // 50x50 - розумний ліміт, враховуючи, що найважчий режим у нас 30x16
            const int MaxDim = 50;
            if (width <= 0 || height <= 0 || width > MaxDim || height > MaxDim)
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Некоректні розміри поля.");
                return;
            }

            // 2. Валідація кількості мін. 
            // Віднімаємо 9, бо алгоритм GenerateSafeBoard резервує зону 3x3 навколо першого кліку.
            if (minesCount <= 0 || minesCount >= (width * height) - 9)
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Некоректна кількість мін.");
                return;
            }

            // 3. Перевірка на "дублікати" матчів. Захищає від спаму запитами.
            if (ActiveMatches.Values.Any(m => m.Players.ContainsKey(connectionId)))
            {
                await Clients.Caller.SendAsync("ErrorMessage", "Ви вже граєте в іншому матчі.");
                return;
            }

            // Якщо всі перевірки пройдено — створюємо гру
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
                Rows = height,
                Cols = width
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