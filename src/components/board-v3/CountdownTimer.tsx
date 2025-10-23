import React, { useEffect, useState } from "react";
import { Player } from "@/game/engine";
import classNames from "classnames";
import { GameClient } from "@/game/engine-v2";

const CountdownTimer = ({
  active,
  player,
  game,
}: {
  active: boolean;
  player: Player;
  game: GameClient;
}) => {
  const { timeControl } = game;
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  useEffect(() => {
    const timeLeft = game.getPlayerTimeLeftMs(player);
    setRemainingTime(timeLeft);
  }, []);

  useEffect(() => {
    const timeLeft = game.getPlayerTimeLeftMs(player, active);
    if (timeLeft === null) return;

    // Update the remaining time when elapsed changes, even if it's not our turn.
    setRemainingTime(timeLeft);

    // If the turn is not active, exit the effect without starting the countdown.
    if (!active) return;

    // Set up the countdown interval only when `active` is true.
    const intervalId = setInterval(() => {
      const timeLeft = game.getPlayerTimeLeftMs(player, true);
      if (timeLeft === null) return;
      setRemainingTime(timeLeft);

      if (timeLeft === 0) {
        clearInterval(intervalId);
      }
    }, 1000);

    // Clean up interval when `active` becomes false or when the component unmounts.
    return () => clearInterval(intervalId);
  }, [timeControl, active, game.turn]);

  const formatTime = (timeInMs: number | null) => {
    if (!timeControl) return "∞";
    if (timeInMs === null) return "";
    if (timeInMs <= 0) return "00:00";

    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  return (
    <div className="text-center flex justify-center items-center">
      <div
        className={classNames(
          active ? "bg-gray-900" : "bg-gray-500",
          "rounded-xl px-4 text-2xl font-mono",
          player === "BLUE" ? "text-blue-300" : "text-red-300"
        )}
      >
        <p>{formatTime(remainingTime)}</p>
      </div>
    </div>
  );
};

export default CountdownTimer;
