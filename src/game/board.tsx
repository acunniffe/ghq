"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Coordinate,
  GHQState,
  NonNullSquare,
  Orientation,
  Player,
  ReserveFleet,
  Units,
} from "@/game/engine";
import { BoardProps } from "boardgame.io/react";
import { useMachine } from "@xstate/react";
import { turnStateMachine } from "@/game/board-state";
import classNames from "classnames";
import { useHotkeys } from "react-hotkeys-hook";
import { bombardedSquares } from "@/game/move-logic";
import { SelectOrientation } from "@/game/select-orientation";
import CountdownTimer from "@/game/countdown";
import { Check, Flag, MoveRight, Percent, Undo } from "lucide-react";
import { colIndexToFile, rowIndexToRank } from "./notation";
import { PlayOnlineButton } from "@/app/live/PlayOnlineButton";
import { SoundPlayer } from "./SoundPlayer";
import { HistoryLog } from "./HistoryLog";
import { getCapturedPieces } from "./capture-logic";
import { getUsernames } from "@/lib/supabase";
import EvalBar from "./EvalBar";
import { coordsForThisTurnMoves } from "./board-moves";

import { useMeasure } from "@uidotdev/usehooks";
import { Button } from "@/app/live/Button";
import { useRouter } from "next/navigation";
import AbortGameButton from "./AbortGameButton";
import Header from "@/components/Header";
import BoardArrow, { BoardArrowType } from "./BoardArrow";
import { useBoardArrow } from "./BoardArrowProvider";
import { playCaptureSound, playMoveSound } from "./audio";
import {
  columns,
  MOVE_SPEED_MS,
  rows,
  pieceSizes,
  squareSizes,
} from "@/game/constants";
import ShareGameDialog from "./ExportGameDialog";

//coordinate string x,y
type Annotations = {
  [key: string]: {
    moveTo?: true;
    bombardedBy?: { RED?: true; BLUE?: true };
    selectedPiece?: true;
    showAim?: true;
    showTarget?: true;
    hidePiece?: true;
    showProxyPiece?: NonNullSquare;
  };
};

export function GHQBoard({
  ctx,
  G,
  moves,
  playerID,
  undo,
  redo,
  plugins,
  log,
}: BoardProps<GHQState>) {
  const router = useRouter();
  const [usernames, setUsernames] = React.useState<string[]>([]);
  const { boardArrows, setBoardArrows } = useBoardArrow();

  const [measureRef, { width, height }] = useMeasure();

  const [squareSize, pieceSize] = useMemo(() => {
    const smallestDim: number = Math.min(width || 0, height || 0);
    if (smallestDim && smallestDim - 90 - squareSizes.large * 8 > 0) {
      return [squareSizes.large, pieceSizes.large];
    } else {
      return [squareSizes.small, pieceSizes.small];
    }
  }, [width, height]);

  useEffect(() => {
    async function fetchUsernames() {
      if (!G.userIds[0] || !G.userIds[1]) return;
      const userIds = [G.userIds["0"], G.userIds["1"]];
      const usernames = await getUsernames(userIds);
      setUsernames(usernames);
    }

    if (!usernames.length) {
      fetchUsernames();
    }
  }, [G.userIds]);

  const isPrimaryPlayer = useCallback(
    (playerId: string) => {
      // If playerID is null, it means we're in spectator mode.
      // TODO(tyler): ensure they can't click moves on local (master will prevent it anyway)
      if (playerID === null) {
        playerID = "0";
      }

      if (G.isOnline) {
        return playerId === playerID;
      }

      return ctx.currentPlayer === playerId;
    },
    [G.isOnline, playerID, ctx.currentPlayer]
  );

  const [state, send] = useMachine(
    turnStateMachine.provide({
      actions: {
        movePiece: ({ context, event }) => {
          moves.Move(
            context.selectedPiece!.at,
            context.stagedMove!,
            context.captureEnemyAt
          );
        },
        changeOrientation: ({ context, event }) => {
          if ("orientation" in event)
            moves.ChangeOrientation(
              context.selectedPiece!.at,
              event.orientation
            );
        },
        spawnPiece: ({ context, event }) => {
          if (context.unitKind && "at" in event)
            moves.Reinforce(context.unitKind, event.at);
        },
        moveAndOrient: ({ context, event }) => {
          if ("orientation" in event) {
            moves.MoveAndOrient(
              context.selectedPiece!.at,
              context.stagedMove,
              event.orientation
            );
          }
        },
      },
    })
  );

  const renderBoard = ctx.gameover
    ? G.board
    : state.matches("notTurn")
    ? ctx.currentPlayer === "1"
      ? G.redTurnStartBoard
      : G.blueTurnStartBoard
    : state.matches("replay")
    ? ctx.currentPlayer === "0"
      ? G.redTurnStartBoard
      : G.blueTurnStartBoard
    : G.board;

  const renderMoves = ctx.gameover
    ? G.lastPlayerMoves
    : state.matches("replay")
    ? G.lastPlayerMoves
    : G.thisTurnMoves;

  // useEffect(() => {
  //   console.log(JSON.stringify(renderMoves));
  // }, [renderMoves]);

  useHotkeys("escape", () => send({ type: "DESELECT" }), [send]);
  useHotkeys(
    "left",
    (e) => {
      e.preventDefault();
      undo();
    },
    [undo]
  );
  useHotkeys(
    "right",
    (e) => {
      e.preventDefault();
      redo();
    },
    [redo]
  );

  useEffect(() => {
    if (G.isOnline && ctx.currentPlayer !== playerID) {
      send({ type: "NOT_TURN" });
    } else {
      // console.log("NEW TURN");
      send({
        type: "START_TURN",
        player: isPrimaryPlayer("0") ? "RED" : "BLUE",
        disabledPieces: coordsForThisTurnMoves(G.thisTurnMoves),
        renderMoves: G.lastPlayerMoves.length,
      });
    }
  }, [isPrimaryPlayer, ctx.turn]);

  const [rightClicked, setRightClicked] = React.useState<Set<string>>(
    new Set()
  );
  useEffect(() => {
    setRightClicked(new Set());
    setBoardArrows([]);
  }, [G.board]);

  const selectReserve = useCallback(
    (kind: keyof ReserveFleet) => {
      send({
        type: "SELECT_RESERVE_PIECE",
        currentBoard: G.board,
        reserve: isPrimaryPlayer("0") ? G.redReserve : G.blueReserve,
        kind,
      });
    },
    [G.board, G.redReserve, G.blueReserve, isPrimaryPlayer]
  );

  const annotations = useMemo(() => {
    const annotate: Annotations = {};

    (state.context.allowedMoves || []).forEach((i) => {
      annotate[`${i[0]},${i[1]}`] = annotate[`${i[0]},${i[1]}`]
        ? { ...annotate[`${i[0]},${i[1]}`], moveTo: true }
        : { moveTo: true };
    });

    const bombarded = bombardedSquares(renderBoard);
    Object.entries(bombarded).forEach(([key, value]) => {
      if (annotate[key]) {
        annotate[key].bombardedBy = value;
      } else {
        annotate[key] = { bombardedBy: value };
      }
    });

    const { selectedPiece } = state.context;
    if (selectedPiece) {
      annotate[`${selectedPiece.at[0]},${selectedPiece.at[1]}`] = {
        ...annotate[`${selectedPiece.at[0]},${selectedPiece.at[1]}`],
        selectedPiece: true,
      };
    }

    const aiming = state.matches("activePieceSelected.selectOrientation");
    if (aiming && state.context.stagedMove) {
      const [x, y] = state.context.stagedMove;
      annotate[`${x},${y}`] = { ...annotate[`${x},${y}`], showAim: true };

      const [oldX, oldY] = state.context.selectedPiece!.at;
      annotate[`${oldX},${oldY}`] = {
        ...annotate[`${oldX},${oldY}`],
        hidePiece: true,
      };
    }

    if (
      state.matches("selectEnemyToCapture") &&
      state.context.stagedMove &&
      (state.context.allowedCaptures || []).length > 1
    ) {
      const captures = state.context.allowedCaptures!;

      captures.forEach(([xx, yy]) => {
        annotate[`${xx},${yy}`] = {
          ...annotate[`${xx},${yy}`],
          showTarget: true,
        };
      });

      const [oldX, oldY] = state.context.selectedPiece!.at;

      annotate[`${oldX},${oldY}`] = {
        ...annotate[`${oldX},${oldY}`],
        hidePiece: true,
      };

      const [x, y] = state.context.stagedMove!;

      annotate[`${x},${y}`] = {
        ...annotate[`${x},${y}`],
        showProxyPiece: state.context.selectedPiece!.piece,
      };
    }

    return annotate;
  }, [state.context, renderBoard]);

  const lastTurnMoves = useMemo(() => {
    const movesSet = new Set<string>();
    for (const [key, value] of Object.entries(G.lastTurnMoves ?? {})) {
      for (const move of value) {
        movesSet.add(`${move[0]},${move[1]}`);
      }
    }
    return movesSet;
  }, [ctx.turn]);

  const lastTurnCaptures = useMemo(() => {
    const movesSet = new Set<string>();
    for (const [key, value] of Object.entries(G.lastTurnCaptures ?? {})) {
      for (const move of value) {
        movesSet.add(`${move[0]},${move[1]}`);
      }
    }
    return movesSet;
  }, [ctx.turn]);

  const [playedMoveSounds, setPlayedMoveSounds] = useState<boolean[]>([]);
  useEffect(() => {
    if (G.thisTurnMoves.length === 0) {
      setPlayedMoveSounds([]);
      return;
    }

    if (G.thisTurnMoves.length === playedMoveSounds.length) {
      return;
    }

    const lastMove = G.thisTurnMoves[G.thisTurnMoves.length - 1];

    // If we're offline, play the sound immediately, otherwise only play it if it's our turn.
    if (!G.isOnline || (G.isOnline && ctx.currentPlayer === playerID)) {
      setPlayedMoveSounds([...playedMoveSounds, true]);

      if (lastMove.name === "Move" && lastMove.args[2]) {
        playCaptureSound();
      } else {
        playMoveSound();
      }
    }
  }, [G.thisTurnMoves]);

  const pieces = useMemo(() => {
    return renderBoard.map((cols, x) => {
      return cols.map((existingSquare, y) => {
        const reinforced = state.matches("replay.animate")
          ? renderMoves.filter(
              (i) =>
                i.name === "Reinforce" &&
                i.args[1][0] === x &&
                i.args[1][1] === y
            )[0]
          : undefined;

        let square = existingSquare;
        if (reinforced?.name === "Reinforce") {
          const [unitType] = reinforced.args;
          square = {
            player: isPrimaryPlayer("0") ? "BLUE" : "RED", // Render the opponent's color
            type: unitType,
            orientation: isPrimaryPlayer("0") ? 180 : 0,
          };
        }

        // has piece on it or it *will* have a piece on it
        if (square) {
          const add180 =
            square &&
            ((isPrimaryPlayer("0") && square.player === "BLUE") ||
              (isPrimaryPlayer("1") && square.player === "RED"));

          const annotationsForSquare = annotations[`${x},${y}`];

          const moved = state.matches("replay.animate")
            ? renderMoves.filter(
                (i) =>
                  (i.name === "Move" || i.name === "MoveAndOrient") &&
                  i.args[0][0] === x &&
                  i.args[0][1] === y
              )[0]
            : undefined;

          // if (moved) console.log("MOVED " + JSON.stringify(moved));

          const moveOrReinforce = moved || reinforced;

          let moveOrder = moveOrReinforce
            ? renderMoves.indexOf(moveOrReinforce)
            : 0;

          const renderX = moved ? moved.args[1]![0] : x;
          const renderY = moved ? moved.args[1]![1] : y;

          const left = isPrimaryPlayer("1")
            ? squareSize * 8 - renderY * squareSize - squareSize
            : renderY * squareSize;
          const top = isPrimaryPlayer("1")
            ? squareSize * 8 - renderX * squareSize - squareSize
            : renderX * squareSize;

          const renderedOrientation =
            moved && moved.args[2]
              ? (moved.args[2] as Orientation)
              : square.orientation;

          // if (moved)
          //   console.log(
          //     "RENDERED ORIENTATION",
          //     renderedOrientation,
          //     square.orientation
          //   );

          const selectingOrientation = Boolean(
            square &&
              Units[square.type].artilleryRange &&
              annotationsForSquare?.selectedPiece
          );
          const hidePiece = Boolean(annotations[`${x},${y}`]?.hidePiece);

          if (moveOrReinforce) {
            const delayMs = moveOrder * MOVE_SPEED_MS;
            setTimeout(() => {
              const captured =
                moveOrReinforce.name === "Move" && moveOrReinforce.args[2];
              if (captured) {
                playCaptureSound();
              } else {
                playMoveSound();
              }
            }, delayMs);
          }

          return (
            <div
              key={`${x},${y}`}
              className={classNames(
                "pointer-events-none absolute w-20 h-5 flex items-center justify-center",
                { ["animate-move"]: state.matches("replay.animate") },
                {
                  ["animate-fade-in"]:
                    reinforced && state.matches("replay.animate"),
                }
              )}
              style={{
                left,
                top,
                width: squareSize,
                height: squareSize,
                transitionDelay: `${moveOrder * MOVE_SPEED_MS}ms`,
                animationDelay: `${moveOrder * MOVE_SPEED_MS}ms`,
              }}
            >
              {square && !selectingOrientation && !hidePiece ? (
                <div
                  className={classNames(
                    "flex items-center justify-center select-none font-bold text-3xl",
                    square.player === "RED" ? "text-red-600" : "text-blue-600",
                    {
                      // @todo this is really only for infantry. Adjust when we do orientation
                      // ["rotate-180"]:
                      //   (isPrimaryPlayer("0") && square.player === "BLUE") ||
                      //   (isPrimaryPlayer("1") && square.player === "RED"),
                    }
                  )}
                >
                  <img
                    src={`/${
                      Units[square.type].imagePathPrefix
                    }-${square.player.toLowerCase()}.png`}
                    width={pieceSize}
                    height={pieceSize}
                    className={classNames(
                      "select-none",
                      { ["animate-move"]: state.matches("replay.animate") },
                      {
                        ["animate-fade-in"]:
                          reinforced && state.matches("replay.animate"),
                      },
                      {
                        ["opacity-50"]:
                          (ctx.currentPlayer === "0" &&
                            square.player === "BLUE") ||
                          (ctx.currentPlayer === "1" &&
                            square.player === "RED"),
                      }
                    )}
                    draggable="false"
                    style={{
                      transitionDelay: `${moveOrder * MOVE_SPEED_MS}ms`,
                      animationDelay: `${moveOrder * MOVE_SPEED_MS}ms`,
                      transform: renderedOrientation
                        ? isPrimaryPlayer("1")
                          ? `rotate(${renderedOrientation - 180}deg)`
                          : `rotate(${renderedOrientation}deg)`
                        : `rotate(${add180 ? 180 : 0}deg)`,
                    }}
                    alt={Units[square.type].imagePathPrefix}
                  />
                </div>
              ) : null}
            </div>
          );
        }
      });
    });
  }, [ctx.turn, renderBoard, width, state.value, renderMoves]);

  const cells = Array.from({ length: rows }).map((_, rowIndex) => {
    const colN = Array.from({ length: columns }, (_, index) => index);
    const cols = isPrimaryPlayer("0") ? colN : colN.reverse();
    return (
      <tr key={rowIndex}>
        {cols.map((colIndex) => {
          const square = renderBoard[rowIndex][colIndex];

          const annotationsForSquare = annotations[`${rowIndex},${colIndex}`];

          const showTarget = annotationsForSquare?.showTarget;

          const add180 =
            square &&
            ((isPrimaryPlayer("0") && square.player === "BLUE") ||
              (isPrimaryPlayer("1") && square.player === "RED"));

          const bombardmentClass =
            annotationsForSquare && annotationsForSquare.bombardedBy
              ? annotationsForSquare.bombardedBy
                ? annotationsForSquare.bombardedBy.BLUE &&
                  annotationsForSquare.bombardedBy.RED
                  ? "stripe-red-blue"
                  : annotationsForSquare.bombardedBy.BLUE
                  ? "stripe-blue-transparent"
                  : annotationsForSquare.bombardedBy.RED
                  ? "stripe-red-transparent"
                  : ""
                : ""
              : "";

          const selectingOrientation = Boolean(
            square &&
              Units[square.type].artilleryRange &&
              annotationsForSquare?.selectedPiece
          );

          const aiming = Boolean(
            annotations[`${rowIndex},${colIndex}`]?.showAim
          );
          const hidePiece = Boolean(
            annotations[`${rowIndex},${colIndex}`]?.hidePiece
          );

          return (
            <td
              onClick={() => {
                if (state.matches("selectEnemyToCapture") || !square) {
                  send({
                    type: "SELECT_SQUARE",
                    at: [rowIndex, colIndex],
                    currentBoard: G.board,
                  });
                } else {
                  send({
                    type: "SELECT_ACTIVE_PIECE",
                    at: [rowIndex, colIndex],
                    piece: square,
                    currentBoard: G.board,
                  });
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();

                setRightClicked((prev) => {
                  const newSet = new Set(prev);
                  const key = `${rowIndex},${colIndex}`;
                  if (newSet.has(key)) {
                    newSet.delete(key);
                  } else {
                    newSet.add(key);
                  }
                  return newSet;
                });
              }}
              key={colIndex}
              className={classNames(
                "relative",
                bombardmentClass,
                {
                  ["cursor-pointer"]:
                    annotationsForSquare?.moveTo ||
                    square?.player === (isPrimaryPlayer("0") ? "RED" : "BLUE"),
                },
                { ["bg-red-900"]: showTarget },
                {
                  ["bg-green-600/40"]: rightClicked.has(
                    `${rowIndex},${colIndex}`
                  ),
                },
                (rowIndex + colIndex) % 2 === 0 ? "bg-gray-300" : "bg-gray-200"
              )}
              style={{
                boxShadow:
                  (annotationsForSquare?.selectedPiece && !hidePiece) || aiming
                    ? "inset 0 0 8px darkgray"
                    : "",
                textAlign: "center",
                width: squareSize,
                height: squareSize,
              }}
            >
              {lastTurnMoves.has(`${rowIndex},${colIndex}`) ? (
                <div
                  className="absolute w-full h-full bg-yellow-300 top-0"
                  style={{ pointerEvents: "none", opacity: 0.3 }}
                ></div>
              ) : null}
              {lastTurnCaptures.has(`${rowIndex},${colIndex}`) ? (
                <div
                  className="absolute w-full h-full bg-red-300 top-0"
                  style={{ pointerEvents: "none", opacity: 0.3 }}
                ></div>
              ) : null}
              <BoardCoordinateLabels
                isPrimaryPlayer={isPrimaryPlayer}
                colIndex={colIndex}
                rowIndex={rowIndex}
              />
              {/*{square && !selectingOrientation && !hidePiece ? (*/}
              {/*  <div*/}
              {/*    className={classNames(*/}
              {/*      "flex items-center justify-center select-none font-bold text-3xl",*/}
              {/*      square.player === "RED" ? "text-red-600" : "text-blue-600",*/}
              {/*      {*/}
              {/*        // @todo this is really only for infantry. Adjust when we do orientation*/}
              {/*        // ["rotate-180"]:*/}
              {/*        //   (isPrimaryPlayer("0") && square.player === "BLUE") ||*/}
              {/*        //   (isPrimaryPlayer("1") && square.player === "RED"),*/}
              {/*      }*/}
              {/*    )}*/}
              {/*  >*/}
              {/*    <img*/}
              {/*      src={`/${*/}
              {/*        Units[square.type].imagePathPrefix*/}
              {/*      }-${square.player.toLowerCase()}.png`}*/}
              {/*      width="52"*/}
              {/*      height="52"*/}
              {/*      className={classNames("select-none", {*/}
              {/*        ["opacity-50"]:*/}
              {/*          (ctx.currentPlayer === "0" &&*/}
              {/*            square.player === "BLUE") ||*/}
              {/*          (ctx.currentPlayer === "1" && square.player === "RED"),*/}
              {/*      })}*/}
              {/*      draggable="false"*/}
              {/*      style={{*/}
              {/*        transform: square.orientation*/}
              {/*          ? isPrimaryPlayer("1")*/}
              {/*            ? `rotate(${square.orientation - 180}deg)`*/}
              {/*            : `rotate(${square.orientation}deg)`*/}
              {/*          : `rotate(${add180 ? 180 : 0}deg)`,*/}
              {/*      }}*/}
              {/*      alt={Units[square.type].imagePathPrefix}*/}
              {/*    />*/}
              {/*  </div>*/}
              {/*) : null}*/}

              {annotationsForSquare?.showProxyPiece ? (
                <div
                  className={classNames(
                    "flex items-center justify-center select-none font-bold text-3xl",
                    annotationsForSquare?.showProxyPiece.player === "RED"
                      ? "text-red-600"
                      : "text-blue-600",
                    {
                      // @todo this is really only for infantry. Adjust when we do orientation
                      // ["rotate-180"]:
                      //   (isPrimaryPlayer("0") && square.player === "BLUE") ||
                      //   (isPrimaryPlayer("1") && square.player === "RED"),
                    }
                  )}
                >
                  <img
                    src={`/${
                      Units[annotationsForSquare?.showProxyPiece.type]
                        .imagePathPrefix
                    }-${annotationsForSquare?.showProxyPiece.player.toLowerCase()}.png`}
                    width={pieceSize * 0.7}
                    height={pieceSize * 0.7}
                    className="select-none"
                    draggable="false"
                    style={{
                      transform: annotationsForSquare?.showProxyPiece
                        .orientation
                        ? isPrimaryPlayer("1")
                          ? `rotate(${
                              180 -
                              annotationsForSquare?.showProxyPiece.orientation
                            }deg)`
                          : `rotate(${annotationsForSquare?.showProxyPiece.orientation}deg)`
                        : `rotate(${add180 ? 180 : 0}deg)`,
                    }}
                    alt={
                      Units[annotationsForSquare?.showProxyPiece.type]
                        .imagePathPrefix
                    }
                  />
                </div>
              ) : null}

              {square && selectingOrientation && !hidePiece ? (
                <SelectOrientation
                  squareSize={squareSize}
                  initialOrientation={square.orientation!}
                  player={square.player}
                  onChange={(orientation: Orientation) => {
                    send({
                      type: "CHANGE_ORIENTATION",
                      orientation: orientation,
                    });
                  }}
                >
                  <img
                    src={`/${
                      Units[square.type].imagePathPrefix
                    }-${square.player.toLowerCase()}.png`}
                    width={pieceSize * 0.7}
                    height={pieceSize * 0.7}
                    className="select-none"
                    draggable="false"
                    style={{
                      transform: square.orientation
                        ? isPrimaryPlayer("1")
                          ? `rotate(${180 - square.orientation}deg)`
                          : `rotate(${square.orientation}deg)`
                        : `rotate(${add180 ? 180 : 0}deg)`,
                    }}
                    alt={Units[square.type].imagePathPrefix}
                  />
                </SelectOrientation>
              ) : null}
              {annotationsForSquare?.moveTo &&
              !aiming &&
              !state.matches("selectEnemyToCapture") ? (
                <div
                  className="rounded-full m-auto bg-green-600/40"
                  style={{ width: pieceSize / 2, height: pieceSize / 2 }}
                />
              ) : null}
              {showTarget ? <div className="target-square "></div> : null}
              {aiming && state.context.selectedPiece ? (
                <SelectOrientation
                  squareSize={squareSize}
                  initialOrientation={
                    state.context.selectedPiece!.piece!.orientation!
                  }
                  player={state.context.player}
                  onChange={(orientation: Orientation) => {
                    send({
                      type: "CHANGE_ORIENTATION",
                      orientation: orientation,
                    });
                  }}
                >
                  <img
                    src={`/${
                      Units[state.context.selectedPiece.piece.type]
                        .imagePathPrefix
                    }-${state.context.player.toLowerCase()}.png`}
                    width={pieceSize * 0.7}
                    height={pieceSize * 0.7}
                    className="select-none"
                    draggable="false"
                    style={{
                      transform: state.context.selectedPiece.piece.orientation
                        ? isPrimaryPlayer("1")
                          ? `rotate(${
                              180 -
                              state.context.selectedPiece.piece.orientation
                            }deg)`
                          : `rotate(${state.context.selectedPiece.piece.orientation}deg)`
                        : `rotate(${add180 ? 180 : 0}deg)`,
                    }}
                    alt={
                      Units[state.context.selectedPiece.piece.type]
                        .imagePathPrefix
                    }
                  />
                </SelectOrientation>
              ) : null}
            </td>
          );
        })}
      </tr>
    );
  });

  const blueBank = (
    <>
      <div className="items-center justify-center flex py-2 px-1">
        <ReserveBank
          player="BLUE"
          reserve={G.blueReserve}
          selectedKind={
            isPrimaryPlayer("1") ? state.context.unitKind : undefined
          }
          selectable={
            isPrimaryPlayer("1") && !state.matches("activePieceSelected")
          }
          selectReserve={selectReserve}
        />
        <div className="ml-4 lg:ml-20 my-2 flex flex-col gap-1">
          <div>
            {usernames[1]} ({G.elos[1]})
          </div>
          <CountdownTimer
            active={ctx.currentPlayer === "1" && !ctx.gameover}
            player="BLUE"
            elapsed={G.blueElapsed}
            startDate={G.turnStartTime}
            totalTimeAllowed={G.timeControl}
          />
        </div>
      </div>
    </>
  );

  const redBank = (
    <div className="flex py-2 px-1">
      <ReserveBank
        player="RED"
        reserve={G.redReserve}
        selectedKind={isPrimaryPlayer("0") ? state.context.unitKind : undefined}
        selectable={
          isPrimaryPlayer("0") && !state.matches("activePieceSelected")
        }
        selectReserve={selectReserve}
      />
      <div className="ml-4 lg:ml-20 my-2 flex flex-col gap-1">
        <div>
          {usernames[0]} ({G.elos[0]})
        </div>
        <CountdownTimer
          active={ctx.currentPlayer === "0" && !ctx.gameover}
          player="RED"
          elapsed={G.redElapsed}
          startDate={G.turnStartTime}
          totalTimeAllowed={G.timeControl}
        />
      </div>
    </div>
  );

  const historyEval = useMemo(() => {
    return (
      <>
        <EvalBar evalValue={G.eval} />
        <HistoryLog systemMessages={plugins.history.data} log={log} />
      </>
    );
  }, [ctx.turn, ctx.gameover]);

  return (
    <div className="flex flex-col md:flex-row bg-gray-100 absolute w-full h-full overflow-x-hidden overflow-y-auto">
      <div
        className={classNames(
          "bg-white order-3 md:order-1",
          "w-full md:w-[450px]"
        )}
      >
        <Header />
        {historyEval}
        {ctx.gameover ? (
          <div className="flex flex-col items-center justify-center gap-1 justify-center items-center">
            <h2
              className={classNames(
                "text-center font-semibold text-2xl",
                ctx.gameover.status === "DRAW" && "text-gray-800",
                ctx.gameover.status === "WIN" && ctx.gameover.winner === "RED"
                  ? "text-red-500"
                  : "text-blue-500"
              )}
            >
              {ctx.gameover.status === "DRAW" ? (
                "Draw!"
              ) : (
                <>{ctx.gameover.winner === "RED" ? "Red " : "Blue"} Won!</>
              )}
            </h2>
            {ctx.gameover.reason && ctx.gameover.reason}
            <Button onClick={async () => router.push("/")}>🏠 Home</Button>
            <ShareGameDialog G={G} />
          </div>
        ) : (
          <div
            className={classNames(
              "text-center font-semibold flex items-center flex-col justify-center text-2xl flex-1",
              ctx.currentPlayer === "0" ? "text-red-500" : "text-blue-500"
            )}
          >
            {ctx.currentPlayer === "0" ? "Red's " : "Blue's"} Turn
            <div className="text-lg text-gray-600 font-mono flex gap-1 justify-center items-center">
              {3 - ctx.numMoves!} remaining move
              {ctx.numMoves !== 2 ? "s" : ""}{" "}
            </div>
            <div className="flex gap-1 justify-center items-center">
              {ctx.currentPlayer === playerID || !G.isOnline ? (
                <>
                  <SkipButton skip={() => moves.Skip()} />
                  {G.drawOfferedBy && G.drawOfferedBy !== ctx.currentPlayer ? (
                    <AcceptDrawButton draw={() => moves.AcceptDraw()} />
                  ) : (
                    <OfferDrawButton
                      draw={(offer: boolean) => moves.OfferDraw(offer)}
                    />
                  )}
                  <ResignButton resign={() => moves.Resign()} />
                  <ShareGameDialog G={G} />
                </>
              ) : (
                <>
                  <AbortGameButton matchId={G.matchId} />
                  <ShareGameDialog G={G} />
                </>
              )}
              {!G.isOnline && (
                <>
                  <button
                    className="bg-blue-500 text-white py-1 px-2 text-sm rounded hover:bg-blue-600 flex gap-1 items-center"
                    onClick={() => router.push("/")}
                  >
                    🏠 Home
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-center mt-2"></div>
      </div>

      <div
        className="order-1 md:order-2 flex-1 flex flex-col items-center justify-center"
        ref={measureRef}
      >
        <div className=" flex">{isPrimaryPlayer("1") ? redBank : blueBank}</div>
        <div
          className="border-r-2 border-gray-100 flex items-center justify-center relative"
          style={{
            width: squareSize * 8,
            height: squareSize * 8,
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              width: squareSize * 8,
              height: squareSize * 8,
            }}
            className="table-fixed relative"
          >
            {/*flip board*/}
            <tbody>{isPrimaryPlayer("0") ? cells : cells.reverse()}</tbody>
            {/*overlay pieces */}
          </table>
          {pieces}

          {boardArrows.map((boardArrow) => (
            <BoardArrow
              key={`${boardArrow.from[0]},${boardArrow.from[1]}-${boardArrow.to[0]},${boardArrow.to[1]}`}
              squareSize={squareSize}
              from={boardArrow.from}
              to={boardArrow.to}
              className="fill-blue-400 stroke-blue-400"
            />
          ))}
        </div>

        <div className=" flex">{isPrimaryPlayer("1") ? blueBank : redBank}</div>
      </div>
    </div>
  );
}

function ReserveBank(props: {
  player: Player;
  reserve: ReserveFleet;
  selectable: boolean;
  selectedKind?: keyof ReserveFleet;
  selectReserve: (kind: keyof ReserveFleet) => void;
}) {
  const kinds = [
    "INFANTRY",
    "ARMORED_INFANTRY",
    "AIRBORNE_INFANTRY",
    "ARTILLERY",
    "ARMORED_ARTILLERY",
    "HEAVY_ARTILLERY",
  ] as (keyof ReserveFleet)[];

  const reserves = kinds.flatMap((kind) => {
    const count = props.reserve[kind as keyof ReserveFleet];
    if (count === 0) return null;
    return (
      <div
        onClick={() => {
          props.selectReserve(kind);
        }}
        key={kind}
        className={classNames(
          "col-span-1 select-none flex font-bold text-xl p-1 flex-col items-center justify-end",
          props.player === "RED" ? "text-red-600" : "text-blue-600",
          { ["cursor-pointer"]: props.selectable },
          {
            ["hover:bg-gray-100 "]:
              props.selectable && props.selectedKind !== kind,
          },
          { ["bg-gray-200 "]: props.selectedKind === kind }
        )}
      >
        <img
          src={`/${
            Units[kind].imagePathPrefix
          }-${props.player.toLowerCase()}.png`}
          width="30"
          height="30"
          alt={Units[kind].imagePathPrefix}
        />
        <div>{count}</div>
      </div>
    );
  });

  if (reserves.every((r) => r === null)) {
    return (
      <div className="flex-1 flex items-center justify-center font-bold text-gray-500">
        None
      </div>
    );
  }

  return <div className="grid flex-1 grid-cols-6 gap-5">{reserves}</div>;
}

function BoardCoordinateLabels({
  isPrimaryPlayer,
  colIndex,
  rowIndex,
}: {
  isPrimaryPlayer: (playerId: string) => boolean;
  colIndex: number;
  rowIndex: number;
}) {
  const color =
    (rowIndex + colIndex) % 2 === 0 ? "text-gray-50" : "text-gray-400";
  return (
    <>
      <div
        className={classNames("absolute top-0 left-1 text-xs font-bold", color)}
      >
        {isPrimaryPlayer("0") && colIndex === 0 && rowIndexToRank(rowIndex)}
      </div>
      <div
        className={classNames(
          "absolute bottom-0 left-1 text-xs font-bold",
          color
        )}
      >
        {isPrimaryPlayer("0") && rowIndex === 7 && colIndexToFile(colIndex)}
      </div>
      <div
        className={classNames("absolute top-0 left-1 text-xs font-bold", color)}
      >
        {isPrimaryPlayer("1") && colIndex === 7 && rowIndexToRank(rowIndex)}
      </div>
      <div
        className={classNames(
          "absolute bottom-0 left-1 text-xs font-bold",
          color
        )}
      >
        {isPrimaryPlayer("1") && rowIndex === 0 && colIndexToFile(colIndex)}
      </div>
    </>
  );
}

function SkipButton({ skip }: { skip: () => void }) {
  return (
    <button
      onClick={skip}
      className="bg-black text-white py-1 px-2 text-sm rounded hover:bg-gray-800 flex gap-1 items-center"
    >
      <MoveRight className="w-4 h-4" />
      Skip
    </button>
  );
}

function ResignButton({ resign }: { resign: () => void }) {
  const [confirm, setConfirm] = React.useState(false);
  if (confirm) {
    return (
      <div className="flex gap-1">
        <button
          onClick={() => setConfirm(false)}
          className="bg-gray-500 text-white py-1.5 px-2 text-sm rounded hover:bg-gray-400 flex gap-1 items-center"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={resign}
          className="bg-red-500 text-white py-1.5 px-2 text-sm rounded hover:bg-red-600 flex gap-1 items-center"
        >
          <Flag className="w-4 h-4" />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirm(true)}
      className="bg-red-500 text-white py-1 px-2 text-sm rounded hover:bg-red-600 flex gap-1 items-center"
    >
      <Flag className="w-4 h-4" />
      Resign
    </button>
  );
}

function OfferDrawButton({ draw }: { draw: (offer: boolean) => void }) {
  const [offered, setOffered] = React.useState(false);
  return (
    <button
      onClick={() => {
        draw(!offered);
        setOffered(!offered);
      }}
      className={classNames(
        "bg-gray-500 text-white py-1 px-2 text-sm rounded hover:bg-gray-600 flex gap-1 items-center",
        offered ? "bg-gray-300 hover:bg-gray-400" : ""
      )}
    >
      {offered ? <Undo className="w-4 h-4" /> : <Percent className="w-4 h-4" />}
      {offered ? "Cancel" : "Draw"}
    </button>
  );
}

function AcceptDrawButton({ draw }: { draw: () => void }) {
  return (
    <button
      onClick={draw}
      className={classNames(
        "bg-gray-500 text-white py-1 px-2 text-sm rounded hover:bg-gray-600 flex gap-1 items-center"
      )}
    >
      <Check className="w-4 h-4" />
      Accept Draw
    </button>
  );
}
