import { useState } from 'react';
import { AuthScreen } from './features/auth/AuthScreen';
import { LobbyScreen } from './features/lobby/LobbyScreen';
import type {User} from './types';

function App() {
    const [user, setUser] = useState<User | null>(() => {
        const savedUser = localStorage.getItem('minesweeper_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    if (!user) {
        return <AuthScreen onLogin={setUser} />;
    }

    return <LobbyScreen user={user} />;
}

export default App;