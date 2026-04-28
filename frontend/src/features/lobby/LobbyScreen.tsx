import { useLobby } from '../../hooks/useLobby';
import { GameScreen } from '../game/GameScreen';
import { useState, useEffect } from 'react';
import type { User } from '../../types';

interface LobbyScreenProps {
    user: User;
}

export const LobbyScreen = ({ user }: LobbyScreenProps) => {
    const { players, incomingChallenge, sendChallenge, clearChallenge, acceptChallenge, activeGame, connection, clearActiveGame, startSoloGame, errorMessage, clearErrorMessage } = useLobby(user.username, user.id);

    const [selectedMode, setSelectedMode] = useState<"PvP" | "CoOp">("PvP");

    
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                clearErrorMessage();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage, clearErrorMessage]);

    if (activeGame) {
        return (
            <GameScreen
                connection={connection}
                matchId={activeGame.matchId}
                user={user}
                mode={activeGame.mode as "Solo" | "CoOp" | "PvP"} 
                width={activeGame.cols || 16}
                height={activeGame.rows || 16}
                totalMines={activeGame.totalMines}
                onLeave={clearActiveGame}
            />
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white w-full">
            <div className="max-w-2xl mx-auto mt-8 relative w-full px-4">

                
                {errorMessage && (
                    <div className="absolute top-10 left-1/2 transform -translate-x-1/2 -mt-16 w-full max-w-md z-50 animate-fade-in-down">
                        <div className="bg-red-600 border-l-4 border-red-800 text-white p-4 rounded-lg shadow-xl flex justify-between items-start">
                            <div className="flex items-center">
                                <span className="text-xl mr-3">⚠️</span>
                                <p className="font-medium">{errorMessage}</p>
                            </div>
                            <button
                                onClick={clearErrorMessage}
                                className="text-red-200 hover:text-white transition-colors ml-4"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                )}
                

                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">Lobby</h1>
                    <span className="bg-black border border-gray-200 px-3 py-1 rounded-full font-medium">You: {user.username}</span>
                </div>
                <div className="bg-black p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col items-start gap-4">
                    <h2 className="text-2xl font-bold">Play Solo</h2>
                    <div className="flex flex-wrap gap-4 w-full">
                        <button
                            onClick={() => startSoloGame(9, 9, 10)}
                            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg transition-transform hover:scale-105"
                        >
                            Easy (9x9, 10 💣)
                        </button>
                        <button
                            onClick={() => startSoloGame(16, 16, 40)}
                            className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-4 rounded-lg transition-transform hover:scale-105"
                        >
                            Medium (16x16, 40 💣)
                        </button>
                        <button
                            onClick={() => startSoloGame(30, 16, 99)}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg transition-transform hover:scale-105"
                        >
                            Hard (30x16, 99 💣)
                        </button>
                    </div>
                </div>
                
                <div className="bg-black p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex gap-4 items-center">
                    <span className="font-bold">Select Mode:</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="mode" value="PvP" checked={selectedMode === "PvP"} onChange={() => setSelectedMode("PvP")} />
                        PvP Speedrun
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="mode" value="CoOp" checked={selectedMode === "CoOp"} onChange={() => setSelectedMode("CoOp")} />
                        Co-Op
                    </label>
                </div>

                <div className="bg-black p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold mb-4 border-b pb-2">Players Online ({players.length})</h2>
                    {players.length === 0 ? (
                        <p className="text-gray-500">Waiting for players...</p>
                    ) : (
                        <ul className="space-y-3">
                            {players.map(player => (
                                <li key={player.connectionId} className="flex justify-between items-center p-3 hover:bg-gray-50 hover:text-black rounded-lg transition-colors">
                                    <span className="font-medium">{player.username} {player.userId === user.id && "(You)"}</span>
                                    {player.userId !== user.id && (
                                        <button
                                            onClick={() => sendChallenge(player.connectionId, selectedMode)}
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

            
            {incomingChallenge && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
                    <div className="bg-white p-6 rounded-xl shadow-lg text-center text-gray-900">
                        <h3 className="text-2xl font-bold mb-2">⚔️ New {incomingChallenge.mode} Challenge!</h3>
                        <p className="mb-6 font-medium text-gray-700">
                            <span className="text-blue-600">{incomingChallenge.challengerName}</span> wants to play <span className="font-bold">{incomingChallenge.mode}</span>!
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={clearChallenge} className="px-6 py-2 bg-red-500 text-white rounded font-semibold hover:bg-red-600 cursor-pointer">Decline</button>
                            <button
                                onClick={() => acceptChallenge(incomingChallenge.challengerConnectionId, incomingChallenge.mode)}
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
};