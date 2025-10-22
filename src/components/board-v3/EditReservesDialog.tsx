import React, { useState, useEffect } from "react";
import { ReserveFleet, Units } from "@/game/engine";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EditReservesDialogProps {
  redReserve: ReserveFleet;
  blueReserve: ReserveFleet;
  onSave: (redReserve: ReserveFleet, blueReserve: ReserveFleet) => void;
}

export default function EditReservesDialog({
  redReserve,
  blueReserve,
  onSave,
}: EditReservesDialogProps) {
  const [localRedReserve, setLocalRedReserve] =
    useState<ReserveFleet>(redReserve);
  const [localBlueReserve, setLocalBlueReserve] =
    useState<ReserveFleet>(blueReserve);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLocalRedReserve(redReserve);
    setLocalBlueReserve(blueReserve);
  }, [redReserve, blueReserve]);

  const kinds = [
    "INFANTRY",
    "ARMORED_INFANTRY",
    "AIRBORNE_INFANTRY",
    "ARTILLERY",
    "ARMORED_ARTILLERY",
    "HEAVY_ARTILLERY",
  ] as (keyof ReserveFleet)[];

  const handleSave = () => {
    onSave(localRedReserve, localBlueReserve);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Reserves</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Reserves</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-4">
          <div className="font-semibold text-red-600 text-center">Unit</div>
          <div className="font-semibold text-red-600 text-center">Red</div>
          <div className="font-semibold text-blue-600 text-center">Unit</div>
          <div className="font-semibold text-blue-600 text-center">Blue</div>
          {kinds.map((kind) => (
            <React.Fragment key={kind}>
              <div className="flex items-center justify-center gap-2">
                <img
                  src={`/${Units[kind].imagePathPrefix}-red.png`}
                  width={30}
                  height={30}
                  alt={Units[kind].imagePathPrefix}
                  draggable={false}
                />
              </div>
              <Input
                type="number"
                min={0}
                value={localRedReserve[kind]}
                onChange={(e) =>
                  setLocalRedReserve({
                    ...localRedReserve,
                    [kind]: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
              <div className="flex items-center justify-center gap-2">
                <img
                  src={`/${Units[kind].imagePathPrefix}-blue.png`}
                  width={30}
                  height={30}
                  alt={Units[kind].imagePathPrefix}
                  draggable={false}
                />
              </div>
              <Input
                type="number"
                min={0}
                value={localBlueReserve[kind]}
                onChange={(e) =>
                  setLocalBlueReserve({
                    ...localBlueReserve,
                    [kind]: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
              />
            </React.Fragment>
          ))}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
