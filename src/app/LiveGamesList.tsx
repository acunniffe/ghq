"use client";

import { API_URL } from "./live/config";
import { ghqFetch } from "@/lib/api";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MatchLink } from "./MatchLink";
import { MatchModel } from "@/lib/types";

export default function LiveGamesList() {
  const { isSignedIn, getToken, userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<MatchModel[]>([]);
  const [page, setPage] = useState(0);
  const [pageGames, setPageGames] = useState<MatchModel[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>("");

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    setLoading(true);

    ghqFetch<{ matches: MatchModel[] }>({
      url: `${API_URL}/matches?userId=${filterUserId}`,
      getToken,
      method: "GET",
    })
      .then((data) => {
        setGames(data.matches ?? []);
        setPage(0);
      })
      .finally(() => setLoading(false));
  }, [isSignedIn, filterUserId]);

  useEffect(() => {
    const start = page * 10;
    const end = start + 10;
    setPageGames(games.slice(start, end));
  }, [page, games]);

  return (
    <div className="flex flex-col gap-2">
      <div className="font-bold text-lg flex items-center gap-2 justify-between">
        Recent games
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-gray-500"
          onClick={() =>
            filterUserId ? setFilterUserId("") : setFilterUserId(userId ?? "")
          }
        >
          {filterUserId ? "My games" : "All games"}
        </Button>
      </div>

      {!loading && games.length === 0 && (
        <div className="text-gray-600">
          {isSignedIn ? "No games found" : "Sign in to see recent games!"}
        </div>
      )}
      {loading && (
        <div className="flex flex-col gap-2">
          <div className="py-2 px-3 bg-gray-300 animate-pulse border border-gray-200 rounded-lg h-20"></div>
          <div className="py-2 px-3 bg-gray-300 animate-pulse border border-gray-200 rounded-lg h-20"></div>
          <div className="py-2 px-3 bg-gray-300 animate-pulse border border-gray-200 rounded-lg h-20"></div>
        </div>
      )}

      <div className="flex flex-col">
        {pageGames.map((game: MatchModel) => (
          <MatchLink key={game.id} game={game} />
        ))}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => page > 0 && setPage(page - 1)}
          disabled={page === 0}
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage(page + 1)}
          disabled={page >= Math.ceil(games.length / 10) - 1}
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
