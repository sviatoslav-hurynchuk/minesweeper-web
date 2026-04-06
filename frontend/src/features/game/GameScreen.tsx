import type { User } from '../../types';
import type { GameInfo, CellUpdate } from '../../hooks/useLobby';
import * as React from "react";

interface GameScreenProps {
    game: GameInfo;
    user: User;
    boardUpdates: CellUpdate[];
    gameOverState: { loserConnectionId: string, mineIndex: number } | null;
    flags: number[];
    onRevealCell: (matchId: string, index: number) => void;
    onToggleFlag: (matchId: string, index: number) => void;
}

// Допоміжна функція для пошуку сусідів (потрібна для акорду)
const getNeighbors = (index: number, cols: number, rows: number) => {
    const r = Math.floor(index / cols);
    const c = index % cols;
    const res: number[] = [];

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nr = r + i, nc = c + j;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                res.push(nr * cols + nc);
            }
        }
    }
    return res;
};

export function GameScreen({ game, user, boardUpdates, gameOverState, flags, onRevealCell, onToggleFlag }: GameScreenProps) {
    const cells = Array.from({ length: game.rows * game.cols }, (_, i) => i);

    // Отримання стану конкретної клітинки
    const getCellData = (index: number) => boardUpdates.find(c => c.index === index);

    // Класичні кольори цифр сапера
    const numberColors = ["", "text-blue-500", "text-green-500", "text-red-500", "text-purple-500", "text-yellow-600", "text-cyan-500", "text-black", "text-gray-600"];

    // Обробка прапорців (права кнопка миші)
    const handleContextMenu = (e: React.MouseEvent, index: number) => {
        e.preventDefault(); // Блокуємо стандартне меню браузера
        e.stopPropagation();
        if (!gameOverState) {
            onToggleFlag(game.matchId, index);
        }
    };

    // Обробка кліків (відкриття та акорд)
    const handleCellClick = (index: number) => {
        if (gameOverState) return;

        const cell = getCellData(index);

        // Логіка Акорду: якщо клікнули на вже відкриту цифру
        if (cell && cell.value > 0) {
            const neighbors = getNeighbors(index, game.cols, game.rows);
            const flaggedNeighbors = neighbors.filter(n => flags.includes(n)).length;

            // Якщо кількість прапорців навколо дорівнює цифрі
            if (flaggedNeighbors === cell.value) {
                neighbors.forEach(n => {
                    // Відкриваємо тих сусідів, які ще закриті і без прапорців
                    if (!getCellData(n) && !flags.includes(n)) {
                        onRevealCell(game.matchId, n);
                    }
                });
            }
        }
        // Звичайне відкриття: клітинка закрита і на ній немає прапорця
        else if (!cell && !flags.includes(index)) {
            onRevealCell(game.matchId, index);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white select-none relative">

            {/* Екран програшу */}
            {gameOverState && (
                <div className="absolute inset-0 bg-red-900/80 z-10 flex flex-col items-center justify-center">
                    <h2 className="text-6xl font-bold mb-4">💥 BOOM!</h2>
                    <p className="text-2xl">Match Over</p>
                </div>
            )}

            <h1 className="text-3xl font-bold mb-4">💣 Match in Progress!</h1>
            <p className="text-xl mb-6">Player: <span className="text-blue-400">{user.username}</span></p>

            {/* Ігрове поле */}
            <div
                className="bg-gray-800 p-4 rounded-xl border-4 border-gray-700 grid gap-1 shadow-2xl z-0"
                style={{
                    gridTemplateColumns: `repeat(${game.cols}, minmax(0, 1fr))`
                }}
                onContextMenu={(e) => e.preventDefault()} // Блокуємо меню на всьому контейнері поля
            >
                {cells.map(index => {
                    const cellData = getCellData(index);
                    const isRevealed = cellData !== undefined;
                    const isExplodedMine = gameOverState?.mineIndex === index;
                    const isFlagged = flags.includes(index);

                    return (
                        <button
                            key={index}
                            onContextMenu={(e) => handleContextMenu(e, index)}
                            onClick={() => handleCellClick(index)}
                            // Ми більше не вимикаємо відкриті клітинки, щоб по них можна було клікати (акорд)
                            disabled={!!gameOverState}
                            className={`w-10 h-10 flex items-center justify-center font-bold text-lg rounded-sm transition-all
                                ${isExplodedMine ? "bg-red-500 border-none" :
                                isRevealed ? "bg-gray-200 border-none" :
                                    "bg-gray-400 hover:bg-gray-300 border-b-4 border-gray-500 cursor-pointer active:border-b-0 active:translate-y-1"}`}
                        >
                            {isExplodedMine ? "💣" :
                                isRevealed && cellData.value > 0 ? (
                                    <span className={numberColors[cellData.value]}>{cellData.value}</span>
                                ) : isFlagged && !isRevealed ? (
                                    "🚩"
                                ) : ""}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}