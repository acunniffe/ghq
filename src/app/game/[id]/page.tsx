"use client";

import { API_URL } from "@/app/live/config";
import { GHQBoardV3 } from "@/components/board-v3/boardv3";
import { ghqFetch } from "@/lib/api";
import { MatchV3Info } from "@/lib/types";
import { useAuth } from "@clerk/nextjs";
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

  return (
    <div>
      <GHQBoardV3
        playerId={matchInfo?.playerInfo?.playerId}
        id={id}
        credentials={matchInfo?.playerInfo?.credentials}
      />
    </div>
  );
}
