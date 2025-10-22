import { useEffect, useMemo, useRef, useState } from "react";
import { Player, Units } from "@/game/engine";
import { UserActionState } from "./state";

export default function PieceMouse({
  userActionState,
  pieceSize,
  currentPlayer,
}: {
  userActionState: UserActionState;
  pieceSize: number;
  currentPlayer: Player;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  const square = useMemo(() => {
    // If the user is selecting between capturing or rotating, then we don't want to show the piece.
    if (userActionState.chosenMoves) {
      return null;
    }

    // If the user has selected a piece or reserve, show it.
    if (userActionState.selectedPiece) {
      return userActionState.selectedPiece.piece;
    }

    if (userActionState.selectedReserve) {
      return {
        type: userActionState.selectedReserve,
        player: currentPlayer,
      };
    }

    return null;
  }, [userActionState]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setX(event.clientX);
      setY(event.clientY);
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 0) {
        setX(event.touches[0].clientX);
        setY(event.touches[0].clientY);
      }
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchstart", handleTouchMove);
    document.addEventListener("touchend", handleTouchMove);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchstart", handleTouchMove);
      document.removeEventListener("touchend", handleTouchMove);
    };
  }, []);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.left = `${x - pieceSize / 2}px`;
      ref.current.style.top = `${y - pieceSize / 2}px`;
    }
  }, [ref.current, x, y]);

  return (
    <div ref={ref} className="pointer-events-none fixed z-20">
      {userActionState.isMouseDown && square && (
        <img
          className="pointer-events-none"
          src={`/${
            Units[square.type].imagePathPrefix
          }-${square.player.toLowerCase()}.png`}
          width={pieceSize}
          height={pieceSize}
          draggable="false"
          alt={Units[square.type].imagePathPrefix}
        />
      )}
    </div>
  );
}
