# Minesweeper Web: Real-Time Multiplayer

A modern, web-based version of the classic Minesweeper game, featuring real-time multiplayer modes, a leaderboard system, and progress saving.

## Tech Stack
* **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS v4
* **Backend:** C# ASP.NET Core 8 Web API, SignalR
* **Database:** PostgreSQL (via Docker), Entity Framework Core

## Game Modes
* 👤 **Solo:** Classic single-player Minesweeper experience.
* 🤝 **Co-Op:** Play collaboratively on a single shared board with another player.
* ⚔️ **PvP Speedrun:** Race against an opponent on identical boards. Mistakes trigger a 10-second penalty freeze!

## Local Setup
*(Instructions on how to run the project locally will be added here later)*

## Programming Principles
* **SOLID:** Single Responsibility Principle (e.g., separating React components from network logic using custom hooks), Open/Closed Principle (adding new game modes via Strategy pattern without modifying core engine logic).
* **DRY (Don't Repeat Yourself):** Reusing the core board generation and flood-fill logic across all game modes.
* **KISS (Keep It Simple, Stupid):** Simplified optimistic UI updates that instantly react to user input before server confirmation.
* **Fail Fast:** Throwing `InvalidOperationException` on the backend immediately when an invalid board configuration (e.g., too many mines) is requested.
* **Separation of Concerns (SoC):** Decoupling UI components (`GameBoard`) from state management and SignalR communication (`useGameEngine`).

## Design Patterns
* **Strategy Pattern:** Used on the backend (`IGameModeStrategy`) to seamlessly switch between Solo, Co-Op, and PvP logic without polluting the SignalR Hub.
* **Observer Pattern (Pub/Sub):** Utilized via SignalR to broadcast real-time events (e.g., `BoardUpdated`, `PlayerFrozen`) to subscribed clients.
* **State Pattern:** The frontend utilizes complex state machines (via custom hooks) to seamlessly transition between Lobby, Playing, Penalty Freeze, and Game Over states.

## Refactoring Techniques
* **Extract Hook:** Moving massive game logic out of React components into specialized `useGameEngine` and `useLobby` hooks.
* **Guard Clauses:** Replacing nested `if/else` statements with early returns in SignalR event handlers to improve readability and flow.
* **Optimistic UI with Rollback:** Updating local React state immediately (e.g., flag toggling), coupled with a `try/catch` mechanism to revert state if the server invocation fails.
* **Safe Concurrent Access:** Introducing `lock` blocks and snapshotting (`ToList()`) on the backend to prevent race conditions in multi-threaded multiplayer scenarios.
* **Data Normalization:** Converting `PascalCase` backend properties to `camelCase` at the serialization level to ensure seamless integration with TypeScript interfaces.