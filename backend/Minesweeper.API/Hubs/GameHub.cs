// Hubs/GameHub.cs
using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Models;
using Minesweeper.API.Strategies;
using System.Collections.Concurrent;

namespace Minesweeper.API.Hubs
{
    public class GameHub : Hub
    {
        private static readonly ConcurrentDictionary<Guid, GameState> ActiveMatches = new();

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

        // Updated to handle 2 players (e.g., called when invite is accepted)
        public async Task StartMatch(Guid matchId, string mode, string player1Id, string player2Id)
        {
            var match = new GameState
            {
                MatchId = matchId,
                GameMode = mode,
                ModeStrategy = mode == "PvP" ? new PvpSpeedrunStrategy() : new CoOpStrategy()
            };

            // 1. Add both players BEFORE initialization
            match.Players.TryAdd(player1Id, new PlayerState { ConnectionId = player1Id, Username = "Player 1" });
            match.Players.TryAdd(player2Id, new PlayerState { ConnectionId = player2Id, Username = "Player 2" });

            // 2. Initialize boards based on the strategy
            match.ModeStrategy.InitializeGame(match, 16, 16, 40);
            ActiveMatches.TryAdd(matchId, match);

            // 3. Add both connections to the SignalR Group for group broadcasting
            await Groups.AddToGroupAsync(player1Id, matchId.ToString());
            await Groups.AddToGroupAsync(player2Id, matchId.ToString());

            // 4. Notify clients to transition to the Game View
            await Clients.Group(matchId.ToString()).SendAsync("MatchStarted", new
            {
                MatchId = matchId,
                Mode = mode,
                Width = 16,
                Height = 16
            });
        }
    }
}