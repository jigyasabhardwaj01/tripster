// Pure, no-network localStorage helpers for organizer identification. Split
// out of tripLifecycle.ts so this logic is testable without pulling in the
// Supabase client (which throws at import time without env vars configured).
import { Trip } from "./types";

const CREATOR_TOKEN_PREFIX = "tripster:creatorToken:";

export function storeCreatorToken(tripId: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${CREATOR_TOKEN_PREFIX}${tripId}`, token);
  } catch {
    // localStorage can be unavailable (private browsing, quota) — the organizer just won't
    // see organizer-only controls on this browser; the trip itself is unaffected
  }
}

export function isTripCreator(tripId: string, trip: Trip): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${CREATOR_TOKEN_PREFIX}${tripId}`) === trip.creator_token;
  } catch {
    return false;
  }
}
