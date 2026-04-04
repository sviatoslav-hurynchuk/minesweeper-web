# 💣 Minesweeper Web - Architecture & Master Plan

## 1. Project Overview
Багатокористувацька веб-версія гри "Сапер" з підтримкою режимів Solo та PvP, розроблена на сучасному стеку технологій. Архітектура закладається з урахуванням майбутнього розширення (Co-op режим, повноцінна JWT-автентифікація).

**Технологічний стек:**
* **Frontend:** React 18+, TypeScript, Vite, Tailwind CSS v4.
* **Backend:** C# .NET 8 (Minimal APIs), Entity Framework Core, SignalR.
* **Database:** PostgreSQL (via Docker).

---

## 2. Core Architecture

Система розділена на 3 головні шари:
1.  **Persistent Storage (PostgreSQL):** Зберігає користувачів (реєстрація/гості), результати Solo-рекордів (Leaderboard) та історію мультиплеєрних матчів (Match History).
2.  **In-Memory State (C# Backend):** Оскільки гра відбувається в реальному часі, поточний стан ігрових дошок, активні підключення (Лобі) та таймери зберігаються в оперативній пам'яті сервера (використовуючи `ConcurrentDictionary`).
3.  **Real-time Communication (SignalR):** Забезпечує двосторонній зв'язок. Сервер миттєво повідомляє клієнтів про онлайн-статус інших гравців, інвайти на гру та кліки по ігровому полю.

---

## 3. Database Schema (Entity Framework Core)

### `User` (Користувач)
Готуємо під майбутній JWT. Для гостей `PasswordHash` буде `null`.
* `Id` (Guid) - PK
* `Username` (string) - Унікальне ім'я
* `IsGuest` (bool) - Флаг, чи це тимчасовий акаунт
* `PasswordHash` (string?) - Nullable, для майбутньої реєстрації
* `CreatedAt` (DateTime)

### `SoloLeaderboard` (Таблиця лідерів)
Суто для одиночних забігів без права на помилку (одна міна = смерть).
* `Id` (Guid) - PK
* `UserId` (Guid) - FK to User
* `Difficulty` (enum: Easy, Medium, Hard)
* `TimeSpentMs` (long) - Час у мілісекундах
* `PlayedAt` (DateTime)

### `MatchHistory` (Історія матчів)
Зберігає результати PvP (і майбутніх Co-op) ігор.
* `Id` (Guid) - PK
* `GameMode` (enum: PvP, CoOp)
* `Player1Id` (Guid) - FK to User
* `Player2Id` (Guid) - FK to User
* `WinnerId` (Guid?) - Nullable (якщо нічия або Co-op)
* `DurationMs` (long)
* `SettingsSnapshot` (jsonb / string) - Збережені налаштування (напр. "Penalty: Freeze 5s")
* `PlayedAt` (DateTime)

---

## 4. SignalR & Real-Time Flow

Додаток використовуватиме один головний хаб — `GameHub`, який матиме два логічні стани для клієнта: Лобі та Гра.

### The Lobby (Лобі)
* Користувач підключається -> Додається в `ConcurrentDictionary<string, Player>` (ConnectionId -> PlayerData).
* **Broadcasting:** При підключенні нового гравця, сервер відправляє подію `LobbyUpdated` всім клієнтам. React малює список онлайн-гравців (як у Steam).
* **Invites:** Гравець А викликає `SendInvite(TargetConnectionId, GameSettings)`. Гравець Б отримує подію `ReceiveInvite`. При згоді обидва додаються в SignalR Group (Кімнату).

### The Game (Ігровий процес)
* Сервер генерує ігрове поле (масив клітинок) і тримає його в пам'яті. Клієнтам відправляється лише розмірність дошки (без мін).
* Клієнт клікає на `[X, Y]` -> відправляє `RevealCell(X, Y)`.
* Сервер валідує клік. Якщо міна:
    * *Якщо налаштування "Freeze":* Сервер блокує прийом кліків від цього гравця на N секунд, відправляє подію `PlayerFrozen(Duration)`.
    * *Якщо налаштування "Death":* Гра закінчується, відправляється подія `GameOver`.
* Сервер розсилає `BoardUpdated(Cells)` всім у кімнаті.

---

## 5. Game Engine (Backend Design Patterns)

Щоб легко додавати нові режими (PvP, Co-op, Solo), використовуємо патерн **Strategy**.

```csharp
// Інтерфейс, який реалізують різні режими гри
public interface IGameModeStrategy 
{
    void HandleClick(GameSession session, Player player, int x, int y);
    bool CheckWinCondition(GameSession session);
}

// Приклад реалізації PvP на швидкість з двома однаковими дошками
public class PvpSpeedrunStrategy : IGameModeStrategy 
{
    public void HandleClick(GameSession session, Player player, int x, int y) 
    {
        // Логіка перевірки міни, нарахування штрафу (Freeze), 
        // та оновлення персональної дошки гравця
    }
    // ...
}
```

---

## 6. Development Roadmap (Покроковий план)

* **Phase 1: Foundation (База)**
    * Створення Entity Framework моделей (User, MatchHistory, Leaderboard).
    * Налаштування міграцій та підключення до PostgreSQL через Docker.
    * Реалізація створення тимчасового "Гостя" (Minimal API endpoint: `POST /api/auth/guest`).
* **Phase 2: The Lobby (Реал-тайм підключення)**
    * Налаштування SignalR у .NET.
    * Створення контексту в React для тримання підключення.
    * Виведення списку онлайн-гравців та реалізація механіки "Відправити інвайт / Прийняти інвайт".
* **Phase 3: Solo Engine & Leaderboard**
    * Реалізація генератора дошки (C# алгоритм розстановки мін та підрахунку сусідів).
    * Створення `SoloStrategy` (одна помилка = програш).
    * React-компонент ігрового поля (малювання сітки).
    * Запис результатів у таблицю `SoloLeaderboard` та виведення її на клієнті.
* **Phase 4: PvP Multiplayer**
    * Реалізація `PvpSpeedrunStrategy`.
    * Підтримка налаштувань кімнати (Freeze Timer vs Instant Death).
    * Синхронізація прогресу суперника (наприклад, маленький прогрес-бар "Суперник відкрив 40/100 клітинок").
    * Запис результатів у `MatchHistory`.
* **Phase 5: JWT Authentication**
    * Додавання `PasswordHash` до користувачів.
    * Ендпоінти `/register` та `/login`.
    * Заміна тимчасових гостьових сесій на захищені JWT-токени (передача токена при підключенні до SignalR).

---