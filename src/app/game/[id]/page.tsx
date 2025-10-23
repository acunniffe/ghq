"use client";

import { API_URL } from "@/app/live/config";
import { GHQBoardV3 } from "@/components/board-v3/boardv3";
import GameLoader from "@/components/board-v3/GameLoader";
import { TimeControl } from "@/game/constants";
import { ghqFetch } from "@/lib/api";
import { MatchV3Info } from "@/lib/types";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { use, useCallback, useEffect, useMemo, useState } from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isSignedIn, getToken } = useAuth();
  const [matchInfo, setMatchInfo] = useState<MatchV3Info | undefined>();

  const fetchMatchInfo = useCallback(async () => {
    if (!isSignedIn) {
      return;
    }

    try {
      const data = await ghqFetch<MatchV3Info>({
        url: `${API_URL}/v3/match/${id}`,
        getToken,
      });
      return data;
    } catch (error) {
      console.error("Error polling matchmaking API:", error);
    }
  }, [isSignedIn, getToken, id]);

  useEffect(() => {
    fetchMatchInfo().then((data) => setMatchInfo(data));
  }, [fetchMatchInfo]);

  const timeControl: TimeControl | undefined = useMemo(() => {
    if (!matchInfo) {
      return undefined;
    }
    return {
      time: matchInfo.match.timeControlAllowedTime,
      bonus: matchInfo.match.timeControlBonus,
      variant: matchInfo.match.timeControlVariant,
    };
  }, [matchInfo]);

  const playerId = useMemo(() => {
    if (!matchInfo?.playerInfo) {
      return "0";
    }
    return matchInfo?.playerInfo?.playerId;
  }, [matchInfo]);
  const credentials = useMemo(() => {
    if (!matchInfo?.playerInfo) {
      return "";
    }
    return matchInfo?.playerInfo?.credentials;
  }, [matchInfo]);
  const gameStartTimeMs = useMemo(() => {
    return matchInfo?.match.createdAt
      ? new Date(matchInfo.match.createdAt).getTime()
      : undefined;
  }, [matchInfo]);

  if (
    !playerId ||
    credentials === undefined ||
    !timeControl ||
    !gameStartTimeMs
  ) {
    return <GameLoader message="Fetching game data..." />;
  }

  return (
    <div>
      <GHQBoardV3
        playerId={playerId}
        id={id}
        credentials={credentials}
        timeControl={timeControl}
        gameStartTimeMs={gameStartTimeMs}
        match={matchInfo?.match}
      />
    </div>
  );
}
