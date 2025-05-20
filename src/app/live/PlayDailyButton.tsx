"use client";

import Button from "./ButtonV2";
import { useAuth } from "@clerk/nextjs";
import { ghqFetch } from "@/lib/api";
import { API_URL } from "./config";
import { User } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Button as UIButton } from "@/components/ui/button";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { CircleCheck } from "lucide-react";
import Username from "@/components/Username";

export function PlayDailyButton() {
  const { isSignedIn, getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  function openSignInDialog() {
    if (!isSignedIn) {
      const signInButton = document.getElementById("sign-in-button");
      if (signInButton) {
        signInButton.click();
      }
    }
  }

  async function openPlayDailyDialog() {
    if (!isSignedIn) {
      openSignInDialog();
      return;
    }

    const { user } = await ghqFetch<{ user: User }>({
      url: `${API_URL}/correspondence/random-user`,
      getToken,
      method: "GET",
    });
    setSelectedUser(user);
    setOpen(true);
  }

  async function sendChallenge() {
    if (!isSignedIn || !selectedUser) return;

    await ghqFetch({
      url: `${API_URL}/correspondence/challenge`,
      getToken,
      method: "POST",
      body: JSON.stringify({
        targetUserId: selectedUser.id,
        rated: true,
        fen: "",
      }),
    });

    toast(
      <div className="flex items-center gap-2">
        <CircleCheck className="h-4 w-4" />
        <div>Challenge sent to {selectedUser.username}!</div>
      </div>,
      {
        description: `Challenge sent to ${selectedUser.username}!`,
      }
    );
    setOpen(false);
  }

  return (
    <>
      <Button onClick={openPlayDailyDialog} loadingText="Searching...">
        🌎 Play Daily
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Play Daily</DialogTitle>
            <DialogDescription>
              Start a match with a random user, without a time limit.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="flex justify-between p-2 px-4 rounded-md border items-center">
              <Username user={selectedUser} />
              <div className="text-sm">
                {selectedUser.gamesThisMonth} games this month
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-start">
            <UIButton type="button" onClick={sendChallenge}>
              <Send className="h-4 w-4" /> Send challenge
            </UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
