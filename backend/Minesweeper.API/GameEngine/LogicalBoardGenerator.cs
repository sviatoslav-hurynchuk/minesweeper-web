using System;
using System.Collections.Generic;
using System.Linq;

namespace Minesweeper.API.GameEngine
{
    public class LogicalBoardGenerator : IBoardGenerator
    {
        public HashSet<int> GenerateMines(int width, int height, int minesCount, int safeIndex, int? seed)
        {
            var rand = seed.HasValue ? new Random(seed.Value) : new Random();
            int totalCells = width * height;
            var safeZone = new HashSet<int>(GetNeighbors(safeIndex, width, height)) { safeIndex };

            int maxAttempts = 100;
            int bestRevealedCount = -1;
            HashSet<int> bestMinePositions = new();

            for (int i = 0; i < maxAttempts; i++)
            {
                var currentMines = new HashSet<int>();
                while (currentMines.Count < minesCount)
                {
                    int pos = rand.Next(totalCells);
                    if (!safeZone.Contains(pos)) currentMines.Add(pos);
                }

                var adjacentCache = CalculateCache(width, height, currentMines);
                if (Simulate(width, height, currentMines, adjacentCache, safeIndex, out int revealed))
                    return currentMines;

                if (revealed > bestRevealedCount)
                {
                    bestRevealedCount = revealed;
                    bestMinePositions = currentMines;
                }
            }
            return bestMinePositions;
        }

        private bool Simulate(int w, int h, HashSet<int> mines, Dictionary<int, int> cache, int start, out int revealedCount)
        {
            var simRevealed = new HashSet<int>();
            var simFlags = new HashSet<int>();
            bool progress;
            FloodFillSim(start, simRevealed, mines, cache, w, h);
            do {
                progress = false;
                foreach (var cell in simRevealed.ToList()) {
                    int mCount = cache.GetValueOrDefault(cell, 0);
                    if (mCount == 0) continue;
                    var neighbors = GetNeighbors(cell, w, h).ToList();
                    var hidden = neighbors.Where(n => !simRevealed.Contains(n)).ToList();
                    var flagged = neighbors.Count(n => simFlags.Contains(n));
                    if (hidden.Count + flagged == mCount)
                        foreach (var hIdx in hidden) if (simFlags.Add(hIdx)) progress = true;
                    if (flagged == mCount)
                        foreach (var hIdx in hidden.Where(n => !simFlags.Contains(n))) {
                            FloodFillSim(hIdx, simRevealed, mines, cache, w, h);
                            progress = true;
                        }
                }
            } while (progress);
            revealedCount = simRevealed.Count;
            return revealedCount == (w * h) - mines.Count;
        }

        private void FloodFillSim(int start, HashSet<int> revealed, HashSet<int> mines, Dictionary<int, int> cache, int w, int h)
        {
            var q = new Queue<int>(); q.Enqueue(start);
            while (q.Count > 0) {
                int curr = q.Dequeue();
                if (!revealed.Add(curr)) continue;
                if (cache.GetValueOrDefault(curr, 0) == 0)
                    foreach (var n in GetNeighbors(curr, w, h)) if (!mines.Contains(n)) q.Enqueue(n);
            }
        }

        private Dictionary<int, int> CalculateCache(int w, int h, HashSet<int> mines) =>
            Enumerable.Range(0, w * h).Where(i => !mines.Contains(i))
            .ToDictionary(i => i, i => GetNeighbors(i, w, h).Count(n => mines.Contains(n)));

        private IEnumerable<int> GetNeighbors(int idx, int w, int h) {
            int r = idx / w, c = idx % w;
            for (int i = -1; i <= 1; i++)
                for (int j = -1; j <= 1; j++) {
                    int nr = r + i, nc = c + j;
                    if (i == 0 && j == 0 || nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
                    yield return nr * w + nc;
                }
        }
    }
}