using Minesweeper.API.GameEngine;
using Minesweeper.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Minesweeper.API.Strategies
{
    public class PvpSpeedrunStrategy : IGameModeStrategy
    {
        public void InitializeGame(GameState session, int width, int height, int minesCount)
        {
            // Same seed ensures both boards have identical mine placements
            int commonSeed = new Random().Next();

            foreach (var player in session.Players.Values)
            {
                player.Board = new GameBoard(width, height, minesCount, commonSeed);
            }
        }

        public async Task HandleRevealAsync(GameState session, string connectionId, int x, int y, IClientProxy clientProxy, IClientProxy opponentProxy, IClientProxy groupProxy)
        {
            var player = session.Players[connectionId];

            // 1. Check for active penalty freeze
            if (player.PenaltyUntil.HasValue && player.PenaltyUntil > DateTime.UtcNow)
            {
                return; // Ignore click
            }

            // 2. Process reveal
            var result = player.Board.RevealCell(x, y);

            if (result.IsMine)
            {
                player.PenaltyUntil = DateTime.UtcNow.AddSeconds(10);

                await clientProxy.SendAsync("BoardUpdated", result.RevealedCells);

                await clientProxy.SendAsync("PlayerFrozen", 10);
                await opponentProxy.SendAsync("OpponentMistake");
            }
            else
            {
                await clientProxy.SendAsync("BoardUpdated", result.RevealedCells);
                await clientProxy.SendAsync("PlayerProgress", player.Board.GetProgressPercentage());
                await opponentProxy.SendAsync("OpponentProgress", player.Board.GetProgressPercentage());

                if (player.Board.IsWinConditionMet())
                {
                    await clientProxy.SendAsync("MatchFinished", new { Status = "Victory" });
                    await opponentProxy.SendAsync("MatchFinished", new { Status = "Defeat" });
                }
            }
        }
    }
}