import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthScreen } from './features/auth/AuthScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import { GameScreen } from './features/game/GameScreen';
import { useLobby } from './hooks/useLobby';
import type { User } from './types';

function AppContent() {
    const [user, setUser] = useState<User | null>(() => {
        try {
            const savedUser = localStorage.getItem('minesweeper_user');
            if (!savedUser) return null;
            const parsed = JSON.parse(savedUser) as Partial<User>;
            if (typeof parsed.id === 'string' && typeof parsed.username === 'string') {
                return { id: parsed.id, username: parsed.username };
            }
        } catch {
            // Ignore malformed persisted state
        }
        localStorage.removeItem('minesweeper_user');
        return null;
    });

    const navigate = useNavigate();

    const lobbyState = useLobby(user?.username || null, user?.id || null);

    useEffect(() => {
        if (lobbyState.activeGame) {
            navigate(`/game/${lobbyState.activeGame.matchId}`);
        }
    }, [lobbyState.activeGame, navigate]);

    if (!user) {
        return <AuthScreen onLogin={setUser} />;
    }

    return (
        <Routes>
            <Route path="/" element={
                <LobbyScreen user={user} lobbyState={lobbyState} />
            } />

            <Route path="/game/:matchId" element={
                (!lobbyState.connection || !lobbyState.activeGame) ? (
                    <Navigate to="/" replace />
                ) : (
                    <GameScreen
                        connection={lobbyState.connection}
                        matchId={lobbyState.activeGame.matchId}
                        user={user}
                        mode={lobbyState.activeGame.mode}
                        width={lobbyState.activeGame.cols || 16}
                        height={lobbyState.activeGame.rows || 16}
                        totalMines={lobbyState.activeGame.totalMines}
                        onLeave={() => {
                            lobbyState.clearActiveGame();
                            navigate('/');
                        }}
                    />
                )
            } />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;