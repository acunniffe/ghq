"use client";

import { API_URL } from "@/app/live/config";
import { GHQBoardV3 } from "@/components/board-v3/boardv3";
import GameLoader from "@/components/board-v3/GameLoader";
import { TimeControl } from "@/game/constants";
import { GHQAPIError, ghqFetch } from "@/lib/api";
import { MatchV3Info } from "@/lib/types";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isSignedIn, userId, getToken } = useAuth();
  const [matchInfo, setMatchInfo] = useState<MatchV3Info | undefined>();
  const router = useRouter();

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
      if (error instanceof GHQAPIError) {
        toast.error("We couldn't find that game.");
        router.push("/");
      } else {
        console.error("Error getting match info:", error);
      }
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
    if (matchInfo?.match?.player1UserId === userId) {
      return "1";
    }
    if (matchInfo?.playerInfo?.playerId) {
      return matchInfo?.playerInfo?.playerId;
    }
    return "0";
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
