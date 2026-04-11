using Minesweeper.API.GameEngine;

namespace Minesweeper.API.Models
{
    public class PlayerState
    {
        public required string ConnectionId { get; set; }
        public required string Username { get; set; }

        public GameBoard Board { get; set; } = null!;

        public bool IsReady { get; set; }
        public bool IsGameOver { get; set; }
        public DateTime? PenaltyUntil { get; set; }
    }
}