import type {User} from '../../types';

interface GameScreenProps {
    matchId: string;
    user: User;
}

export const GameScreen = ({ matchId, user }: GameScreenProps) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
            <h1 className="text-3xl font-bold mb-4">💣 Match in Progress!</h1>
            <p className="text-xl mb-2">Player: <span className="text-blue-400">{user.username}</span></p>
            <p className="text-gray-400">Match ID: {matchId}</p>

            <div className="mt-8 p-12 border-4 border-dashed border-gray-700 rounded-xl">
                <p className="text-gray-500">Game board will be rendered here...</p>
            </div>
        </div>
    );
};