import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

export interface PlayerData {
    connectionId: string;
    username: string;
    userId: string;
}

export const useLobby = (username: string | null, userId: string | null) => {
    const [players, setPlayers] = useState<PlayerData[]>([]);
    // Use ref for connection to avoid unnecessary re-renders
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
                console.log("Connected to GameHub!");
                connection.invoke("JoinLobby", username, userId)
                    .catch(e => console.error("JoinLobby error: ", e));
            })
            .catch(e => console.error("Connection failed: ", e));

        connection.on("LobbyUpdated", (onlinePlayers: PlayerData[]) => {
            setPlayers(onlinePlayers);
        });

        // Cleanup on unmount
        return () => {
            connection.stop().catch(e => console.error("Stop error: ", e));
            connectionRef.current = null;
        };
    }, [username, userId]);

    return { players };
};