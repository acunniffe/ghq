import { AllowedMove, Board, Player, ReserveFleet } from "./engine";

const unitScores: Record<string, number> = {
  INFANTRY: 1,
  ARMORED_INFANTRY: 3,
  AIRBORNE_INFANTRY: 5,
  ARTILLERY: 3,
  ARMORED_ARTILLERY: 5,
  HEAVY_ARTILLERY: 6,
  HQ: 100,
};

export interface EvalBoardState {
  board: Board;
  redReserve?: ReserveFleet;
  blueReserve?: ReserveFleet;
  currentPlayerTurn?: Player;
  thisTurnMoves?: AllowedMove[];
  isReplayMode?: boolean;
  enforceZoneOfControl?: boolean;
}

export function calculateEval({ board }: EvalBoardState): number {
  const scores: Record<Player, number> = {
    RED: 0,
    BLUE: 0,
  };

  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      const square = board[i][j];
      if (square === null) {
        continue;
      }

      scores[square.player] += unitScores[square.type] ?? 0;
    }
  }

  return scores.RED - scores.BLUE;
}
