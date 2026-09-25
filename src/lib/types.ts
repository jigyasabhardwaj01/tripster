export type TripStatus = "collecting" | "results_ready" | "confirming" | "final";

export interface Trip {
  id: string;
  name: string;
  organizer_name: string;
  status: TripStatus;
  invitees: string[];
  expected_participant_count: number;
  confirmation_window_hours: number;
  confirmation_deadline: string | null;
  creator_token: string;
  created_at: string;
}

export interface Participant {
  id: string;
  trip_id: string;
  name: string;
  created_at: string;
}

export interface DateRange {
  start: string; // ISO date, e.g. "2026-11-01"
  end: string;
}

export const DESTINATION_TYPES = [
  "beach",
  "hills",
  "city",
  "adventure",
  "heritage",
  "wildlife",
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const DEALBREAKERS = [
  { id: "alcohol_nightlife", label: "Alcohol / nightlife scene" },
  { id: "high_altitude", label: "High altitude / trekking" },
  { id: "long_travel", label: "Long flights / travel time (6h+)" },
  { id: "water_sports", label: "Water sports / swimming required" },
  { id: "crowded_touristy", label: "Crowded, touristy places" },
  { id: "remote_no_connectivity", label: "Remote areas with poor connectivity" },
  { id: "extreme_heat", label: "Extreme heat" },
  { id: "adventure_sports", label: "Extreme/adventure sports" },
] as const;
export type DealbreakerId = (typeof DEALBREAKERS)[number]["id"];

export interface Response {
  id: string;
  trip_id: string;
  participant_id: string;
  max_budget: number;
  date_ranges: DateRange[];
  destination_types: DestinationType[];
  dealbreakers: DealbreakerId[];
  created_at: string;
  updated_at: string;
}

export interface Confirmation {
  id: string;
  trip_id: string;
  participant_id: string;
  destination_id: string;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shortlist {
  trip_id: string;
  destination_ids: string[];
  computed_at: string;
}

// Convenience shape used across the UI: a participant plus their response (if submitted).
export interface ParticipantWithResponse extends Participant {
  response: Response | null;
}
