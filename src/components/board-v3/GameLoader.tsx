import { Loader2 } from "lucide-react";

export default function GameLoader({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <div className="text-lg font-bold text-blue-500">{message}</div>
      <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
    </div>
  );
}
