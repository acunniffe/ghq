"use client";

import React from "react";
import { Player } from "@/game/engine";

interface MoveProgressBarProps {
  numMoves: number;
  currentPlayerTurn: Player;
  maxMoves?: number;
}

export default function MoveProgressBar({ 
  numMoves, 
  currentPlayerTurn, 
  maxMoves = 3 
}: MoveProgressBarProps) {
  // Calculate remaining moves (starts full, decreases as moves are made)
  const remainingMoves = maxMoves - numMoves;
  const progress = Math.max((remainingMoves / maxMoves) * 100, 0);
  
  // Color based on current player turn
  const barColor = currentPlayerTurn === "RED" ? "bg-red-500" : "bg-blue-500";

  return (
    <div className="w-full h-1 bg-white overflow-hidden">
      <div
        className={`h-full ${barColor} transition-all duration-300 ease-in-out ml-auto`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
