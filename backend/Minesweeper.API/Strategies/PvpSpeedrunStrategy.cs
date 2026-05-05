// Strategies/PvpSpeedrunStrategy.cs
using Minesweeper.API.GameEngine;
using Minesweeper.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Minesweeper.API.Strategies
{
    public class PvpSpeedrunStrategy : IGameModeStrategy
    {
        private const int PenaltySeconds = 10;
        private const string EventBoardUpdated = "BoardUpdated";
        private const string EventMatchFinished = "MatchFinished";
        private const string EventPlayerFrozen = "PlayerFrozen";
        private const string EventOpponentMistake = "OpponentMistake";
        private const string EventPlayerProgress = "PlayerProgress";
        private const string EventOpponentProgress = "OpponentProgress";

        public void InitializeGame(GameState session, int width, int height, int minesCount)
        {
            session.TotalMines = minesCount;
            int commonSeed = new Random().Next();

            foreach (var player in session.Players.Values)
            {
                player.Board = new GameBoard(width, height, minesCount, commonSeed);
            }
        }

        public async Task HandleRevealAsync(
            GameState session, 
            string connectionId, 
            int x, int y, 
            IClientProxy clientProxy, 
            IClientProxy opponentProxy, 
            IClientProxy groupProxy)
        {
            var player = session.Players[connectionId];

            // 1. Валідація стану (Penalty check)
            if (IsPlayerUnderPenalty(player)) return;

            // 2. Логіка першої генерації (синхронізація мін)
            bool isFirstGeneration = !player.Board.IsGenerated;
            var result = player.Board.RevealCell(x, y);

            if (isFirstGeneration)
            {
                SyncMinesWithOpponent(session, connectionId, player);
            }

            // 3. Обробка результату ходу
            if (result.IsMine)
            {
                await HandleMineHitAsync(player, clientProxy, opponentProxy);
            }
            else
            {
                await HandleSafeRevealAsync(player, clientProxy, opponentProxy, result);
            }
        }

        #region Private Core Logic

        private bool IsPlayerUnderPenalty(PlayerState player)
        {
            return player.PenaltyUntil.HasValue && player.PenaltyUntil > DateTime.UtcNow;
        }

        private void SyncMinesWithOpponent(GameState session, string connectionId, PlayerState player)
        {
            var opponent = session.Players.Values.FirstOrDefault(p => p != player);
            if (opponent != null && !opponent.Board.IsGenerated)
            {
                opponent.Board.SyncMines(player.Board.GetAllMines());
            }
        }

        private async Task HandleMineHitAsync(PlayerState player, IClientProxy clientProxy, IClientProxy opponentProxy)
        {
            player.PenaltyUntil = DateTime.UtcNow.AddSeconds(PenaltySeconds);
            player.Board.ResetBoard();

            // Повідомляємо гравця про "заморозку"
            await clientProxy.SendAsync(EventBoardUpdated, new List<CellInfo>());
            await clientProxy.SendAsync(EventPlayerFrozen, PenaltySeconds);
            
            // Повідомляємо опонента про помилку гравця
            await opponentProxy.SendAsync(EventOpponentMistake);
        }

        private async Task HandleSafeRevealAsync(PlayerState player, IClientProxy clientProxy, IClientProxy opponentProxy, RevealResult result)
        {
            double progress = player.Board.GetProgressPercentage();

            // Оновлюємо візуалізацію та прогрес для обох сторін
            await clientProxy.SendAsync(EventBoardUpdated, result.RevealedCells);
            await clientProxy.SendAsync(EventPlayerProgress, progress);
            await opponentProxy.SendAsync(EventOpponentProgress, progress);

            if (player.Board.IsWinConditionMet())
            {
                await FinalizeMatchAsync(clientProxy, opponentProxy);
            }
        }

        private async Task FinalizeMatchAsync(IClientProxy winnerProxy, IClientProxy loserProxy)
        {
            await winnerProxy.SendAsync(EventMatchFinished, new { Status = "Victory" });
            await loserProxy.SendAsync(EventMatchFinished, new { Status = "Defeat" });
        }

        #endregion
    }
}