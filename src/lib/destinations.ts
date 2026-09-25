import { DealbreakerId, DestinationType } from "./types";

export interface Destination {
  id: string;
  name: string;
  region: string;
  type: DestinationType;
  costPerPerson: number; // INR, all-in estimate for the typical trip length
  typicalLengthDays: number;
  tags: DealbreakerId[]; // dealbreaker categories this destination triggers
}

// Fixed candidate list the matching step scores against. Intentionally hardcoded —
// the point is a small, known, comparable set, not an open-ended search.
export const DESTINATIONS: Destination[] = [
  { id: "goa", name: "Goa", region: "West India", type: "beach", costPerPerson: 15000, typicalLengthDays: 4, tags: ["alcohol_nightlife", "water_sports", "crowded_touristy"] },
  { id: "gokarna", name: "Gokarna", region: "Karnataka", type: "beach", costPerPerson: 10000, typicalLengthDays: 4, tags: ["water_sports"] },
  { id: "andaman", name: "Andaman Islands", region: "Andaman & Nicobar", type: "beach", costPerPerson: 35000, typicalLengthDays: 6, tags: ["long_travel", "water_sports", "remote_no_connectivity"] },
  { id: "manali", name: "Manali", region: "Himachal Pradesh", type: "hills", costPerPerson: 14000, typicalLengthDays: 5, tags: ["high_altitude", "crowded_touristy"] },
  { id: "shimla", name: "Shimla", region: "Himachal Pradesh", type: "hills", costPerPerson: 12000, typicalLengthDays: 4, tags: ["crowded_touristy"] },
  { id: "coorg", name: "Coorg", region: "Karnataka", type: "hills", costPerPerson: 11000, typicalLengthDays: 4, tags: [] },
  { id: "munnar", name: "Munnar", region: "Kerala", type: "hills", costPerPerson: 13000, typicalLengthDays: 4, tags: [] },
  { id: "darjeeling", name: "Darjeeling", region: "West Bengal", type: "hills", costPerPerson: 16000, typicalLengthDays: 5, tags: ["long_travel", "high_altitude"] },
  { id: "leh_ladakh", name: "Leh-Ladakh", region: "Ladakh", type: "adventure", costPerPerson: 32000, typicalLengthDays: 7, tags: ["high_altitude", "long_travel", "remote_no_connectivity", "adventure_sports"] },
  { id: "rishikesh", name: "Rishikesh", region: "Uttarakhand", type: "adventure", costPerPerson: 12000, typicalLengthDays: 3, tags: ["water_sports", "adventure_sports"] },
  { id: "spiti_valley", name: "Spiti Valley", region: "Himachal Pradesh", type: "adventure", costPerPerson: 24000, typicalLengthDays: 6, tags: ["high_altitude", "remote_no_connectivity", "adventure_sports"] },
  { id: "auli", name: "Auli", region: "Uttarakhand", type: "adventure", costPerPerson: 18000, typicalLengthDays: 4, tags: ["high_altitude", "adventure_sports"] },
  { id: "jaipur", name: "Jaipur", region: "Rajasthan", type: "city", costPerPerson: 13000, typicalLengthDays: 3, tags: ["crowded_touristy", "extreme_heat"] },
  { id: "udaipur", name: "Udaipur", region: "Rajasthan", type: "city", costPerPerson: 16000, typicalLengthDays: 3, tags: ["extreme_heat"] },
  { id: "mumbai", name: "Mumbai", region: "Maharashtra", type: "city", costPerPerson: 18000, typicalLengthDays: 3, tags: ["crowded_touristy", "alcohol_nightlife"] },
  { id: "pondicherry", name: "Pondicherry", region: "Tamil Nadu", type: "city", costPerPerson: 12000, typicalLengthDays: 3, tags: [] },
  { id: "jaisalmer", name: "Jaisalmer", region: "Rajasthan", type: "heritage", costPerPerson: 15000, typicalLengthDays: 3, tags: ["extreme_heat", "remote_no_connectivity"] },
  { id: "hampi", name: "Hampi", region: "Karnataka", type: "heritage", costPerPerson: 9000, typicalLengthDays: 3, tags: ["extreme_heat"] },
  { id: "varanasi", name: "Varanasi", region: "Uttar Pradesh", type: "heritage", costPerPerson: 10000, typicalLengthDays: 3, tags: ["crowded_touristy"] },
  { id: "jim_corbett", name: "Jim Corbett", region: "Uttarakhand", type: "wildlife", costPerPerson: 14000, typicalLengthDays: 3, tags: [] },
  { id: "kaziranga", name: "Kaziranga", region: "Assam", type: "wildlife", costPerPerson: 20000, typicalLengthDays: 4, tags: ["long_travel", "remote_no_connectivity"] },
];

export function getDestination(id: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.id === id);
}
