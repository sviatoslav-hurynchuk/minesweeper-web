using Minesweeper.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Minesweeper.API.Strategies
{
    public interface IGameModeStrategy
    {
        void InitializeGame(GameState session, int width, int height, int minesCount);

        Task HandleRevealAsync(GameState session, string connectionId, int x, int y, IClientProxy clientProxy, IClientProxy opponentProxy, IClientProxy groupProxy);
    }
}