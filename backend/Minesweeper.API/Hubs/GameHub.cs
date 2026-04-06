using Microsoft.AspNetCore.SignalR;
using Minesweeper.API.Models;
using System.Collections.Concurrent;

namespace Minesweeper.API.Hubs;

public class PlayerData
{
    public required string ConnectionId { get; set; }
    public required string Username { get; set; }
    public Guid? UserId { get; set; }
}

public class GameHub : Hub
{
    private static readonly ConcurrentDictionary<string, PlayerData> _onlinePlayers = new();

    private static readonly ConcurrentDictionary<string, GameState> _activeGames = new();

    public async Task JoinLobby(string username, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length > 50)
        {
            throw new HubException("Invalid username");
        }

        var player = new PlayerData
        {
            ConnectionId = Context.ConnectionId,
            Username = username,
            UserId = userId
        };

        _onlinePlayers.TryAdd(Context.ConnectionId, player);

        await Clients.All.SendAsync("LobbyUpdated", _onlinePlayers.Values);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_onlinePlayers.TryRemove(Context.ConnectionId, out var player))
        {
            await Clients.All.SendAsync("LobbyUpdated", _onlinePlayers.Values);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task ChallengePlayer(string targetConnectionId)
    {
        if (_onlinePlayers.TryGetValue(Context.ConnectionId, out var sender))
        {
            await Clients.Client(targetConnectionId).SendAsync("ChallengeReceived", sender.Username, Context.ConnectionId);
        }
    }


    public async Task AcceptChallenge(string challengerConnectionId)
    {
        if (!_onlinePlayers.ContainsKey(challengerConnectionId))
        {
            throw new HubException("Challenger disconnected");
        }

        var matchId = Guid.NewGuid().ToString();

        var game = new GameState
        {
            MatchId = matchId,
            Player1ConnectionId = challengerConnectionId,
            Player2ConnectionId = Context.ConnectionId,
            Rows = 10,
            Cols = 10,
            TotalMines = 10
        };

        // ВАЖЛИВО: Ми ВИДАЛИЛИ виклик GenerateBoard() звідси
        _activeGames.TryAdd(matchId, game);

        var gameInfo = new { matchId, rows = game.Rows, cols = game.Cols };

        await Clients.Client(challengerConnectionId).SendAsync("GameStarted", gameInfo);
        await Clients.Client(Context.ConnectionId).SendAsync("GameStarted", gameInfo);
    }

    public async Task RevealCell(string matchId, int cellIndex)
    {
        if (!_activeGames.TryGetValue(matchId, out var game)) return;
        if (game.RevealedCells.Contains(cellIndex) || game.FlaggedCells.Contains(cellIndex)) return;

        if (!game.IsGenerated)
        {
            game.GenerateSafeBoard(cellIndex);
        }

        if (game.MinePositions.Contains(cellIndex))
        {
            await Clients.Clients(new List<string> { game.Player1ConnectionId, game.Player2ConnectionId })
                .SendAsync("GameOver", new { loserConnectionId = Context.ConnectionId, mineIndex = cellIndex });
            return;
        }

        var toReveal = new List<int>();
        RecursiveReveal(game, cellIndex, toReveal);

        var updates = toReveal.Select(idx => new { index = idx, value = game.CountAdjacentMines(idx) }).ToList();

        await Clients.Clients(new List<string> { game.Player1ConnectionId, game.Player2ConnectionId })
            .SendAsync("CellsRevealed", updates);

        if (game.IsWin())
        {
            await Clients.Clients(new List<string> { game.Player1ConnectionId, game.Player2ConnectionId })
                .SendAsync("GameWon", new { winnerConnectionId = Context.ConnectionId });
        }
    }

    private void RecursiveReveal(GameState game, int index, List<int> revealedThisTurn)
    {
        if (game.RevealedCells.Contains(index) || game.MinePositions.Contains(index)) return;

        game.RevealedCells.Add(index);
        revealedThisTurn.Add(index);

        if (game.CountAdjacentMines(index) == 0)
        {
            foreach (var neighbor in game.GetNeighbors(index))
            {
                RecursiveReveal(game, neighbor, revealedThisTurn);
            }
        }
    }
    public async Task ToggleFlag(string matchId, int cellIndex)
    {
        if (!_activeGames.TryGetValue(matchId, out var game)) return;
        if (game.RevealedCells.Contains(cellIndex)) return;

        if (game.FlaggedCells.Contains(cellIndex))
            game.FlaggedCells.Remove(cellIndex);
        else
            game.FlaggedCells.Add(cellIndex);

        await Clients.Clients(new List<string> { game.Player1ConnectionId, game.Player2ConnectionId })
            .SendAsync("FlagToggled", new { index = cellIndex, isFlagged = game.FlaggedCells.Contains(cellIndex) });
    }
}