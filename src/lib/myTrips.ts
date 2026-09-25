// There's no login, so "my trips" is tracked per-browser in localStorage —
// trips this device created or submitted a response for. It won't follow you
// to another device or browser; that's an inherent limit of the no-auth design.
const STORAGE_KEY = "tripster:myTrips";

export interface MyTripEntry {
  tripId: string;
  tripName: string;
  role: "organizer" | "participant";
  savedAt: string;
}

export function getMyTrips(): MyTripEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MyTripEntry[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  } catch {
    return [];
  }
}

export function addMyTrip(entry: Omit<MyTripEntry, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const all = getMyTrips();
    const prior = all.find((t) => t.tripId === entry.tripId);
    // Organizing outranks participating — don't let a later "submit my response" as the
    // organizer downgrade the badge they already earned by creating the trip.
    const role = prior?.role === "organizer" ? "organizer" : entry.role;
    const others = all.filter((t) => t.tripId !== entry.tripId);
    const next: MyTripEntry[] = [...others, { ...entry, role, savedAt: new Date().toISOString() }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can be unavailable (private browsing, quota) — losing the "my trips" list
    // isn't fatal, the trip itself is already saved server-side and reachable by link
  }
}
