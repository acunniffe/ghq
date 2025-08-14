import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GameState, Player, ReserveFleet } from '../types';

interface GameInfoProps {
  gameState: GameState;
}

export const GameInfo: React.FC<GameInfoProps> = ({ gameState }) => {
  const renderReserve = (reserve: ReserveFleet, player: Player) => (
    <View style={styles.reserveContainer}>
      <Text style={[styles.playerTitle, { color: player === 'RED' ? '#d32f2f' : '#1976d2' }]}>
        {player} Reserve:
      </Text>
      <View style={styles.reserveGrid}>
        {Object.entries(reserve).map(([unitType, count]) => (
          <View key={unitType} style={styles.reserveItem}>
            <Text style={styles.unitType}>{unitType.replace('_', ' ')}</Text>
            <Text style={styles.unitCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.currentPlayerContainer}>
        <Text style={styles.currentPlayerText}>
          Current Player: 
          <Text style={{ color: gameState.currentPlayer === 'RED' ? '#d32f2f' : '#1976d2' }}>
            {' '}{gameState.currentPlayer}
          </Text>
        </Text>
        <Text style={styles.movesText}>
          Moves this turn: {gameState.thisTurnMoves.length}/4
        </Text>
      </View>

      {gameState.gameOver && (
        <View style={styles.gameOverContainer}>
          <Text style={styles.gameOverText}>
            Game Over! {gameState.winner ? `${gameState.winner} Wins!` : 'Draw!'}
          </Text>
        </View>
      )}

      <View style={styles.reservesContainer}>
        {renderReserve(gameState.redReserve, 'RED')}
        {renderReserve(gameState.blueReserve, 'BLUE')}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  currentPlayerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  currentPlayerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  movesText: {
    fontSize: 14,
    color: '#666',
  },
  gameOverContainer: {
    backgroundColor: '#ffeb3b',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  gameOverText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reservesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reserveContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  playerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  reserveGrid: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
  },
  reserveItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unitType: {
    fontSize: 12,
    flex: 1,
  },
  unitCount: {
    fontSize: 12,
    fontWeight: 'bold',
    minWidth: 20,
    textAlign: 'right',
  },
});
