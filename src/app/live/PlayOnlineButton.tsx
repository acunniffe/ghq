"use client";

import Button from "./ButtonV3";
import { useAuth } from "@clerk/nextjs";
import { useMatchmaking } from "@/components/MatchmakingProvider";
import { TIME_CONTROLS } from "@/game/constants";

interface Mode {
  id: string;
  timeControl: keyof typeof TIME_CONTROLS;
  rated: boolean;
}

const allModes: Mode[] = [
  { id: "rapid:rated", timeControl: "rapid", rated: true },
  { id: "blitz:rated", timeControl: "blitz", rated: true },
  { id: "rapid:unrated", timeControl: "rapid", rated: false },
  { id: "endgame:unrated", timeControl: "endgame", rated: false },
  { id: "normandy:unrated", timeControl: "normandy", rated: false },
];

export function PlayOnlineButton({}: {}) {
  const { isSignedIn } = useAuth();
  const { startMatchmaking } = useMatchmaking();

  function openSignInDialog() {
    if (!isSignedIn) {
      const signInButton = document.getElementById("sign-in-button");
      if (signInButton) {
        signInButton.click();
      }
    }
  }

  async function playOnline(modeId: string) {
    if (!isSignedIn) {
      openSignInDialog();
      return;
    }

    const mode = allModes.find((mode) => mode.id === modeId);
    if (!mode) {
      return;
    }

    startMatchmaking(mode.timeControl, mode.rated);
  }

  const options = allModes.map((mode) => ({
    id: mode.id,
    body: (
      <>
        <div className="w-full flex justify-center items-center gap-1 h-6 overflow-clip truncate">
          <div className="font-bold">
            {mode.rated ? "🫅" : "🧩"} {toTitleCase(mode.timeControl)}
          </div>
          <div className="text-xs">•</div>
          <div className="text-xs">{mode.rated ? "Rated" : "Unrated"}</div>
          <div className="text-xs">•</div>
          <div className="text-xs">
            {TIME_CONTROLS[mode.timeControl].time / 60 / 1000}+
            {TIME_CONTROLS[mode.timeControl].bonus / 1000}
          </div>
        </div>
      </>
    ),
  }));

  return (
    <Button options={options} onClick={playOnline} loadingText="Searching..." />
  );
}

function toTitleCase(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
