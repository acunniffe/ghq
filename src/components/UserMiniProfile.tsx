import { User } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ghqFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { UserSummary } from "@/server/user-summary";
import UserBadgeTag from "./UserBadgeTag";

export default function UserMiniProfile({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullUser, setFullUser] = useState<UserSummary | null>(null);
  const { isSignedIn, getToken } = useAuth();

  const fetchFullUser = async () => {
    if (loading || fullUser || !isSignedIn) return;
    setLoading(true);
    try {
      const data = await ghqFetch<{ user: UserSummary }>({
        url: `/api/users/${user.id}`,
        getToken,
        method: "GET",
      });
      setFullUser(data.user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open}>
      <PopoverTrigger
        onMouseEnter={() => {
          setOpen(true);
          fetchFullUser();
        }}
        onMouseLeave={() => setOpen(false)}
        asChild
      >
        {children}
      </PopoverTrigger>
      <PopoverContent>
        {loading ? (
          <div className="flex justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex flex-row gap-2 items-center">
              <div className="font-semibold">{fullUser?.username}</div>
              <UserBadgeTag badge={fullUser?.badge} showTitle />
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <div className="text-sm text-gray-500">Rating</div>
              <div className="text-sm">{fullUser?.elo}</div>
              <div className="text-sm text-gray-500">Games this month</div>
              <div className="text-sm">{fullUser?.gamesThisMonth || 0}</div>
              <div className="text-sm text-gray-500">Total games</div>
              <div className="text-sm">{fullUser?.matchHistory.total || 0}</div>
              <div className="text-sm text-gray-500">W/L/D</div>
              <div className="text-sm">
                {fullUser?.matchHistory.wins || 0} |{" "}
                {fullUser?.matchHistory.losses || 0} |{" "}
                {fullUser?.matchHistory.draws || 0}
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
