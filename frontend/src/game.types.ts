export interface CellInfo {
    x: number;
    y: number;
    index: number;
    adjacentMines: number;
}

export interface MatchStartedPayload {
    matchId: string;
    mode: "Solo" | "CoOp" | "PvP";
    width: number;
    height: number;
}

export interface MatchFinishedPayload {
    status: "Victory" | "Defeat";
    mines?: number[]; // Only populated on defeat
}