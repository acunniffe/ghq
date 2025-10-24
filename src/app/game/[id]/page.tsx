"use client";

import { API_URL } from "@/app/live/config";
import { GHQBoardV3, GHQBoardV3Props } from "@/components/board-v3/boardv3";
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
    if (isSignedIn === undefined) {
      return;
    }

    const getTokenFn = isSignedIn ? getToken : async () => null;

    try {
      const data = await ghqFetch<MatchV3Info>({
        url: `${API_URL}/v3/match/${id}`,
        getToken: getTokenFn,
      });
      return data;
    } catch (error) {
      if (error instanceof GHQAPIError) {
        if (error.status === 404) {
          toast.error("We couldn't find that game.");
          router.push("/");
        } else {
          toast.error("There was a problem fetching the game data.");
          console.error("Error getting match info:", error);
        }
      } else {
        toast.error("There was a problem fetching the game data.");
        console.error("Error getting match info:", error);
      }
    }
  }, [isSignedIn, getToken, id]);

  useEffect(() => {
    fetchMatchInfo().then((data) => setMatchInfo(data));
  }, [fetchMatchInfo]);

  function getTimeControl(matchInfo?: MatchV3Info): TimeControl | undefined {
    if (!matchInfo) {
      return undefined;
    }
    return {
      time: matchInfo.match.timeControlAllowedTime,
      bonus: matchInfo.match.timeControlBonus,
      variant: matchInfo.match.timeControlVariant,
    };
  }

  function getPlayerId(matchInfo?: MatchV3Info) {
    if (matchInfo?.match?.player1UserId === userId) {
      return "1";
    }
    if (matchInfo?.playerInfo?.playerId) {
      return matchInfo?.playerInfo?.playerId;
    }
    return "0";
  }

  function getCredentials(matchInfo?: MatchV3Info) {
    if (!matchInfo?.playerInfo) {
      return "";
    }
    return matchInfo?.playerInfo?.credentials;
  }

  function getGameStartTimeMs(matchInfo?: MatchV3Info) {
    return matchInfo?.match.createdAt
      ? new Date(matchInfo.match.createdAt).getTime()
      : undefined;
  }

  const opts: GHQBoardV3Props | undefined = useMemo(() => {
    if (!matchInfo) {
      return undefined;
    }
    return {
      id: id,
      playerId: getPlayerId(matchInfo),
      credentials: getCredentials(matchInfo),
      timeControl: getTimeControl(matchInfo),
      gameStartTimeMs: getGameStartTimeMs(matchInfo),
      match: matchInfo.match,
    };
  }, [matchInfo]);

  if (!opts) {
    return <GameLoader message="Fetching game data..." />;
  }

  return (
    <div>
      <GHQBoardV3 {...opts} />
    </div>
  );
}
