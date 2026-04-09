import React from 'react';
import { HubConnection } from '@microsoft/signalr';
import { useGameEngine } from '../../../hooks/useGameEngine';

interface GameBoardProps {
    connection: HubConnection | null;
    matchId: string;
    width: number;
    height: number;
    onLeave: () => void;
    mode: "Solo" | "CoOp" | "PvP"; // 1. ДОДАЛИ ПРОПС РЕЖИМУ
}

const getNeighbors = (index: number, width: number, height: number) => {
    // ... (код getNeighbors залишається без змін)
    const r = Math.floor(index / width);
    const c = index % width;
    const res: number[] = [];

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nr = r + i, nc = c + j;
            if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
                res.push(nr * width + nc);
            }
        }
    }
    return res;
};

export const GameBoard: React.FC<GameBoardProps> = ({ connection, matchId, width, height, onLeave, mode }) => {
    const {
        revealedCells,
        flaggedCells,
        gameStatus,
        finalMines,
        isFrozen,
        freezeTimer,
        revealCell,
        toggleFlag,
        playerProgress,
        opponentProgress // 2. ДІСТАЛИ ПРОГРЕС СУПЕРНИКА З ХУКА
    } = useGameEngine(connection, matchId);

    const handleCellClick = (index: number, x: number, y: number) => {
        // ... (код handleCellClick залишається без змін)
        const cell = revealedCells[index];
        if (cell && cell.adjacentMines > 0) {
            const neighbors = getNeighbors(index, width, height);
            let flaggedNeighborsCount = 0;
            neighbors.forEach(n => {
                if (flaggedCells.has(n)) flaggedNeighborsCount++;
            });
            if (flaggedNeighborsCount === cell.adjacentMines) {
                neighbors.forEach(n => {
                    if (!revealedCells[n] && !flaggedCells.has(n)) {
                        const nx = n % width;
                        const ny = Math.floor(n / width);
                        revealCell(nx, ny);
                    }
                });
            }
        } else if (!cell && !flaggedCells.has(index)) {
            revealCell(x, y);
        }
    };

    const cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const cell = revealedCells[index];
            const isMine = finalMines.includes(index);
            const isFlagged = flaggedCells.has(index);

            cells.push(
                <div
                    key={index}
                    className={`
                        w-10 h-10 flex items-center justify-center font-bold text-lg select-none rounded-sm transition-all
                        ${cell ? 'text-black bg-gray-200 border-none' : 'bg-gray-400 hover:bg-gray-300 border-b-4 border-gray-500 cursor-pointer active:border-b-0 active:translate-y-1'}
                        ${isMine && !isFlagged ? 'bg-red-500 border-none' : ''}
                    `}
                    onClick={() => handleCellClick(index, x, y)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (!cell) {
                            toggleFlag(index).catch();
                        }
                    }}
                >
                    {cell && cell.adjacentMines > 0 ? (
                        <span className={`text-minesweeper-${cell.adjacentMines}`}>{cell.adjacentMines}</span>
                    ) : ''}
                    {isMine && !isFlagged ? '💣' : ''}
                    {isFlagged ? '🚩' : ''}
                </div>
            );
        }
    }

    return (
        <div className="relative inline-block p-4 bg-gray-800 border-4 border-gray-700 rounded-xl shadow-2xl z-0">

            {/* 3. ДОДАЛИ БЛОК ШКАЛИ (Показується тільки якщо режим PvP) */}
            {mode === "PvP" && (
                <div className="mb-4 bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-inner flex flex-col gap-3">

                    {/* Твоя шкала (Синя) */}
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-blue-400">My Progress</span>
                            <span className="text-gray-300">{Math.round(playerProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${playerProgress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Шкала суперника (Червона) */}
                    <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-red-400">Opponent Progress</span>
                            <span className="text-gray-300">{Math.round(opponentProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-red-500 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${opponentProgress}%` }}
                            ></div>
                        </div>
                    </div>

                </div>
            )}

            {/* Grid Container */}
            <div className="grid gap-1 bg-gray-800" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }} onContextMenu={(e) => e.preventDefault()}>
                {cells}
            </div>

            {/* Overlay: Game Over */}
            {gameStatus !== "Playing" && (
                <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center backdrop-blur-sm rounded-lg">
                    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl text-center border-2 border-gray-600 transform transition-all scale-105">
                        <h2 className="text-4xl font-black mb-4 tracking-tight text-white">
                            {gameStatus === "Victory" ? "🎉 YOU WON!" : "💀 BOOM!"}
                        </h2>
                        <button
                            onClick={onLeave}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors"
                        >
                            Back to Lobby
                        </button>
                    </div>
                </div>
            )}

            {/* Overlay: Penalty Freeze (PvP Only) */}
            {isFrozen && (
                <div className="absolute inset-0 z-10 bg-red-900/80 flex items-center justify-center backdrop-blur-md rounded-lg">
                    <div className="text-center text-white">
                        <h2 className="text-3xl font-bold mb-2">Penalty Freeze!</h2>
                        <span className="text-7xl font-black shadow-black drop-shadow-lg">{freezeTimer}s</span>
                    </div>
                </div>
            )}
        </div>
    );
};