import { PassThrough } from "stream";
import { Turn } from "@/game/engine-v2";
import { fetchMatchV3 } from "./matchv3-store";
import { pgnToTurns } from "@/game/pgn";

export interface Listener {
  id: string;
  stream: PassThrough;
  gameId: string;
  lastTurnIndex: number;
}

export const gameIdsToListenerIds: Record<string, Set<string>> = {};
export const listeners: Record<string, Listener> = {};

export function sendGameTurns(listenerId: string, turns: Turn[]) {
  const listener = listeners[listenerId];

  if (!listener) {
    console.error("listener is not initialized for client:", listenerId);
    return;
  }

  const newTurns = turns.slice(listener.lastTurnIndex);

  if (newTurns.length === 0) {
    return;
  }

  const data = {
    turns: newTurns,
  };

  const formattedData = `data: ${JSON.stringify(data)}\n\n`;
  listener.stream.write(formattedData);

  listener.lastTurnIndex = turns.length;
}

export async function sendInitialTurns(listenerId: string, gameId: string) {
  const game = await fetchMatchV3(gameId);
  if (!game) {
    return;
  }

  const turns = pgnToTurns(game.pgn);
  sendGameTurns(listenerId, turns);
}

export function addListener(listenerId: string, listener: Listener) {
  listeners[listenerId] = listener;

  if (!gameIdsToListenerIds[listener.gameId]) {
    gameIdsToListenerIds[listener.gameId] = new Set();
  }
  gameIdsToListenerIds[listener.gameId].add(listenerId);
}

export function removeListener(listenerId: string) {
  const listener = listeners[listenerId];
  if (listener) {
    gameIdsToListenerIds[listener.gameId]?.delete(listenerId);
    delete listeners[listenerId];
  }
}
