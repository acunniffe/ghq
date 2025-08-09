"use client";

import { Client } from "boardgame.io/react";
import { shouldUseBoardV2 } from "@/components/board/board-switcher";
import { GHQBoardV2 } from "@/components/board/boardv2";
import { GHQBoard } from "@/game/board";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { newTutorialGHQGame } from "@/game/tutorial";
import { useLatestMoveContext } from "@/components/LatestMoveContext";
import { frames } from "@/app/tutorial/frames";
import classNames from "classnames";
import { useBoardArrow } from "@/game/BoardArrowProvider";
import { coordinateToAlgebraic, degreesToCardinal } from "@/game/notation";
import { MoveLog } from "@/app/tutorial/types";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function TutorialBoard(props: { 
  slug: string; 
  nextLink: string; 
  prev?: string; 
  next?: string; 
}) {
  const [client, setClient] = useState<any | null>(null);
  const router = useRouter();

  // load it here so we can access the function props
  const tutorialFrame = frames.find((i) => i.slug === props.slug)!;

  const { moves, board } = useLatestMoveContext();
  const { setBoardArrows } = useBoardArrow();

  const [key, setKey] = useState(Date.now());

  const next = useCallback(() => {
    setTimeout(() => {
      router.push(props.nextLink);
    }, 800);
  }, [props.nextLink]);

  const reset = useCallback(() => {
    setTimeout(() => {
      setKey(Date.now());
    }, 1400);
  }, [key, setKey]);

  const [message, setMessage] = useState<string | null>(null);
  const [encourageAdvance, setEncourageAdvance] = useState(false);

  const App = useMemo(
    () =>
      Client({
        debug: false,
        game: newTutorialGHQGame({
          boardState: {
            board: tutorialFrame.board,
            redReserve: tutorialFrame.redReserve,
            blueReserve: tutorialFrame.blueReserve,
          },
          isTutorial: true,
        }),
        board: shouldUseBoardV2() ? GHQBoardV2 : GHQBoard,
      }),
    [key]
  );

  useEffect(() => {
    if (tutorialFrame.didMove) {
      const playerMessages: MoveLog[] = moves
        .filter((entry) => entry.action.type === "MAKE_MOVE")
        .map((entry) => {
          const { playerID, type, args } = entry.action.payload;
          const player = playerID === "0" ? "RED" : "BLUE";
          let description = type;
          let reactNode: ReactNode | null = null;
          const pieceType =
            entry?.metadata?.pieceType?.toLowerCase() ?? "piece";

          if (type === "Move") {
            const [from, to] = args;
            const fromNotation = coordinateToAlgebraic(from);
            const toNotation = coordinateToAlgebraic(to);
            description = `moved ${pieceType} from ${fromNotation} to ${toNotation}`;

            const capture = entry?.metadata?.capturePreference;
            if (capture) {
              const captureType =
                entry?.metadata?.capturedPiece?.type ?? "piece";
              const captureNotation = coordinateToAlgebraic(capture);
              description += ` and captured ${captureType.toLowerCase()} on ${captureNotation}`;
            }

            return {
              type,
              player,
              unitType: entry?.metadata?.pieceType,
              from,
              to,
              capturedPiece: entry?.metadata?.capturedPiece,
              capturedCoordinate: entry?.metadata?.capturePreference,
              description,
            };
          } else if (type === "Reinforce") {
            const [kind, at] = args;
            const atNotation = coordinateToAlgebraic(at);
            description = `reinforced with ${kind.toLowerCase()} at ${atNotation}`;
            return {
              player,
              type,
              unitType: kind,
              at,
              description,
            };
          } else if (type === "MoveAndOrient") {
            const [from, to, orientation] = args;
            const fromNotation = coordinateToAlgebraic(from);
            const toNotation = coordinateToAlgebraic(to);
            description = `moved ${pieceType} from ${fromNotation} to ${toNotation} and rotated ${degreesToCardinal(
              orientation
            )}`;
            return {
              type,
              player,
              unitType: entry?.metadata?.pieceType,
              from,
              to,
              orientation,
              description,
            };
          } else if (type === "ChangeOrientation") {
            const [at, orientation] = args;
            const atNotation = coordinateToAlgebraic(at);
            description = `rotated ${pieceType} at ${atNotation} ${degreesToCardinal(
              orientation
            )}`;
          }
        })
        .filter((i) => typeof i !== "undefined");

      tutorialFrame.didMove(board, playerMessages, next, reset, setMessage, setEncourageAdvance);
    }
  }, [moves, board, tutorialFrame]);

  // Initialize encourageAdvance based on whether the frame requires user action
  useEffect(() => {
    // For frames that don't have didMove, encourage advance immediately
    if (!tutorialFrame.didMove) {
      setEncourageAdvance(true);
    }
    // For frames with didMove, start with false (user needs to complete action)
    else {
      setEncourageAdvance(false);
    }
  }, [tutorialFrame.slug]);

  // No longer need to manipulate body classes

  const prevLink = props.prev ? `/tutorial/${props.prev}` : null;
  const nextLink = props.next ? `/tutorial/${props.next}` : null;

  return (
    <>
      {/* Navigation */}
      <div className="flex justify-center gap-4 relative z-10 mb-[-10px]">
        {prevLink && (
          <Link 
            className={`bg-blue-400 hover:bg-blue-500 text-gray-50 font-semibold py-2.5 rounded-2xl transition-colors duration-200 ${
              !nextLink ? 'max-[500px]:px-2 px-10' : 'px-10'
            }`}
            href={prevLink}
          >
            ◄ Back
          </Link>
        )}
        {nextLink ? (
          <Link 
            className={`text-gray-50 font-semibold py-2.5 px-10 rounded-2xl transition-colors duration-200 ${
              encourageAdvance 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-blue-400 hover:bg-blue-500'
            }`}
            href={nextLink}
          >
            Next ►
          </Link>
        ) : (
          <Link 
            className="bg-green-500 hover:bg-green-600 text-gray-50 font-semibold py-2.5 px-10 rounded-2xl transition-colors duration-200 max-[500px]:px-2"
            href={`/bot`}
          >
            Play your first game against a bot!
          </Link>
        )}
      </div>
      
      {/* Header */}
      <div className="p-5 bg-gray-200">
        <h1 className="text-2xl mb-4 font-bold">{tutorialFrame.heading}</h1>
        <h3 className="text-xl px-2">{tutorialFrame.details}</h3>
      </div>

      {/* Message */}
      <div className="h-12 flex items-center justify-center">
        {message && (
          <h3 className={`text-md text-center ${
            encourageAdvance ? 'text-green-700' : 'text-yellow-600'
          }`}>
            {message}
          </h3>
        )}
      </div>

      {/* Game Board */}
      <div
        className={classNames("flex bg-gray-50 justify-center", {
          ["pointer-events-none"]: tutorialFrame.disablePlay,
        })}
      >
        <App key={key} playerID="0" />
      </div>
    </>
  );
}
