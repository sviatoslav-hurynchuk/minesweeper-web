import { useState } from 'react';
import type {User} from '../../types';

interface AuthScreenProps {
    onLogin: (user: User) => void;
}

//const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:7244";

export const AuthScreen = ({ onLogin }: AuthScreenProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleGuestLogin = async () => {
        setIsLoading(true);
        try {
            /*const response = await fetch(`${API_BASE_URL}/api/auth/guest`, */// МАЄ БУТИ (заміни на свій IP):
            const response = await fetch("http://192.168.171.101:5244/api/auth/guest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "" })
            });

            if (response.ok) {
                const data: unknown = await response.json();

                if (
                    !data ||
                    typeof data !== 'object' ||
                    typeof (data as { id?: unknown }).id !== 'string' ||
                    typeof (data as { username?: unknown }).username !== 'string'
                ) {
                    throw new Error("Invalid auth response payload");
                }

                const newUser: User = {
                    id: (data as { id: string }).id,
                    username: (data as { username: string }).username,
                };

                localStorage.setItem('minesweeper_user', JSON.stringify(newUser));
                onLogin(newUser);
            } else {
                console.error("Failed to create guest");
            }
        } catch (error) {
            console.error("API Error: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black-100">
            <h1 className="text-4xl font-bold mb-8 text-blue-600">💣 Minesweeper PvP</h1>
            <button
                onClick={handleGuestLogin}
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
                {isLoading ? "Connecting..." : "Play as Guest"}
            </button>
        </div>
    );
};