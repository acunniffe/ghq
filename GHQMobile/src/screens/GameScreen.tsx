import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameBoard } from '../components/GameBoard';
import { GameInfo } from '../components/GameInfo';
import { GameControls } from '../components/GameControls';
import { GameEngine } from '../game/engine/gameEngine';
import { SimpleAI } from '../game/ai/simpleAI';
import { GameState, Coordinate, AllowedMove } from '../types';

export const GameScreen: React.FC = () => {
  const [gameEngine] = useState(() => new GameEngine());
  const [ai] = useState(() => new SimpleAI('medium'));
  const [gameState, setGameState] = useState<GameState>(() => gameEngine.getState());
  const [selectedSquare, setSelectedSquare] = useState<Coordinate | null>(null);
  const [highlightedSquares, setHighlightedSquares] = useState<Coordinate[]>([]);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const updateGameState = useCallback(() => {
    setGameState(gameEngine.getState());
  }, [gameEngine]);

  const handleSquarePress = useCallback((coordinate: Coordinate) => {
    if (gameState.gameOver || isAIThinking) return;

    const [x, y] = coordinate;
    const piece = gameState.board[x][y];

    if (selectedSquare) {
      // Try to make a move
      const move: AllowedMove = {
        name: 'Move',
        args: [selectedSquare, coordinate],
      };

      if (gameEngine.makeMove(move)) {
        updateGameState();
        setSelectedSquare(null);
        setHighlightedSquares([]);
      } else {
        // Invalid move, select new square if it has a piece
        if (piece && piece.player === gameState.currentPlayer) {
          setSelectedSquare(coordinate);
          setHighlightedSquares(getValidMoves(coordinate));
        } else {
          setSelectedSquare(null);
          setHighlightedSquares([]);
        }
      }
    } else {
      // Select a square
      if (piece && piece.player === gameState.currentPlayer) {
        setSelectedSquare(coordinate);
        setHighlightedSquares(getValidMoves(coordinate));
      }
    }
  }, [gameState, selectedSquare, gameEngine, updateGameState, isAIThinking]);

  const getValidMoves = useCallback((from: Coordinate): Coordinate[] => {
    const moves = gameEngine.getAllowedMoves();
    return moves
      .filter(move => 
        move.name === 'Move' && 
        move.args[0][0] === from[0] && 
        move.args[0][1] === from[1]
      )
      .map(move => move.args[1])
      .filter((coord): coord is Coordinate => coord !== undefined);
  }, [gameEngine]);

  const handleNewGame = useCallback(() => {
    gameEngine.resetGame();
    updateGameState();
    setSelectedSquare(null);
    setHighlightedSquares([]);
    setIsAIThinking(false);
  }, [gameEngine, updateGameState]);

  const handleSkipTurn = useCallback(() => {
    if (gameState.gameOver || isAIThinking) return;

    const skipMove: AllowedMove = { name: 'Skip', args: [] };
    if (gameEngine.makeMove(skipMove)) {
      updateGameState();
      setSelectedSquare(null);
      setHighlightedSquares([]);
    }
  }, [gameState.gameOver, isAIThinking, gameEngine, updateGameState]);

  const handleAIMove = useCallback(async () => {
    if (gameState.gameOver || isAIThinking) return;

    setIsAIThinking(true);
    
    // Add a small delay to show the "thinking" state
    setTimeout(() => {
      const bestMove = ai.getBestMove(gameState);
      if (bestMove && gameEngine.makeMove(bestMove)) {
        updateGameState();
        setSelectedSquare(null);
        setHighlightedSquares([]);
      }
      setIsAIThinking(false);
    }, 500);
  }, [gameState, isAIThinking, ai, gameEngine, updateGameState]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <GameInfo gameState={gameState} />
        
        <View style={styles.boardContainer}>
          <GameBoard
            board={gameState.board}
            onSquarePress={handleSquarePress}
            selectedSquare={selectedSquare}
            highlightedSquares={highlightedSquares}
          />
        </View>

        <GameControls
          onNewGame={handleNewGame}
          onSkipTurn={handleSkipTurn}
          onAIMove={handleAIMove}
          gameOver={gameState.gameOver}
          isAIThinking={isAIThinking}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  boardContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
