using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Models;
using Minesweeper.API.Strategies;
using System.Collections.Concurrent;

namespace Minesweeper.API.Hubs
{
    // Додай цей клас у файл Models/PlayerData.cs або прямо тут знизу,
    // щоб він співпадав з інтерфейсом PlayerData на фронтенді.
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
            var activeMatch = ActiveMatches.Values.FirstOrDefault(m => m.Players.ContainsKey(Context.ConnectionId));
            if (activeMatch != null) await LeaveMatch(activeMatch.MatchId);

            await base.OnDisconnectedAsync(exception);
        }

        // FIXED: Added 'mode' parameter
        public async Task ChallengePlayer(string targetConnectionId, string mode)
        {
            if (OnlinePlayers.TryGetValue(Context.ConnectionId, out var challenger))
            {
                await Clients.Client(targetConnectionId).SendAsync("ChallengeReceived", challenger.Username, Context.ConnectionId, mode);
            }
        }

        // FIXED: Added 'mode' parameter
        public async Task AcceptChallenge(string challengerConnectionId, string mode)
        {
            Guid matchId = Guid.NewGuid();
            await StartMatch(matchId, mode, challengerConnectionId, Context.ConnectionId);
        }

        // --- GAMEPLAY METHODS ---

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

        // FIXED: Flag syncing logic
        public async Task ToggleFlag(Guid matchId, int index, bool isFlagged)
        {
            if (!ActiveMatches.TryGetValue(matchId, out var match)) return;

            // In PvP, flags are personal. We don't broadcast them to the opponent.
            // In Co-Op, players share a board, so we must broadcast the flag to others.
            if (match.GameMode == "CoOp")
            {
                // Send to everyone in the group EXCEPT the person who placed it 
                // (because their frontend already updated optimistically)
                await Clients.GroupExcept(matchId.ToString(), Context.ConnectionId)
                             .SendAsync("FlagToggled", index, isFlagged);
            }
        }

        // NEW: Leave Match Method
        public async Task LeaveMatch(Guid matchId)
        {
            if (ActiveMatches.TryRemove(matchId, out var match))
            {
                // Notify everyone in the match that it was aborted
                await Clients.Group(matchId.ToString()).SendAsync("MatchFinished", new { Status = "Defeat" });
            }
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