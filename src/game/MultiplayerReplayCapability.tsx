import { CreateGameReducer } from "boardgame.io/internal";
import { useEffect, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

export default function MultiplayerReplayCapability({
  offlineClient,
  onlineClient,
  setUseOnlineGameClient,
  disableReplays = true,
}: {
  offlineClient: any;
  onlineClient: any;
  setUseOnlineGameClient: any;
  disableReplays?: boolean;
}) {
  const [latestLogLength, setLatestLogLength] = useState<number>(0);
  const [currentLogIndex, setCurrentLogIndex] = useState<
    number | "latest" | "init"
  >("latest");
  const [initialState, setInitialState] = useState<any | null>(null);

  // If new game state comes in, fast forward to latest.
  useEffect(() => {
    const unsub = onlineClient.subscribe((state: any) => {
      if (!state?.log) {
        return;
      }

      if (state.log.length > latestLogLength) {
        setLatestLogLength(state.log.length);
        setCurrentLogIndex("latest");
      }
    });

    return () => {
      unsub();
    };
  }, [onlineClient, latestLogLength]);

  useEffect(() => {
    if (currentLogIndex === "latest") {
      setUseOnlineGameClient(true);
      offlineClient.overrideGameState(null);
    }
  }, [offlineClient, currentLogIndex]);

  function nonAutomaticLogs(log: any) {
    return log.filter((logEntry: any) => !logEntry.automatic);
  }

  const rewind = (logIndex: number) => {
    if (!onlineClient.log || !offlineClient) {
      return;
    }

    const initialState = offlineClient.getInitialState();

    // Copy over some of the online state that the offline version doesn't have.
    const onlineInitialState = onlineClient.initialState;
    initialState.G = {
      ...initialState.G,
      userIds: onlineInitialState?.G?.userIds,
      elos: onlineInitialState?.G?.elos,
      matchId: onlineInitialState?.G?.matchId,
      isOnline: true,
      isReplayMode: true,
    };
    setInitialState(initialState);

    offlineClient.log = onlineClient.log;
    const log = nonAutomaticLogs(offlineClient.log);
    const reducer = CreateGameReducer({ game: offlineClient.game });

    let state = initialState;
    for (let i = 0; i < log.length; i++) {
      const { action, automatic } = log[i];

      if (!automatic) {
        state = reducer(state, action);

        if (logIndex == 0) {
          break;
        }

        logIndex--;
      }
    }
    return { G: state.G, ctx: state.ctx, plugins: state.plugins };
  };

  useHotkeys(
    "down",
    (e) => {
      e.preventDefault();

      if (disableReplays) {
        return;
      }

      if (!onlineClient.log) {
        return;
      }

      const log = nonAutomaticLogs(onlineClient.log);
      if (currentLogIndex === "init") {
        return;
      }

      const logIndex =
        currentLogIndex === "latest" ? log.length - 1 : currentLogIndex;

      if (logIndex - 1 >= 0) {
        const state = rewind(logIndex - 1);
        setCurrentLogIndex(logIndex - 1);
        offlineClient.overrideGameState(state);
      } else if (logIndex === 0) {
        setCurrentLogIndex("init");
        offlineClient.overrideGameState(initialState);
      }

      setUseOnlineGameClient(false);
    },
    [currentLogIndex, disableReplays]
  );
  useHotkeys(
    "up",
    (e) => {
      e.preventDefault();

      if (disableReplays) {
        return;
      }

      if (!onlineClient.log) {
        return;
      }

      if (currentLogIndex === "latest") {
        return;
      }

      if (currentLogIndex === "init") {
        const state = rewind(0);
        setCurrentLogIndex(0);
        offlineClient.overrideGameState(state);
        return;
      }

      const log = nonAutomaticLogs(onlineClient.log);

      if (currentLogIndex + 1 < log.length) {
        const state = rewind(currentLogIndex + 1);
        setCurrentLogIndex(currentLogIndex + 1);
        offlineClient.overrideGameState(state);
      } else if (currentLogIndex + 1 >= log.length) {
        setCurrentLogIndex("latest");
      }

      setUseOnlineGameClient(false);
    },
    [currentLogIndex, disableReplays]
  );

  return null;
}
