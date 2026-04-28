using System;
using System.Collections.Generic;
using System.Linq;

namespace Minesweeper.API.GameEngine
{
    public class GameBoard
    {
        public int Width { get; }
        public int Height { get; }
        public int MinesCount { get; }
        private readonly int? _seed;

        public bool IsGenerated { get; private set; }

        public HashSet<int> MinePositions { get; private set; } = new();
        public HashSet<int> RevealedCells { get; private set; } = new();
        public HashSet<int> FlaggedCells { get; private set; } = new();

        // Cache adjacent mine counts so we don't recalculate them on every click
        private readonly Dictionary<int, int> _adjacentMinesCache = new();

        public GameBoard(int width, int height, int minesCount, int? seed = null)
        {
            Width = width;
            Height = height;
            MinesCount = minesCount;
            _seed = seed;
        }

        public RevealResult RevealCell(int x, int y)
        {
            int index = y * Width + x;

            // 1. Generate board on the very first click to ensure safety
            if (!IsGenerated)
            {
                GenerateSafeBoard(index);
            }

            // 2. Ignore clicks on already revealed or flagged cells
            if (RevealedCells.Contains(index) || FlaggedCells.Contains(index))
            {
                return new RevealResult(false, new List<CellInfo>());
            }

            // 3. Check for Game Over
            if (MinePositions.Contains(index))
            {
                return new RevealResult(true, new List<CellInfo>());
            }

            // 4. Perform Flood Fill to open adjacent empty cells
            var newlyRevealed = new List<CellInfo>();
            ExecuteFloodFill(index, newlyRevealed);

            return new RevealResult(false, newlyRevealed);
        }

        public bool ToggleFlag(int x, int y)
        {
            int index = y * Width + x;

            if (RevealedCells.Contains(index)) return false;

            if (FlaggedCells.Contains(index))
                FlaggedCells.Remove(index);
            else
                FlaggedCells.Add(index);

            return true; // Successfully toggled
        }

        private void GenerateSafeBoard(int safeIndex)
        {
            var rand = _seed.HasValue ? new Random(_seed.Value) : new Random();
            int totalCells = Width * Height;
            var safeZone = new HashSet<int>(GetNeighbors(safeIndex)) { safeIndex };

            int maxAttempts = 100; 
            int attempts = 0;
            bool isLogicallySolvable = false;

            int bestRevealedCount = -1;
            HashSet<int> bestMinePositions = new();
            Dictionary<int, int> bestAdjacentMinesCache = new();

            while (!isLogicallySolvable && attempts < maxAttempts)
            {
                attempts++;
                MinePositions.Clear();
                _adjacentMinesCache.Clear();

                // 1. Random mine placement
                while (MinePositions.Count < MinesCount)
                {
                    int pos = rand.Next(totalCells);
                    if (!safeZone.Contains(pos))
                    {
                        MinePositions.Add(pos);
                    }
                }

                // 2. Caching neighbors
                for (int i = 0; i < totalCells; i++)
                {
                    if (!MinePositions.Contains(i))
                        _adjacentMinesCache[i] = GetNeighbors(i).Count(n => MinePositions.Contains(n));
                }

                // 3. Logic check
                isLogicallySolvable = SimulateLogicalGame(safeIndex, out int revealedCount);

                if (isLogicallySolvable)
                {
                    break; // Perfect board found, current state is already correct
                }

                // Track the best available board if a perfect one isn't found
                if (revealedCount > bestRevealedCount)
                {
                    bestRevealedCount = revealedCount;
                    bestMinePositions = new HashSet<int>(MinePositions);
                    bestAdjacentMinesCache = new Dictionary<int, int>(_adjacentMinesCache);
                }
            }

            // If we maxed out attempts, restore the board state that had the most logically solvable cells
            if (!isLogicallySolvable)
            {
                MinePositions.Clear();
                foreach (var m in bestMinePositions) MinePositions.Add(m);

                _adjacentMinesCache.Clear();
                foreach (var kvp in bestAdjacentMinesCache) _adjacentMinesCache[kvp.Key] = kvp.Value;

                Console.WriteLine($"[Warning] Failed to generate 100% logical board after {maxAttempts} attempts. Using best available which revealed {bestRevealedCount} cells.");
            }

            IsGenerated = true;
        }

        // --- Внутрішній БОТ-СИМУЛЯТОР ---
        private bool SimulateLogicalGame(int startIndex, out int revealedCount)
        {
            var simulatedRevealed = new HashSet<int>();
            var simulatedFlags = new HashSet<int>();
            bool progressMade;

            // Імітуємо перший клік (відкриваємо safeIndex та запускаємо Flood Fill)
            SimulateReveal(startIndex, simulatedRevealed);

            // Цикл працює, поки бот знаходить нові логічні кроки
            do
            {
                progressMade = false;

                // Проходимось по всіх відкритих цифрах
                foreach (var cell in simulatedRevealed.ToList())
                {
                    int cellMines = _adjacentMinesCache.GetValueOrDefault(cell, 0);
                    if (cellMines == 0) continue;

                    var neighbors = GetNeighbors(cell).ToList();
                    var hiddenNeighbors = neighbors.Where(n => !simulatedRevealed.Contains(n)).ToList();
                    var flaggedNeighbors = neighbors.Count(n => simulatedFlags.Contains(n));

                    // ПРАВИЛО 1: Якщо кількість прихованих клітинок + вже поставлених прапорців 
                    // дорівнює цифрі на клітинці -> всі приховані сусіди це 100% МІНИ.
                    if (hiddenNeighbors.Count + flaggedNeighbors == cellMines)
                    {
                        foreach (var hidden in hiddenNeighbors)
                        {
                            if (simulatedFlags.Add(hidden))
                                progressMade = true;
                        }
                    }

                    // ПРАВИЛО 2: Якщо навколо цифри вже стоїть достатньо прапорців ->
                    // всі інші приховані сусіди 100% БЕЗПЕЧНІ.
                    if (flaggedNeighbors == cellMines)
                    {
                        foreach (var hidden in hiddenNeighbors)
                        {
                            if (!simulatedFlags.Contains(hidden))
                            {
                                SimulateReveal(hidden, simulatedRevealed);
                                progressMade = true;
                            }
                        }
                    }
                }

            } while (progressMade);

            revealedCount = simulatedRevealed.Count;
            int targetReveals = (Width * Height) - MinesCount;
            return revealedCount == targetReveals;
        }

        // Допоміжний метод для симулятора (спрощений Flood Fill)
        private void SimulateReveal(int startIndex, HashSet<int> simulatedRevealed)
        {
            var queue = new Queue<int>();
            queue.Enqueue(startIndex);

            while (queue.Count > 0)
            {
                int current = queue.Dequeue();
                if (!simulatedRevealed.Add(current)) continue;

                if (_adjacentMinesCache.GetValueOrDefault(current, 0) == 0)
                {
                    foreach (var neighbor in GetNeighbors(current))
                    {
                        if (!simulatedRevealed.Contains(neighbor) && !MinePositions.Contains(neighbor))
                            queue.Enqueue(neighbor);
                    }
                }
            }
        }

        private void ExecuteFloodFill(int startIndex, List<CellInfo> newlyRevealed)
        {
            var queue = new Queue<int>();
            queue.Enqueue(startIndex);

            while (queue.Count > 0)
            {
                int current = queue.Dequeue();

                if (RevealedCells.Contains(current)) continue;

                RevealedCells.Add(current);
                int adjacentMines = _adjacentMinesCache.GetValueOrDefault(current, 0);

                // Add to the result list sent to the frontend
                newlyRevealed.Add(new CellInfo(current % Width, current / Width, current, adjacentMines));

                // If the cell is empty (0 mines around), continue the flood fill to its neighbors
                if (adjacentMines == 0)
                {
                    foreach (var neighbor in GetNeighbors(current))
                    {
                        if (!RevealedCells.Contains(neighbor) &&
                            !FlaggedCells.Contains(neighbor) &&
                            !MinePositions.Contains(neighbor))
                        {
                            queue.Enqueue(neighbor);
                        }
                    }
                }
            }
        }

        private IEnumerable<int> GetNeighbors(int index)
        {
            int r = index / Width;
            int c = index % Width;

            for (int i = -1; i <= 1; i++)
            {
                for (int j = -1; j <= 1; j++)
                {
                    if (i == 0 && j == 0) continue;

                    int nr = r + i;
                    int nc = c + j;

                    if (nr >= 0 && nr < Height && nc >= 0 && nc < Width)
                    {
                        yield return nr * Width + nc;
                    }
                }
            }
        }

        // --- Helper Methods Used by Strategies ---

        public bool IsWinConditionMet()
        {
            int totalCells = Width * Height;
            return RevealedCells.Count + MinePositions.Count == totalCells;
        }

        public IEnumerable<int> GetAllMines()
        {
            return MinePositions;
        }

        public int GetProgressPercentage()
        {
            int targetReveals = (Width * Height) - MinesCount;
            if (targetReveals <= 0) return 0;

            return (int)((RevealedCells.Count / (double)targetReveals) * 100);
        }
        public void SyncMines(IEnumerable<int> mines)
        {
            MinePositions = new HashSet<int>(mines);
            IsGenerated = true;

            int totalCells = Width * Height;
            _adjacentMinesCache.Clear();

            for (int i = 0; i < totalCells; i++)
            {
                if (!MinePositions.Contains(i))
                {
                    _adjacentMinesCache[i] = GetNeighbors(i).Count(n => MinePositions.Contains(n));
                }
            }
        }
        public void ResetBoard()
        {
            // Clears player progress but keeps the mines in the exact same spots.
            // Used for the PvP 10-second penalty mechanic.
            RevealedCells.Clear();
            FlaggedCells.Clear();
        }
    }

    // --- Data Transfer Objects (DTOs) ---

    // Returned by RevealCell to inform the Strategy what happened
    public record RevealResult(bool IsMine, List<CellInfo> RevealedCells);

    // Contains all data the frontend needs to render a number on the grid
    public record CellInfo(int X, int Y, int Index, int AdjacentMines);
}