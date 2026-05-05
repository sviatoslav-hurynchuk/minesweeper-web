// Strategies/SoloStrategy.cs
using Minesweeper.API.GameEngine;
using Minesweeper.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace Minesweeper.API.Strategies
{
    /// <summary>
    /// Реалізація соло-режиму з використанням паттернів Strategy та Template Method elements.
    /// </summary>
    public class SoloStrategy : IGameModeStrategy
    {
        // Константи для запобігання "Magic Strings"
        private const string EventBoardUpdated = "BoardUpdated";
        private const string EventMatchFinished = "MatchFinished";

        public void InitializeGame(GameState session, int width, int height, int minesCount)
        {
            var player = session.Players.Values.FirstOrDefault();
            
            if (player == null) return;

            // Використання стандартної ініціалізації (можна було б додати Factory, 
            // якби ми могли змінювати GameBoard)
            player.Board = new GameBoard(width, height, minesCount);
        }

        public async Task HandleRevealAsync(
            GameState session, 
            string connectionId, 
            int x, int y, 
            IClientProxy clientProxy, 
            IClientProxy opponentProxy, 
            IClientProxy groupProxy)
        {
            if (!TryGetValidPlayer(session, connectionId, out var player))
                return;

            var result = player.Board.RevealCell(x, y);

            // Паттерн: Розгалуження логіки на основі стану (State-like behavior)
            if (result.IsMine)
            {
                await HandleDefeatAsync(player, clientProxy, result);
            }
            else
            {
                await HandleProgressAsync(player, clientProxy, result);
            }
        }

        #region Private Helper Methods (Encapsulation)

        private bool TryGetValidPlayer(GameState session, string connectionId, out PlayerState player)
        {
            return session.Players.TryGetValue(connectionId, out player) && !player.IsGameOver;
        }

        private async Task HandleDefeatAsync(PlayerState player, IClientProxy clientProxy, RevealResult result)
        {
            player.IsGameOver = true;
            
            // Спочатку показуємо міну, яку натиснув гравець
            await clientProxy.SendAsync(EventBoardUpdated, result.RevealedCells);
            
            // Відкриваємо всі інші міни (Strategy-specific logic)
            var allMines = player.Board.GetAllMines();
            await clientProxy.SendAsync(EventMatchFinished, new 
            { 
                Status = "Defeat", 
                Mines = allMines,
                Message = "Game Over! You hit a mine."
            });
        }

        private async Task HandleProgressAsync(PlayerState player, IClientProxy clientProxy, RevealResult result)
        {
            // Оновлюємо стан поля у клієнта
            await clientProxy.SendAsync(EventBoardUpdated, result.RevealedCells);

            // Перевірка умови перемоги (Template Method step)
            if (player.Board.IsWinConditionMet())
            {
                await HandleVictoryAsync(player, clientProxy);
            }
        }

        private async Task HandleVictoryAsync(PlayerState player, IClientProxy clientProxy)
        {
            player.IsGameOver = true;

            // Тут можна додати Observer або Event Publisher для SoloLeaderboard,
            // якби у нас був доступ до DI контейнера або інших класів.
            
            await clientProxy.SendAsync(EventMatchFinished, new 
            { 
                Status = "Victory",
                Timestamp = DateTime.UtcNow 
            });
        }

        #endregion
    }
}