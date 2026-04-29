import { useEffect, useState, useRef } from 'react';
import { HubConnection } from '@microsoft/signalr';
import type { CellInfo, MatchFinishedPayload } from "../game.types.ts";

export const useGameEngine = (connection: HubConnection | null, matchId: string) => {
    
    const [revealedCells, setRevealedCells] = useState<Record<number, CellInfo>>({});
    const [gameStatus, setGameStatus] = useState<"Playing" | "Victory" | "Defeat" | "Abandoned">("Playing");
    const [finalMines, setFinalMines] = useState<number[]>([]);

    const [timeElapsed, setTimeElapsed] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    
    const [flaggedCells, setFlaggedCells] = useState<Set<number>>(new Set());
    const [opponentCursor, setOpponentCursor] = useState<number | null>(null);

    
    const [freezeTimer, setFreezeTimer] = useState(0);
    const [playerProgress, setPlayerProgress] = useState(0);
    const [opponentProgress, setOpponentProgress] = useState(0);

    
    const lastSentCursorIndex = useRef<number | null>(null);

    
    const isFrozen = freezeTimer > 0;

    useEffect(() => {
        if (gameStatus === "Playing" && !isPaused) {
            const timer = setInterval(() => {
                setTimeElapsed(prev => prev + 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [gameStatus, isFrozen, isPaused]);

    const togglePause = () => {
        if (gameStatus === "Playing") {
            setIsPaused(prev => !prev);

            
        }
    };
    useEffect(() => {
        if (!connection) return;

        
        const handleBoardUpdated = (newCells: CellInfo[]) => {
            setRevealedCells(prev => {
                const updated = { ...prev };
                newCells.forEach(cell => {
                    updated[cell.index] = cell;
                });
                return updated;
            });
            setFlaggedCells(prev => {
                const updated = new Set(prev);
                let changed = false;
                newCells.forEach(cell => {
                    if (updated.has(cell.index)) {
                        updated.delete(cell.index);
                        changed = true;
                    }
                });
                return changed ? updated : prev;
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

        
        connection.on("BoardUpdated", handleBoardUpdated);
        connection.on("MatchFinished", handleMatchFinished);
        connection.on("PlayerFrozen", handlePlayerFrozen);
        connection.on("PlayerProgress", handlePlayerProgress);
        connection.on("OpponentProgress", handleOpponentProgress);
        connection.on("FlagToggled", handleFlagToggled);
        connection.on("OpponentCursorMoved", handleOpponentCursor);

        
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

    
    useEffect(() => {
        if (!isFrozen) return;
        const timer = setInterval(() => {
            setFreezeTimer(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isFrozen]);

    
    const revealCell = async (x: number, y: number) => {
        if (!connection || gameStatus !== "Playing" || isFrozen || isPaused) return;
        await connection.invoke("RevealCell", matchId, x, y);
    };

    const toggleFlag = async (index: number) => {
        if (!connection || gameStatus !== "Playing" || isFrozen || isPaused) return;

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
        if (!connection || gameStatus !== "Playing" || isFrozen || isPaused) return;

        
        if (index === lastSentCursorIndex.current) return; 
        lastSentCursorIndex.current = index;

        try {
            await connection.invoke("SendCursorPosition", matchId, index);
        } catch (error) {
            console.error("SendCursorPosition failed:", error); 
        }
    };

    return {
        revealedCells,
        flaggedCells,
        gameStatus,
        finalMines,
        isFrozen,
        isPaused,
        timeElapsed,
        freezeTimer,
        playerProgress,
        opponentProgress,
        opponentCursor,
        revealCell,
        toggleFlag,
        sendCursorMove,
        togglePause,
    };
};