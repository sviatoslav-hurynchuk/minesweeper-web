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

export const useLobby = (username: string | null, userId: string | null) => {
    const [players, setPlayers] = useState<PlayerData[]>([]);
    const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
    const connectionRef = useRef<signalR.HubConnection | null>(null);

    useEffect(() => {
        if (!username || !userId) return;

        const connection = new signalR.HubConnectionBuilder()
            .withUrl("https://localhost:7244/gamehub")
            .withAutomaticReconnect()
            .build();

        connectionRef.current = connection;

        connection.start()
            .then(() => {
                connection.invoke("JoinLobby", username, userId)
                    .catch(e => console.error("JoinLobby error: ", e));
            })
            .catch(e => console.error("Connection failed: ", e));

        connection.on("LobbyUpdated", (onlinePlayers: PlayerData[]) => {
            setPlayers(onlinePlayers);
        });

        // Listen for direct challenges
        connection.on("ChallengeReceived", (challengerName: string, challengerConnectionId: string) => {
            setIncomingChallenge({ challengerName, challengerConnectionId });
        });

        return () => {
            connection.stop().catch(e => console.error("Stop error: ", e));
            connectionRef.current = null;
        };
    }, [username, userId]);

    // Function to trigger challenge from UI
    const sendChallenge = (targetConnectionId: string) => {
        connectionRef.current?.invoke("ChallengePlayer", targetConnectionId)
            .catch(e => console.error("Challenge error: ", e));
    };

    // Function to clear challenge (e.g., if declined)
    const clearChallenge = () => setIncomingChallenge(null);

    return { players, incomingChallenge, sendChallenge, clearChallenge };
};