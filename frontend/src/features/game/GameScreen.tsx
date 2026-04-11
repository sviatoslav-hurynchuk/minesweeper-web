// features/game/GameScreen.tsx
import { HubConnection } from '@microsoft/signalr';
import { GameBoard } from './components/GameBoard';
import type { User } from '../../types';

interface GameScreenProps {
    connection: HubConnection | null;
    matchId: string;
    user: User;
    mode: "Solo" | "CoOp" | "PvP";
    width: number;
    height: number;
    onLeave: () => void;
}

export function GameScreen({ connection, matchId, user, mode, width, height, onLeave }: GameScreenProps) {

    // NEW: Leave match handler
    const handleLeaveMatch = async () => {
        if (!window.confirm("Are you sure you want to leave the match?")) {
            return;
        }

        if (!connection) {
            onLeave();
            return;
        }

        try {
            await connection.invoke("LeaveMatch", matchId);
        } finally {
            onLeave();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white select-none">

            {/* NEW: Top Bar with Leave Button */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-6 px-4">
                <div>
                    <h1 className="text-3xl font-bold">💣 Minesweeper: <span className="text-blue-400">{mode}</span></h1>
                    <p className="text-lg text-gray-400">Player: {user.username}</p>
                </div>
                <button
                    onClick={handleLeaveMatch}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold transition-colors"
                >
                    Leave Match
                </button>
            </div>

            <GameBoard
                key={matchId}
                connection={connection}
                matchId={matchId}
                width={width}
                height={height}
                onLeave={onLeave}
                mode={mode}
            />        </div>
    );
}