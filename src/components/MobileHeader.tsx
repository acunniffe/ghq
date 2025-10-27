"use client";

import { ClerkLoaded, ClerkLoading, useAuth, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { getUser } from "@/lib/supabase";
import { useEffect, useState } from "react";
import Link from "next/link";
import { config } from "@/lib/config";
import { ghqFetch } from "@/lib/api";
import Username from "./Username";
import { User } from "@/lib/types";

export default function Header() {
  return (
    <div className="flex justify-between border-b bg-white">
      <Link
        className="text-4xl font-bold text-blue-400 flex gap-1 items-center px-2"
        href="/"
      >
        <Image
          src="/icon.png"
          alt="GHQ"
          width={24}
          height={24}
          className="cursor-pointer"
        />
        <Image src="/ghq-letters.png" alt="GHQ" width={60} height={16} />
      </Link>
      <div className="p-2">{config.useClerk && <AuthSection />}</div>
    </div>
  );
}

function AuthSection() {
  const { user } = useClerk();
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);
  const [userInfo, setUserInfo] = useState<User | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    if (user) {
      getUser(user.id)
        .then(setUserInfo)
        .finally(() => setIsLoadingUserInfo(false));
    }
  }, [user]);

  useEffect(() => {
    // If user info is still loading, don't do anything
    if (isLoadingUserInfo) {
      return;
    }

    // If clerk user is not loaded, don't do anything
    if (!user) {
      return;
    }

    if (
      // If clerk username is set and it's different from the username in the database, update the username.
      (user.username && user.username !== userInfo?.username) ||
      // If the username in the database is null, update it to a random default.
      !userInfo?.username
    ) {
      // NOTE: This also creates the user if they don't exist.
      ghqFetch({
        url: "/api/users/me/username",
        method: "PUT",
        getToken: getToken,
      }).then((data: any) => {
        console.log({
          message: "Updated username",
          data,
        });
        // Don't update this for now, it's causing infinite re-renders, needs a better solution.
        // setUserInfo(data.user);
      });
    }
  }, [user, userInfo, isLoadingUserInfo]);

  return (
    <>
      <ClerkLoading>
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </ClerkLoading>

      <ClerkLoaded>
        <SignedOut>
          <SignInButton mode="modal">
            <div
              id="sign-in-button"
              className="bg-blue-800 hover:bg-blue-900 text-sm font-bold text-white rounded px-2 py-1 cursor-pointer"
            >
              Sign in
            </div>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <div className="flex gap-1">
            {userInfo && (
              <Username
                user={{
                  id: userInfo.id,
                  username: userInfo.username,
                  elo: userInfo.elo,
                  badge: userInfo.badge,
                }}
                includeElo
              />
            )}
            <UserButton />
          </div>
        </SignedIn>
      </ClerkLoaded>
    </>
  );
}
