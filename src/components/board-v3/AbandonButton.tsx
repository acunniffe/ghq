import AbortGameModal from "@/game/AbortGameModal";
import { useState } from "react";
import { Button } from "../ui/button";

export default function AbandonButton({ matchId }: { matchId: string }) {
  const [openAbortModal, setOpenAbortModal] = useState(false);
  return (
    <>
      <Button
        className="bg-red-500 hover:bg-red-600 flex gap-1 items-center"
        onClick={() => setOpenAbortModal(true)}
      >
        Abandon
      </Button>
      <AbortGameModal
        matchId={matchId}
        open={openAbortModal}
        onClose={() => setOpenAbortModal(false)}
      />
    </>
  );
}
