import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

export interface PlayerData {
    connectionId: string;
    username: string;
    userId: string;
}

export interface Challenge {
    challengerName: string;
    challengerConnectionId: string;
}

export interface GameInfo {
    matchId: string;
    rows: number;
    cols: number;
}

export interface CellUpdate {
    index: number;
    value: number;
}

export const useLobby = (username: string | null, userId: string | null) => {
    const [activeGame, setActiveGame] = useState<GameInfo | null>(null);
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);

    const [boardUpdates, setBoardUpdates] = useState<CellUpdate[]>([]);
    const [gameOverState, setGameOverState] = useState<{loserConnectionId: string, mineIndex: number} | null>(null);
    // FIXED: Added state for flags
    const [flags, setFlags] = useState<number[]>([]);

    const connectionRef = useRef<signalR.HubConnection | null>(null);

    useEffect(() => {
        if (!username || !userId) return;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:7244/gamehub")
            .withAutomaticReconnect()
            .build();

        connectionRef.current = connection;

        connection.onreconnected(() => {
            connection.invoke("JoinLobby", username, userId)
                .catch(e => console.error("Rejoin error: ", e));
        });

        connection.start()
            .then(() => {
                connection.invoke("JoinLobby", username, userId)
                    .catch(e => console.error("JoinLobby error: ", e));
            })
            .catch(e => console.error("Connection failed: ", e));

        connection.on("LobbyUpdated", (onlinePlayers: PlayerData[]) => {
            setPlayers(onlinePlayers);
        });

        connection.on("ChallengeReceived", (challengerName: string, challengerConnectionId: string) => {
            setIncomingChallenge({ challengerName, challengerConnectionId });
        });

        connection.on("GameStarted", (info: GameInfo) => {
            setActiveGame(info);
            setIncomingChallenge(null);
            setBoardUpdates([]);
            setGameOverState(null);
            setFlags([]);
        });

        connection.on("CellsRevealed", (updates: CellUpdate[]) => {
            setBoardUpdates(prev => [...prev, ...updates]);
        });

        connection.on("FlagToggled", (data: { index: number, isFlagged: boolean }) => {
            if (data.isFlagged) {
                setFlags(prev => [...prev, data.index]);
            } else {
                setFlags(prev => prev.filter(idx => idx !== data.index));
            }
        });

        connection.on("GameWon", () => {
            alert("WE HAVE A WINNER!");
        });

        connection.on("GameOver", (data: { loserConnectionId: string, mineIndex: number }) => {
            setGameOverState(data);
        });

        return () => {
            connection.stop().catch(e => console.error("Stop error: ", e));
            connectionRef.current = null;
        };
    }, [username, userId]);

    const toggleFlag = (matchId: string, index: number) => {
        connectionRef.current?.invoke("ToggleFlag", matchId, index).catch(console.error);
    };

    const sendChallenge = (targetConnectionId: string) => {
        connectionRef.current?.invoke("ChallengePlayer", targetConnectionId)
            .catch(e => console.error("Challenge error: ", e));
    };

    const acceptChallenge = (challengerConnectionId: string) => {
        connectionRef.current?.invoke("AcceptChallenge", challengerConnectionId)
            .catch(e => console.error("Accept error: ", e));
    };

    const clearChallenge = () => setIncomingChallenge(null);

    const revealCell = (matchId: string, index: number) => {
        connectionRef.current?.invoke("RevealCell", matchId, index)
            .catch(e => console.error("Reveal error: ", e));
    };

    return {
        players,
        incomingChallenge,
        sendChallenge,
        clearChallenge,
        acceptChallenge,
        activeGame,
        boardUpdates,
        gameOverState,
        revealCell,
        flags,
        toggleFlag
    };
};