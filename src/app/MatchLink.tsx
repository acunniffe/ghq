"use client";

import { DateTime } from "luxon";
import classNames from "classnames";
import Link from "next/link";
import { MatchModel } from "@/lib/types";
import RatedBadge from "@/components/RatedBadge";

export function MatchLink({ game }: { game: MatchModel }) {
  return (
    <Link
      href={`/${game.rated === false ? "game" : "live"}/${game.id}`}
      className="p-1 px-2 bg-white/50 border border-white/50 hover:border-blue-700 flex justify-between hover:bg-blue-100 rounded flex-col sm:flex-row"
    >
      <div className="flex gap-1 items-center flex-wrap">
        <RatedBadge rated={game.rated ?? false} />
        <div
          className={classNames(
            game.player1 === game.winner && "text-blue-800"
          )}
        >
          {game.player1}
        </div>{" "}
        <span className="text-xs">({game.player1Elo})</span>
        <span className="text-gray-500"> vs.</span>
        <div
          className={classNames(
            game.player2 === game.winner && "text-blue-800"
          )}
        >
          {game.player2}
        </div>{" "}
        <span className="text-xs">({game.player2Elo})</span>
      </div>

      <div className="flex gap-1 items-center text-xs justify-end">
        {game.isYourTurn !== undefined ? (
          <>
            {game.isYourTurn ? (
              <div className="flex gap-2 items-center text-blue-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                Your turn
              </div>
            ) : (
              <div className="flex gap-2 items-center text-gray-600">
                <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                Opponent&apos;s turn
              </div>
            )}
          </>
        ) : (
          DateTime.fromISO(game.createdAt).toRelative()
        )}
      </div>
    </Link>
  );
}
