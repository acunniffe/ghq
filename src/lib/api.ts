import { Turn } from "@/game/engine-v2";

export class GHQAPIError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

interface FetchOptions extends RequestInit {
  getToken: () => Promise<string | null>;
  url: string;
}

export async function ghqFetch<T>({
  url,
  getToken,
  ...options
}: FetchOptions): Promise<T> {
  const token = await getToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new GHQAPIError(response.statusText, response.status);
  }

  return (await response.json()) as T;
}

export interface SendTurnRequest {
  turn: Turn;
  playerId: string;
  credentials: string;
}
