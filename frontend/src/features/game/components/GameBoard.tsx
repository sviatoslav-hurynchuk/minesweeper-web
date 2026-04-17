import React, { useState, useCallback, useRef } from 'react';
import { HubConnection } from '@microsoft/signalr';
import { useGameEngine } from '../../../hooks/useGameEngine';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface GameBoardProps {
    connection: HubConnection | null;
    matchId: string;
    width: number;
    height: number;
    onLeave: () => void;
    mode: "Solo" | "CoOp" | "PvP";
}

const getNeighbors = (index: number, width: number, height: number) => {
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
        revealedCells, flaggedCells, gameStatus, finalMines,
        isFrozen, freezeTimer, revealCell, toggleFlag,
        playerProgress, opponentProgress, opponentCursor, sendCursorMove
    } = useGameEngine(connection, matchId);

    const [clickMode, setClickMode] = useState<"reveal" | "flag">("reveal");

    // --- Тротлінг та дедуплікація курсору ---
    const lastSentIndex = useRef<number | null>(null);
    const lastThrottleTime = useRef<number>(0);

    const throttledCursorMove = useCallback((index: number | null) => {
        const now = Date.now();
        // Якщо індекс той самий — нічого не шлемо
        if (index === lastSentIndex.current) return;

        // Шлемо не частіше ніж раз на 50мс (або миттєво, якщо це null — прибирання курсору)
        if (index === null || now - lastThrottleTime.current > 50) {
            lastSentIndex.current = index;
            lastThrottleTime.current = now;
            sendCursorMove(index);
        }
    }, [sendCursorMove]);

    const handleCellClick = (index: number, x: number, y: number) => {
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
                        revealCell(nx, ny).catch(console.error);
                    }
                });
            }
        } else if (!cell) {
            if (clickMode === "flag") {
                toggleFlag(index).catch(console.error);
            } else if (!flaggedCells.has(index)) {
                revealCell(x, y).catch(console.error);
            }
        }
    };

    const finalMinesSet = React.useMemo(() => new Set(finalMines), [finalMines]);
    const numberColors = ["", "text-blue-500", "text-green-500", "text-red-500", "text-purple-500", "text-yellow-600", "text-cyan-500", "text-black", "text-gray-600"];

    const cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const cell = revealedCells[index];
            const isMine = finalMinesSet.has(index);
            const isFlagged = flaggedCells.has(index);
            const isOpponentLooking = opponentCursor === index && mode !== "Solo" && mode !== "PvP";
            cells.push(
                <div
                    key={index}
                    // ✅ Додали data-index для делегації подій
                    data-index={index}
                    className={`
                        w-[30px] h-[30px] flex-shrink-0 flex items-center justify-center font-bold text-base select-none rounded-sm transition-all relative
                        ${cell ? 'text-black bg-gray-200 border-none' : 'bg-gray-400 hover:bg-gray-300 border-b-4 border-gray-500 cursor-pointer active:border-b-0 active:translate-y-1'}
                        ${isMine && !isFlagged ? 'bg-red-500 border-none' : ''}
                    `}
                    onClick={() => handleCellClick(index, x, y)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        if (!cell) {
                            if (clickMode === "flag") {
                                if (!flaggedCells.has(index)) revealCell(x, y).catch(console.error);
                            } else {
                                toggleFlag(index).catch(console.error);
                            }
                        }
                    }}
                >
                    <div
                        className={`
                            absolute inset-0 rounded-sm pointer-events-none z-10
                            ring-2 ring-red-500 ring-offset-1 ring-offset-gray-800
                            transition-opacity
                            ${isOpponentLooking ? 'opacity-100 duration-0' : 'opacity-0 duration-500'}
                        `}
                    />

                    {cell && cell.adjacentMines > 0 ? <span className={numberColors[cell.adjacentMines]}>{cell.adjacentMines}</span> : ''}
                    {isMine && !isFlagged ? '💣' : ''}
                    {isFlagged ? '🚩' : ''}
                </div>
            );
        }
    }

    return (
        <div className="flex flex-col xl:flex-row items-center xl:items-start justify-center w-full max-w-full h-full px-2 gap-4 xl:gap-8">

            {mode === "PvP" && (
                <div className="order-1 xl:order-1 w-full max-w-sm xl:w-72 flex-shrink-0 bg-gray-900 p-4 xl:p-5 rounded-xl border-2 border-gray-700 shadow-xl flex flex-col gap-4 xl:gap-6 xl:mt-2">
                    <h3 className="text-lg xl:text-xl font-black text-white text-center border-b border-gray-700 pb-2 xl:pb-3 tracking-wide">⚔️ MATCH STATS</h3>
                    <div>
                        <div className="flex justify-between text-xs xl:text-sm font-bold mb-1 xl:mb-2">
                            <span className="text-blue-400">My Progress</span>
                            <span className="text-gray-300">{Math.round(playerProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3 xl:h-4 overflow-hidden shadow-inner border border-gray-700">
                            <div className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{width: `${playerProgress}%`}}>
                                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs xl:text-sm font-bold mb-1 xl:mb-2">
                            <span className="text-red-400">Opponent Progress</span>
                            <span className="text-gray-300">{Math.round(opponentProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3 xl:h-4 overflow-hidden shadow-inner border border-gray-700">
                            <div className="bg-red-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{width: `${opponentProgress}%`}}>
                                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="order-2 xl:order-2 relative bg-gray-800 border-4 border-gray-700 rounded-xl shadow-2xl z-0 w-fit max-w-full mx-auto flex flex-col h-fit max-h-full xl:max-h-[85vh] overflow-hidden">
                <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={3}
                    wheel={{ step: 0.0005 }}
                    pinch={{ step: 3 }}
                    panning={{ velocityDisabled: true, allowLeftClickPan: false }}
                    doubleClick={{ disabled: true }}
                >
                    <TransformComponent wrapperStyle={{ width: "fit-content", height: "fit-content", maxWidth: "100%" }}>
                        {/* ✅ ОДИН обробник на весь контейнер замість 256 індивідуальних */}
                        <div
                            className="p-2 md:p-6"
                            onMouseMove={(e) => {
                                const target = e.target as HTMLElement;
                                const cell = target.closest('[data-index]');
                                if (cell) {
                                    const idx = parseInt(cell.getAttribute('data-index') || '', 10);
                                    throttledCursorMove(idx);
                                }
                            }}
                            onMouseLeave={() => throttledCursorMove(null)}
                        >
                            <div
                                className="grid gap-1 bg-gray-800 w-max mx-auto shadow-inner"
                                style={{
                                    gridTemplateColumns: `repeat(${width}, 30px)`,
                                    gridTemplateRows: `repeat(${height}, 30px)`
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                {cells}
                            </div>
                        </div>
                    </TransformComponent>
                </TransformWrapper>

                {gameStatus !== "Playing" && (
                    <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center backdrop-blur-md">
                        <div className="bg-gray-800 p-8 md:p-10 rounded-2xl shadow-2xl text-center border-2 border-gray-600">
                            <h2 className="text-4xl md:text-5xl font-black mb-6 text-white">{gameStatus === "Victory" ? "🎉 YOU WON!" : "💀 BOOM!"}</h2>
                            <button onClick={onLeave} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-10 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105 uppercase">Back to Lobby</button>
                        </div>
                    </div>
                )}
                {isFrozen && (
                    <div className="absolute inset-0 z-10 bg-red-900/80 flex items-center justify-center backdrop-blur-md">
                        <div className="text-center text-white">
                            <h2 className="text-3xl md:text-4xl font-black mb-4 uppercase text-red-200">Penalty Freeze!</h2>
                            <span className="text-7xl md:text-9xl font-black">{freezeTimer}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="order-3 xl:order-3 mt-2 xl:mt-2 flex flex-row xl:flex-col bg-gray-900 rounded-xl p-2 border-2 border-gray-700 shadow-xl shrink-0 gap-2 xl:w-32">
                <button onClick={() => setClickMode("reveal")} className={`flex flex-1 xl:flex-none items-center justify-center gap-2 px-4 py-2 xl:py-4 rounded-lg font-bold text-sm xl:text-base transition-all ${clickMode === "reveal" ? "bg-blue-600 text-white shadow-md xl:scale-[1.02]" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"}`}>
                    <span className="text-lg">⛏️</span>
                    <span className="xl:hidden">Відкрити</span>
                </button>
                <button onClick={() => setClickMode("flag")} className={`flex flex-1 xl:flex-none items-center justify-center gap-2 px-4 py-2 xl:py-4 rounded-lg font-bold text-sm xl:text-base transition-all ${clickMode === "flag" ? "bg-red-600 text-white shadow-md xl:scale-[1.02]" : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"}`}>
                    <span className="text-lg">🚩</span>
                    <span className="xl:hidden">Прапор</span>
                </button>
                <div className="hidden xl:block mt-4 text-center text-xs text-gray-500 font-medium px-2">
                    {clickMode === "reveal" ? "ЛКМ: Відкрити\nПКМ: Прапор" : "ЛКМ: Прапор\nПКМ: Відкрити"}
                </div>
            </div>

        </div>
    );
};