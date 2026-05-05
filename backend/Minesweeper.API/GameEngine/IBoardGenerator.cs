using System.Collections.Generic;

namespace Minesweeper.API.GameEngine
{
    public interface IBoardGenerator
    {
        HashSet<int> GenerateMines(int width, int height, int minesCount, int safeIndex, int? seed);
    }
}