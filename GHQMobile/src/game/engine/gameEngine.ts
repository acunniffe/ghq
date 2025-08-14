import { GameState, Board, Player, ReserveFleet, AllowedMove, Coordinate, Square, NonNullSquare, UnitType, Units } from '../../types';

export const defaultBoard: Board = [
  [
    { type: "HQ", player: "BLUE" },
    { type: "ARTILLERY", player: "BLUE", orientation: 180 },
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  [
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    { type: "INFANTRY", player: "BLUE" },
    null,
    null,
    null,
    null,
    null,
  ],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [
    null,
    null,
    null,
    null,
    null,
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
    { type: "INFANTRY", player: "RED" },
  ],
  [
    null,
    null,
    null,
    null,
    null,
    null,
    { type: "ARTILLERY", player: "RED", orientation: 0 },
    { type: "HQ", player: "RED" },
  ],
];

export const defaultReserveFleet: ReserveFleet = {
  INFANTRY: 5,
  ARMORED_INFANTRY: 3,
  AIRBORNE_INFANTRY: 1,
  ARTILLERY: 2,
  ARMORED_ARTILLERY: 1,
  HEAVY_ARTILLERY: 1,
};

export class GameEngine {
  private state: GameState;

  constructor() {
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      board: JSON.parse(JSON.stringify(defaultBoard)),
      currentPlayer: "RED",
      redReserve: { ...defaultReserveFleet },
      blueReserve: { ...defaultReserveFleet },
      thisTurnMoves: [],
      lastPlayerMoves: [],
      gameOver: false,
      eval: 0,
    };
  }

  public getState(): GameState {
    return { ...this.state };
  }

  public resetGame(): void {
    this.state = this.createInitialState();
  }

  public makeMove(move: AllowedMove): boolean {
    if (this.state.gameOver) {
      return false;
    }

    switch (move.name) {
      case "Move":
        return this.executeMove(move.args[0], move.args[1]);
      case "Reinforce":
        return this.executeReinforce(move.args[0], move.args[1]);
      case "Skip":
        this.endTurn();
        return true;
      default:
        return false;
    }
  }

  private executeMove(from: Coordinate, to: Coordinate): boolean {
    const [fromX, fromY] = from;
    const [toX, toY] = to;

    const piece = this.state.board[fromX][fromY];
    if (!piece || piece.player !== this.state.currentPlayer) {
      return false;
    }

    if (!this.isValidMove(from, to)) {
      return false;
    }

    this.state.board[fromX][fromY] = null;
    this.state.board[toX][toY] = piece;

    this.state.thisTurnMoves.push({
      name: "Move",
      args: [from, to],
    });

    if (this.state.thisTurnMoves.length >= 4) {
      this.endTurn();
    }

    return true;
  }

  private executeReinforce(unitType: keyof ReserveFleet, to: Coordinate): boolean {
    const reserve = this.state.currentPlayer === "RED" ? this.state.redReserve : this.state.blueReserve;
    
    if (reserve[unitType] <= 0) {
      return false;
    }

    const [toX, toY] = to;
    if (this.state.board[toX][toY] !== null) {
      return false;
    }

    reserve[unitType]--;
    
    const piece: NonNullSquare = {
      type: unitType,
      player: this.state.currentPlayer,
      orientation: unitType.includes("ARTILLERY") 
        ? (this.state.currentPlayer === "RED" ? 0 : 180)
        : undefined,
    };

    this.state.board[toX][toY] = piece;

    this.state.thisTurnMoves.push({
      name: "Reinforce",
      args: [unitType, to],
    });

    if (this.state.thisTurnMoves.length >= 4) {
      this.endTurn();
    }

    return true;
  }

  private isValidMove(from: Coordinate, to: Coordinate): boolean {
    const [fromX, fromY] = from;
    const [toX, toY] = to;

    if (toX < 0 || toX >= 8 || toY < 0 || toY >= 8) {
      return false;
    }

    const piece = this.state.board[fromX][fromY];
    if (!piece) {
      return false;
    }

    const distance = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
    const mobility = Units[piece.type].mobility;

    return distance <= mobility;
  }

  private endTurn(): void {
    this.state.lastPlayerMoves = [...this.state.thisTurnMoves];
    this.state.thisTurnMoves = [];
    this.state.currentPlayer = this.state.currentPlayer === "RED" ? "BLUE" : "RED";
    
    this.checkGameOver();
  }

  private checkGameOver(): void {
    const redHQ = this.findHQ("RED");
    const blueHQ = this.findHQ("BLUE");

    if (!redHQ) {
      this.state.gameOver = true;
      this.state.winner = "BLUE";
    } else if (!blueHQ) {
      this.state.gameOver = true;
      this.state.winner = "RED";
    }
  }

  private findHQ(player: Player): Coordinate | null {
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const piece = this.state.board[x][y];
        if (piece && piece.type === "HQ" && piece.player === player) {
          return [x, y];
        }
      }
    }
    return null;
  }

  public getAllowedMoves(): AllowedMove[] {
    if (this.state.gameOver) {
      return [];
    }

    const moves: AllowedMove[] = [];
    const reserve = this.state.currentPlayer === "RED" ? this.state.redReserve : this.state.blueReserve;

    // Add reinforcement moves
    for (const [unitType, count] of Object.entries(reserve)) {
      if (count > 0) {
        for (let x = 0; x < 8; x++) {
          for (let y = 0; y < 8; y++) {
            if (this.state.board[x][y] === null) {
              moves.push({
                name: "Reinforce",
                args: [unitType as keyof ReserveFleet, [x, y]],
              });
            }
          }
        }
      }
    }

    // Add piece moves
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const piece = this.state.board[x][y];
        if (piece && piece.player === this.state.currentPlayer) {
          const mobility = Units[piece.type].mobility;
          
          for (let dx = -mobility; dx <= mobility; dx++) {
            for (let dy = -mobility; dy <= mobility; dy++) {
              if (dx === 0 && dy === 0) continue;
              
              const newX = x + dx;
              const newY = y + dy;
              
              if (this.isValidMove([x, y], [newX, newY])) {
                moves.push({
                  name: "Move",
                  args: [[x, y], [newX, newY]],
                });
              }
            }
          }
        }
      }
    }

    // Always allow skip
    moves.push({ name: "Skip", args: [] });

    return moves;
  }
}
