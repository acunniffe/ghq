import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import classNames from "classnames";

export default function MoveCounter({
  numMoves,
  maxMoves = 3,
  active,
}: {
  numMoves: number | undefined;
  maxMoves?: number;
  active: boolean;
}) {
  const movesLeft = maxMoves - (numMoves ?? 0);

  return (
    <HoverCard>
      <HoverCardTrigger
        className={classNames(
          "px-2 rounded-xl border-2 border-black cursor-default text-xl font-mono",
          active
            ? "bg-yellow-100 border-gray-900 text-gray-900"
            : "bg-gray-100 border-gray-500 text-gray-500",
          active && "animate-glow"
        )}
      >
        {active ? movesLeft : "-"}
      </HoverCardTrigger>
      <HoverCardContent className="flex flex-col text-sm">
        <div>
          You have <strong></strong>
          {movesLeft} moves remaining this turn. Or you can skip.
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
