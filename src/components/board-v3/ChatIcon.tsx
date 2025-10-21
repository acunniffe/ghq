import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MessageCircleMore } from "lucide-react";

const messages = [
  "👋 Hey",
  "🍀 Good luck!",
  "👏 Nice move!",
  "🤝 GG",
  "🙏 Thanks!",
];

export default function ChatIcon({
  sendChatMessage,
}: {
  sendChatMessage: (message: string) => void;
}) {
  async function sendMessage(message: string) {
    sendChatMessage(message);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="hover:cursor-pointer hover:text-blue-500">
          <MessageCircleMore className="w-6 h-6" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Send a message</DropdownMenuLabel>
        {messages.map((message) => (
          <DropdownMenuItem key={message} onClick={() => sendMessage(message)}>
            {message}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
