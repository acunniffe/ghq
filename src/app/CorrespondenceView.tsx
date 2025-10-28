import { ghqFetch } from "@/lib/api";
import { Loader2, Mail, MailQuestion } from "lucide-react";
import { useEffect, useState } from "react";
import { API_URL } from "./live/config";
import { useAuth } from "@clerk/nextjs";
import { PlayFriendDialog } from "./PlayFriendDialog";
import { Button } from "@/components/ui/button";
import { MatchLink } from "./MatchLink";
import { MatchModel } from "@/lib/types";
import RatedBadge from "@/components/RatedBadge";
import Link from "next/link";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Challenge {
  challenger: {
    id: string;
    username: string;
  };
  target: {
    id: string;
    username: string;
  };
  status: "sent" | "accepted" | "declined";
  fen: string;
  rated: boolean;
  created_at?: string;
}

export default function CorrespondenceView() {
  const { isSignedIn, getToken, userId } = useAuth();
  const [matches, setMatches] = useState<MatchModel[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [sentChallenges, setSentChallenges] = useState<Challenge[]>([]);
  const [receivedChallenges, setReceivedChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const yourTurnCount = matches.filter((match) => match.isYourTurn).length;
  usePageTitle(yourTurnCount > 0 ? yourTurnCount.toString() : "");

  useEffect(() => {
    fetchMatchesAndChallenges();
    const interval = setInterval(fetchMatchesAndChallenges, 60_000);
    return () => clearInterval(interval);
  }, [isSignedIn]);

  async function fetchMatchesAndChallenges() {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    setLoading(true);
    ghqFetch<{ matches: MatchModel[] }>({
      url: `${API_URL}/correspondence/matches`,
      getToken,
      method: "GET",
    })
      .then((data) => {
        const matches = data.matches ?? [];
        setMatches(
          matches
            .filter((m) => m.status === null)
            .sort((a, b) => {
              if (a.isYourTurn !== b.isYourTurn) {
                return a.isYourTurn ? -1 : 1;
              }
              return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
              );
            })
        );
      })
      .finally(() => setLoading(false));

    ghqFetch<{ challenges: Challenge[] }>({
      url: `${API_URL}/correspondence/challenges`,
      getToken,
      method: "GET",
    })
      .then((data) => {
        setChallenges(data.challenges);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setSentChallenges(challenges.filter((c) => c.challenger.id === userId));
    setReceivedChallenges(challenges.filter((c) => c.target.id === userId));
  }, [challenges]);

  async function acceptChallenge(challengerUserId: string) {
    await ghqFetch({
      url: "/api/correspondence/accept",
      getToken,
      method: "POST",
      body: JSON.stringify({ challengerUserId }),
    });

    fetchMatchesAndChallenges();
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <div className="text-lg font-bold flex items-center gap-2">
          Correspondence
        </div>
        <PlayFriendDialog />
      </div>

      {loading && (
        <div>
          <Loader2 className="animate-spin h-4 w-4" />
        </div>
      )}

      {receivedChallenges.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-0.5">
          {receivedChallenges.map((challenge) => (
            <ReceivedChallengeRow
              key={`${challenge.challenger.id}-${challenge.target.id}`}
              challenge={challenge}
              acceptChallenge={acceptChallenge}
            />
          ))}
        </div>
      )}

      {!loading &&
        matches.length === 0 &&
        sentChallenges.length === 0 &&
        receivedChallenges.length === 0 && (
          <div className="text-gray-600 text-sm">
            No games or open challenges found
          </div>
        )}

      {matches.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-0.5">
          {matches.map((game) => (
            <MatchLink key={game.id} game={game} />
          ))}
        </div>
      )}

      {sentChallenges.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {sentChallenges.map((challenge) => (
            <SentChallengeRow
              key={`${challenge.challenger.id}-${challenge.target.id}`}
              challenge={challenge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReceivedChallengeRow({
  challenge,
  acceptChallenge,
}: {
  challenge: any;
  acceptChallenge: (challengerUserId: string) => Promise<void>;
}) {
  const [accepting, setAccepting] = useState<boolean>(false);

  return (
    <div
      key={`${challenge.challenger.id}-${challenge.target.id}`}
      className="p-1 px-2 bg-white/50 border border-white/50 flex justify-between rounded flex-col sm:flex-row text-sm"
    >
      <div className="flex items-center gap-1 px-2">
        <Mail className="h-4 w-4 mr-1" />
        Challenge from{" "}
        <span className="font-bold text-gray-700">
          {challenge.challenger.username}
        </span>
        <RatedBadge rated={challenge.rated} />
        <CustomGameLink challenge={challenge} />
      </div>
      <div className="flex items-center gap-1 justify-end">
        <Button
          variant="outline"
          className="h-7"
          onClick={() => {
            setAccepting(true);
            acceptChallenge(challenge.challenger.id).finally(() =>
              setAccepting(false)
            );
          }}
          disabled={accepting}
        >
          Accept
        </Button>
      </div>
    </div>
  );
}

function SentChallengeRow({ challenge }: { challenge: any }) {
  return (
    <div
      key={`${challenge.challenger.id}-${challenge.target.id}`}
      className="p-1 px-2 bg-white/50 border border-white/50 flex justify-between rounded flex-col sm:flex-row"
    >
      <div className="flex items-center gap-1 px-2 text-sm">
        <MailQuestion className="h-4 w-4 mr-1" />
        Challenged{" "}
        <span className="font-bold text-gray-700">
          {challenge.target.username}
        </span>
        <RatedBadge rated={challenge.rated} />
        <CustomGameLink challenge={challenge} />
      </div>
      <div className="flex items-center text-xs text-gray-600 justify-end">
        Awaiting response...
      </div>
    </div>
  );
}

function CustomGameLink({ challenge }: { challenge: any }) {
  if (!challenge?.fen) {
    return null;
  }

  const url = new URL(window.location.toString());
  url.pathname = "/learn";
  if (challenge?.fen) {
    url.searchParams.set("jfen", challenge.fen);
  }
  const learnUrl = url.toString();

  return (
    <Link
      href={learnUrl}
      className="text-sm text-gray-500 hover:text-gray-700"
      target="_blank"
    >
      Custom Game
    </Link>
  );
}
