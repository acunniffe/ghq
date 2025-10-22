import { colIndexToFile, rowIndexToRank } from "@/game/notation";
import classNames from "classnames";

export default function BoardCoordinateLabels({
  isFlipped,
  colIndex,
  rowIndex,
}: {
  isFlipped: boolean;
  colIndex: number;
  rowIndex: number;
}) {
  const color =
    (rowIndex + colIndex) % 2 === 0 ? "text-gray-50" : "text-gray-400";

  const bottomRank = isFlipped ? 0 : 7;
  const leftColumn = isFlipped ? 7 : 0;
  return (
    <>
      <div
        className={classNames(
          "absolute select-none text-xs font-bold",
          isFlipped ? "bottom-0 right-1" : "top-0 left-1",
          { "rotate-180": isFlipped },
          color
        )}
      >
        {colIndex === leftColumn && rowIndexToRank(rowIndex)}
      </div>
      <div
        className={classNames(
          "absolute select-none text-xs font-bold",
          isFlipped ? "top-0 right-1" : "bottom-0 left-1",
          { "rotate-180": isFlipped },
          color
        )}
      >
        {rowIndex === bottomRank && colIndexToFile(colIndex)}
      </div>
    </>
  );
}
