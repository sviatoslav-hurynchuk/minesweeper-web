import { useLobby } from '../../hooks/useLobby';
import { GameScreen } from '../game/GameScreen';
import type {User} from '../../types';

interface LobbyScreenProps {
    user: User;
}

export const LobbyScreen = ({ user }: LobbyScreenProps) => {
    // Note: If you updated useLobby to return activeGame instead of activeMatchId, adjust accordingly
    const { players, incomingChallenge, sendChallenge, clearChallenge, acceptChallenge, activeMatchId } = useLobby(user.username, user.id);

    if (activeMatchId) {
        return <GameScreen matchId={activeMatchId} user={user} />;
    }

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
                                onClick={() => acceptChallenge(incomingChallenge.challengerConnectionId)}
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