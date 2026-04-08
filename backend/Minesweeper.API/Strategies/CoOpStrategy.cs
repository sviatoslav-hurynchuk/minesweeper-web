// Strategies/CoOpStrategy.cs
using Minesweeper.API.GameEngine;
using Minesweeper.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Minesweeper.API.Strategies
{
    public class CoOpStrategy : IGameModeStrategy
    {
        public void InitializeGame(GameState session, int width, int height, int minesCount)
        {
            // 1. Generate ONE shared board
            var sharedBoard = new GameBoard(width, height, minesCount);

            // 2. Assign the exact same board reference to all players in the session
            foreach (var player in session.Players.Values)
            {
                player.Board = sharedBoard;
            }
        }

        public async Task HandleRevealAsync(GameState session, string connectionId, int x, int y, IClientProxy clientProxy, IClientProxy opponentProxy, IClientProxy groupProxy)
        {
            var player = session.Players[connectionId];

            // If the game is already over for the group, ignore further clicks
            if (player.IsGameOver) return;

            // Reveal the cell on the shared board
            var result = player.Board.RevealCell(x, y);

            if (result.IsMine)
            {
                // 1. Mark the game as over for ALL players
                foreach (var p in session.Players.Values)
                {
                    p.IsGameOver = true;
                }

                // 2. Get all mine coordinates to display the final board
                var allMines = player.Board.GetAllMines();

                // 3. Broadcast the fatal click and the defeat status to the ENTIRE group
                await groupProxy.SendAsync("BoardUpdated", result.RevealedCells);
                await groupProxy.SendAsync("MatchFinished", new { Status = "Defeat", Mines = allMines });
            }
            else
            {
                // 1. Broadcast safely revealed cells (Flood Fill) to EVERYONE in the group
                await groupProxy.SendAsync("BoardUpdated", result.RevealedCells);

                // 2. Check if the shared board has been completely solved
                if (player.Board.IsWinConditionMet())
                {
                    foreach (var p in session.Players.Values)
                    {
                        p.IsGameOver = true;
                    }

                    // Broadcast victory to everyone
                    await groupProxy.SendAsync("MatchFinished", new { Status = "Victory" });
                }
            }
        }
    }
}