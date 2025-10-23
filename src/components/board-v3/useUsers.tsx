import { getUsers } from "@/lib/supabase";
import { User } from "@/lib/types";
import { useEffect, useState } from "react";

export function useUsers({ userIds }: { userIds: string[] }) {
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    if (userIds.length !== 2) {
      return;
    }
    getUsers(userIds).then((users) => {
      if (users) {
        setUsers(users);
      }
    });
  }, [userIds]);

  return { users };
}
