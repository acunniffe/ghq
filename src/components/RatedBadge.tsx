import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Crown, Smile } from "lucide-react";
import { useState } from "react";

export default function RatedBadge({ rated }: { rated: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="focus:outline-none focus:ring-0"
      >
        <span className="text-xs">
          {rated ? (
            <Crown className="text-gray-500 w-3 h-3" />
          ) : (
            <Smile className="text-gray-500 w-3 h-3" />
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent>
        <div className="text-sm">{rated ? "Rated match" : "Unrated match"}</div>
      </PopoverContent>
    </Popover>
  );
}
