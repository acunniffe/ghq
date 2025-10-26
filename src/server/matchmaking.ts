import { OnlineUser } from "@/lib/types";

const blitzQueue: Map<string, number> = new Map();
const blitzUnratedQueue: Map<string, number> = new Map();
const rapidQueue: Map<string, number> = new Map();
const endgameQueue: Map<string, number> = new Map();
const normandyQueue: Map<string, number> = new Map();
const rapidUnratedQueue: Map<string, number> = new Map();
export const inGameUsers: Map<string, number> = new Map();

export function getQueue(mode: string, rated: boolean) {
  if (mode === "blitz") {
    if (rated) {
      return blitzQueue;
    } else {
      return blitzUnratedQueue;
    }
  } else if (mode === "endgame") {
    return endgameQueue;
  } else if (mode === "normandy") {
    return normandyQueue;
  } else if (mode === "rapid" && !rated) {
    return rapidUnratedQueue;
  } else {
    return rapidQueue;
  }
}

export function removeUserFromAllQueues(userId: string) {
  blitzQueue.delete(userId);
  blitzUnratedQueue.delete(userId);
  rapidQueue.delete(userId);
  endgameQueue.delete(userId);
  normandyQueue.delete(userId);
  rapidUnratedQueue.delete(userId);
}

export function listUserIdsInQueues(): string[] {
  const userIds = [];
  for (const userId of blitzQueue.keys()) {
    userIds.push(userId);
  }
  for (const userId of blitzUnratedQueue.keys()) {
    userIds.push(userId);
  }
  for (const userId of rapidQueue.keys()) {
    userIds.push(userId);
  }
  for (const userId of rapidUnratedQueue.keys()) {
    userIds.push(userId);
  }
  for (const userId of endgameQueue.keys()) {
    userIds.push(userId);
  }
  for (const userId of normandyQueue.keys()) {
    userIds.push(userId);
  }
  return userIds;
}

export function getUserQueueStatus(
  userId: string
): OnlineUser["status"] | null {
  if (isActiveInQueue(userId, blitzQueue)) {
    return "in blitz queue";
  } else if (isActiveInQueue(userId, rapidQueue)) {
    return "in rapid queue";
  } else if (isActiveInQueue(userId, blitzUnratedQueue)) {
    return "in blitz queue (unrated)";
  } else if (isActiveInQueue(userId, endgameQueue)) {
    return "in endgame queue (unrated)";
  } else if (isActiveInQueue(userId, normandyQueue)) {
    return "in normandy queue (unrated)";
  } else if (isActiveInQueue(userId, rapidUnratedQueue)) {
    return "in rapid queue (unrated)";
  }
  return null;
}

function isActiveInQueue(userId: string, queue: Map<string, number>): boolean {
  const lastActive = queue.get(userId);
  if (!lastActive) {
    return false;
  }

  return lastActive > Date.now() - 5_000;
}
