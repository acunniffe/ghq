import { cn } from "@/lib/utils";
import { Player } from "@/game/engine";

export interface ReserveBankButtonProps<T> {
  player?: Player;
  selectable: boolean;
  value: T;
  onSelect: (kind: T, isMouseDown: boolean) => void;
  selected: boolean;
  squareSize: number;
  count?: number;
  imageUrl: string;
}

export default function ReserveBankButton<T>({
  player,
  selectable,
  onSelect,
  squareSize,
  selected,
  count,
  value,
  imageUrl,
}: ReserveBankButtonProps<T>) {
  return (
    <div
      onClick={() => {
        if (selectable) {
          onSelect(value, false);
        }
      }}
      onMouseDown={() => {
        if (selectable) {
          onSelect(value, true);
        }
      }}
      style={{
        width: squareSize * 0.8,
        height: squareSize * 0.8,
      }}
      className={cn(
        "col-span-1 select-none flex p-0 flex-col items-center justify-center relative rounded",
        player === "RED" && "text-red-600",
        player === "BLUE" && "text-blue-600",
        {
          ["cursor-pointer"]: selectable && !selected,
        },
        {
          ["hover:bg-gray-200"]: selectable && !selected,
        },
        { ["bg-gray-300"]: selected }
      )}
    >
      <img
        src={imageUrl}
        width={squareSize * 0.5}
        height={squareSize * 0.5}
        alt={imageUrl}
        draggable={false}
      />
      <div className="absolute top-0 left-0.5 sm:left-1 text-[10px] sm:text-sm">
        {count !== undefined ? count : ""}
      </div>
    </div>
  );
}
