import {useState, useCallback, useRef, useEffect, useMemo} from 'react';
import { HubConnection } from '@microsoft/signalr';
import { useGameEngine } from '../../../hooks/useGameEngine';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import * as React from "react";

interface GameBoardProps {
    connection: HubConnection | null;
    matchId: string;
    width: number;
    height: number;
    totalMines: number;
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

export const GameBoard = ({ connection, matchId, width, height, totalMines, onLeave, mode }: GameBoardProps) => {
    const {
        revealedCells, flaggedCells, gameStatus, finalMines,
        isFrozen, freezeTimer, revealCell, toggleFlag,
        playerProgress, opponentProgress, opponentCursor, sendCursorMove,
        timeElapsed, isPaused, togglePause
    } = useGameEngine(connection, matchId);

    const [clickMode, setClickMode] = useState<"reveal" | "flag">("reveal");

    const lastSentIndex = useRef<number | null>(null);
    const lastThrottleTime = useRef<number>(0);

    const throttledCursorMove = useCallback((index: number | null) => {
        if (mode === "Solo") return;
        if (index !== null && Number.isNaN(index)) return;

        const now = Date.now();
        if (index === lastSentIndex.current) return;

        if (index === null || now - lastThrottleTime.current > 50) {
            lastSentIndex.current = index;
            lastThrottleTime.current = now;
            void sendCursorMove(index).catch(console.error);
        }
    }, [sendCursorMove, mode]);

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

    const finalMinesSet = useMemo(() => new Set(finalMines), [finalMines]);
    const numberColors = ["", "text-blue-500", "text-green-500", "text-red-500", "text-purple-500", "text-yellow-600", "text-cyan-500", "text-black", "text-gray-600"];

    const cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const cell = revealedCells[index];
            const isMine = finalMinesSet.has(index);
            const isFlagged = flaggedCells.has(index);
            const isOpponentLooking = opponentCursor === index && mode === "CoOp";
            cells.push(
                <div
                    key={index}
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
                    {isFlagged && !cell ? '🚩' : ''}
                </div>
            );
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (e.key === "Escape" && mode === "Solo" && gameStatus === "Playing") {
                togglePause();
            }
        };

        window.addEventListener("keydown", handleKeyDown);

        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [mode, gameStatus, togglePause]);

    return (
        <div className="flex flex-col xl:flex-row items-center xl:items-start justify-start xl:justify-center w-full max-w-full h-full px-2 gap-4 xl:gap-8 relative">

            {mode === "PvP" && (
                <div className="order-1 xl:order-1 w-full max-w-sm xl:w-72 flex-shrink-0 bg-gray-900 p-3 md:p-4 xl:p-5 rounded-xl border-2 border-gray-700 shadow-xl flex flex-col gap-3 md:gap-4 xl:gap-6 xl:mt-2">
                    <div>
                        <div className="flex justify-between text-[10px] md:text-xs xl:text-sm font-bold mb-1 xl:mb-2">
                            <span className="text-blue-400">My Progress</span>
                            <span className="text-gray-300">{Math.round(playerProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 md:h-3 xl:h-4 overflow-hidden shadow-inner border border-gray-700">
                            <div className="bg-blue-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{width: `${playerProgress}%`}}>
                                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] md:text-xs xl:text-sm font-bold mb-1 xl:mb-2">
                            <span className="text-red-400">Opponent Progress</span>
                            <span className="text-gray-300">{Math.round(opponentProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 md:h-3 xl:h-4 overflow-hidden shadow-inner border border-gray-700">
                            <div className="bg-red-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{width: `${opponentProgress}%`}}>
                                <div className="absolute top-0 left-0 right-0 h-1 bg-white opacity-20"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="order-2 xl:order-2 flex flex-col gap-4 w-full md:w-fit max-w-full">
                <div className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl shadow-xl p-2 md:px-4 flex flex-wrap justify-between items-center gap-2 md:gap-4 z-10">
                    <div className="flex items-center gap-2 md:gap-8">
                        <div className="flex flex-col items-center bg-gray-800 px-2 md:px-4 py-1 rounded-lg border border-gray-600 shadow-inner">
                            <span className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-wider">Time</span>
                            <span className="text-base font-mono font-black text-blue-400 leading-none md:leading-normal">
                                {String(Math.floor(timeElapsed / 60)).padStart(2, '0')}:{String(timeElapsed % 60).padStart(2, '0')}
                            </span>
                        </div>
                        <div className="flex flex-col items-center bg-gray-800 px-2 md:px-4 py-1 rounded-lg border border-gray-600 shadow-inner">
                            <span className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-wider">Mines</span>
                            <span className="text-base font-mono font-black text-red-400 leading-none md:leading-normal">
                                🚩 {flaggedCells.size} / {totalMines}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {mode === "Solo" ? (
                            <button
                                onClick={togglePause}
                                disabled={gameStatus !== "Playing"}
                                aria-label={isPaused ? "Resume game" : "Pause game"}
                                className={`px-4 md:px-6 py-1.5 md:py-2 font-black uppercase tracking-wide rounded-lg shadow-md transition-all text-xs md:text-base ${isPaused ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                            >
                                {isPaused ? "▶" : "⏸"} <span className="hidden sm:inline">{isPaused ? " Resume" : " Pause"}</span>
                            </button>
                        ) : (
                            <div className="text-[10px] md:text-sm font-bold text-gray-400 bg-gray-800 px-2 md:px-4 py-1.5 md:py-2 rounded-lg border border-gray-700">
                                Mode: <span className={mode === "PvP" ? "text-purple-400" : "text-blue-400"}>{mode}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div
                    className="relative bg-gray-800 border-4 border-gray-700 rounded-xl shadow-2xl z-0 w-full md:w-fit max-w-full flex flex-col items-center justify-center overflow-hidden mx-auto aspect-[var(--board-aspect)] md:aspect-auto h-auto md:h-fit md:max-h-full xl:max-h-[85vh]"
                    style={{ "--board-aspect": `${width} / ${height}` } as React.CSSProperties}
                ><TransformWrapper
                        initialScale={1}
                        minScale={0.5}
                        maxScale={3}
                        wheel={{ step: 0.0005 }}
                        pinch={{ step: 3 }}
                        panning={{ velocityDisabled: true, allowLeftClickPan: false }}
                        doubleClick={{ disabled: true }}
                        centerOnInit={true}
                    >
                    <TransformComponent wrapperClass="!w-full !h-full md:!h-fit" wrapperStyle={{ maxWidth: "100%" }}>                            <div
                                className="p-2"
                                onMouseMove={mode === "Solo" ? undefined : (e) => {
                                    const target = e.target as HTMLElement;
                                    const cell = target.closest('[data-index]');
                                    if (cell) {
                                        const idx = parseInt(cell.getAttribute('data-index') || '', 10);
                                        if (!Number.isNaN(idx)) throttledCursorMove(idx);
                                    }
                                }}
                                onMouseLeave={mode === "Solo" ? undefined : () => throttledCursorMove(null)}
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

                    {isPaused && gameStatus === "Playing" && (
                        <div className="absolute inset-0 z-20 bg-gray-900/95 flex flex-col items-center justify-center backdrop-blur-sm rounded-xl">
                            <h2 className="text-4xl md:text-7xl font-black text-gray-500 tracking-[0.2em] mb-4 md:mb-8">PAUSED</h2>
                            <button onClick={togglePause} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-8 md:py-4 md:px-12 rounded-xl text-lg md:text-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105 uppercase">
                                ▶ Resume Game
                            </button>
                        </div>
                    )}
                    {gameStatus !== "Playing" && (
                        <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center backdrop-blur-md rounded-xl p-4">
                            <div className="bg-gray-800 p-6 md:p-10 rounded-2xl shadow-2xl text-center border-2 border-gray-600 w-full max-w-sm md:max-w-none">
                                <h2 className={`text-3xl md:text-5xl font-black mb-4 md:mb-6 ${
                                    gameStatus === "Victory" ? "text-green-400" :
                                        gameStatus === "Abandoned" ? "text-yellow-400" : "text-red-500"
                                }`}>
                                    {gameStatus === "Victory" ? "🎉 YOU WON!" :
                                        gameStatus === "Abandoned" && mode === "PvP" ? "🚪 OPPONENT LEFT" :
                                            gameStatus === "Abandoned" ? "🚪 TEAMMATE LEFT" :
                                                "💀 BOOM!"}
                                </h2>
                                {gameStatus === "Abandoned" && <p className="text-gray-300 text-sm md:text-base font-medium mb-6">A player disconnected.</p>}
                                <button onClick={onLeave} className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-8 md:py-4 md:px-10 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-transform hover:scale-105 uppercase w-full md:w-auto">Back to Lobby</button>
                            </div>
                        </div>
                    )}
                    {isFrozen && (
                        <div className="absolute inset-0 z-10 bg-red-900/80 flex items-center justify-center backdrop-blur-md">
                            <div className="text-center text-white">
                                <h2 className="text-2xl md:text-4xl font-black mb-2 md:mb-4 uppercase text-red-200">Penalty Freeze!</h2>
                                <span className="text-6xl md:text-9xl font-black">{freezeTimer}</span>
                            </div>
                        </div>
                    )}
                </div>
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