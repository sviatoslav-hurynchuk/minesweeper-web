namespace Minesweeper.API.Models;

public class GameState
{
    public required string MatchId { get; set; }
    public required string Player1ConnectionId { get; set; }
    public required string Player2ConnectionId { get; set; }

    public int Rows { get; set; } = 10;
    public int Cols { get; set; } = 10;
    public int TotalMines { get; set; } = 10;
    public bool IsGenerated { get; set; } = false;

    public HashSet<int> MinePositions { get; set; } = new();
    public HashSet<int> RevealedCells { get; set; } = new();
    public HashSet<int> FlaggedCells { get; set; } = new();

    public void GenerateSafeBoard(int safeIndex)
    {
        var rand = new Random();
        int totalCells = Rows * Cols;

        var safeZone = new HashSet<int>(GetNeighbors(safeIndex)) { safeIndex };

        while (MinePositions.Count < TotalMines)
        {
            int pos = rand.Next(totalCells);
            if (!safeZone.Contains(pos))
            {
                MinePositions.Add(pos);
            }
        }
        IsGenerated = true;
    }

    public int CountAdjacentMines(int index)
    {
        int count = 0;
        foreach (var neighbor in GetNeighbors(index))
        {
            if (MinePositions.Contains(neighbor)) count++;
        }
        return count;
    }

    public IEnumerable<int> GetNeighbors(int index)
    {
        int r = index / Cols;
        int c = index % Cols;

        for (int i = -1; i <= 1; i++)
        {
            for (int j = -1; j <= 1; j++)
            {
                if (i == 0 && j == 0) continue;

                int nr = r + i;
                int nc = c + j;

                if (nr >= 0 && nr < Rows && nc >= 0 && nc < Cols)
                {
                    yield return nr * Cols + nc;
                }
            }
        }
    }

    public bool IsWin()
    {
        int totalCells = Rows * Cols;
        return RevealedCells.Count + MinePositions.Count == totalCells;
    }
}