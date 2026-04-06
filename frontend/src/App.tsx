import { useLobby } from './hooks/useLobby';

function App() {
    // Hardcoded user for testing Phase 2 connection
    const testUsername = "Sviatoslav_Test";
    const testUserId = "00000000-0000-0000-0000-000000000001";

    const { players } = useLobby(testUsername, testUserId);

    return (
        <div className="p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4">Minesweeper Lobby</h1>

            <div className="bg-gray-100 p-4 rounded-lg w-96">
                <h2 className="text-lg font-semibold mb-2">Players Online ({players.length}):</h2>
                <ul className="list-disc pl-5">
                    {players.map(player => (
                        <li key={player.connectionId}>
                            {player.username} <span className="text-xs text-gray-500">({player.connectionId})</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default App;