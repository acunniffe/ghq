import { CircleCheck, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { ghqFetch } from "@/lib/api";
import { API_URL } from "./live/config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import ButtonV2 from "./live/ButtonV2";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  username: string;
  elo: number;
}

export function PlayFriendDialog() {
  const { isSignedIn, getToken, userId } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSelectedUser(null);
    }
  }, [open]);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    setLoading(true);
    ghqFetch<{ users: User[] }>({
      url: `${API_URL}/users`,
      getToken,
      method: "GET",
    })
      .then((data) => {
        const users = (data.users ?? []).filter((user) => user.id !== userId);
        setUsers(users);
      })
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  async function sendChallenge(e: React.MouseEvent<HTMLButtonElement>) {
    if (!isSignedIn || !selectedUser) {
      e.preventDefault();
      return;
    }

    await ghqFetch({
      url: `${API_URL}/correspondence/challenge`,
      getToken,
      method: "POST",
      body: JSON.stringify({ targetUserId: selectedUser.id, rated: true }),
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
  }

  return (
    <Dialog onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ButtonV2 size="sm" onClick={async () => setOpen(true)}>
          🤝 Play Friend
        </ButtonV2>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Play with a friend</DialogTitle>
          <DialogDescription>
            To play with a friend, select their username below and click the
            button to send a challenge.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading && (
            <div className="flex justify-center">
              <Loader2 className="animate-spin h-4 w-4" />
            </div>
          )}
          <div className="flex flex-col gap-1 h-80 overflow-y-auto border rounded-md p-2">
            {users
              .filter((user) =>
                user.username.toLowerCase().includes(search.toLowerCase())
              )
              .map((user) => (
                <div
                  key={user.id}
                  className={cn(
                    "flex justify-between p-2 rounded-md cursor-pointer",
                    selectedUser?.id === user.id
                      ? "bg-gray-200"
                      : "hover:bg-gray-100"
                  )}
                  onClick={() => {
                    setSelectedUser(user);
                  }}
                >
                  <div>{user.username}</div>
                  <div>{user.elo}</div>
                </div>
              ))}
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button
              type="button"
              onClick={sendChallenge}
              disabled={!selectedUser}
            >
              <Send className="h-4 w-4" /> Send challenge
              {selectedUser?.username ? " to " + selectedUser.username : ""}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
