// src/hooks/useLobby.ts
import { useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';

export interface PlayerData {
    connectionId: string;
    username: string;
    userId: string;
}

export interface Challenge {
    challengerName: string;
    challengerConnectionId: string;
    mode: string; // NEW
}

export interface GameInfo {
    mode: "Solo" | "CoOp" | "PvP";
    matchId: string;
    rows: number;
    cols: number;
}

export const useLobby = (username: string | null, userId: string | null) => {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

    const [activeGame, setActiveGame] = useState<GameInfo | null>(null);
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);


    useEffect(() => {
        if (!username || !userId) return;

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:7244/gamehub")
            .withAutomaticReconnect()
            .build();

        newConnection.onreconnected(() => {
            newConnection.invoke("JoinLobby", username, userId)
                .catch(e => console.error("Rejoin error: ", e));
        });

        // --- ДОДАЄМО ПОДІЇ ДО СТАРТУ ---
        newConnection.on("LobbyUpdated", (onlinePlayers: PlayerData[]) => {
            setPlayers(onlinePlayers);
        });

        newConnection.on("ChallengeReceived", (challengerName: string, challengerConnectionId: string, mode: string) => {
            setIncomingChallenge({ challengerName, challengerConnectionId, mode });
        });

        newConnection.on("GameStarted", (info: GameInfo) => {
            setActiveGame(info);
            setIncomingChallenge(null);
        });

        // --- СТАРТУЄМО З'ЄДНАННЯ ---
        newConnection.start()
            .then(() => {
                newConnection.invoke("JoinLobby", username, userId)
                    .catch(e => console.error("JoinLobby error: ", e));

                // ✅ ВИПРАВЛЕННЯ: Встановлюємо стейт тут (асинхронно)
                setConnection(newConnection);
            })
            .catch(e => console.error("Connection failed: ", e));

        return () => {
            newConnection.stop().catch(e => console.error("Stop error: ", e));
        };
    }, [username, userId]);

    // --- ACTIONS ---
    const sendChallenge = (targetConnectionId: string, mode: string) => {
        connection?.invoke("ChallengePlayer", targetConnectionId, mode).catch(console.error);
    };

    const acceptChallenge = (challengerConnectionId: string, mode: string) => {
        connection?.invoke("AcceptChallenge", challengerConnectionId, mode).catch(console.error);
    };

    const clearChallenge = () => setIncomingChallenge(null);
    const clearActiveGame = () => {
        setActiveGame(null);
    };
    return {
        connection, // <-- ТЕПЕР CONNECTION ЕКСПОРТУЄТЬСЯ
        players,
        incomingChallenge,
        sendChallenge,
        clearChallenge,
        acceptChallenge,
        activeGame,
        clearActiveGame
    };
};