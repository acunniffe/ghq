import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Board, Square, Coordinate } from '../types';
import { SquareComponent } from './SquareComponent';

interface GameBoardProps {
  board: Board;
  onSquarePress: (coordinate: Coordinate) => void;
  selectedSquare?: Coordinate | null;
  highlightedSquares?: Coordinate[];
}

const { width } = Dimensions.get('window');
const BOARD_SIZE = width - 40;
const SQUARE_SIZE = BOARD_SIZE / 8;

export const GameBoard: React.FC<GameBoardProps> = ({
  board,
  onSquarePress,
  selectedSquare,
  highlightedSquares = [],
}) => {
  const isSquareSelected = (x: number, y: number): boolean => {
    return selectedSquare ? selectedSquare[0] === x && selectedSquare[1] === y : false;
  };

  const isSquareHighlighted = (x: number, y: number): boolean => {
    return highlightedSquares.some(([hx, hy]) => hx === x && hy === y);
  };

  return (
    <View style={styles.board}>
      {board.map((row, x) =>
        row.map((square, y) => (
          <SquareComponent
            key={`${x}-${y}`}
            square={square}
            coordinate={[x, y]}
            onPress={onSquarePress}
            isSelected={isSquareSelected(x, y)}
            isHighlighted={isSquareHighlighted(x, y)}
            size={SQUARE_SIZE}
          />
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#f0f0f0',
  },
});
