import { GameState, AllowedMove, Player, Coordinate } from '../../types';
import { GameEngine } from '../engine/gameEngine';

export class SimpleAI {
  private difficulty: 'easy' | 'medium' | 'hard';

  constructor(difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    this.difficulty = difficulty;
  }

  public getBestMove(gameState: GameState): AllowedMove | null {
    const engine = new GameEngine();
    const allowedMoves = engine.getAllowedMoves();

    if (allowedMoves.length === 0) {
      return null;
    }

    switch (this.difficulty) {
      case 'easy':
        return this.getRandomMove(allowedMoves);
      case 'medium':
        return this.getGreedyMove(gameState, allowedMoves);
      case 'hard':
        return this.getMiniMaxMove(gameState, allowedMoves);
      default:
        return this.getRandomMove(allowedMoves);
    }
  }

  private getRandomMove(moves: AllowedMove[]): AllowedMove {
    const nonSkipMoves = moves.filter(move => move.name !== 'Skip');
    const movesToConsider = nonSkipMoves.length > 0 ? nonSkipMoves : moves;
    return movesToConsider[Math.floor(Math.random() * movesToConsider.length)];
  }

  private getGreedyMove(gameState: GameState, moves: AllowedMove[]): AllowedMove {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const score = this.evaluateMove(gameState, move);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private getMiniMaxMove(gameState: GameState, moves: AllowedMove[]): AllowedMove {
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      const engine = new GameEngine();
      // Simulate the move and evaluate
      const score = this.minimax(gameState, 2, false, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(
    gameState: GameState,
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number
  ): number {
    if (depth === 0 || gameState.gameOver) {
      return this.evaluatePosition(gameState);
    }

    const engine = new GameEngine();
    const moves = engine.getAllowedMoves();

    if (isMaximizing) {
      let maxEvaluation = -Infinity;
      for (const move of moves) {
        const evaluation = this.minimax(gameState, depth - 1, false, alpha, beta);
        maxEvaluation = Math.max(maxEvaluation, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) {
          break;
        }
      }
      return maxEvaluation;
    } else {
      let minEvaluation = Infinity;
      for (const move of moves) {
        const evaluation = this.minimax(gameState, depth - 1, true, alpha, beta);
        minEvaluation = Math.min(minEvaluation, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) {
          break;
        }
      }
      return minEvaluation;
    }
  }

  private evaluateMove(gameState: GameState, move: AllowedMove): number {
    let score = 0;

    if (move.name === 'Move') {
      const [from, to] = move.args;
      const piece = gameState.board[from[0]][from[1]];
      
      if (piece) {
        // Prefer moving pieces forward
        const direction = piece.player === 'RED' ? -1 : 1;
        const progress = (to[0] - from[0]) * direction;
        score += progress * 10;

        // Prefer capturing enemy pieces
        const targetSquare = gameState.board[to[0]][to[1]];
        if (targetSquare && targetSquare.player !== piece.player) {
          score += 50;
          if (targetSquare.type === 'HQ') {
            score += 1000;
          }
        }
      }
    }

    if (move.name === 'Reinforce') {
      const [unitType, to] = move.args;
      // Prefer reinforcing closer to enemy
      const enemyDistance = this.getDistanceToNearestEnemy(gameState, to);
      score += (8 - enemyDistance) * 5;
    }

    return score;
  }

  private evaluatePosition(gameState: GameState): number {
    let score = 0;

    // Check for game over
    if (gameState.gameOver) {
      if (gameState.winner === gameState.currentPlayer) {
        return 1000;
      } else {
        return -1000;
      }
    }

    // Count pieces
    let redPieces = 0;
    let bluePieces = 0;
    let redHQPosition: Coordinate | null = null;
    let blueHQPosition: Coordinate | null = null;

    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        const piece = gameState.board[x][y];
        if (piece) {
          if (piece.player === 'RED') {
            redPieces++;
            if (piece.type === 'HQ') {
              redHQPosition = [x, y];
            }
          } else {
            bluePieces++;
            if (piece.type === 'HQ') {
              blueHQPosition = [x, y];
            }
          }
        }
      }
    }

    // Material advantage
    score += (redPieces - bluePieces) * 10;

    // HQ safety (prefer HQ away from enemy pieces)
    if (redHQPosition && blueHQPosition) {
      const hqDistance = Math.abs(redHQPosition[0] - blueHQPosition[0]) + 
                        Math.abs(redHQPosition[1] - blueHQPosition[1]);
      score += hqDistance * 5;
    }

    return gameState.currentPlayer === 'RED' ? score : -score;
  }

  private getDistanceToNearestEnemy(gameState: GameState, position: Coordinate): number {
    let minDistance = 8;
    const [x, y] = position;

    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = gameState.board[i][j];
        if (piece && piece.player !== gameState.currentPlayer) {
          const distance = Math.abs(x - i) + Math.abs(y - j);
          minDistance = Math.min(minDistance, distance);
        }
      }
    }

    return minDistance;
  }
}
