// src/hooks/useGameEngine.ts
import { useEffect, useState } from 'react';
import { HubConnection } from '@microsoft/signalr';
import type { CellInfo, MatchFinishedPayload } from "../game.types.ts";

export const useGameEngine = (connection: HubConnection | null, matchId: string) => {
    // Core Game State
    const [revealedCells, setRevealedCells] = useState<Record<number, CellInfo>>({});
    const [gameStatus, setGameStatus] = useState<"Playing" | "Victory" | "Defeat">("Playing");
    const [finalMines, setFinalMines] = useState<number[]>([]);

    // NEW: Flagging State (Using a Set for O(1) lookups)
    const [flaggedCells, setFlaggedCells] = useState<Set<number>>(new Set());

    // PvP Specific State
    const [freezeTimer, setFreezeTimer] = useState(0);
    const [playerProgress, setPlayerProgress] = useState(0);
    const [opponentProgress, setOpponentProgress] = useState(0);
    // DERIVED STATE
    const isFrozen = freezeTimer > 0;

    useEffect(() => {
        if (!connection) return;

        // 1. Handle Flood Fill & Safe Clicks
        connection.on("BoardUpdated", (newCells: CellInfo[]) => {
            setRevealedCells(prev => {
                const updated = { ...prev };
                newCells.forEach(cell => {
                    updated[cell.index] = cell;
                });
                return updated;
            });
        });

        // 2. Handle Game Over
        connection.on("MatchFinished", (payload: MatchFinishedPayload) => {
            setGameStatus(payload.status);
            if (payload.mines) {
                setFinalMines(payload.mines);
            }
        });

        // 3. Handle PvP Penalty
        connection.on("PlayerFrozen", (seconds: number) => {
            setFreezeTimer(seconds);
        });

        connection.on("PlayerProgress", (percentage: number) => {
            setPlayerProgress(percentage);
        });
        // 4. Handle Opponent Progress
        connection.on("OpponentProgress", (percentage: number) => {
            setOpponentProgress(percentage);
        });

        // 5. NEW: Handle Flag Syncing (Important for Co-op)
        connection.on("FlagToggled", (index: number, isFlagged: boolean) => {
            setFlaggedCells(prev => {
                const updated = new Set(prev);
                if (isFlagged) {
                    updated.add(index);
                } else {
                    updated.delete(index);
                }
                return updated;
            });
        });

        return () => {
            connection.off("BoardUpdated");
            connection.off("MatchFinished");
            connection.off("PlayerFrozen");
            connection.off("PlayerProgress");
            connection.off("OpponentProgress");
            connection.off("FlagToggled");
        };
    }, [connection]);

    // Timer logic for PvP Penalty
    useEffect(() => {
        if (freezeTimer <= 0) return;

        const timer = setInterval(() => {
            setFreezeTimer(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [freezeTimer]);

    // ACTIONS

    const revealCell = async (x: number, y: number) => {
        if (gameStatus !== "Playing" || isFrozen) return;
        await connection?.invoke("RevealCell", matchId, x, y);
    };

    const toggleFlag = async (index: number) => {
        if (gameStatus !== "Playing" || isFrozen) return;

        // 1. Читаємо поточний стан ПРЯМО ЗІ СТЕЙТУ
        const isCurrentlyFlagged = flaggedCells.has(index);

        // 2. Визначаємо новий стан (якщо був - знімаємо, якщо не було - ставимо)
        const newFlagState = !isCurrentlyFlagged;

        // 3. Оновлюємо UI (Оптимістичний апдейт)
        setFlaggedCells(prev => {
            const next = new Set(prev);
            if (isCurrentlyFlagged) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });

        // 4. Відправляємо на бекенд ПРАВИЛЬНИЙ новий стан
        await connection?.invoke("ToggleFlag", matchId, index, newFlagState);
    };

    return {
        revealedCells,
        flaggedCells, // Exported
        gameStatus,
        finalMines,
        isFrozen,
        freezeTimer,
        playerProgress,
        opponentProgress,
        revealCell,
        toggleFlag    // Exported
    };
};