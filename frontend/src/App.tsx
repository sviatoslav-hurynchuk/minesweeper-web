import { useState } from 'react';
import { useLobby } from './hooks/useLobby';

interface User {
    id: string;
    username: string;
}

function App() {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('minesweeper_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });    const [isLoading, setIsLoading] = useState(false);

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

                setUser(newUser);
                localStorage.setItem('minesweeper_user', JSON.stringify(newUser));
            } else {
                console.error("Failed to create guest");
            }
        } catch (error) {
            console.error("API Error: ", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-black-100">
                <h1 className="text-4xl font-bold mb-8 text-blue-600">💣 Minesweeper PvP</h1>
                <button
                    onClick={handleGuestLogin}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors disabled:opacity-50"
                >
                    {isLoading ? "Connecting..." : "Play as Guest"}
                </button>
            </div>
        );
    }

    return <LobbyScreen user={user} />;
}

function LobbyScreen({ user }: { user: User }) {
    const { players, incomingChallenge, sendChallenge, clearChallenge } = useLobby(user.username, user.id);

    return (
        <div className="p-8 font-sans bg-black-50 min-h-screen relative">
            <div className="max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Lobby</h1>
                    <span className="bg-black-100 text-blue-800 px-3 py-1 rounded-full font-medium">
            You: {user.username}
          </span>
                </div>

                <div className="bg-black p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">
                        Players Online ({players.length})
                    </h2>
                    {players.length === 0 ? (
                        <p className="text-gray-500">Waiting for players...</p>
                    ) : (
                        <ul className="space-y-3">
                            {players.map(player => (
                                <li key={player.connectionId} className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg transition-colors">
                  <span className="font-medium">
                    {player.username} {player.userId === user.id && "(You)"}
                  </span>

                                    {player.userId !== user.id && (
                                        <button
                                            onClick={() => sendChallenge(player.connectionId)}
                                            className="px-4 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors cursor-pointer"
                                        >
                                            Challenge
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Challenge Alert Modal */}
            {incomingChallenge && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center">
                        <h3 className="text-2xl font-bold mb-2">⚔️ New Challenge!</h3>
                        <p className="mb-6 font-medium text-gray-700">
                            <span className="text-blue-600">{incomingChallenge.challengerName}</span> wants to play!
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button
                                onClick={clearChallenge}
                                className="px-6 py-2 bg-red-500 text-white rounded font-semibold hover:bg-red-600 cursor-pointer"
                            >
                                Decline
                            </button>
                            <button
                                onClick={() => alert("Game start logic coming soon!")}
                                className="px-6 py-2 bg-blue-500 text-white rounded font-semibold hover:bg-blue-600 cursor-pointer"
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;