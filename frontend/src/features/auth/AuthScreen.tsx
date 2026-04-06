import { useState } from 'react';
import type {User} from '../../types';

interface AuthScreenProps {
    onLogin: (user: User) => void;
}

export const AuthScreen = ({ onLogin }: AuthScreenProps) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleGuestLogin = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("https://localhost:7244/api/auth/guest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: "" })
            });

            if (response.ok) {
                const data = await response.json();
                const newUser = { id: data.id, username: data.username };

                localStorage.setItem('minesweeper_user', JSON.stringify(newUser));
                onLogin(newUser); // Pass user back to App.tsx
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