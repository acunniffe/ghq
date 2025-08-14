import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface GameControlsProps {
  onNewGame: () => void;
  onSkipTurn: () => void;
  onAIMove: () => void;
  gameOver: boolean;
  isAIThinking: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  onNewGame,
  onSkipTurn,
  onAIMove,
  gameOver,
  isAIThinking,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, styles.newGameButton]}
        onPress={onNewGame}
      >
        <Text style={styles.buttonText}>New Game</Text>
      </TouchableOpacity>

      {!gameOver && (
        <>
          <TouchableOpacity
            style={[styles.button, styles.skipButton]}
            onPress={onSkipTurn}
          >
            <Text style={styles.buttonText}>Skip Turn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.aiButton,
              isAIThinking && styles.disabledButton,
            ]}
            onPress={onAIMove}
            disabled={isAIThinking}
          >
            <Text style={styles.buttonText}>
              {isAIThinking ? 'AI Thinking...' : 'AI Move'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  newGameButton: {
    backgroundColor: '#4CAF50',
  },
  skipButton: {
    backgroundColor: '#FF9800',
  },
  aiButton: {
    backgroundColor: '#2196F3',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
