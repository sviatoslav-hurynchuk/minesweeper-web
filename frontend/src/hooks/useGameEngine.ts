// src/hooks/useGameEngine.ts
import { useEffect, useState } from 'react';
import { HubConnection } from '@microsoft/signalr';
import type { CellInfo, MatchFinishedPayload } from "../game.types.ts";

export const useGameEngine = (connection: HubConnection | null, matchId: string) => {
    // Core Game State
    const [revealedCells, setRevealedCells] = useState<Record<number, CellInfo>>({});
    const [gameStatus, setGameStatus] = useState<"Playing" | "Victory" | "Defeat">("Playing");
    const [finalMines, setFinalMines] = useState<number[]>([]);

    // PvP Specific State
    const [freezeTimer, setFreezeTimer] = useState(0);
    const [opponentProgress, setOpponentProgress] = useState(0);

    // DERIVED STATE: No need for a separate useState.
    // If the timer is greater than 0, the player is frozen.
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

        // 2. Handle Game Over (Co-op/Solo death, or Victory)
        connection.on("MatchFinished", (payload: MatchFinishedPayload) => {
            setGameStatus(payload.status);
            if (payload.mines) {
                setFinalMines(payload.mines);
            }
        });

        // 3. Handle PvP Penalty
        connection.on("PlayerFrozen", (seconds: number) => {
            setFreezeTimer(seconds);
            setRevealedCells({}); // Reset local board view for penalty
        });

        // 4. Handle Opponent Progress (PvP)
        connection.on("OpponentProgress", (percentage: number) => {
            setOpponentProgress(percentage);
        });

        return () => {
            connection.off("BoardUpdated");
            connection.off("MatchFinished");
            connection.off("PlayerFrozen");
            connection.off("OpponentProgress");
        };
    }, [connection]);

    // Cleaned up timer logic for PvP Penalty
    useEffect(() => {
        // Exit early if there's no active timer
        if (freezeTimer <= 0) return;

        const timer = setInterval(() => {
            setFreezeTimer(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [freezeTimer]);

    // Actions
    const revealCell = async (x: number, y: number) => {
        if (gameStatus !== "Playing" || isFrozen) return;
        await connection?.invoke("RevealCell", matchId, x, y);
    };

    return {
        revealedCells,
        gameStatus,
        finalMines,
        isFrozen,
        freezeTimer,
        opponentProgress,
        revealCell
    };
};