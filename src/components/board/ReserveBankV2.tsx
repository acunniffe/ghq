import { Player, ReserveFleet, Units } from "@/game/engine";
import ReserveBankButton from "./ReserveBankButton";

export function ReserveBankV2(props: {
  player: Player;
  reserve: ReserveFleet;
  selectable: boolean;
  selectedKind?: keyof ReserveFleet;
  selectReserve: (kind: keyof ReserveFleet) => void;
  squareSize: number;
  hideHQ?: boolean;
}) {
  const kinds = [
    "INFANTRY",
    "ARMORED_INFANTRY",
    "AIRBORNE_INFANTRY",
    "ARTILLERY",
    "ARMORED_ARTILLERY",
    "HEAVY_ARTILLERY",
    "HQ",
  ] as (keyof ReserveFleet)[];

  const reserves = kinds.flatMap((kind) => {
    const count = props.reserve[kind as keyof ReserveFleet];
    if (count === 0) return null;
    if (props.hideHQ && (kind as string) === "HQ") return null;

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
    // Invisible placeholder that keeps the layout the same
    return (
      <div className="opacity-0">
        <ReserveBankButton
          value="INFANTRY"
          imageUrl={`/${
            Units.HQ.imagePathPrefix
          }-${props.player.toLowerCase()}.png`}
          player={props.player}
          selectable={props.selectable}
          onSelect={props.selectReserve}
          squareSize={props.squareSize}
          selected={false}
          count={0}
        />
      </div>
    );
  }

  return <div className="flex flex-1 gap-2">{reserves}</div>;
}
