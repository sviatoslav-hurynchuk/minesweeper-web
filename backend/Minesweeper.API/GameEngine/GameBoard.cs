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
            // Use the provided seed for PvP (to make identical boards), or random for Solo/Co-op
            var rand = _seed.HasValue ? new Random(_seed.Value) : new Random();
            int totalCells = Width * Height;

            // The clicked cell and its neighbors must be safe
            var safeZone = new HashSet<int>(GetNeighbors(safeIndex)) { safeIndex };

            while (MinePositions.Count < MinesCount)
            {
                int pos = rand.Next(totalCells);
                if (!safeZone.Contains(pos))
                {
                    MinePositions.Add(pos);
                }
            }

            // Pre-calculate adjacent mines for fast retrieval during flood fill
            for (int i = 0; i < totalCells; i++)
            {
                if (!MinePositions.Contains(i))
                {
                    _adjacentMinesCache[i] = GetNeighbors(i).Count(n => MinePositions.Contains(n));
                }
            }

            IsGenerated = true;
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