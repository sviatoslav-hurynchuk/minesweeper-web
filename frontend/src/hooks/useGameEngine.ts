import { useEffect, useState, useRef } from 'react';
import { HubConnection } from '@microsoft/signalr';
import type { CellInfo, MatchFinishedPayload } from "../game.types.ts";

export const useGameEngine = (connection: HubConnection | null, matchId: string) => {
    // Core Game State
    const [revealedCells, setRevealedCells] = useState<Record<number, CellInfo>>({});
    const [gameStatus, setGameStatus] = useState<"Playing" | "Victory" | "Defeat">("Playing");
    const [finalMines, setFinalMines] = useState<number[]>([]);

    // Flagging State & Cursor
    const [flaggedCells, setFlaggedCells] = useState<Set<number>>(new Set());
    const [opponentCursor, setOpponentCursor] = useState<number | null>(null);

    // PvP Specific State
    const [freezeTimer, setFreezeTimer] = useState(0);
    const [playerProgress, setPlayerProgress] = useState(0);
    const [opponentProgress, setOpponentProgress] = useState(0);

    // --- State Ref for Cursor Deduplication ---
    const lastSentCursorIndex = useRef<number | null>(null);

    // DERIVED STATE
    const isFrozen = freezeTimer > 0;

    useEffect(() => {
        if (!connection) return;

        // 1. Оголошуємо всі функції-обробники окремо
        const handleBoardUpdated = (newCells: CellInfo[]) => {
            setRevealedCells(prev => {
                const updated = { ...prev };
                newCells.forEach(cell => {
                    updated[cell.index] = cell;
                });
                return updated;
            });
        };

        const handleMatchFinished = (payload: MatchFinishedPayload) => {
            setGameStatus(payload.status);
            if (payload.mines) {
                setFinalMines(payload.mines);
            }
        };

        const handlePlayerFrozen = (seconds: number) => setFreezeTimer(seconds);
        const handlePlayerProgress = (percentage: number) => setPlayerProgress(percentage);
        const handleOpponentProgress = (percentage: number) => setOpponentProgress(percentage);
        const handleOpponentCursor = (index: number | null) => setOpponentCursor(index);

        const handleFlagToggled = (index: number, isFlagged: boolean) => {
            setFlaggedCells(prev => {
                const updated = new Set(prev);
                if (isFlagged) updated.add(index);
                else updated.delete(index);
                return updated;
            });
        };

        // 2. Підписуємось, передаючи саме ці посилання
        connection.on("BoardUpdated", handleBoardUpdated);
        connection.on("MatchFinished", handleMatchFinished);
        connection.on("PlayerFrozen", handlePlayerFrozen);
        connection.on("PlayerProgress", handlePlayerProgress);
        connection.on("OpponentProgress", handleOpponentProgress);
        connection.on("FlagToggled", handleFlagToggled);
        connection.on("OpponentCursorMoved", handleOpponentCursor);

        // 3. Відписуємось ТОЧНО від цих функцій (безпечне очищення)
        return () => {
            connection.off("BoardUpdated", handleBoardUpdated);
            connection.off("MatchFinished", handleMatchFinished);
            connection.off("PlayerFrozen", handlePlayerFrozen);
            connection.off("PlayerProgress", handlePlayerProgress);
            connection.off("OpponentProgress", handleOpponentProgress);
            connection.off("FlagToggled", handleFlagToggled);
            connection.off("OpponentCursorMoved", handleOpponentCursor);
        };
    }, [connection]);

    // Таймер
    useEffect(() => {
        if (!isFrozen) return;
        const timer = setInterval(() => {
            setFreezeTimer(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isFrozen]);

    // ACTIONS
    const revealCell = async (x: number, y: number) => {
        if (!connection || gameStatus !== "Playing" || isFrozen) return;
        await connection.invoke("RevealCell", matchId, x, y);
    };

    const toggleFlag = async (index: number) => {
        if (!connection || gameStatus !== "Playing" || isFrozen) return;

        const isCurrentlyFlagged = flaggedCells.has(index);
        const newFlagState = !isCurrentlyFlagged;

        setFlaggedCells(prev => {
            const next = new Set(prev);
            if (isCurrentlyFlagged) next.delete(index);
            else next.add(index);
            return next;
        });

        try {
            await connection.invoke("ToggleFlag", matchId, index, newFlagState);
        } catch (error) {
            setFlaggedCells(prev => {
                const next = new Set(prev);
                if (isCurrentlyFlagged) next.add(index);
                else next.delete(index);
                return next;
            });
            console.error("ToggleFlag failed:", error);
        }
    };

    const sendCursorMove = async (index: number | null) => {
        if (!connection || gameStatus !== "Playing" || isFrozen) return;

        // --- Deduplication Logic ---
        if (index === lastSentCursorIndex.current) return; // Prevent duplicate requests
        lastSentCursorIndex.current = index;

        try {
            await connection.invoke("SendCursorPosition", matchId, index);
        } catch (error) {
            console.error("SendCursorPosition failed:", error); // Changed from console.log to console.error
        }
    };

    return {
        revealedCells,
        flaggedCells,
        gameStatus,
        finalMines,
        isFrozen,
        freezeTimer,
        playerProgress,
        opponentProgress,
        opponentCursor,
        revealCell,
        toggleFlag,
        sendCursorMove
    };
};