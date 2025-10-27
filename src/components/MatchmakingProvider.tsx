"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ghqFetch } from "@/lib/api";
import { TIME_CONTROLS } from "@/game/constants";
import { playGameReadySound } from "@/game/audio";
import { UsersOnline } from "@/lib/types";
import useServerConnectionStatus from "./useServerConnectionStatus";
import { API_URL } from "@/app/live/config";

interface MatchmakingContextType {
  matchmakingMode: keyof typeof TIME_CONTROLS | null;
  matchmakingRated: boolean;
  startMatchmaking: (mode: keyof typeof TIME_CONTROLS, rated: boolean) => void;
  cancelMatchmaking: () => void;
  usersOnline: UsersOnline | null;
}

const MatchmakingContext = createContext<MatchmakingContextType | undefined>(
  undefined
);

export const useMatchmaking = () => {
  const context = useContext(MatchmakingContext);
  if (!context) {
    throw new Error("useMatchmaking must be used within a MatchmakingProvider");
  }
  return context;
};

interface MatchmakingData {
  match: {
    id: string;
    playerId: string;
    credentials: string;
  };
}

export const MatchmakingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [matchmakingMode, setMatchmakingMode] = useState<
    keyof typeof TIME_CONTROLS | null
  >(null);
  const [rated, setRated] = useState<boolean>(true);
  const { isSignedIn, getToken } = useAuth();
  const [usersOnline, setUsersOnline] = useState<UsersOnline | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<
    boolean | undefined
  >(undefined);
  const router = useRouter();
  useServerConnectionStatus({ isServerConnected });

  const checkMatchmaking = useCallback(async () => {
    try {
      // NB(tyler): support matchmaking for previous engine rated games
      const path = rated ? `${API_URL}/matchmaking` : "/api/matchmaking";
      const data = await ghqFetch<MatchmakingData>({
        url: `${path}?mode=${matchmakingMode}&rated=${rated}`,
        getToken,
        method: "POST",
      });
      if (data.match) {
        if (!rated) {
          router.push(`/game/${data.match.id}`);
        } else {
          router.push(`/live/${data.match.id}`);
        }
        playGameReadySound();
        setMatchmakingMode(null);
      }
    } catch (error) {
      console.error("Error polling matchmaking API:", error);
    }
  }, [router, matchmakingMode, rated]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (matchmakingMode) {
      checkMatchmaking();
      interval = setInterval(() => checkMatchmaking(), 2000); // Poll every 2 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [matchmakingMode, checkMatchmaking]);

  const startMatchmaking = (
    mode: keyof typeof TIME_CONTROLS,
    rated: boolean
  ) => {
    setMatchmakingMode(mode);
    setRated(rated);
  };

  const cancelMatchmaking = () => {
    ghqFetch({
      url: `/api/matchmaking?mode=${matchmakingMode}`,
      getToken,
      method: "DELETE",
    });
    setMatchmakingMode(null);
  };

  // Keep track of online users
  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const fetchOnlineUsers = () => {
      ghqFetch<UsersOnline>({
        url: "/api/users/online",
        getToken,
        method: "GET",
      })
        .then((data) => {
          setIsServerConnected(true);
          setUsersOnline(data);
        })
        .catch(() => {
          setIsServerConnected(false);
        });
    };

    fetchOnlineUsers();
    const interval = setInterval(fetchOnlineUsers, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isSignedIn, getToken]);

  return (
    <MatchmakingContext.Provider
      value={{
        matchmakingRated: rated,
        matchmakingMode,
        startMatchmaking,
        cancelMatchmaking,
        usersOnline,
      }}
    >
      {children}
    </MatchmakingContext.Provider>
  );
};
