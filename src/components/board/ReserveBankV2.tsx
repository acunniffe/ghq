import { Player, ReserveFleet, Units } from "@/game/engine";
import { cn } from "@/lib/utils";

export function ReserveBankV2(props: {
  player: Player;
  reserve: ReserveFleet;
  selectable: boolean;
  selectedKind?: keyof ReserveFleet;
  selectReserve: (kind: keyof ReserveFleet) => void;
  squareSize: number;
}) {
  const kinds = [
    "INFANTRY",
    "ARMORED_INFANTRY",
    "AIRBORNE_INFANTRY",
    "ARTILLERY",
    "ARMORED_ARTILLERY",
    "HEAVY_ARTILLERY",
  ] as (keyof ReserveFleet)[];

  const reserves = kinds.flatMap((kind) => {
    const count = props.reserve[kind as keyof ReserveFleet];
    if (count === 0) return null;
    return (
      <div
        onClick={() => {
          if (props.selectable) {
            props.selectReserve(kind);
          }
        }}
        key={kind}
        style={{
          width: props.squareSize * 0.8,
          height: props.squareSize * 0.8,
        }}
        className={cn(
          "col-span-1 select-none flex p-0 flex-col items-center justify-center relative rounded",
          props.player === "RED" ? "text-red-600" : "text-blue-600",
          {
            ["cursor-pointer"]: props.selectable && kind !== props.selectedKind,
          },
          {
            ["hover:bg-gray-200"]:
              props.selectable && props.selectedKind !== kind,
          },
          { ["bg-gray-300"]: props.selectedKind === kind }
        )}
      >
        <img
          src={`/${
            Units[kind].imagePathPrefix
          }-${props.player.toLowerCase()}.png`}
          width={props.squareSize * 0.5}
          height={props.squareSize * 0.5}
          alt={Units[kind].imagePathPrefix}
          draggable={false}
        />
        <div className="absolute top-0 left-0.5 sm:left-1 text-[10px] sm:text-sm">
          {count}
        </div>
      </div>
    );
  });

  if (reserves.every((r) => r === null)) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500"></div>
    );
  }

  return <div className="grid flex-1 grid-cols-6 gap-1">{reserves}</div>;
}
