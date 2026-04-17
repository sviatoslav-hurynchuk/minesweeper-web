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
    mode: string;
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
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!username || !userId) return;

        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl("http://192.168.1.186:5244/gamehub")
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
            setErrorMessage(null); // Очищаємо помилки при успішному старті
        });

        // ✅ НОВЕ: Слухаємо помилки від сервера (наприклад, якщо опонент вже грає)
        newConnection.on("ErrorMessage", (message: string) => {
            setErrorMessage(message);
            setIncomingChallenge(null); // Скидаємо виклик, бо він більше неактуальний
        });

        // --- СТАРТУЄМО З'ЄДНАННЯ ---
        newConnection.start()
            .then(() => {
                newConnection.invoke("JoinLobby", username, userId)
                    .catch(e => console.error("JoinLobby error: ", e));

                setConnection(newConnection);
            })
            .catch(e => console.error("Connection failed: ", e));

        return () => {
            // ✅ Не забуваємо відписуватись від подій
            newConnection.off("LobbyUpdated");
            newConnection.off("ChallengeReceived");
            newConnection.off("GameStarted");
            newConnection.off("ErrorMessage");
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

    const startSoloGame = (width: number, height: number, minesCount: number) => {
        if (!connection) return;

        connection.invoke("StartSoloMatch", width, height, minesCount)
            .catch(err => console.error("Failed to start solo match:", err));
    };

    const clearChallenge = () => setIncomingChallenge(null);
    const clearActiveGame = () => setActiveGame(null);
    const clearErrorMessage = () => setErrorMessage(null); // Додано для зручності

    return {
        connection,
        players,
        incomingChallenge,
        errorMessage,
        sendChallenge,
        clearChallenge,
        acceptChallenge,
        activeGame,
        clearActiveGame,
        startSoloGame,
        clearErrorMessage
    };
};