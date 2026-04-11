# 💣 Minesweeper Web - Architecture & Master Plan

## 1. Project Overview
A multiplayer web version of Minesweeper supporting multiple game modes (Solo, Co-op, PvP Speedrun), built on a modern technology stack.

**Tech Stack:**
* **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS v4. (Architecture: Vertical Slices / Feature-based).
* **Backend:** C# .NET 8 (Minimal APIs), Entity Framework Core, SignalR.
* **Database:** PostgreSQL (via Docker).

---

## 2. Core Architecture

The system is divided into 3 main layers:

1.  **Persistent Storage (PostgreSQL):** Stores user data (registered/guests), Solo high scores (Leaderboard), and multiplayer match history (Match History).
2.  **In-Memory State (C# Backend):** Since the game occurs in real-time, the current state of the game boards (`GameState`) and active connections (Lobby) are stored in the server's RAM (using `ConcurrentDictionary`). Depending on the mode, the `GameState` can hold a single shared board (Co-op) or two independent boards with the identical mine seed (PvP).
3.  **Real-time Communication (SignalR):** Provides two-way communication. The server instantly notifies clients about the online status of other players, game invites, board clicks, flags, and win/loss conditions.

---

## 3. Database Schema (Entity Framework Core)

### `User`
Prepared for future JWT integration. For guests, `PasswordHash` is `null`.
* `Id` (Guid) - PK
* `Username` (string) - Unique name
* `IsGuest` (bool) - Flag indicating if this is a temporary account
* `PasswordHash` (string?) - Nullable, for registered accounts
* `CreatedAt` (DateTime)

### `SoloLeaderboard`
For single-player runs.
* `Id` (Guid) - PK
* `UserId` (Guid) - FK to User
* `Difficulty` (enum: Easy, Medium, Hard)
* `TimeSpentMs` (long) - Time in milliseconds
* `PlayedAt` (DateTime)

### `MatchHistory`
Stores the results of multiplayer games.
* `Id` (Guid) - PK
* `GameMode` (enum: PvP, CoOp)
* `Player1Id` (Guid) - FK to User
* `Player2Id` (Guid) - FK to User
* `WinnerId` (Guid?) - Nullable (In Co-op, the winners are either both players or neither)
* `DurationMs` (long)
* `PlayedAt` (DateTime)

---

## 4. SignalR & Real-Time Flow

The application uses a single main hub — `GameHub`, which manages the Lobby and Game states.

### The Lobby
* User connects -> Added to `ConcurrentDictionary<string, PlayerData>`.
* **Broadcasting:** When a new player connects, the server sends a `LobbyUpdated` event to all clients.
* **Invites:** Player A triggers `ChallengePlayer` (selecting the mode: Co-op or PvP). Player B receives a `ChallengeReceived` event. Upon acceptance, the corresponding `GameState` is created.

### The Game
* The server holds the board parameters in memory. Clients only receive the board dimensions initially.
* **Safe First Click:** Mines are generated (`GenerateSafeBoard`) only during the player's first click to guarantee a safe starting zone (in PvP, the exact same matrix is generated for both players).
* **Flood Fill:** Clicking on an empty cell recursively reveals all adjacent empty zones on the backend.
* **Chording:** The frontend supports quickly revealing cells (Chording) when clicking on a number if there are enough flags around it.

---

## 5. Game Engine (Backend Design Patterns)

To easily support different modes (PvP Speedrun, Co-op, Solo), game logic is governed by the **Strategy** pattern.

```csharp
    // Interface implemented by different game modes
    public interface IGameModeStrategy 
    {
        void HandleReveal(GameState session, string connectionId, int cellIndex);
        void HandleFlag(GameState session, string connectionId, int cellIndex);
        bool CheckWinCondition(GameState session);
    }

    // Co-op Implementation (Shared board)
    public class CoOpStrategy : IGameModeStrategy { /* Players share a single board state */ }

    // PvP Implementation (Separate boards)
    public class PvpSpeedrunStrategy : IGameModeStrategy { /* Each player has their own RevealedCells array */ }
```

---

## 6. Development Roadmap

* **Phase 1: Foundation — [DONE]**
    * Create EF models (User).
    * Set up migrations and PostgreSQL DB (Docker).
    * Create a temporary "Guest" entity (POST `/api/auth/guest`).
* **Phase 2: The Lobby (Real-time Connectivity) — [DONE]**
    * Configure SignalR in .NET.
    * Create the `useLobby` hook in React (with auto-reconnect).
    * Display online players list and implement invite mechanics.
* **Phase 3: Core Game Mechanics — [IN PROGRESS]**
    * Render the game grid (Vertical Architecture: `features/game`).
    * Implement "Safe First Click" board generation.
    * Backend recursive reveal (Flood Fill) and flag synchronization.
    * Frontend Chording logic (quick reveal).
* **Phase 4: Game Modes — [NEXT]**
    * Lobby UI: mode selection (Co-op or PvP) before sending an invite.
    * Refactor backend to utilize the `IGameModeStrategy` pattern.
    * Implement logic for 2 independent boards for PvP (including opponent progress tracking).
* **Phase 5: Persistence & Leaderboards**
    * Connect the database to save match results (`MatchHistory`).
    * Add a "Play Solo" button in the lobby.
    * Write results to the `SoloLeaderboard` table and display it on the client.
* **Phase 6: JWT Authentication & Polish**
    * Add `PasswordHash` to users.
    * Create `/register` and `/login` endpoints.
    * Replace temporary guest sessions with secure JWT tokens.