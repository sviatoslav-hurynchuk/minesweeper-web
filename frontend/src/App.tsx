import { useState } from 'react';
import { AuthScreen } from './features/auth/AuthScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import type {User} from './types';

function App() {
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

    if (!user) {
        return <AuthScreen onLogin={setUser} />;
    }

    return <LobbyScreen user={user} />;
}

export default App;