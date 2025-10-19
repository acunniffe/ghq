import { OnlineUser } from "@/lib/types";

const blitzQueue: Map<string, number> = new Map();
const rapidQueue: Map<string, number> = new Map();
const endgameQueue: Map<string, number> = new Map();
const normandyQueue: Map<string, number> = new Map();
export const inGameUsers: Map<string, number> = new Map();

export function getQueue(mode: string) {
  if (mode === "blitz") {
    return blitzQueue;
  } else if (mode === "endgame") {
    return endgameQueue;
  } else if (mode === "normandy") {
    return normandyQueue;
  } else {
    return rapidQueue;
  }
}

export function removeUserFromAllQueues(userId: string) {
  blitzQueue.delete(userId);
  rapidQueue.delete(userId);
  endgameQueue.delete(userId);
  normandyQueue.delete(userId);
}

export function listUserIdsInQueues(): string[] {
  const userIds = [];
  for (const userId of blitzQueue.keys()) {
    userIds.push(userId);
  }
  for (const userId of rapidQueue.keys()) {
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
  } else if (isActiveInQueue(userId, endgameQueue)) {
    return "in endgame queue";
  } else if (isActiveInQueue(userId, normandyQueue)) {
    return "in normandy queue";
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
