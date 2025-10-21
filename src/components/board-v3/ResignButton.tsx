import { Flag, Undo } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";

export default function ResignButton({ resign }: { resign: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <div className="flex gap-1">
        <Button
          onClick={() => setConfirm(false)}
          className="bg-gray-500 hover:bg-gray-400 flex gap-1 items-center"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          onClick={resign}
          className="bg-red-500 hover:bg-red-600 flex gap-1 items-center"
        >
          <Flag className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  return (
    <Button
      onClick={() => setConfirm(true)}
      className="bg-red-500 hover:bg-red-600 flex gap-1 items-center"
    >
      <Flag className="w-4 h-4" />
      Resign
    </Button>
  );
}
