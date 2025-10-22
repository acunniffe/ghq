"use client";

import React, { useEffect } from "react";
import { useBoardArrow } from "@/game/BoardArrowProvider";
import { Board } from "@/game/engine";

export default function useRightClick({ board }: { board: Board }) {
  const { boardArrows, setBoardArrows } = useBoardArrow();
  const [rightClicked, setRightClicked] = React.useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setRightClicked(new Set());
    setBoardArrows([]);
  }, [board]);

  const handleRightClickDrag = (
    from: [number, number],
    to: [number, number]
  ): void => {
    if (from[0] === to[0] && from[1] === to[1]) {
      setRightClicked((prev) => {
        const newSet = new Set(prev);
        const key = `${from[0]},${from[1]}`;
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        return newSet;
      });
    } else {
      setBoardArrows((prev) => {
        const newArrows = [...prev];
        const alreadyExists = newArrows.some(
          (arrow) =>
            arrow.from[0] === from[0] &&
            arrow.from[1] === from[1] &&
            arrow.to[0] === to[0] &&
            arrow.to[1] === to[1]
        );
        if (!alreadyExists) {
          newArrows.push({
            from,
            to: to,
          });
        }
        return newArrows;
      });
    }
  };

  return {
    boardArrows,
    rightClicked,
    handleRightClickDrag,
    clearRightClick: () => {
      setRightClicked(new Set());
      setBoardArrows([]);
    },
  };
}
