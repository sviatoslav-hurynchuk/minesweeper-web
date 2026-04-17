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
    const handleLeaveMatch = async () => {
        if (!window.confirm("Are you sure you want to leave the match?")) return;
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
        // ✅ ФІКС 1: h-screen жорстко фіксує висоту вікна, overflow-hidden забороняє глобальний скрол
        <div className="flex flex-col items-center h-screen bg-gray-900 text-white w-full overflow-hidden">

            {/* Шапка гри */}
            <div className="w-full max-w-6xl flex justify-between items-center px-4 md:px-8 py-4 shrink-0">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold">
                        💣 Minesweeper: <span className="text-blue-400">{mode}</span>
                    </h1>
                    <p className="text-sm md:text-lg text-gray-400 mt-1">Player: {user.username}</p>
                </div>
                <button
                    onClick={handleLeaveMatch}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all shadow-lg hover:scale-105"
                >
                    Leave Match
                </button>
            </div>

            {/* ✅ ФІКС 2: flex-grow займає залишок екрану, а overflow-hidden гарантує, що дошка не вилізе за його межі */}
            <div className="w-full flex flex-col items-center pb-4 overflow-hidden">
                <GameBoard
                    key={matchId}
                    connection={connection}
                    matchId={matchId}
                    width={width}
                    height={height}
                    onLeave={onLeave}
                    mode={mode}
                />
            </div>
        </div>
    );
}