import { ChatMessage } from "boardgame.io";
import { useState } from "react";
import { useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Player } from "@/game/engine";

export default function LatestChatMessage({
  player,
  chatMessages,
}: {
  player: Player;
  chatMessages: ChatMessage[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      chatMessages.length > 0 &&
      chatMessages[chatMessages.length - 1].sender === playerToNumber(player)
    ) {
      setMessage(chatMessages[chatMessages.length - 1].payload.message);
      setIsOpen(true);
      const timer = setTimeout(() => {
        setIsOpen(false);
        setMessage(null);
      }, 3_000);
      return () => clearTimeout(timer);
    }
  }, [chatMessages]);

  return (
    <Popover open={isOpen}>
      <PopoverTrigger></PopoverTrigger>
      <PopoverContent onClick={() => setIsOpen(false)}>
        {message}
      </PopoverContent>
    </Popover>
  );
}

function playerToNumber(player: Player): string {
  return player === "RED" ? "0" : "1";
}
