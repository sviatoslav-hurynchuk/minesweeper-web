using Microsoft.AspNetCore.SignalR;
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

    public async Task JoinLobby(string username, Guid userId)
    {
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
}