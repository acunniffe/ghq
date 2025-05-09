import { getAllowedMoves, getOpponent } from "./board-moves";
import { GameoverState, GHQState, Player } from "./engine";

export function getGameoverState(
  G: GHQState,
  currentPlayerTurn: Player
): GameoverState | undefined {
  // No gameover during replays
  if (G.isReplayMode) {
    return;
  }

  if (G.timeControl > 0 && G.redElapsed > G.timeControl) {
    return newWinner("BLUE", "on time");
  }
  if (G.timeControl > 0 && G.blueElapsed > G.timeControl) {
    return newWinner("RED", "on time");
  }

  if (!isHqOnBoard(G.board, "RED")) {
    return newWinner("BLUE", "by HQ capture");
  }
  if (!isHqOnBoard(G.board, "BLUE")) {
    return newWinner("RED", "by HQ capture");
  }

  if (isPlayerOutOfMoves(G, getOpponent(currentPlayerTurn))) {
    return newWinner(currentPlayerTurn, "by trapping HQ");
  }

  return undefined;
}

function newWinner(player: Player, reason: string): GameoverState {
  return {
    status: "WIN",
    winner: player,
    reason,
  };
}

export function isHqOnBoard(board: GHQState["board"], player: Player): boolean {
  return board.some((rows) =>
    rows.some((square) => square?.type === "HQ" && square.player === player)
  );
}

function isPlayerOutOfMoves(G: GHQState, player: Player): boolean {
  const allowedMoves = getAllowedMoves({
    board: G.board,
    redReserve: G.redReserve,
    blueReserve: G.blueReserve,
    currentPlayerTurn: player,
    thisTurnMoves: G.thisTurnMoves,
    enforceZoneOfControl: G.enforceZoneOfControl,
  });

  return allowedMoves.length === 0;
}

export function checkTimeForGameover({
  G,
  currentPlayer,
}: {
  G: GHQState;
  currentPlayer: Player;
}) {
  if (G.timeControl === 0) {
    return;
  }

  const elapsed = Date.now() - G.turnStartTime;

  const playerElapsed = currentPlayer === "RED" ? G.redElapsed : G.blueElapsed;
  const newPlayerElapsed = playerElapsed + elapsed - G.bonusTime;
  const timeLeft = G.timeControl - newPlayerElapsed;

  if (timeLeft >= 0) {
    return;
  }

  if (currentPlayer === "RED") {
    G.redElapsed = newPlayerElapsed;
  } else {
    G.blueElapsed = newPlayerElapsed;
  }

  const gameover: GameoverState = {
    status: "WIN",
    winner: currentPlayer === "RED" ? "BLUE" : "RED",
    reason: "on time",
  };

  return gameover;
}
