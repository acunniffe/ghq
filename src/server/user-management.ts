import { User } from "@/lib/types";
import { clerkClient } from "@clerk/nextjs/server";
import { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveMatch {
  id: string;
  playerId: string;
  credentials: string;
}

export async function getActiveMatch(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveMatch | null> {
  const { data, error } = await supabase
    .from("active_user_matches")
    .select("match_id, player_id, credentials")
    .eq("user_id", userId)
    .eq("is_correspondence", false)
    .single();
  if (error) return null;

  return {
    id: data?.match_id || "",
    playerId: data?.player_id,
    credentials: data?.credentials,
  };
}

export async function getOrCreateUser(
  supabase: SupabaseClient,
  userId: string
): Promise<User> {
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, username, elo")
    .eq("id", userId)
    .single();

  if (user) {
    if (
      (clerkUser.username && user.username !== clerkUser.username) ||
      !user.username
    ) {
      const username = clerkUsernameOrRandomDefault(clerkUser.username);
      const { error } = await supabase
        .from("users")
        .update({ username })
        .eq("id", userId);

      if (!error) {
        user.username = username;
      }
    }

    return user;
  }

  if (userError && userError.code === "PGRST116") {
    const newUser = {
      id: userId,
      elo: 1000,
      username: clerkUsernameOrRandomDefault(clerkUser.username),
    };
    const { error: insertError } = await supabase
      .from("users")
      .insert([newUser]);

    if (insertError) throw insertError;
    return newUser;
  } else if (userError) {
    throw userError;
  }

  throw new Error("Unexpected error");
}

function clerkUsernameOrRandomDefault(username?: string | null): string {
  if (username && username.length > 0) {
    return username;
  }

  const adjectives = [
    "Brave",
    "Clever",
    "Dazzling",
    "Energetic",
    "Fierce",
    "Glorious",
    "Happy",
    "Incredible",
    "Jolly",
    "Keen",
    "Luminous",
    "Mighty",
    "Noble",
    "Optimistic",
    "Powerful",
    "Quirky",
    "Radiant",
    "Spectacular",
    "Terrific",
    "Unstoppable",
    "Vibrant",
    "Wonderful",
    "Excellent",
    "Youthful",
    "Zealous",
  ];

  const nouns = [
    "Panda",
    "Tiger",
    "Dragon",
    "Phoenix",
    "Wizard",
    "Knight",
    "Ninja",
    "Pirate",
    "Robot",
    "Astronaut",
    "Dinosaur",
    "Unicorn",
    "Warrior",
    "Explorer",
    "Hero",
    "Falcon",
    "Dolphin",
    "Lion",
    "Wolf",
    "Eagle",
    "Shark",
    "Titan",
    "Champion",
    "Voyager",
    "Ranger",
  ];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 1000);

  return `${adjective}${noun}${number}`;
}
