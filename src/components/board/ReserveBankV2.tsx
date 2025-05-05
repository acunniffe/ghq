import { Player, ReserveFleet, Units } from "@/game/engine";
import ReserveBankButton from "./ReserveBankButton";

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
    return (
      <ReserveBankButton
        key={kind}
        value={kind}
        imageUrl={`/${
          Units[kind].imagePathPrefix
        }-${props.player.toLowerCase()}.png`}
        player={props.player}
        selectable={props.selectable}
        onSelect={props.selectReserve}
        squareSize={props.squareSize}
        selected={props.selectedKind === kind}
        count={count}
      />
    );
  });

  if (reserves.every((r) => r === null)) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500"></div>
    );
  }

  return <div className="grid flex-1 grid-cols-6 gap-1">{reserves}</div>;
}
