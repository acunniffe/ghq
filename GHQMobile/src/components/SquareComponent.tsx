import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Square, Coordinate } from '../types';

interface SquareComponentProps {
  square: Square;
  coordinate: Coordinate;
  onPress: (coordinate: Coordinate) => void;
  isSelected: boolean;
  isHighlighted: boolean;
  size: number;
}

export const SquareComponent: React.FC<SquareComponentProps> = ({
  square,
  coordinate,
  onPress,
  isSelected,
  isHighlighted,
  size,
}) => {
  const [x, y] = coordinate;
  const isLightSquare = (x + y) % 2 === 0;

  const handlePress = () => {
    onPress(coordinate);
  };

  const getSquareColor = () => {
    if (isSelected) return '#4CAF50';
    if (isHighlighted) return '#FFC107';
    return isLightSquare ? '#f0d9b5' : '#b58863';
  };

  const getPieceSymbol = (square: Square): string => {
    if (!square) return '';
    
    const symbols: { [key: string]: string } = {
      HQ: square.player === 'RED' ? '♔' : '♚',
      INFANTRY: square.player === 'RED' ? '♙' : '♟',
      ARMORED_INFANTRY: square.player === 'RED' ? '♘' : '♞',
      AIRBORNE_INFANTRY: square.player === 'RED' ? '♗' : '♝',
      ARTILLERY: square.player === 'RED' ? '♖' : '♜',
      ARMORED_ARTILLERY: square.player === 'RED' ? '♕' : '♛',
      HEAVY_ARTILLERY: square.player === 'RED' ? '♖' : '♜',
    };
    
    return symbols[square.type] || '';
  };

  return (
    <TouchableOpacity
      style={[
        styles.square,
        {
          width: size,
          height: size,
          backgroundColor: getSquareColor(),
        },
      ]}
      onPress={handlePress}
    >
      <View style={styles.squareContent}>
        {square && (
          <Text style={[
            styles.piece,
            { color: square.player === 'RED' ? '#d32f2f' : '#1976d2' }
          ]}>
            {getPieceSymbol(square)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  square: {
    borderWidth: 0.5,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  piece: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
