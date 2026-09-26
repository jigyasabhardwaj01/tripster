// Mirrors lib/myTrips.ts for the new sessions system: no login, so "my
// sessions" and "my own submitted values" are tracked in this browser's
// localStorage only.
const SESSIONS_KEY = "tripster:mySessions";

export interface MySessionEntry {
  sessionId: string;
  title: string;
  savedAt: string;
}

export function getMySessions(): MySessionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MySessionEntry[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  } catch {
    return [];
  }
}

export function addMySession(entry: Omit<MySessionEntry, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const others = getMySessions().filter((s) => s.sessionId !== entry.sessionId);
    const next = [...others, { ...entry, savedAt: new Date().toISOString() }];
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable — losing "my sessions" isn't fatal, the session
    // itself is already saved server-side and reachable by link
  }
}

const NAME_KEY = (sessionId: string) => `tripster:session:${sessionId}:name`;

export function getMyName(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NAME_KEY(sessionId));
  } catch {
    return null;
  }
}

export function storeMyName(sessionId: string, name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAME_KEY(sessionId), name);
  } catch {
    // non-fatal — see getMySessions above
  }
}
