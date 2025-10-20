"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMatchmaking } from "./MatchmakingProvider";
import { Button } from "./ui/button";
import { Circle, Maximize2, Minimize2 } from "lucide-react";
import { TIME_CONTROLS } from "@/game/constants";

export default function MatchmakingToast() {
  const { matchmakingMode, matchmakingRated, cancelMatchmaking } =
    useMatchmaking();
  const [toastId, setToastId] = useState<string | number | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    let toastId: string | number | null = null;

    setTimeout(() => {
      if (!matchmakingMode) {
        return;
      }

      toastId = toast(
        <ToastContent
          matchmakingMode={matchmakingMode}
          matchmakingRated={matchmakingRated}
          cancelMatchmaking={cancelMatchmaking}
          onMinimize={() => setIsMinimized(true)}
        />,
        {
          duration: Infinity,
          position: "bottom-left",
          onDismiss: cancelMatchmaking,
        }
      );
      setToastId(toastId);
    });

    return () => {
      if (toastId) {
        setToastId(null);
        toast.dismiss(toastId);
      }
    };
  }, [matchmakingMode, matchmakingRated]);

  useEffect(() => {
    if (!toastId) {
      return;
    }

    if (isMinimized) {
      toast(
        <ToastContentMinimized onMaximize={() => setIsMinimized(false)} />,
        {
          id: toastId,
          duration: Infinity,
          position: "bottom-left",
          onDismiss: cancelMatchmaking,
        }
      );
    } else {
      toast(
        <ToastContent
          matchmakingMode={matchmakingMode}
          matchmakingRated={matchmakingRated}
          cancelMatchmaking={cancelMatchmaking}
          onMinimize={() => setIsMinimized(true)}
        />,
        {
          id: toastId,
          duration: Infinity,
          position: "bottom-left",
          onDismiss: cancelMatchmaking,
        }
      );
    }
  }, [isMinimized]);

  return null;
}
function ToastContent({
  matchmakingMode,
  matchmakingRated,
  cancelMatchmaking,
  onMinimize,
}: {
  matchmakingMode: keyof typeof TIME_CONTROLS | null;
  matchmakingRated: boolean;
  cancelMatchmaking: () => void;
  onMinimize: () => void;
}) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="flex gap-1 items-center text-blue-800 animate-pulse">
          <Circle className="w-4 h-4 fill-blue-800 text-blue-800" />
          Searching for match
        </div>
        <Button variant="outline" className="h-6 w-6" onClick={onMinimize}>
          <Minimize2 />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <div>
          We&apos;re finding someone suitable for you to play{" "}
          <strong>
            {matchmakingMode} {matchmakingRated ? "(rated)" : "(unrated)"}
          </strong>
          . This may take a moment.
        </div>
        <div>Feel free to play a bot or review lessons while you wait!</div>
      </div>

      <div className="flex gap-1 justify-between">
        <Button className="h-6" onClick={cancelMatchmaking}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ToastContentMinimized({ onMaximize }: { onMaximize: () => void }) {
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <div className="flex gap-1 items-center text-blue-800 animate-pulse">
          <Circle className="w-4 h-4 fill-blue-800 text-blue-800" />
          Searching for match
        </div>
        <Button variant="outline" className="h-6 w-6" onClick={onMaximize}>
          <Maximize2 />
        </Button>
      </div>
    </div>
  );
}
