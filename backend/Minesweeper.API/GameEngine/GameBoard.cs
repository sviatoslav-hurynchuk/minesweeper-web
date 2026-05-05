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
        private readonly IBoardGenerator _generator;

        public bool IsGenerated { get; private set; }
        public HashSet<int> MinePositions { get; private set; } = new();
        public HashSet<int> RevealedCells { get; private set; } = new();
        public HashSet<int> FlaggedCells { get; private set; } = new();
        private readonly Dictionary<int, int> _adjacentMinesCache = new();

        // КОНСТРУКТОР 1: Для сумісності зі старим кодом (Default Strategy)
        public GameBoard(int width, int height, int minesCount, int? seed = null) 
            : this(width, height, minesCount, new LogicalBoardGenerator(), seed) { }

        // КОНСТРУКТОР 2: Для патерна DI / Strategy
        public GameBoard(int width, int height, int minesCount, IBoardGenerator generator, int? seed = null)
        {
            Width = width;
            Height = height;
            MinesCount = minesCount;
            _generator = generator;
            _seed = seed;
        }

        public RevealResult RevealCell(int x, int y)
        {
            int index = y * Width + x;
            if (!IsGenerated) GenerateSafeBoard(index);
            if (RevealedCells.Contains(index) || FlaggedCells.Contains(index)) return new RevealResult(false, new List<CellInfo>());
            if (MinePositions.Contains(index)) return new RevealResult(true, new List<CellInfo>());

            var newlyRevealed = new List<CellInfo>();
            ExecuteFloodFill(index, newlyRevealed);
            return new RevealResult(false, newlyRevealed);
        }

        private void GenerateSafeBoard(int safeIndex)
        {
            // Виклик стратегії (Pattern Strategy)
            MinePositions = _generator.GenerateMines(Width, Height, MinesCount, safeIndex, _seed);
            RecalculateCache();
            IsGenerated = true;
        }

        private void RecalculateCache()
        {
            _adjacentMinesCache.Clear();
            for (int i = 0; i < Width * Height; i++)
                if (!MinePositions.Contains(i))
                    _adjacentMinesCache[i] = GetNeighbors(i).Count(n => MinePositions.Contains(n));
        }

        public bool ToggleFlag(int x, int y) {
            int index = y * Width + x;
            if (RevealedCells.Contains(index)) return false;
            if (!FlaggedCells.Remove(index)) FlaggedCells.Add(index);
            return true;
        }

        private void ExecuteFloodFill(int startIndex, List<CellInfo> newlyRevealed) {
            var queue = new Queue<int>(); queue.Enqueue(startIndex);
            while (queue.Count > 0) {
                int current = queue.Dequeue();
                if (RevealedCells.Contains(current)) continue;
                RevealedCells.Add(current);
                int adj = _adjacentMinesCache.GetValueOrDefault(current, 0);
                newlyRevealed.Add(new CellInfo(current % Width, current / Width, current, adj));
                if (adj == 0)
                    foreach (var n in GetNeighbors(current))
                        if (!RevealedCells.Contains(n) && !FlaggedCells.Contains(n) && !MinePositions.Contains(n))
                            queue.Enqueue(n);
            }
        }

        private IEnumerable<int> GetNeighbors(int index) {
            int r = index / Width, c = index % Width;
            for (int i = -1; i <= 1; i++)
                for (int j = -1; j <= 1; j++) {
                    int nr = r + i, nc = c + j;
                    if (i == 0 && j == 0 || nr < 0 || nr >= Height || nc < 0 || nc >= Width) continue;
                    yield return nr * Width + nc;
                }
        }

        public bool IsWinConditionMet() => RevealedCells.Count + MinePositions.Count == Width * Height;
        public int GetProgressPercentage() => (int)((RevealedCells.Count / (double)((Width * Height) - MinesCount)) * 100);
        public void SyncMines(IEnumerable<int> mines) { MinePositions = new HashSet<int>(mines); IsGenerated = true; RecalculateCache(); }
        public void ResetBoard() { RevealedCells.Clear(); FlaggedCells.Clear(); }
        public List<int> GetAllMines() => MinePositions.ToList(); // Додав для зручності
    }

    public record RevealResult(bool IsMine, List<CellInfo> RevealedCells);
    public record CellInfo(int X, int Y, int Index, int AdjacentMines);
}
