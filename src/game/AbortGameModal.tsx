"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ghqFetch } from "@/lib/api";
import { useAuth } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export default function AbortGameModal({
  matchId,
  open,
  onClose,
}: {
  matchId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { getToken } = useAuth();
  const router = useRouter();

  const abortGame = useCallback(
    async (matchId: string) => {
      setSubmitting(true);
      try {
        await ghqFetch<any>({
          url: `/api/matches/${matchId}`,
          method: "DELETE",
          getToken,
        });
        onClose();
        router.push("/");
      } catch (error) {
        console.error("Error polling matchmaking API:", error);
      } finally {
        setSubmitting(false);
      }
    },
    [getToken]
  );

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abandon</DialogTitle>
          <div>
            Are you sure you want to abandon this game? If you do this too
            often, it could result in account suspension.
            <div className="flex">
              {submitting ? (
                <div
                  className="bg-red-500 text-white py-2 px-4 text-sm rounded hover:bg-red-600 flex gap-1 items-center mt-2"
                  onClick={() => abortGame(matchId)}
                >
                  <Loader2 className="animate-spin w-4 h-4 mr-1" />
                  Abandoning...
                </div>
              ) : (
                <button
                  className="bg-red-500 text-white py-2 px-4 text-sm rounded hover:bg-red-600 flex gap-1 items-center mt-2"
                  onClick={() => abortGame(matchId)}
                >
                  Yes, I&apos;m sure
                </button>
              )}
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
