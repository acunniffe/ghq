"use client";

import { Client } from "boardgame.io/react";
import { GHQGame, newOnlineGHQGame } from "@/game/engine";
import { GHQBoardV2 } from "@/components/board/boardv2";
import { SocketIO } from "boardgame.io/multiplayer";
import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../config";
import MultiplayerReplayCapability from "@/game/MultiplayerReplayCapability";
import { ghqFetch } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import AbandonedDialog from "./AbandonedDialog";
import { newGHQGameV2, useEngine } from "@/game/engine-v2";

const OfflineGameClient = Client({
  game: GHQGame,
  board: GHQBoardV2,
});

const AppWithV1Engine = Client({
  game: newOnlineGHQGame({}),
  board: GHQBoardV2,
  multiplayer: SocketIO({ server: API_URL }),
  debug: false,
});

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const [matchId, setMatchId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | undefined>();
  const [credentials, setCredentials] = useState<string>("");
  const [disableReplays, setDisableReplays] = useState<boolean>(false);
  const [abandoned, setAbandoned] = useState<boolean>(false);
  const { isSignedIn, getToken } = useAuth();
  const [AppWithV2Engine, setAppWithV2Engine] = useState<any | null>(null);
  const { engine } = useEngine();
  const [isRated, setIsRated] = useState<boolean>(true);

  useEffect(() => {
    if (!engine) {
      return;
    }

    const appWithV2Engine = Client({
      game: newGHQGameV2({ engine, type: "online" }),
      board: GHQBoardV2,
      multiplayer: SocketIO({ server: API_URL }),
    });
    setAppWithV2Engine(() => appWithV2Engine);
  }, [engine]);

  const getMatchInfo = useCallback(
    async (matchId: string) => {
      try {
        const data = await ghqFetch<any>({
          url: `${API_URL}/matches/${matchId}`,
          getToken,
        });
        if (data?.credentials && data?.playerId) {
          setCredentials(data.credentials);
          setPlayerId(data.playerId);
        } else if (data?.status) {
          setDisableReplays(false);
          setPlayerId("0"); // default to player 0 during replay mode
        }

        setIsRated(data?.rated !== false);

        if (data?.status === "ABORTED") {
          setAbandoned(true);
        }
      } catch (error) {
        console.error("Error polling matchmaking API:", error);
      }
    },
    [getToken]
  );

  useEffect(() => {
    params.then(({ id }) => setMatchId(id));
  }, [params]);

  useEffect(() => {
    if (isSignedIn && matchId) {
      getMatchInfo(matchId);
    }
  }, [isSignedIn, matchId, getMatchInfo]);

  const [onlineClient, setOnlineClient] = useState<any | null>(null);
  const [offlineClient, setOfflineClient] = useState<any | null>(null);
  const [useOnlineGameClient, setUseOnlineGameClient] =
    useState<boolean>(false);

  return (
    <div>
      {matchId && (
        <>
          {onlineClient && offlineClient && (
            <MultiplayerReplayCapability
              offlineClient={offlineClient}
              onlineClient={onlineClient}
              setUseOnlineGameClient={setUseOnlineGameClient}
              disableReplays={disableReplays}
            />
          )}
          <div className={useOnlineGameClient ? "" : "hidden"}>
            {isRated || !AppWithV2Engine ? (
              <>
                <AppWithV1Engine
                  ref={(ref: any) => setOnlineClient(ref?.client)}
                  matchID={matchId}
                  playerID={playerId}
                  credentials={credentials}
                />
              </>
            ) : (
              <>
                <AppWithV2Engine
                  ref={(ref: any) => setOnlineClient(ref?.client)}
                  matchID={matchId}
                  playerID={playerId}
                  credentials={credentials}
                />
              </>
            )}
          </div>
          <div className={useOnlineGameClient ? "hidden" : ""}>
            <OfflineGameClient
              ref={(ref) => setOfflineClient(ref?.client)}
              matchID={matchId}
              playerID={playerId}
            />
          </div>
          <BottomOfflineBanner
            useOnlineGameClient={useOnlineGameClient}
            setUseOnlineGameClient={setUseOnlineGameClient}
          />
          <AbandonedDialog abandoned={abandoned} />
        </>
      )}
    </div>
  );
}

function BottomOfflineBanner({
  useOnlineGameClient,
  setUseOnlineGameClient,
}: {
  useOnlineGameClient: boolean;
  setUseOnlineGameClient: (bool: boolean) => void;
}) {
  return (
    !useOnlineGameClient && (
      <button
        className="fixed bottom-0 left-0 w-full text-yellow-900 bg-yellow-200/80 hover:bg-yellow-300 p-1"
        onClick={() => setUseOnlineGameClient(true)}
      >
        You are currently reviewing this game in offline mode. Click here to
        switch back to the live game.
      </button>
    )
  );
}
