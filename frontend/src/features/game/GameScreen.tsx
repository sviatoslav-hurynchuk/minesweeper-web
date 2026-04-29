
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
    totalMines: number;
    onLeave: () => void;
}

export function GameScreen({ connection, matchId, user, mode, width, height, totalMines, onLeave }: GameScreenProps) {
    const handleLeaveMatch = () => {
        if (window.confirm("Are you sure you want to leave the match?")) {
            onLeave();
        }
    };

    return (
        
        <div className="flex flex-col items-center h-screen bg-gray-900 text-white w-full overflow-hidden">

            
            
            <div className="w-full max-w-6xl flex justify-between items-center px-4 md:px-8 py-2 shrink-0">
                <div>
                    
                    <h1 className="text-xl font-bold">
                        💣 Minesweeper: <span className="text-blue-400">{mode}</span>
                    </h1>
                    
                    <p className="text-xs md:text-lg text-gray-400 md:mt-1">Player: {user.username}</p>
                </div>
                
                <button
                    onClick={handleLeaveMatch}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 md:px-6 md:py-3 rounded-lg font-bold text-sm md:text-base transition-all shadow-lg hover:scale-105"
                >
                    Leave Match
                </button>
            </div>

            
            <div className="w-full flex flex-col items-center pb-4 overflow-hidden flex-grow">
                <GameBoard
                    key={matchId}
                    connection={connection}
                    matchId={matchId}
                    width={width}
                    height={height}
                    totalMines={totalMines}
                    onLeave={onLeave}
                    mode={mode}
                />
            </div>
        </div>
    );
}