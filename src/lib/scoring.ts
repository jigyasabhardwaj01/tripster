// Plain rule-based scoring. No LLM anywhere in this file — see lib/summary.ts
// for the one place an LLM is allowed to turn these numbers into a sentence.
import { Destination, DESTINATIONS } from "./destinations";
import { DateRange, Response } from "./types";

export interface CriterionResult {
  pass: boolean;
  detail: string;
}

export interface ParticipantFit {
  participantId: string;
  participantName: string;
  budget: CriterionResult;
  dates: CriterionResult;
  destinationType: CriterionResult;
  dealbreakers: CriterionResult;
  criteriaPassed: number; // 0-4
}

export interface DestinationScore {
  destination: Destination;
  score: number; // sum of criteriaPassed across participants
  maxScore: number; // participants.length * 4
  participantFits: ParticipantFit[];
}

export interface ParticipantResponse {
  participantId: string;
  participantName: string;
  response: Response;
}

// -- date range helpers, working in integer day-number space --

interface DayInterval {
  startDay: number;
  endDay: number;
}

function toDay(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00Z").getTime() / 86400000);
}

function toRangeIntervals(ranges: DateRange[]): DayInterval[] {
  return ranges
    .map((r) => ({ startDay: toDay(r.start), endDay: toDay(r.end) }))
    .filter((iv) => iv.endDay >= iv.startDay);
}

function intervalLengthDays(iv: DayInterval): number {
  return iv.endDay - iv.startDay + 1;
}

function intersectIntervalSets(a: DayInterval[], b: DayInterval[]): DayInterval[] {
  const out: DayInterval[] = [];
  for (const ivA of a) {
    for (const ivB of b) {
      const startDay = Math.max(ivA.startDay, ivB.startDay);
      const endDay = Math.min(ivA.endDay, ivB.endDay);
      if (startDay <= endDay) out.push({ startDay, endDay });
    }
  }
  return out;
}

/** Intersection of every participant's date ranges (each participant's own ranges are OR'd first). */
function commonAvailability(allRanges: DateRange[][]): DayInterval[] {
  if (allRanges.length === 0) return [];
  let common = toRangeIntervals(allRanges[0]);
  for (let i = 1; i < allRanges.length && common.length > 0; i++) {
    common = intersectIntervalSets(common, toRangeIntervals(allRanges[i]));
  }
  return common;
}

function longestIntervalDays(intervals: DayInterval[]): number {
  return intervals.reduce((max, iv) => Math.max(max, intervalLengthDays(iv)), 0);
}

// -- per-criterion scoring --

function scoreBudget(response: Response, destination: Destination): CriterionResult {
  const pass = response.max_budget >= destination.costPerPerson;
  const diff = Math.abs(response.max_budget - destination.costPerPerson);
  return {
    pass,
    detail: pass
      ? `Within budget (₹${destination.costPerPerson.toLocaleString("en-IN")} of ₹${response.max_budget.toLocaleString("en-IN")})`
      : `Over budget by ₹${diff.toLocaleString("en-IN")}`,
  };
}

function scoreDestinationType(response: Response, destination: Destination): CriterionResult {
  const pass = response.destination_types.includes(destination.type);
  return {
    pass,
    detail: pass
      ? `Matches preferred type (${destination.type})`
      : `Not a preferred type (wanted ${response.destination_types.join(", ") || "none selected"})`,
  };
}

function scoreDealbreakers(response: Response, destination: Destination): CriterionResult {
  const hit = destination.tags.find((tag) => response.dealbreakers.includes(tag));
  return {
    pass: !hit,
    detail: hit ? `Hits a dealbreaker (${hit.replace(/_/g, " ")})` : "No dealbreakers triggered",
  };
}

function scoreDates(
  destination: Destination,
  thisParticipantRanges: DateRange[],
  othersRanges: DateRange[][],
  fullGroupPasses: boolean
): CriterionResult {
  if (fullGroupPasses) {
    return { pass: true, detail: `Fits within the group's overlapping availability` };
  }
  // Would removing this participant let the rest of the group find a long-enough window?
  const withoutThisPerson = commonAvailability(othersRanges);
  const worksWithoutThem = longestIntervalDays(withoutThisPerson) >= destination.typicalLengthDays;
  if (worksWithoutThem) {
    return {
      pass: false,
      detail: `Your available dates don't overlap enough with the group for a ${destination.typicalLengthDays}-day trip`,
    };
  }
  return {
    pass: false,
    detail: `Group doesn't have a shared ${destination.typicalLengthDays}-day window yet`,
  };
}

export function scoreDestination(
  destination: Destination,
  participants: ParticipantResponse[]
): DestinationScore {
  const allRanges = participants.map((p) => p.response.date_ranges);
  const fullCommon = commonAvailability(allRanges);
  const fullGroupPasses = longestIntervalDays(fullCommon) >= destination.typicalLengthDays;

  const participantFits: ParticipantFit[] = participants.map((p, idx) => {
    const budget = scoreBudget(p.response, destination);
    const destinationType = scoreDestinationType(p.response, destination);
    const dealbreakers = scoreDealbreakers(p.response, destination);
    const othersRanges = allRanges.filter((_, i) => i !== idx);
    const dates = scoreDates(destination, p.response.date_ranges, othersRanges, fullGroupPasses);

    const criteriaPassed = [budget, dates, destinationType, dealbreakers].filter((c) => c.pass).length;

    return {
      participantId: p.participantId,
      participantName: p.participantName,
      budget,
      dates,
      destinationType,
      dealbreakers,
      criteriaPassed,
    };
  });

  const score = participantFits.reduce((sum, f) => sum + f.criteriaPassed, 0);
  const maxScore = participants.length * 4;

  return { destination, score, maxScore, participantFits };
}

/** Scores every candidate destination and returns the top N by score, descending. */
export function computeShortlist(
  participants: ParticipantResponse[],
  topN = 3
): DestinationScore[] {
  const scored = DESTINATIONS.map((d) => scoreDestination(d, participants));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
