"use client";

import { StatusIndicator } from "@/components/StatusIndicator";
import { UsersOnline } from "@/lib/types";
import Username from "@/components/Username";
import { useAuth } from "@clerk/nextjs";

export default function Players({
  usersOnline,
}: {
  usersOnline: UsersOnline | null;
}) {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="text-gray-600 text-sm">
          Sign in to see online players!
        </div>
      </div>
    );
  }

  if (!usersOnline) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-col">
          <div>No users online</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col">
        {usersOnline.users.map((user) => (
          <div key={user.id} className="rounded flex justify-between">
            <div className="flex flex-row gap-2 items-center">
              <StatusIndicator status={user.status} />
              <Username
                user={{
                  id: user.id,
                  username: user.username,
                  elo: user.elo,
                  badge: user.badge,
                }}
              />
            </div>
            <div className="text-sm">{user.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
