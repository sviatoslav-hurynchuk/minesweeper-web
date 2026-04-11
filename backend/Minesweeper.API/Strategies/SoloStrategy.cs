// Strategies/SoloStrategy.cs
using Minesweeper.API.GameEngine;
using Minesweeper.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Minesweeper.API.Strategies
{
    public class SoloStrategy : IGameModeStrategy
    {
        public void InitializeGame(GameState session, int width, int height, int minesCount)
        {
            // Solo mode only has one player
            var player = session.Players.Values.First();

            // Initialize a standard independent board
            player.Board = new GameBoard(width, height, minesCount);
        }

        public async Task HandleRevealAsync(GameState session, string connectionId, int x, int y, IClientProxy clientProxy, IClientProxy opponentProxy, IClientProxy groupProxy)
        {
            if (!session.Players.TryGetValue(connectionId, out var player))
                return;

            if (player.IsGameOver) return;

            var result = player.Board.RevealCell(x, y);

            if (result.IsMine)
            {
                player.IsGameOver = true;

                // Reveal all mines to the player upon defeat
                var allMines = player.Board.GetAllMines();
                await clientProxy.SendAsync("BoardUpdated", result.RevealedCells); // Show the clicked mine
                await clientProxy.SendAsync("MatchFinished", new { Status = "Defeat", Mines = allMines });
            }
            else
            {
                // Send safely revealed cells to the client
                await clientProxy.SendAsync("BoardUpdated", result.RevealedCells);

                // Check if the player has successfully uncovered all safe cells
                if (player.Board.IsWinConditionMet())
                {
                    player.IsGameOver = true;

                    // Calculate final time (assuming MatchStartTime is stored in GameState)
                    // long timeSpentMs = DateTime.UtcNow.Subtract(session.MatchStartTime).TotalMilliseconds;

                    await clientProxy.SendAsync("MatchFinished", new { Status = "Victory" });

                    // NOTE: The actual database insertion for the SoloLeaderboard 
                    // should be handled by a Domain Service or an Event Publisher here, 
                    // not directly inside the SignalR Strategy to keep concerns separated.
                }
            }
        }
    }
}